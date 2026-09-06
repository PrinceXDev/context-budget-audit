#!/usr/bin/env -S rote play run
/**
 * @rote-frontmatter
 * ---
 * name: gitlab-pipeline-triage
 * description: |-
 *   Your GitLab pipeline is red. Which job actually failed, is it your change or was
 *   it already broken, and does it even block the merge?
 *
 *   TRY IT IN ONE LINE - no arguments, no token, no setup:
 *
 *       rote play run princepanchani/gitlab-pipeline-triage
 *
 *   That triages a real public MR whose pipeline really is failing. Then point it
 *   at your own, or at self-hosted GitLab with gitlab_host:
 *
 *       rote play run princepanchani/gitlab-pipeline-triage \
 *           project=your-group/your-repo mr=123
 *
 *   WHY "THE PIPELINE FAILED" IS NOT ONE SENTENCE
 *
 *   It is four, and they belong to different people:
 *
 *     ALLOWED       A job marked allow_failure turns the pipeline red and blocks
 *                   nothing. Teams stop trusting red pipelines because nobody
 *                   separates these out.
 *     INFRA         failure_reason=runner_system_failure or stuck_or_timeout is a
 *                   runner that died, not code that broke. A retry may clear it;
 *                   reading the diff never will.
 *     PRE-EXISTING  A job that ALSO fails at this branch's MERGE BASE was broken
 *                   before a line changed, so it is not this author's move.
 *     YOURS         What is left. This play names it.
 *
 *   WHAT YOU GET
 *
 *     VERDICT     BLOCKED_BY_PIPELINE, ADVISORY_ONLY, PIPELINE_GREEN,
 *                 PIPELINE_PENDING, NO_PIPELINE, NOT_OPEN or UNAVAILABLE.
 *     PER JOB     Name, stage, whether it blocks, category, evidence.
 *     FIX ORDER   Cheapest first: retries, then what this change broke, then
 *                 what was already broken and is not yours.
 *     WHOSE MOVE  One name.
 *
 *   HOW IT REFUSES TO LIE TO YOU
 *
 *     - 74 self-check cases run BEFORE any live data is judged; if one fails the
 *       triage is withheld. Half are negative assertions - things the logic must
 *       refuse to say, such as calling an unknown failure_reason infrastructure.
 *     - The baseline is the pipeline at the MERGE BASE, so "already broken" is
 *       provable rather than assumed. If only a branch-tip pipeline exists and it
 *       ran LATER than this one, the job is reported as failing on both with the
 *       cause unproven - not blamed on whoever touched the target. If no baseline
 *       can be read, nothing is attributed.
 *     - Job logs are never read: every judgement comes from GitLab's own
 *       structured fields, not unbounded author-controlled text.
 *
 *   COMPANION PLAYS. For whether the MR can merge at all use
 *   princepanchani/gitlab-mr-gate; to sweep every open MR, gitlab-mr-queue.
 *
 *   READ ONLY - nothing is retried, cancelled, approved or merged. Needs only
 *   python3. No credentials on public projects; a private or self-hosted project
 *   uses your own GITLAB_TOKEN from the environment, sent as a header.
 *
 *   KNOWN LIMITS: job-level triage needs the jobs endpoint, which some instances
 *   gate behind auth even for public projects; the play then reports UNAVAILABLE
 *   rather than guessing. A running pipeline is PIPELINE_PENDING, never a failure.
 *   Only the newest pipeline is triaged.
 * version: 1.2.0
 * source_url: https://github.com/PrinceXDev/context-budget-audit
 * provenance:
 *   author: Prince Panchani (github.com/PrinceXDev)
 *   workspace: gitlab-mr-gate
 * metadata:
 *   version: 1.2.0
 *   rote_version: 0.80.0
 *   status: released
 *   kind: atomic
 *   flow_type: parallel
 *   execution_model: steps_with_presentation
 *   requires_sessions: false
 * tags:
 * - domain-code-review
 * - job-ci-triage
 * - platform-gitlab
 * - audience-developers
 * - effect-read-only
 * - tool-shell
 * discoverability:
 *   tags:
 *   - domain-code-review
 *   - job-ci-triage
 *   - platform-gitlab
 *   - audience-developers
 *   - effect-read-only
 *   - tool-shell
 * output:
 *   schema:
 *     type: object
 *     properties:
 *       verdict:
 *         type: string
 *       summary:
 *         type: string
 *       headline:
 *         type: string
 *       whose_move:
 *         type: string
 *       blocking:
 *         type: array
 *       advisory:
 *         type: array
 *       fix_order:
 *         type: array
 *       unknowns:
 *         type: array
 *       stages:
 *         type: array
 *       facts:
 *         type: object
 *       self_check:
 *         type: object
 * parameters:
 * - name: project
 *   param_type: string
 *   required: false
 *   default: gitlab-org/cli
 *   description: GitLab project path or numeric id. Left alone it runs the built-in
 *     demo against a real public merge request whose pipeline is genuinely failing,
 *     so you can see a triage before deciding whether to point this at one of yours.
 *   example: gitlab-org/cli
 * - name: mr
 *   param_type: string
 *   required: false
 *   default: '3093'
 *   description: Merge request iid, the number shown in the merge request URL. Part
 *     of the built-in demo when left alone; set it together with project.
 *   example: '3093'
 * - name: gitlab_host
 *   param_type: string
 *   required: false
 *   default: gitlab.com
 *   description: GitLab hostname; set this for a self-hosted instance
 *   example: gitlab.com
 * - name: timeout_s
 *   param_type: integer
 *   required: false
 *   default: '25'
 *   description: Per request HTTP timeout in seconds, clamped to 1-120
 *   example: '25'
 * steps:
 *   self_check:
 *     type: process.exec
 *     timeout_ms: 90000
 *     argv:
 *     - python3
 *     - '@resource{selfcheck.py}'
 *     - '@resource{triage.py}'
 *   validate_input:
 *     type: process.exec
 *     timeout_ms: 15000
 *     argv:
 *     - python3
 *     - '@resource{validate.py}'
 *     - $project
 *     - $mr
 *     - $gitlab_host
 *   fetch_mr:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - validate_input
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - mr
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - $timeout_s
 *   fetch_pipelines:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - validate_input
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - mr_pipelines
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - $timeout_s
 *   fetch_jobs:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - fetch_pipelines
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - jobs
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .pipeline_id}'
 *     - $timeout_s
 *   fetch_base_pipeline:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - fetch_mr
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - base_pipeline
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .base_sha}'
 *     - $timeout_s
 *     - '@fetch_mr{$.stdout.text | fromjson | .target_branch}'
 *   fetch_base_jobs:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - fetch_base_pipeline
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - jobs
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_id}'
 *     - $timeout_s
 *   compute_triage:
 *     type: process.exec
 *     timeout_ms: 30000
 *     depends_on:
 *     - self_check
 *     - fetch_mr
 *     - fetch_pipelines
 *     - fetch_jobs
 *     - fetch_base_pipeline
 *     - fetch_base_jobs
 *     argv:
 *     - python3
 *     - '@resource{triage.py}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .state}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .web_url}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .author}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .target_branch}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .title_display_only}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .pipeline_id}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .pipeline_status}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .pipeline_web_url}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .pipeline_count}'
 *     - '@fetch_jobs{$.stdout.text | fromjson | .jobs_csv}'
 *     - '@fetch_jobs{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_id}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_status}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_web_url}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_base_jobs{$.stdout.text | fromjson | .jobs_csv}'
 *     - '@fetch_base_jobs{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_route}'
 *     - '@fetch_jobs{$.stdout.text | fromjson | .jobs_truncated}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_final}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .pipeline_created_at}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_pipeline_created_at}'
 *     - '@fetch_base_pipeline{$.stdout.text | fromjson | .base_at_merge_base}'
 * ---
 */

