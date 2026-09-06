"""The triage logic for gitlab-pipeline-triage.

"Pipeline failed" is three different sentences wearing one coat:

  1. a job failed that GitLab was told not to care about (allow_failure), so the
     pipeline is red but nothing is actually blocked;
  2. a job failed because a runner died, timed out or was descheduled, which is
     not a code problem and a retry may simply clear it;
  3. a job failed that ALSO fails on the target branch right now, so fixing it
     is not this author's move. Note the tense: the comparison is against the
     branch's current pipeline, which may be NEWER than this merge request's, so
     this bucket cannot claim the failure came first - only that it is not
     unique to this branch.

Only what is left after those three is the author's actual work. This module
separates them, and it does it from data alone - no heuristics over log text,
because a log line is author-controlled and unbounded.

Called with positional argv so it can be exercised directly by selfcheck.py
without a network, a runner or a fixture.
"""
import json, sys


def arg(i, default=""):
    return sys.argv[i] if len(sys.argv) > i and sys.argv[i] != "" else default


# ---------------------------------------------------------------- inputs
mr_state        = arg(1, "unmeasured")
mr_web_url      = arg(2)
mr_author       = arg(3)
mr_target       = arg(4)
mr_title        = arg(5)          # display only, read by no rule
pipe_id         = arg(6, "-1")
pipe_status     = arg(7, "unmeasured")
pipe_web_url    = arg(8)
pipe_reason     = arg(9)
pipe_count      = arg(10, "-1")
jobs_csv        = arg(11)
jobs_reason     = arg(12)
base_id         = arg(13, "-1")
base_status     = arg(14, "unmeasured")
base_web_url    = arg(15)
base_reason     = arg(16)
base_jobs_csv   = arg(17)
base_jobs_reason = arg(18)
# Which target-branch pipeline the baseline came from. Reported rather than
# assumed, because a scheduled run and a push run answer different questions.
base_route      = arg(19)
# 1 when the job list hit the paging ceiling, so it is known-incomplete.
jobs_truncated  = arg(20, "0")
# 1 when the baseline pipeline had actually FINISHED. An unfinished baseline has
# an incomplete job list, which would make a not-yet-started job look absent.
base_final      = arg(21, "1")


def as_int(text, fallback=-1):
    try:
        return int(text)
    except (TypeError, ValueError):
        return fallback


# A pipeline in one of these states has not finished, so nothing about it is a
# verdict yet. Reporting "failed" for a pipeline still running would be a lie
# with a short shelf life.
PENDING = {
    "created", "waiting_for_resource", "preparing", "pending", "running",
    "manual", "scheduled",
}

# GitLab's own failure_reason values that are NOT the author's code. Keeping
# this as an explicit allow-list means an unfamiliar reason is treated as a code
# failure - the conservative direction, because it keeps work with the author
# rather than waving it off as flaky infrastructure.
INFRA_REASONS = {
    "runner_system_failure", "stuck_or_timeout_failure", "scheduler_failure",
    "api_failure", "runner_unsupported", "insufficient_runner_resources",
    "no_matching_runner", "scheduler_resources_unavailable",
    "data_integrity_failure", "archived_failure", "forward_deployment_failure",
}

# Reasons that mean the job never ran because something upstream stopped it.
# The job is not the problem and retrying it alone will not help.
UPSTREAM_REASONS = {
    "downstream_pipeline_creation_failed", "upstream_bridge_project_not_found",
    "insufficient_bridge_permissions", "invalid_bridge_trigger",
    "downstream_bridge_project_not_found", "user_blocked", "project_deleted",
    "pipeline_loop_detected", "reached_max_descendant_pipelines_depth",
}


def unescape(field):
    """Reverse of fetch.py clean(). Order matters: %25 must come LAST, or a
    literal "%7C" in a job name would be decoded twice into a delimiter."""
    return (field.replace("%7C", "|")
                 .replace("%3B", ";")
                 .replace("%25", "%"))


