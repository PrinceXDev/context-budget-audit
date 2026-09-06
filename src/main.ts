#!/usr/bin/env -S rote play run
/**
 * @rote-frontmatter
 * ---
 * name: gitlab-mr-gate
 * description: |-
 *   Can this GitLab merge request merge? If not, what is blocking it, and whose move is it?
 *
 *   TRY IT IN ONE LINE - no arguments, no token, no setup:
 *
 *       rote play run princepanchani/gitlab-mr-gate
 *
 *   That gates a real public merge request and prints a full verdict in about six
 *   seconds. Then point it at your own, or at self-hosted GitLab:
 *
 *       rote play run princepanchani/gitlab-mr-gate project=your-group/your-repo mr=123
 *       rote play run princepanchani/gitlab-mr-gate \
 *           gitlab_host=invent.kde.org project=frameworks/kio mr=2417
 *
 *   WHAT YOU GET
 *
 *     VERDICT     MERGEABLE, BLOCKED, MERGEABLE_WITH_UNKNOWNS or NOT_OPEN.
 *     MERGE PATH  Not just what is wrong - what has to HAPPEN, in the order it
 *                 can happen, and who does each part. Branch work precedes
 *                 approvals, because the next push commonly resets them.
 *     WHOSE MOVE  One name: who the merge is waiting on right now.
 *     EVIDENCE    Every blocker names the field that proves it, so "blocked"
 *                 becomes "needs 1 approval from one of 77 eligible approvers of
 *                 /app/assets/".
 *
 *   GitLab publishes detailed_merge_status, its own one-field diagnosis of why a
 *   merge is refused, which GitHub has no equivalent of. This play reads it - then
 *   uses it as an independent witness against its own verdict. Pass required_labels
 *   and forbidden_labels to gate your team's rules too.
 *
 *   HOW IT REFUSES TO LIE TO YOU
 *
 *     - 47 self-check cases run BEFORE any live data is judged. If one fails the
 *       verdict is withheld entirely.
 *     - A verify stage re-derives the headline claims by two routes the gate never
 *       used. CONTRADICTED means trust GitLab, not this play.
 *     - A dimension it could not read is unknown, never clean, and the stage ledger
 *       names the route each answer came by.
 *     - Titles and descriptions are author-controlled text, read by no rule.
 *
 *   VERIFIED ON SELF-HOSTED GITLAB, not just gitlab.com: five independent instances
 *   (KDE, Debian, GNOME, freedesktop, VideoLAN), all Community Edition, where the
 *   approval-rules endpoint does not exist and returns 404 while every other
 *   dimension reads fine. Approval rules are then reported as unknown rather than
 *   mistaken for a missing project.
 *
 *   COMPANION PLAYS. To sweep EVERY open merge request instead of one, use
 *   princepanchani/gitlab-mr-queue. When the blocker is a red pipeline,
 *   princepanchani/gitlab-pipeline-triage says which job failed and whether it also
 *   fails on the target branch.
 *
 *   READ ONLY - nothing is approved, merged, rebased, commented or labelled. Needs
 *   only python3. No credentials on public projects; a private or self-hosted
 *   project uses your own GITLAB_TOKEN from the environment, sent as a header, never
 *   in a query string, never printed.
 *
 *   KNOWN LIMITS: the token path is exercised end to end against a private
 *   gitlab.com project, but a token against a self-hosted instance is untested - the
 *   five instances above were read anonymously.
 * version: 1.4.0
 * source_url: https://github.com/PrinceXDev/context-budget-audit
 * provenance:
 *   author: Prince Panchani (github.com/PrinceXDev)
 *   workspace: gitlab-mr-gate
 * metadata:
 *   version: 1.4.0
 *   rote_version: 0.80.0
 *   status: released
 *   kind: atomic
 *   flow_type: parallel
 *   execution_model: steps_with_presentation
 *   requires_sessions: false
 * presentation_fixtures:
 *   self_check: resources/presentation-fixtures/self_check/fixture.yaml
 *   verify: resources/presentation-fixtures/verify/fixture.yaml
 *   validate_input: resources/presentation-fixtures/validate_input/fixture.yaml
 *   fetch_mr: resources/presentation-fixtures/fetch_mr/fixture.yaml
 *   fetch_approvals: resources/presentation-fixtures/fetch_approvals/fixture.yaml
 *   fetch_approval_state: resources/presentation-fixtures/fetch_approval_state/fixture.yaml
 *   fetch_pipelines: resources/presentation-fixtures/fetch_pipelines/fixture.yaml
 *   fetch_discussions: resources/presentation-fixtures/fetch_discussions/fixture.yaml
 *   compute_verdict: resources/presentation-fixtures/compute_verdict/fixture.yaml
 * tags:
 * - domain-code-review
 * - job-merge-readiness
 * - platform-gitlab
 * - audience-developers
 * - effect-read-only
 * - tool-shell
 * discoverability:
 *   tags:
 *   - domain-code-review
 *   - job-merge-readiness
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
 *       merge_path:
 *         type: object
 *       blockers:
 *         type: object
 *       unknowns:
 *         type: object
 *       stages:
 *         type: object
 *       facts:
 *         type: object
 *       self_check:
 *         type: object
 *       verify:
 *         type: object
 * parameters:
 * - name: project
 *   param_type: string
 *   required: false
 *   default: gitlab-org/gitlab
 *   description: GitLab project path or numeric id. Left alone it runs the built-in
 *     demo against a real public merge request, so you can see a verdict before you
 *     have decided whether to point this at one of yours.
 *   example: gitlab-org/gitlab
 * - name: mr
 *   param_type: string
 *   required: false
 *   default: '143468'
 *   description: Merge request iid, the number shown in the merge request URL. Part
 *     of the built-in demo when left alone; set it together with project.
 *   example: '143468'
 * - name: gitlab_host
 *   param_type: string
 *   required: false
 *   default: gitlab.com
 *   description: GitLab hostname; set this for a self-hosted instance
 *   example: gitlab.com
 * - name: required_labels
 *   param_type: string
 *   required: false
 *   default: ''
 *   description: Comma separated labels this merge request must carry to be considered ready
 *   example: Status::Ready
 * - name: forbidden_labels
 *   param_type: string
 *   required: false
 *   default: ''
 *   description: Comma separated labels that block a merge when present
 *   example: Do Not Merge
 * - name: require_pipeline
 *   param_type: string
 *   required: false
 *   default: auto
 *   description: auto asks GitLab whether a pipeline is mandatory; true or false override it
 *   example: auto
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
 *     - '@resource{verdict.py}'
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
 *   fetch_approvals:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - validate_input
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - approvals
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - $timeout_s
 *   fetch_approval_state:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - validate_input
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - approval_state
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
 *     - pipelines
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - $timeout_s
 *   fetch_discussions:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - validate_input
 *     argv:
 *     - python3
 *     - '@resource{fetch.py}'
 *     - discussions
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - $timeout_s
 *   compute_verdict:
 *     type: process.exec
 *     timeout_ms: 30000
 *     depends_on:
 *     - self_check
 *     - fetch_mr
 *     - fetch_approvals
 *     - fetch_approval_state
 *     - fetch_pipelines
 *     - fetch_discussions
 *     argv:
 *     - python3
 *     - '@resource{verdict.py}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .state}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .draft}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .has_conflicts}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .detailed_merge_status}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .blocking_discussions_resolved}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .labels_csv}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .web_url}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .title_display_only}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .author}'
 *     - '@fetch_approvals{$.stdout.text | fromjson | .approvals_required}'
 *     - '@fetch_approvals{$.stdout.text | fromjson | .approvals_left}'
 *     - '@fetch_approval_state{$.stdout.text | fromjson | .rules_total}'
 *     - '@fetch_approval_state{$.stdout.text | fromjson | .rules_unsatisfied_csv}'
 *     - '@fetch_approval_state{$.stdout.text | fromjson | .rules_detail_csv}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .latest_status}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .latest_web_url}'
 *     - '@fetch_discussions{$.stdout.text | fromjson | .unresolved_threads}'
 *     - $required_labels
 *     - $forbidden_labels
 *     - $require_pipeline
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .target_branch}'
 *     - '@fetch_approvals{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_approval_state{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_pipelines{$.stdout.text | fromjson | .reason}'
 *     - '@fetch_discussions{$.stdout.text | fromjson | .reason}'
 *     - '@validate_input{$.stdout.text | fromjson | .auth_mode}'
 *   verify:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - compute_verdict
 *     argv:
 *     - python3
 *     - '@resource{verify.py}'
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .iid}'
 *     - '@compute_verdict{$.stdout.text | fromjson | .verdict}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .detailed_merge_status}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .labels_csv}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .draft}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .has_conflicts}'
 *     - '@fetch_mr{$.stdout.text | fromjson | .blocking_discussions_resolved}'
 *     - '@compute_verdict{$.stdout.text | fromjson | .blocker_dims_csv}'
 *     - $timeout_s
 * ---
 */