const presentationSdk = await import("__ROTE_PRESENTATION_SDK__").catch((cause) => {
  throw new Error("presentation SDK unavailable: " + String(cause));
});
// stepName comes from the SDK rather than being defined here: lint verifies
// every literal stepName("...") against the declared `steps:`, and a local
// wrapper defeats that check.
const { FlowOutput, loadPresentationContext, stepName } = presentationSdk;

const out = new FlowOutput();
const ctx = await loadPresentationContext();

/** Read one step's stdout as JSON, distinguishing the ways it can be unusable.
 *
 * truncated === true is checked BEFORE any JSON.parse is attempted. rote sets
 * that flag when a step's captured stdout hit the capture cap, and a partial
 * payload that happens to still parse must never be read as a clean result. */
function readStep(step) {
  const outcome = step?.outcome;
  if (outcome?.status !== "completed" && outcome?.status !== "restored") {
    return { kind: "absent" };
  }
  const stdout = outcome?.output?.body?.stdout;
  if (!stdout) return { kind: "absent" };
  if (stdout.truncated === true) return { kind: "truncated" };
  const text = stdout.text ?? "";
  if (typeof text !== "string" || !text.trim()) return { kind: "absent" };
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? { kind: "ok", data } : { kind: "unparseable" };
  } catch {
    return { kind: "unparseable" };
  }
}