def unpack(csv):
    """Reverse of fetch.py pack_jobs(). Tolerates a trailing separator."""
    rows = []
    for chunk in str(csv or "").split(";"):
        if not chunk.strip():
            continue
        parts = chunk.split("|")
        # Pad rather than reject: a short record means a field was empty, and
        # dropping the whole job because its failure_reason was blank would hide
        # a real failure.
        while len(parts) < 5:
            parts.append("")
        rows.append({
            "name": unescape(parts[0]),
            "stage": unescape(parts[1]),
            "status": unescape(parts[2]),
            "allow_failure": parts[3] == "1",
            "failure_reason": unescape(parts[4]),
        })
    return rows


jobs = unpack(jobs_csv)
base_jobs = unpack(base_jobs_csv)
base_by_name = {j["name"]: j for j in base_jobs}

unknowns = []


def unknown(dimension, reason):
    unknowns.append({"dimension": dimension, "reason": reason})


# ------------------------------------------------------- baseline readability
# The baseline is what makes "is this mine?" answerable. Whether it is available
# is itself a fact worth stating, because every classification below inherits
# its confidence from this one line.
if base_jobs_reason:
    baseline = "unreadable"
    unknown("baseline", base_jobs_reason or "the target branch jobs could not be read")
elif base_reason:
    baseline = "unreadable"
    unknown("baseline", base_reason or "the target branch pipeline could not be read")
elif as_int(base_id) < 0:
    baseline = "absent"
    unknown("baseline",
            "no pipeline has run on " + (mr_target or "the target branch") +
            ", so there is nothing to compare these failures against")
elif not base_jobs:
    baseline = "absent"
    unknown("baseline", "the target branch pipeline reported no jobs")
elif base_final != "1":
    # Comparing against a pipeline that is still running would call a job that
    # simply has not started yet "absent from the target branch", and pin a
    # failure on the author on that basis.
    baseline = "in_progress"
    unknown("baseline",
            "the newest comparable pipeline on " + (mr_target or "the target branch") +
            " has not finished (status " + (base_status or "unknown") + "), so its job "
            "list is incomplete and nothing is attributed from it")
else:
    baseline = "readable"


def classify(job):
    """Decide whose problem one failed job is, and why.

    Order matters: an infrastructure failure is diagnosed before the baseline is
    consulted, because a runner that died says nothing about whether the code is
    broken, and comparing it to the target branch would invent a signal.
    """
    reason = job["failure_reason"]
    if reason in INFRA_REASONS:
        return ("infrastructure",
                "GitLab reports failure_reason=" + reason + ", which is a runner or "
                "scheduler failure rather than a code failure",
                "whoever owns the CI runners",
                "Retry the job. If it fails the same way twice, escalate to whoever "
                "owns the runners rather than changing the code.")
    if reason in UPSTREAM_REASONS:
        return ("upstream",
                "GitLab reports failure_reason=" + reason + ", so this job never ran "
                "on its own merits",
                "whoever owns the pipeline configuration",
                "Fix the upstream trigger or bridge; retrying this job alone will "
                "not help.")

    twin = base_by_name.get(job["name"])
    if baseline != "readable":
        return ("unverifiable",
                "the target branch could not be read, so it is unknown whether this "
                "job was already failing",
                mr_author or "the author",
                "Check whether " + job["name"] + " also fails on " +
                (mr_target or "the target branch") + " before assuming this change "
                "caused it.")
    if twin is None:
        return ("new_job",
                "no job named " + job["name"] + " ran on " +
                (mr_target or "the target branch") + ", so there is no baseline",
                mr_author or "the author",
                "This job exists only on this branch, so nothing rules the change "
                "out as the cause.")
    if twin["status"] == "failed":
        # Deliberately present tense. This compares against the target branch's
        # CURRENT pipeline, which may be newer than this merge request's - so a
        # failure someone pushed to the target after this MR ran also lands
        # here. "Also failing there now" is provable; "was broken first" is not.
        return ("pre_existing",
                job["name"] + " also fails on " + (mr_target or "the target branch") +
                " in the pipeline this run compared against",
                "whoever broke " + (mr_target or "the target branch"),
                "Not this merge request's move: fix it on " +
                (mr_target or "the target branch") + ", or rebase once it is fixed.")
    if twin["status"] == "success":
        return ("introduced",
                job["name"] + " passes on " + (mr_target or "the target branch") +
                " and fails here",
                mr_author or "the author",
                "This is the one to look at first: the job is green on " +
                (mr_target or "the target branch") + ", so the change is the likely cause.")
    return ("unverifiable",
            job["name"] + " last finished on " + (mr_target or "the target branch") +
            " with status " + (twin["status"] or "unknown") + ", which settles nothing",
            mr_author or "the author",
            "Re-run the target branch pipeline to get a baseline worth comparing to.")