const presentationSdk = await import("__ROTE_PRESENTATION_SDK__").catch((cause) => {
  throw new Error(
    "This is a rote steps presentation program. Run it with `rote play run <name>`.",
    { cause },
  );
});
const { FlowOutput, loadPresentationContext, stepName } = presentationSdk;

const out = new FlowOutput();
const ctx = await loadPresentationContext();

/** Read one non-fan-out step's captured stdout as JSON.
 *
 * truncated === true is checked BEFORE any JSON.parse is attempted. rote sets
 * that flag when a step's captured stdout hit the capture cap, and a partial
 * payload that happens to still parse must never be read as a clean result.
 * The cap is the cause; an unparseable payload is only its symptom. */
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
const DEMO_PROJECT = "gitlab-org/gitlab";
const DEMO_MR = 143468;

/** Wrap one long sentence to the report's column width.
 * The headline is generated from live data - rule paths and usernames make its
 * length unpredictable - so it cannot be hand-fitted the way a static line can. */
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

// The fetch steps report why a dimension could not be measured as a short
// machine code. A code is the right thing to carry between steps and the wrong
// thing to show a reader: "not_available" tells a stranger nothing. Translate
// to a sentence here, and pass anything unrecognised straight through, because
// some reasons already arrive as full prose from the verdict step.
const REASON_TEXT = {
  not_available:
    "approval rules are a GitLab Premium/Ultimate feature and this endpoint " +
    "does not exist on Community Edition, which is most self-hosted GitLab",
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
};