// These MUST stay equal to the `default:` values declared for the project and mr
// parameters in the frontmatter above. They exist only so the report can say out
// loud when nobody chose a merge request, and the run is the built-in demo.
const DEMO_PROJECT = "gitlab-org/cli";
const DEMO_MR = 3093;

/** Wrap one long sentence to the report's column width.
 * Job names, stage names and usernames are all live data of unpredictable
 * length, so nothing built from them can be hand-fitted to a terminal. */
function wrapLine(text, width, indent) {
  const words = String(text ?? "").split(" ").filter(Boolean);
  const wrapped = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > width) {
      wrapped.push(indent + line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) wrapped.push(indent + line);
  return wrapped.length ? wrapped : [indent];
}

/** Push a label plus wrapped body, hanging-indented under the label.
 *
 * The first line is wrapped to what is left beside the label, continuations to
 * what is left beside the indent. Using one width for both makes continuation
 * lines break far short of the margin and the paragraph look ragged. */
function pushWrapped(lines, head, body, indent) {
  const text = String(body ?? "");
  const first = wrapLine(text, Math.max(12, 78 - head.length), "");
  lines.push(head + first[0]);
  const rest = text.slice(first[0].length).trim();
  if (!rest) return;
  for (const l of wrapLine(rest, Math.max(12, 78 - indent.length), indent)) {
    lines.push(l);
  }
}

// The fetch steps report why a dimension could not be measured as a short
// machine code. A code is the right thing to carry between steps and the wrong
// thing to show a reader. Anything unrecognised passes straight through,
// because some reasons already arrive as full prose from the triage step.
const REASON_TEXT = {
  absent: "this GitLab instance has no such endpoint for this merge request",
  auth_required: "needs a GITLAB_TOKEN with read_api scope",
  auth_rejected:
    "the supplied token was refused: it may be expired, lack read_api scope, " +
    "or not have access to this project",
  rate_limited: "GitLab is rate limiting these requests; re-run later",
  server_error: "GitLab returned a server error",
  http_error: "GitLab returned an unexpected HTTP status",
  timeout: "GitLab did not respond before the timeout",
  unreachable: "the GitLab host could not be reached",
  bad_payload: "GitLab returned a body that is not JSON",
};

function reasonText(reason) {
  const key = String(reason ?? "").trim();
  if (!key) return "no reason given";
  return REASON_TEXT[key] ?? key;
}

// How each classification is introduced in the report. The label is what the
// reader scans; the evidence line underneath is what justifies it.
const CLASS_LABEL = {
  introduced: "caused by this change",
  pre_existing: "already broken on the target branch",
  infrastructure: "infrastructure, not code",
  upstream: "upstream pipeline configuration",
  new_job: "no baseline to compare against",
  also_failing_on_target: "also failing on the target branch, cause unproven",
  unverifiable: "cannot be attributed",
};

const triageRead = readStep(ctx.step(stepName("compute_triage")));
const selfCheckRead = readStep(ctx.step(stepName("self_check")));
const validateRead = readStep(ctx.step(stepName("validate_input")));

