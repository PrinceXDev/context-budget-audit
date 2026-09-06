#!/usr/bin/env -S rote play run
/**
 * @rote-frontmatter
 * ---
 * name: gitlab-mr-queue
 * description: |-
 *   Triages every open merge request in a GitLab project into one table grouped by
 *   WHOSE MOVE IT IS - and by how long it has been waiting.
 *
 *   TRY IT IN ONE LINE - no arguments, no token, no setup:
 *
 *       rote play run princepanchani/gitlab-mr-queue
 *
 *   That triages a real public backlog so you can see the whole report before
 *   deciding whether to point it at your own. Then point it at your own:
 *
 *       rote play run princepanchani/gitlab-mr-queue project=your-group/your-repo
 *
 *   WHAT YOU GET
 *
 *     BUCKETS      Every MR lands in exactly one: READY_TO_MERGE, READY_WITH_UNKNOWNS,
 *                  WAITING_ON_AUTHOR, WAITING_ON_CI, WAITING_ON_REVIEWERS,
 *                  WAITING_ON_MAINTAINER, WAITING_ON_PROCESS or WAITING_ON_ANOTHER_MR.
 *                  The bucket is the EARLIEST thing that must happen, so the person to
 *                  chase is obvious. Worst-first inside each bucket.
 *     ROT LEDGER   Oldest and median age, how many are past ninety days, how many are
 *                  stale. Every other merge-readiness play answers only what is true
 *                  right now. This one answers how long it has been true.
 *     REVIEW LOAD  Who the queue is actually waiting on: their MR count, oldest item
 *                  and average age, from the reviewer assignments GitLab exposes with
 *                  no token at all. Drop auto-assigned bots with ignore_reviewers.
 *                  This is QUEUE LOAD, not performance, and an unfilled reviewer slot
 *                  is reported as a routing gap rather than as a slow person.
 *
 *   WHY GITLAB
 *
 *   Every other merge-readiness play in this registry targets GitHub. This one reads
 *   detailed_merge_status, GitLab's own one-field diagnosis of why a merge is
 *   refused, which GitHub has no equivalent of.
 *
 *   YOUR TEAM'S RULES TRAVEL TOO
 *
 *   GitLab cannot know that a label like "workflow::in dev" means do not merge. Pass
 *   required_labels and forbidden_labels and they become buckets alongside the
 *   mechanical ones. stale_after_days is a parameter because no API can decide how
 *   long is too long for your team.
 *
 *   HOW IT REFUSES TO LIE TO YOU
 *
 *     - Merge requests past max_mrs are listed as NOT GATED with the status the list
 *       endpoint already gave, never silently dropped. Capped is not the same as clean.
 *     - An MR with no gate result is reported as unknown, not as mergeable.
 *     - An approval rule with an empty eligible-approver list is only called a
 *       maintainer or CODEOWNERS fault when a token was supplied. Read anonymously
 *       GitLab returns that list empty for some projects and populated for others, so
 *       without a token the rule is a certain reviewer blocker while WHO can satisfy
 *       it is recorded as genuinely unknown.
 *     - Whether a missing pipeline blocks a merge is a project setting, so
 *       require_pipeline defaults to auto and asks GitLab rather than assuming.
 *     - Without a token, idle time stands in for blocker age and the report labels
 *       that precision APPROXIMATE rather than passing an estimate off as a
 *       measurement. With a GITLAB_TOKEN it reads label events and says EXACT.
 *
 *   ORDERING MATTERS: order defaults to stalest. Spending the max_mrs budget
 *   newest-first reports a median age of 1 day while a 186-day-old MR falls past the
 *   cap - the same queue then looks healthy when it is not.
 *
 *   READ ONLY. It does not approve, merge, rebase, comment, label or write anything.
 *   Needs only python3. Cost is one request plus three per gated merge request, or
 *   five when a token enables the exact timeline. No credentials at all on public
 *   projects; a private or self-hosted project uses your own GITLAB_TOKEN read from
 *   the environment, sent as a request header, never printed.
 *
 *   KNOWN LIMITS, not overclaimed: the token path has been exercised end to end
 *   against a real private gitlab.com project, and the exact-timeline route via
 *   label events really does run. A self-hosted gitlab_host is still unverified -
 *   there was no self-hosted instance to test against.
 * version: 1.3.1
 * source_url: https://play.modiqo.ai/princepanchani/gitlab-mr-queue
 * provenance:
 *   workspace: gitlab-mr-gate
 * metadata:
 *   version: 1.3.1
 *   rote_version: 0.80.0
 *   status: released
 *   kind: atomic
 *   flow_type: parallel
 *   execution_model: steps_with_presentation
 *   requires_sessions: false
 * presentation_fixtures:
 *   validate_input: resources/presentation-fixtures/validate_input/fixture.yaml
 *   list_mrs: resources/presentation-fixtures/list_mrs/fixture.yaml
 *   gate_one: resources/presentation-fixtures/gate_one/fixture.yaml
 * tags:
 * - domain-code-review
 * - job-merge-queue-triage
 * - platform-gitlab
 * - audience-developers
 * - effect-read-only
 * - tool-shell
 * discoverability:
 *   tags:
 *   - domain-code-review
 *   - job-merge-queue-triage
 *   - platform-gitlab
 *   - audience-developers
 *   - effect-read-only
 *   - tool-shell
 * output:
 *   schema:
 *     type: object
 *     properties:
 *       ok:
 *         type: object
 *       headline:
 *         type: string
 *       totals:
 *         type: object
 *       buckets:
 *         type: object
 *       rot_ledger:
 *         type: object
 *       review_load:
 *         type: object
 *       rows:
 *         type: object
 *       not_gated:
 *         type: object
 *       no_result:
 *         type: object
 *       note:
 *         type: string
 * parameters:
 * - name: project
 *   param_type: string
 *   required: false
 *   default: gitlab-org/cli
 *   description: GitLab project path or numeric id. Left alone it runs the built-in
 *     demo against a real public project with a real backlog, so you can see the
 *     whole report before deciding whether to point it at your own.
 *   example: gitlab-org/cli
 * - name: gitlab_host
 *   param_type: string
 *   required: false
 *   default: gitlab.com
 *   description: GitLab hostname; set this for a self-hosted instance
 *   example: gitlab.com
 * - name: target_branch
 *   param_type: string
 *   required: false
 *   default: ''
 *   description: Only triage merge requests targeting this branch
 *   example: main
 * - name: filter_labels
 *   param_type: string
 *   required: false
 *   default: ''
 *   description: Comma separated labels; only triage merge requests carrying all of them
 *   example: type::bug
 * - name: max_mrs
 *   param_type: integer
 *   required: false
 *   default: '15'
 *   description: Fully gate at most this many merge requests (1-50); the rest are listed, not gated
 *   example: '15'
 * - name: required_labels
 *   param_type: string
 *   required: false
 *   default: ''
 *   description: Comma separated labels a merge request must carry to count as ready
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
 * - name: order
 *   param_type: string
 *   required: false
 *   default: stalest
 *   description: Which end of the queue to spend the max_mrs budget on; stalest or newest
 *   example: stalest
 * - name: stale_after_days
 *   param_type: integer
 *   required: false
 *   default: '14'
 *   description: A merge request with no activity for this many days is reported as stale
 *   example: '14'
 * - name: ignore_reviewers
 *   param_type: string
 *   required: false
 *   default: ''
 *   description: Comma separated usernames to leave out of the review load table, for bot accounts
 *   example: GitLabDuo
 * - name: timeout_s
 *   param_type: integer
 *   required: false
 *   default: '25'
 *   description: Per request HTTP timeout in seconds, clamped to 1-120
 *   example: '25'
 * steps:
 *   validate_input:
 *     type: process.exec
 *     timeout_ms: 15000
 *     argv:
 *     - python3
 *     - '@resource{validate.py}'
 *     - $project
 *     - $gitlab_host
 *     - $target_branch
 *     - $filter_labels
 *     - $max_mrs
 *     - '3'
 *     - $order
 *   list_mrs:
 *     type: process.exec
 *     timeout_ms: 130000
 *     depends_on:
 *     - validate_input
 *     argv:
 *     - python3
 *     - '@resource{list_mrs.py}'
 *     - '@validate_input{$.stdout.text | fromjson | .api_base}'
 *     - '@validate_input{$.stdout.text | fromjson | .target_branch}'
 *     - '@validate_input{$.stdout.text | fromjson | .filter_labels}'
 *     - '@validate_input{$.stdout.text | fromjson | .max_mrs}'
 *     - $timeout_s
 *     - '@validate_input{$.stdout.text | fromjson | .sort}'
 *   gate_one:
 *     type: process.exec
 *     timeout_ms: 140000
 *     depends_on:
 *     - list_mrs
 *     for_each: $.stdout.text | fromjson | .mrs
 *     max_concurrency: 3
 *     argv:
 *     - python3
 *     - '@resource{gate_one.py}'
 *     - $item
 *     - $item_index
 *     - $required_labels
 *     - $forbidden_labels
 *     - $require_pipeline
 *     - $timeout_s
 *     - $stale_after_days
 *     - $ignore_reviewers
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

/** Read a single (non fan-out) step's stdout as JSON.
 * truncated is checked BEFORE any parse: a partial payload that happens to
 * still parse must never be read as a clean result. */