function reasonText(reason) {
  const key = String(reason ?? "").trim();
  if (!key) return "no reason given";
  return REASON_TEXT[key] ?? key;
}

// A negative count is the sentinel for "never measured" and must never reach
// the reader as a number; "-1 total" reads as a bug, not as an unknown.
function countOrUnread(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? String(n) : "not read";
}

const read = readStep(ctx.step(stepName("compute_verdict")));
const validateRead = readStep(ctx.step(stepName("validate_input")));
const selfCheckRead = readStep(ctx.step(stepName("self_check")));
const verifyRead = readStep(ctx.step(stepName("verify")));

// The verdict step is the single canonical source for this report. If it did
// not produce a readable result, say so plainly instead of rendering a green
// or empty page that would read as "nothing wrong".
if (read.kind !== "ok") {
  const why = {
    absent: "the verdict step did not complete, so no gate was evaluated",
    truncated: "the verdict step output exceeded the capture cap and cannot be trusted",
    unparseable: "the verdict step output was not readable JSON",
  }[read.kind] ?? "the verdict step output could not be read";

  // "the verdict step did not complete" is true and useless. The reason the run
  // stopped is almost always a wrong project path or a private project, and the
  // fetch step already wrote a precise sentence about it to stderr - which
  // otherwise appears only in the raw runner error line, below the report a
  // reader is actually looking at. Lift it into the report.
  // A COMPLETED step carries output.body.stdout.text; a FAILED one carries
  // output.diagnostic.stderr as a plain string. This branch only ever runs for
  // the failed case, but read both so it cannot silently render nothing again.
  const failedStep = ctx.step(stepName("fetch_mr"));
  const causeText = String(
    failedStep?.outcome?.output?.diagnostic?.stderr ??
    failedStep?.outcome?.output?.body?.stderr?.text ??
    "",
  ).replace(/^gitlab-mr-gate:\s*/gm, "").trim();
  const causeLines = causeText
    ? ["", "WHY", ...wrapLine(causeText.split("\n")[0], 74, "  ")]
    : [];

  out.human(
    [
      "GITLAB MR GATE",
      "",
      "VERDICT: UNAVAILABLE",
      "",
      "  " + why + ".",
      ...causeLines,
      "",
      "This is not a passing result. Re-run, or continue from the steps that did",
      "complete with `rote play run ... --resume <run_id>`.",
      "",
    ].join("\n"),
  );
  out.summary("UNAVAILABLE - " + why);
  out.result({
    verdict: "UNAVAILABLE", summary: why, headline: "No verdict was produced: " + why + ".",
    whose_move: "nobody - this run produced no verdict",
    merge_path: [], blockers: [], unknowns: [], stages: [], facts: {},
  });
} else {
  const data = read.data;
  const verdict = String(data.verdict ?? "UNAVAILABLE");
  const blockers = Array.isArray(data.blockers) ? data.blockers : [];
  const unknowns = Array.isArray(data.unknowns) ? data.unknowns : [];
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const mergePath = Array.isArray(data.merge_path) ? data.merge_path : [];
  const facts = (data.facts && typeof data.facts === "object") ? data.facts : {};

  const MARK = {
    MERGEABLE: "PASS",
    BLOCKED: "BLOCKED",
    MERGEABLE_WITH_UNKNOWNS: "PASS WITH UNKNOWNS",
    NOT_OPEN: "NOT OPEN",
    UNAVAILABLE: "UNAVAILABLE",
  };

  const isDemo = validateRead.kind === "ok"
    && String(validateRead.data.project_input ?? "") === DEMO_PROJECT
    && Number(validateRead.data.iid ?? -1) === DEMO_MR;

  const lines = [];
  lines.push("GITLAB MR GATE");
  lines.push("");
  if (isDemo) {
    // Said plainly. A reader must never mistake the demo for a report on their
    // own merge request just because they forgot to pass one.
    lines.push("  DEMO RUN - no project or mr was given, so this gated a real public");
    lines.push("  merge request in gitlab-org/gitlab. Everything below is live data.");
    lines.push("  Point it at your own:");
    lines.push("    rote play run princepanchani/gitlab-mr-gate \\");
    lines.push("      project=your-group/your-repo mr=123");
    lines.push("");
  }
  lines.push("  " + String(facts.web_url ?? "(no url)"));
  if (facts.title_display_only) {
    // Author-controlled text. Shown, never interpreted.
    lines.push("  " + String(facts.title_display_only));
  }
  lines.push("");
  lines.push("VERDICT: " + (MARK[verdict] ?? verdict));
  lines.push("");
  for (const l of wrapLine(data.headline ?? data.summary ?? "", 74, "  ")) lines.push(l);
  lines.push("");
  lines.push("  whose move : " + String(data.whose_move ?? "?"));
  // Wrap the value only. Feeding the label through the wrapper would collapse the
  // run of spaces that keeps this column aligned with the one above it.
  const detailWrapped = wrapLine(String(data.summary ?? ""), 61, "");
  lines.push("  detail     : " + detailWrapped[0]);
  for (const l of detailWrapped.slice(1)) lines.push("               " + l);
  lines.push("");

  if (blockers.length === 0) {
    lines.push("BLOCKERS (0)");
    lines.push("  none");
  } else {
    lines.push("BLOCKERS (" + blockers.length + ")");
    for (const b of blockers) {
      // Rule paths and next-actions are live data of unpredictable length. Left
      // unwrapped a terminal breaks them mid-word, which reads as a typo.
      const head = "  [" + String(b?.dimension ?? "?") + "] ";
      const stmt = wrapLine(b?.statement ?? "", 76 - head.length, "");
      lines.push(head + stmt[0]);
      for (const l of stmt.slice(1)) lines.push("      " + l);
      for (const [label, value] of [
        ["evidence", b?.evidence], ["owner", b?.owner], ["next", b?.next_action],
      ]) {
        const w = wrapLine(value ?? "", 59, "");
        lines.push("      " + label.padEnd(8) + " : " + w[0]);
        for (const l of w.slice(1)) lines.push("                 " + l);
      }
    }
  }
  lines.push("");

  lines.push("MERGE PATH (what has to happen, in order)");
  if (mergePath.length === 0) {
    lines.push("  nothing - no blocker stands between this MR and a merge");
  } else {
    for (const st of mergePath) {
      const head = "  " + String(st?.step ?? "?") + ". ";
      const act = wrapLine(st?.action ?? "", 76 - head.length, "");
      lines.push(head + act[0]);
      for (const l of act.slice(1)) lines.push("     " + l);
      for (const [label, value] of [["who", st?.owner], ["why", st?.because]]) {
        const w = wrapLine(value ?? "", 63, "");
        lines.push("       " + label + " : " + w[0]);
        for (const l of w.slice(1)) lines.push("             " + l);
      }
    }
    lines.push("");
    lines.push("  Order matters: branch work first, because a later push commonly");
    lines.push("  resets approvals gathered before it.");
  }
  lines.push("");

  lines.push("NOT MEASURED (" + unknowns.length + ")");
  if (unknowns.length === 0) {
    lines.push("  nothing - every dimension was read");
  } else {
    for (const u of unknowns) {
      const head = "  [" + String(u?.dimension ?? "?") + "] ";
      const w = wrapLine(reasonText(u?.reason), 76 - head.length, "");
      lines.push(head + w[0]);
      for (const l of w.slice(1)) lines.push("      " + l);
    }
  }
  lines.push("");

  lines.push("STAGE LEDGER");
  if (stages.length === 0) {
    lines.push("  (no ledger reported)");
  } else {
    for (const s of stages) {
      const state = s?.measured ? "read      " : "not read  ";
      // A measured dimension names the route only when it was the weaker one, so
      // the ledger never claims more certainty than the route it actually used.
      // The ledger is a fixed-width table, so it keeps the terse reason rather
      // than the full sentence the NOT MEASURED section carries - but an
      // underscored enum reads as leaked internals, so soften it to words.
      const note = s?.measured
        ? (s?.route ? "  (via " + String(s.route) + ")" : "")
        : "  (" + String(s?.reason ?? "no reason given").replace(/_/g, " ") + ")";
      lines.push("  " + state + String(s?.name ?? "?") + note);
    }
  }
  lines.push("");

  lines.push("GITLAB SAYS");
  lines.push("  detailed_merge_status : " + String(facts.detailed_merge_status ?? "?"));
  lines.push("    meaning             : " + String(facts.dms_meaning ?? "?"));
  lines.push("  pipeline              : " + String(facts.pipeline_status ?? "?"));
  lines.push("  approvals             : " +
    (Number(facts.approvals_required) >= 0
      ? countOrUnread(facts.approvals_left) + " still needed of " +
        countOrUnread(facts.approvals_required) + " required"
      : "not read"));
  lines.push("  approval rules        : " +
    (Number(facts.approval_rules_total) >= 0
      ? countOrUnread(facts.approval_rules_total) + " total, unsatisfied: " +
        (String(facts.approval_rules_unsatisfied ?? "") || "none")
      : "not read"));
  lines.push("  labels                : " +
    (Array.isArray(facts.labels) && facts.labels.length ? facts.labels.join(", ") : "none"));
  lines.push("");

  lines.push("SELF-CHECK (ran before any live data was judged)");
  if (selfCheckRead.kind === "ok") {
    const sc = selfCheckRead.data;
    lines.push("  " + String(sc.passed ?? "?") + "/" + String(sc.total ?? "?") +
      " verdict-logic cases passed" + (sc.ok ? "" : "  <-- FAILURES PRESENT"));
    for (const f of (Array.isArray(sc.failures) ? sc.failures : [])) {
      lines.push("    FAILED: " + String(f?.case ?? "?") + " - " + String(f?.reason ?? ""));
    }
  } else {
    lines.push("  not reported - the self-check result could not be read");
  }
  lines.push("");

  lines.push("VERIFY (re-derived by a different route)");
  if (verifyRead.kind === "ok") {
    const v = verifyRead.data;
    for (const c of (Array.isArray(v.checks) ? v.checks : [])) {
      lines.push("  " + String(c?.status ?? "?").padEnd(14) + String(c?.check ?? "?"));
      lines.push("      " + String(c?.detail ?? ""));
    }
    if (Number(v.contradicted ?? 0) > 0) {
      lines.push("");
      lines.push("  A CONTRADICTED check means GitLab and this gate disagree.");
      lines.push("  Trust GitLab and treat the verdict above as unsafe.");
    }
  } else {
    lines.push("  not reported - the verify result could not be read");
    lines.push("  The verdict above therefore stands UNVERIFIED.");
  }
  lines.push("");

  lines.push("Read-only: nothing was approved, merged, rebased, commented or labelled.");
  lines.push("A dimension marked 'not read' is unknown, not clean.");

  out.human(lines.join("\n"));

  // The summary is often all a caller reads, so it carries the sentence a human
  // would say out loud, not a count of internal fields.
  out.summary(String(data.headline ?? ((MARK[verdict] ?? verdict) +
    " - " + blockers.length + " blocker(s), " + unknowns.length + " not measured")));

  // result is canonical. human and summary are intentionally lossy views of it.
  out.result({
    ...data,
    self_check: selfCheckRead.kind === "ok" ? selfCheckRead.data : { ok: null, note: "unreadable" },
    verify: verifyRead.kind === "ok" ? verifyRead.data : { verified: false, note: "unreadable" },
  });
}