if (triageRead.kind !== "ok") {
  const why = {
    absent: "the triage step did not complete, so no pipeline was triaged",
    truncated: "the triage step output exceeded the capture cap and cannot be trusted",
    unparseable: "the triage step output was not readable JSON",
  }[triageRead.kind] ?? "the triage step output could not be read";

  // "the triage step did not complete" is true and useless. The reason the run
  // stopped is almost always a wrong project path or a private project, and the
  // fetch step already wrote a precise sentence about it to stderr - which
  // otherwise appears only in the runner's raw error line, below the report the
  // reader is looking at. A FAILED step exposes it as output.diagnostic.stderr;
  // a completed one uses the body shape.
  // Validation runs FIRST, and when it rejects the input the fetch step never
  // runs - so reading only the fetch step's stderr loses the validator's
  // specific message ("mr must be a positive integer iid, got 'abc'") and
  // leaves the reader with nothing but "the step did not complete".
  const stderrOf = (st) => String(
    st?.outcome?.output?.diagnostic?.stderr ??
    st?.outcome?.output?.body?.stderr?.text ??
    "",
  );
  const causeText = (
    stderrOf(ctx.step(stepName("validate_input"))) ||
    stderrOf(ctx.step(stepName("fetch_mr")))
  ).replace(/^gitlab-pipeline-triage:\s*/gm, "").trim();

  out.human(
    [
      "GITLAB PIPELINE TRIAGE",
      "",
      "VERDICT: UNAVAILABLE",
      "",
      "  " + why + ".",
      ...(causeText ? ["", "WHY", ...wrapLine(causeText.split("\n")[0], 74, "  ")] : []),
      "",
      "This is not a passing result. Re-run, or continue from the steps that did",
      "complete with `rote play run ... --resume <run_id>`.",
      "",
    ].join("\n"),
  );
  out.summary("UNAVAILABLE - " + why);
  out.result({
    verdict: "UNAVAILABLE", summary: why,
    headline: "No triage was produced: " + why + ".",
    whose_move: "nobody - this run produced no triage",
    blocking: [], advisory: [], fix_order: [], unknowns: [], stages: [], facts: {},
  });
} else {
  const data = triageRead.data;
  const verdict = String(data.verdict ?? "UNAVAILABLE");
  const blocking = Array.isArray(data.blocking) ? data.blocking : [];
  const advisory = Array.isArray(data.advisory) ? data.advisory : [];
  const fixOrder = Array.isArray(data.fix_order) ? data.fix_order : [];
  const unknowns = Array.isArray(data.unknowns) ? data.unknowns : [];
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const facts = (data.facts && typeof data.facts === "object") ? data.facts : {};

  // A self-check that did not run is itself a reason to distrust the triage, so
  // it is reported as loudly as a failing one.
  const selfCheck = selfCheckRead.kind === "ok" ? selfCheckRead.data : null;
  const selfCheckOk = selfCheck?.ok === true;

  const lines = [];
  lines.push("GITLAB PIPELINE TRIAGE");
  lines.push("");

  const chosenProject = String(validateRead.kind === "ok"
    ? (validateRead.data.project_input ?? "") : "");
  const chosenMr = Number(validateRead.kind === "ok" ? validateRead.data.iid : -1);
  if (chosenProject === DEMO_PROJECT && chosenMr === DEMO_MR) {
    lines.push("  DEMO RUN - no project or mr was given, so this triaged a real public");
    lines.push("  merge request in " + DEMO_PROJECT + " whose pipeline is genuinely");
    lines.push("  failing. Everything below is live data. Point it at your own:");
    lines.push("    rote play run princepanchani/gitlab-pipeline-triage \\");
    lines.push("      project=your-group/your-repo mr=123");
    lines.push("");
  }

  if (facts.mr_web_url) lines.push("  " + String(facts.mr_web_url));
  if (facts.mr_title_display_only) {
    for (const l of wrapLine(facts.mr_title_display_only, 74, "  ")) lines.push(l);
  }
  lines.push("");

  // The self-check gate. A triage whose own logic is broken must refuse rather
  // than guess, so the verdict is withheld and nothing below it is shown.
  if (!selfCheckOk) {
    lines.push("VERDICT: WITHHELD");
    lines.push("");
    const detail = selfCheck
      ? "the bundled self-check reported " + String(selfCheck.failed ?? "?") +
        " failing case(s) of " + String(selfCheck.total ?? "?")
      : "the bundled self-check did not produce a readable result";
    for (const l of wrapLine(detail + ", so the triage logic cannot be trusted " +
      "and no verdict is offered.", 74, "  ")) lines.push(l);
    lines.push("");
    for (const f of (selfCheck?.failures ?? []).slice(0, 8)) {
      pushWrapped(lines, "  - " + String(f?.case ?? "?") + ": ", String(f?.error ?? ""), "      ");
    }
    out.human(lines.join("\n"));
    out.summary("WITHHELD - the bundled self-check failed");
    out.result({ ...data, verdict: "WITHHELD", self_check: selfCheck ?? {} });
  } else {
    lines.push("VERDICT: " + verdict.replace(/_/g, " "));
    lines.push("");
    for (const l of wrapLine(data.headline, 74, "  ")) lines.push(l);
    lines.push("");
    pushWrapped(lines, "  whose move : ", String(data.whose_move ?? "?"), "               ");
    pushWrapped(lines, "  detail     : ", String(data.summary ?? "?"), "               ");
    lines.push("");

    lines.push("BLOCKING JOBS (" + blocking.length + ")");
    if (blocking.length === 0) {
      lines.push("  none - no failing job blocks this merge request");
    } else {
      for (const b of blocking) {
        const label = CLASS_LABEL[String(b?.classification)] ?? String(b?.classification ?? "?");
        pushWrapped(lines, "  [" + String(b?.job ?? "?") + "] ", label, "      ");
        pushWrapped(lines, "      stage    : ", String(b?.stage ?? "?"), "                 ");
        pushWrapped(lines, "      evidence : ", String(b?.evidence ?? ""), "                 ");
        pushWrapped(lines, "      owner    : ", String(b?.owner ?? "?"), "                 ");
        pushWrapped(lines, "      next     : ", String(b?.next ?? ""), "                 ");
      }
    }
    lines.push("");

    // Advisory failures are listed separately and never counted as blockers,
    // because conflating them is exactly why a red pipeline stops meaning
    // anything to a team.
    lines.push("ADVISORY FAILURES (" + advisory.length + ") - red, but allow_failure, so not blocking");
    if (advisory.length === 0) {
      lines.push("  none");
    } else {
      for (const a of advisory) {
        pushWrapped(lines, "  [" + String(a?.job ?? "?") + "] ",
          "stage " + String(a?.stage ?? "?") + " - " + String(a?.evidence ?? ""), "      ");
      }
    }
    lines.push("");

    lines.push("FIX ORDER (cheapest first)");
    if (fixOrder.length === 0) {
      lines.push("  nothing to fix - no job is blocking this merge request");
    } else {
      let n = 0;
      for (const f of fixOrder) {
        n += 1;
        pushWrapped(lines, "  " + n + ". [" + String(f?.job ?? "?") + "] ",
          String(f?.action ?? ""), "     ");
        pushWrapped(lines, "       who : ", String(f?.who ?? "?"), "             ");
      }
      lines.push("");
      lines.push("  Retries come first because a runner failure can turn the pipeline");
      lines.push("  green without anybody reading code. What is already broken on the");
      lines.push("  target branch comes last, because it is not this merge request's job.");
    }
    lines.push("");

    lines.push("NOT MEASURED (" + unknowns.length + ")");
    if (unknowns.length === 0) {
      lines.push("  nothing - every dimension was read");
    } else {
      for (const u of unknowns) {
        pushWrapped(lines, "  [" + String(u?.dimension ?? "?") + "] ",
          reasonText(u?.reason), "      ");
      }
    }
    lines.push("");

    lines.push("STAGE LEDGER");
    for (const s of stages) {
      // The ledger is a fixed-width table. It must NOT go through wrapLine,
      // which splits on spaces and so collapses the column padding that makes
      // it a table at all; only the trailing note is wrapped.
      const state = s?.measured ? "read      " : "not read  ";
      const head = "  " + state + String(s?.name ?? "?");
      const note = s?.measured
        ? (s?.route ? "  (via " + String(s.route) + ")" : "")
        : "  (" + String(s?.reason ?? "no reason given").replace(/_/g, " ") + ")";
      if (!note || (head + note).length <= 78) {
        lines.push(head + note);
      } else {
        lines.push(head);
        for (const l of wrapLine(note.trim(), 62, "      ")) lines.push(l);
      }
    }
    lines.push("");

    lines.push("GITLAB SAYS");
    lines.push("  merge request         : " + String(facts.mr_state ?? "?"));
    lines.push("  pipeline              : " + String(facts.pipeline_status ?? "?") +
      (Number(facts.pipeline_id) > 0 ? "  (#" + String(facts.pipeline_id) + ")" : ""));
    lines.push("  jobs                  : " +
      (Number(facts.job_count) >= 0 ? String(facts.job_count) : "not read") +
      " total, " +
      (Number(facts.failed_count) >= 0 ? String(facts.failed_count) : "not read") + " failed");
    lines.push("  target branch         : " + String(facts.mr_target ?? "?"));
    lines.push("  baseline pipeline     : " +
      (Number(facts.base_pipeline_id) > 0
        ? String(facts.base_pipeline_status ?? "?") + "  (#" +
          String(facts.base_pipeline_id) + ", " +
          (Number(facts.base_job_count) >= 0 ? String(facts.base_job_count) : "?") + " jobs)"
        : "none found"));
    // The pipeline URL sits outside the aligned table on purpose. Inside it the
    // label eats 26 columns and a normal GitLab pipeline URL then overruns the
    // margin - and a URL is the one thing that must never be wrapped, because a
    // hard newline through it stops a terminal making it clickable.
    if (facts.pipeline_web_url) {
      lines.push("");
      lines.push("  pipeline  " + String(facts.pipeline_web_url));
    }
    lines.push("");

    lines.push("SELF-CHECK (ran before any live data was judged)");
    lines.push("  " + String(selfCheck.passed ?? "?") + "/" + String(selfCheck.total ?? "?") +
      " triage-logic cases passed");
    lines.push("");

    lines.push("Read-only: nothing was retried, cancelled, approved or merged.");
    lines.push("A dimension marked 'not read' is unknown, not clean.");

    out.human(lines.join("\n"));
    out.summary(String(data.headline ?? verdict));
    out.result({ ...data, self_check: selfCheck });
  }
}