function readStepJson(step) {
  const outcome = step?.outcome;
  if (outcome?.status !== "completed" && outcome?.status !== "restored") return null;
  const stdout = outcome?.output?.body?.stdout;
  if (!stdout || stdout.truncated === true) return null;
  const text = stdout.text ?? "";
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** Read the fan-out step: one process observation per merge request.
 * Deliberately does NOT gate on the aggregate step status. If the runner
 * promotes one item's failure to a non-completed aggregate while still
 * populating output.items, gating here would discard every healthy peer
 * alongside the bad one. */
function readFanOutRows(step) {
  const items = step?.outcome?.output?.items;
  if (!Array.isArray(items)) return { rows: [], unreadable: 0 };
  const rows = [];
  let unreadable = 0;
  for (const item of items) {
    const stdout = item?.body?.stdout;
    if (!stdout || stdout.truncated === true) {
      unreadable += 1;
      continue;
    }
    const text = stdout.text ?? "";
    if (typeof text !== "string" || !text.trim()) {
      unreadable += 1;
      continue;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") rows.push(parsed);
      else unreadable += 1;
    } catch {
      unreadable += 1;
    }
  }
  return { rows, unreadable };
}

// MUST stay equal to the `default:` declared for the project parameter above. It
// exists only so the report can say out loud that this run is the built-in demo.
const DEMO_PROJECT = "gitlab-org/cli";

const validateData = readStepJson(ctx.step(stepName("validate_input")));
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

const listData = readStepJson(ctx.step(stepName("list_mrs")));
const { rows, unreadable } = readFanOutRows(ctx.step(stepName("gate_one")));

const BUCKETS = [
  ["READY_TO_MERGE", "READY TO MERGE - nothing is blocking these"],
  ["READY_WITH_UNKNOWNS", "PROBABLY READY - no blocker found, but something could not be read"],
  ["WAITING_ON_AUTHOR", "WAITING ON AUTHOR"],
  ["WAITING_ON_CI", "WAITING ON CI - nobody needs to act, just wait"],
  ["WAITING_ON_REVIEWERS", "WAITING ON REVIEWERS"],
  ["WAITING_ON_MAINTAINER", "WAITING ON MAINTAINER - needs a settings or CODEOWNERS fix"],
  ["WAITING_ON_PROCESS", "WAITING ON PROCESS - your own label rules"],
  ["WAITING_ON_ANOTHER_MR", "WAITING ON ANOTHER MERGE REQUEST"],
];

if (!listData) {
  out.human(
    "GITLAB MR QUEUE\n\n" +
    "UNAVAILABLE\n\n" +
    "  The merge request list could not be read, so nothing was triaged.\n" +
    "  This is not an empty queue - it is an unknown one.\n",
  );
  out.summary("UNAVAILABLE - the merge request list could not be read");
  out.result({
    ok: false, headline: "The merge request list could not be read, so nothing was triaged.",
    totals: {}, buckets: {}, rows: [], not_gated: [], no_result: [], note: "list step unreadable",
  });
} else {
  const grouped = new Map(BUCKETS.map(([key]) => [key, []]));
  const strays = [];
  for (const row of rows) {
    const key = String(row?.bucket ?? "");
    if (grouped.has(key)) grouped.get(key).push(row);
    else strays.push(row);
  }

  const gatedExpected = Array.isArray(listData.mrs) ? listData.mrs.length : 0;
  const seen = new Set(rows.map((r) => String(r?.iid ?? "")));
  const missing = (listData.mrs ?? [])
    .map((m) => m?.iid)
    .filter((iid) => !seen.has(String(iid)));

  // One sentence a maintainer could read out in a standup. Everything in it is
  // already computed below; this only decides which three numbers matter most.
  const readyNow = (grouped.get("READY_TO_MERGE") ?? []).length;
  const holdup = BUCKETS
    .filter(([key]) => key !== "READY_TO_MERGE" && key !== "READY_WITH_UNKNOWNS")
    .map(([key, heading]) => [heading.split(" - ")[0].toLowerCase(), (grouped.get(key) ?? []).length])
    .sort((a, b) => b[1] - a[1])[0];
  const oldestOpen = rows.reduce((m, r) => Math.max(m, Number(r?.days_open ?? -1)), -1);

  const headline = rows.length === 0
    ? "Nothing could be gated, so this queue is unknown rather than empty."
    : (String(listData.open_total ?? "?") + " open merge request" +
       (Number(listData.open_total ?? 0) === 1 ? ". " : "s. ") +
       (readyNow === 0 ? "None can merge right now" : readyNow + " can merge right now") +
       (holdup && holdup[1] > 0 ? "; the queue is mostly " + holdup[0] + " (" + holdup[1] + ")" : "") +
       (oldestOpen < 0 ? "." : ", and the oldest has been open " + oldestOpen + " days."));

  const isDemo = validateData !== null
    && String(validateData.project_input ?? "") === DEMO_PROJECT;

  const lines = [];
  lines.push("GITLAB MR QUEUE");
  lines.push("");
  if (isDemo) {
    lines.push("  DEMO RUN - no project was given, so this triaged a real public backlog");
    lines.push("  in gitlab-org/cli. Everything below is live data. Point it at your own:");
    lines.push("    rote play run princepanchani/gitlab-mr-queue project=your-group/your-repo");
    lines.push("");
  }
  for (const l of wrapLine(headline, 74, "  ")) lines.push(l);
  lines.push("");
  lines.push("  open merge requests : " + String(listData.open_total ?? "?"));
  lines.push("  fully gated         : " + rows.length + " of " + gatedExpected);
  if (listData.target_branch_filter) lines.push("  target branch filter: " + listData.target_branch_filter);
  if (listData.labels_filter) lines.push("  label filter        : " + listData.labels_filter);
  lines.push("");

  for (const [key, heading] of BUCKETS) {
    const group = grouped.get(key) ?? [];
    if (group.length === 0) continue;
    lines.push(heading + "  (" + group.length + ")");
    // Worst first: the oldest thing in a bucket is the one that needs a decision.
    group.sort((a, b) => Number(b?.days_open ?? -1) - Number(a?.days_open ?? -1));
    for (const row of group) {
      const open = Number(row?.days_open ?? -1);
      const idle = Number(row?.days_idle ?? -1);
      const age = (open < 0 ? "age unknown" : open + "d open") +
        (idle < 0 ? "" : ", " + idle + "d idle") +
        (row?.stale ? "  << STALE" : "");
      lines.push("  !" + String(row?.iid ?? "?") + "  [" + age + "]  " +
        String(row?.title_display_only ?? ""));
      lines.push("        " + String(row?.web_url ?? ""));
      const bl = Array.isArray(row?.blockers) ? row.blockers : [];
      for (const b of bl) {
        lines.push("        - [" + String(b?.owner ?? "?") + "] " + String(b?.statement ?? ""));
      }
      const uk = Array.isArray(row?.unknowns) ? row.unknowns : [];
      for (const u of uk) {
        lines.push("        ? not measured: " + String(u));
      }
      lines.push("        author " + String(row?.author ?? "?") +
        " | into " + String(row?.target_branch ?? "?") +
        " | pipeline " + String(row?.pipeline_status ?? "?") +
        " | updated " + String(row?.updated_at ?? "?"));
    }
    lines.push("");
  }

  const emptyBuckets = BUCKETS.filter(([key]) => (grouped.get(key) ?? []).length === 0).map(([key]) => key);
  if (emptyBuckets.length) {
    lines.push("EMPTY BUCKETS: " + emptyBuckets.join(", "));
    lines.push("");
  }

  if (strays.length) {
    lines.push("UNRECOGNISED BUCKET (" + strays.length + ") - the gate reported a bucket this report does not know");
    for (const row of strays) lines.push("  !" + String(row?.iid ?? "?") + " -> " + String(row?.bucket ?? "?"));
    lines.push("");
  }

  if (missing.length || unreadable) {
    lines.push("NO GATE RESULT (" + (missing.length || unreadable) + ")");
    lines.push("  These merge requests were listed but produced no readable gate result.");
    lines.push("  They are UNKNOWN, not clean.");
    if (missing.length) lines.push("  iids: " + missing.join(", "));
    if (unreadable) lines.push("  unreadable observations: " + unreadable);
    lines.push("");
  }

  const notGated = Array.isArray(listData.not_gated) ? listData.not_gated : [];
  if (notGated.length) {
    lines.push("LISTED BUT NOT GATED (" + notGated.length + ") - raise max_mrs to include these");
    for (const m of notGated.slice(0, 20)) {
      lines.push("  !" + String(m?.iid ?? "?") + "  " + String(m?.detailed_merge_status ?? "?") +
        "  " + String(m?.title_display_only ?? ""));
    }
    if (notGated.length > 20) lines.push("  ... and " + (notGated.length - 20) + " more");
    lines.push("");
  }

  // ---- rot ledger: how long has this queue been sitting, not just how big is it ----
  const aged = rows.filter((r) => Number(r?.days_open ?? -1) >= 0)
    .map((r) => Number(r.days_open)).sort((a, b) => a - b);
  const staleRows = rows.filter((r) => r?.stale);
  const staleAfter = Number(rows[0]?.stale_after_days ?? 14);

  lines.push("ROT LEDGER");
  if (aged.length === 0) {
    lines.push("  no ages could be read");
  } else {
    const median = aged[Math.floor((aged.length - 1) / 2)];
    lines.push("  oldest open        : " + aged[aged.length - 1] + " days");
    lines.push("  median open        : " + median + " days");
    lines.push("  over 90 days       : " + aged.filter((d) => d > 90).length + " of " + aged.length);
    lines.push("  idle " + String(staleAfter).padEnd(3) + "+ days     : " + staleRows.length +
      "  (stale_after_days=" + staleAfter + ")");
    const precision = rows.some((r) => r?.timeline_precision === "exact")
      ? "exact (blocker start read from label events)"
      : "approximate (no token: idle time stands in for blocker age)";
    lines.push("  timeline precision : " + precision);
  }
  lines.push("");

  // ---- review load: whose queue is this, and how long have they held it ----
  const load = new Map();
  for (const row of rows) {
    for (const person of (Array.isArray(row?.waiting_on) ? row.waiting_on : [])) {
      const name = String(person);
      if (!load.has(name)) load.set(name, { count: 0, totalDays: 0, worst: 0, stale: 0 });
      const entry = load.get(name);
      const open = Number(row?.days_open ?? 0);
      entry.count += 1;
      entry.totalDays += Math.max(open, 0);
      entry.worst = Math.max(entry.worst, Math.max(open, 0));
      if (row?.stale) entry.stale += 1;
    }
  }
  const ranked = [...load.entries()].sort((a, b) => b[1].totalDays - a[1].totalDays);

  lines.push("REVIEW LOAD - who the queue is actually waiting on");
  if (ranked.length === 0) {
    lines.push("  nobody - every blocker here is a wait, not a task");
  } else {
    lines.push("  waiting on            MRs   oldest   avg age   stale");
    for (const [name, s] of ranked) {
      const avg = Math.round(s.totalDays / Math.max(s.count, 1));
      lines.push("  " + name.slice(0, 20).padEnd(22) +
        String(s.count).padStart(3) + "   " +
        (s.worst + "d").padStart(6) + "   " +
        (avg + "d").padStart(7) + "   " +
        String(s.stale).padStart(5));
    }
    const ignored = new Set();
    for (const row of rows) {
      for (const person of (Array.isArray(row?.ignored_reviewers) ? row.ignored_reviewers : [])) {
        ignored.add(String(person));
      }
    }
    if (ignored.size) {
      lines.push("");
      lines.push("  excluded by ignore_reviewers: " + [...ignored].join(", "));
    }
    lines.push("");
    lines.push("  This is queue load, not performance. An unassigned reviewer slot shows as");
    lines.push("  'unassigned reviewers' - that is a routing gap, not somebody being slow.");
  }
  lines.push("");

  lines.push("Read-only: nothing was approved, merged, rebased, commented or labelled.");
  lines.push("A merge request with no gate result is unknown, not mergeable.");

  out.human(lines.join("\n"));

  const counts = BUCKETS.map(([key]) => key + "=" + (grouped.get(key) ?? []).length).join(" ");
  const oldest = aged.length ? aged[aged.length - 1] : null;
  // The one sentence first, because the summary is often all a caller reads; the
  // machine-shaped bucket counts follow it rather than replacing it.
  out.summary(headline + " [" + counts + "]" +
    (oldest === null ? "" : " stale=" + staleRows.length));

  const buckets = {};
  for (const [key] of BUCKETS) buckets[key] = (grouped.get(key) ?? []).map((r) => r?.iid);

  // result is canonical. human and summary are intentionally lossy views.
  out.result({
    ok: true,
    headline,
    totals: {
      open_total: listData.open_total ?? null,
      gated_expected: gatedExpected,
      gated_actual: rows.length,
      not_gated: notGated.length,
      unreadable_observations: unreadable,
    },
    buckets,
    rot_ledger: {
      oldest_days: aged.length ? aged[aged.length - 1] : null,
      median_days: aged.length ? aged[Math.floor((aged.length - 1) / 2)] : null,
      over_90_days: aged.filter((d) => d > 90).length,
      stale_count: staleRows.length,
      stale_after_days: staleAfter,
      timeline_precision: rows.some((r) => r?.timeline_precision === "exact") ? "exact" : "approximate",
    },
    review_load: ranked.map(([name, s]) => ({
      waiting_on: name,
      mrs: s.count,
      oldest_days: s.worst,
      avg_days: Math.round(s.totalDays / Math.max(s.count, 1)),
      stale: s.stale,
    })),
    rows,
    not_gated: notGated,
    no_result: missing,
    note: "A merge request with no gate result is unknown, not mergeable. Buckets name the earliest actor who must move. review_load is queue load, not performance.",
  });
}