failed_jobs = [j for j in jobs if j["status"] == "failed"]
blocking, advisory = [], []

for job in failed_jobs:
    kind, evidence, owner, nxt = classify(job)
    record = {
        "job": job["name"],
        "stage": job["stage"],
        "classification": kind,
        "evidence": evidence,
        "owner": owner,
        "next": nxt,
        "failure_reason": job["failure_reason"] or "none reported",
    }
    # allow_failure is GitLab's own statement that this job must not block a
    # merge. Honouring it is the difference between a red pipeline and a blocked
    # one, and conflating them is why "the pipeline is red" stops meaning
    # anything to a team.
    (advisory if job["allow_failure"] else blocking).append(record)

if jobs_truncated == "1":
    unknown("jobs",
            "the pipeline has more jobs than this run was willing to page through, so "
            "a failure beyond the ceiling would not appear here")
if jobs_reason:
    unknown("jobs", jobs_reason or "the pipeline's jobs could not be read")
if pipe_reason:
    unknown("pipeline", pipe_reason or "the merge request's pipelines could not be read")

# ---------------------------------------------------------------- verdict
pipeline_present = as_int(pipe_id) > 0
job_level_readable = not jobs_reason and bool(jobs)

if mr_state not in ("opened", "unmeasured"):
    verdict = "NOT_OPEN"
    headline = ("MR !%s is %s, so its pipeline no longer gates anything."
                % (mr_web_url.rsplit("/", 1)[-1] or "?", mr_state))
    whose_move = "nobody - this merge request is " + mr_state
elif pipe_reason and not pipeline_present:
    verdict = "UNAVAILABLE"
    headline = "The pipeline could not be read, so nothing was triaged."
    whose_move = "nobody - no triage was produced"
elif as_int(pipe_count) == 0 or (not pipeline_present and not pipe_reason):
    verdict = "NO_PIPELINE"
    headline = "No pipeline has ever run for this merge request."
    whose_move = "whoever owns the CI configuration"
elif pipe_status in PENDING:
    verdict = "PIPELINE_PENDING"
    headline = ("The pipeline is still %s, so there is no failure to triage yet."
                % pipe_status)
    whose_move = "nobody - wait for the pipeline to finish"
elif pipe_status == "success":
    verdict = "PIPELINE_GREEN"
    headline = "The latest pipeline passed; no job is blocking this merge request."
    whose_move = "nobody - the pipeline is not what is holding this up"
elif not job_level_readable:
    # The pipeline says failed but the jobs could not be read. That is a real
    # unknown and must not be dressed up as a triage.
    verdict = "UNAVAILABLE"
    headline = ("The pipeline is %s, but its jobs could not be read, so which job "
                "failed is unknown." % pipe_status)
    whose_move = "nobody - no per-job triage was possible"
elif blocking:
    verdict = "BLOCKED_BY_PIPELINE"
    kinds = [b["classification"] for b in blocking]
    if "introduced" in kinds:
        whose_move = mr_author or "the author"
    elif all(k == "infrastructure" for k in kinds):
        whose_move = "whoever owns the CI runners"
    elif all(k == "pre_existing" for k in kinds):
        whose_move = "whoever broke " + (mr_target or "the target branch")
    elif all(k == "upstream" for k in kinds):
        whose_move = "whoever owns the pipeline configuration"
    else:
        whose_move = mr_author or "the author"
    intro = len([k for k in kinds if k == "introduced"])
    pre = len([k for k in kinds if k == "pre_existing"])
    infra = len([k for k in kinds if k == "infrastructure"])
    bits = []
    if intro:
        bits.append("%d look%s caused by this change" % (intro, "" if intro != 1 else "s"))
    if pre:
        bits.append("%d already fail%s on %s"
                    % (pre, "" if pre != 1 else "s", mr_target or "the target branch"))
    if infra:
        bits.append("%d %s infrastructure" % (infra, "are" if infra != 1 else "is"))
    tail = ("; " + ", ".join(bits) + ".") if bits else "."
    headline = ("%d job%s blocking this merge request%s"
                % (len(blocking), "s are" if len(blocking) != 1 else " is", tail))
elif advisory:
    verdict = "ADVISORY_ONLY"
    headline = ("The pipeline is red, but every failed job is marked allow_failure, "
                "so none of them blocks the merge.")
    whose_move = "nobody - no failing job blocks this merge request"
else:
    # Reached when the pipeline is neither green, pending, nor failed - canceled
    # or skipped - and no failed job was found. Calling that ADVISORY_ONLY would
    # assert "every failure was allowed" when there was no failure at all.
    verdict = "PIPELINE_INCONCLUSIVE"
    headline = ("The pipeline is %s and reported no failed job, so there is nothing "
                "to attribute." % pipe_status)
    whose_move = ("whoever cancelled or skipped it"
                  if pipe_status in ("canceled", "skipped")
                  else "nobody - the pipeline reached no conclusion")

# ------------------------------------------------------------- fix order
# Cheapest-first, then the author's real work, then what is not theirs at all.
# A retry that clears an infrastructure failure can turn the pipeline green
# without anybody reading code, so it goes first.
ORDER = {"infrastructure": 0, "upstream": 1, "introduced": 2, "new_job": 3,
         "unverifiable": 4, "pre_existing": 5}
fix_order = []
for record in sorted(blocking, key=lambda r: ORDER.get(r["classification"], 9)):
    fix_order.append({
        "job": record["job"],
        "action": record["next"],
        "who": record["owner"],
        "why": record["evidence"],
    })

summary_bits = []
if blocking:
    summary_bits.append("%d blocking" % len(blocking))
if advisory:
    summary_bits.append("%d advisory" % len(advisory))
if unknowns:
    summary_bits.append("%d unknown" % len(unknowns))
summary = ", ".join(summary_bits) if summary_bits else "nothing to triage"

stages = [
    {"name": "merge_request", "measured": mr_state != "unmeasured", "reason": ""},
    {"name": "pipeline", "measured": not pipe_reason, "reason": pipe_reason},
    {"name": "jobs", "measured": not jobs_reason, "reason": jobs_reason},
    {"name": "baseline", "measured": baseline == "readable",
     "reason": base_jobs_reason or base_reason or (
         "" if baseline == "readable" else "no comparable pipeline on the target branch"),
     "route": base_route if baseline == "readable" else ""},
]

print(json.dumps({
    "verdict": verdict,
    "summary": summary,
    "headline": headline,
    "whose_move": whose_move,
    "blocking": blocking,
    "advisory": advisory,
    "fix_order": fix_order,
    "unknowns": unknowns,
    "stages": stages,
    "baseline": baseline,
    "facts": {
        "mr_state": mr_state,
        "mr_web_url": mr_web_url,
        "mr_author": mr_author,
        "mr_target": mr_target,
        "mr_title_display_only": mr_title,
        "pipeline_id": as_int(pipe_id),
        "pipeline_status": pipe_status,
        "pipeline_web_url": pipe_web_url,
        "job_count": len(jobs),
        "failed_count": len(failed_jobs),
        "base_pipeline_id": as_int(base_id),
        "base_pipeline_status": base_status,
        "base_pipeline_web_url": base_web_url,
        "base_job_count": len(base_jobs),
        "base_pipeline_route": base_route,
        "base_pipeline_final": base_final == "1",
        "jobs_truncated": jobs_truncated == "1",
    },
}))
