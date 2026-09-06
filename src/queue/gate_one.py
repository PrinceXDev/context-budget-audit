"""Gate one merge request and say whose move it is.

Receives one MR object (as JSON) from the list step's fan-out, then enriches it
with the three per-MR dimensions the list endpoint does not carry: approval
counts, approval RULES, and the latest pipeline.

Discussions are deliberately NOT fetched here. The per-thread endpoint is
token-gated (HTTP 401 anonymously), while the list endpoint already supplies
blocking_discussions_resolved, which is readable with no credentials. That saves
one request per MR and keeps the whole play working for a stranger.

Every dimension degrades to a labeled unknown rather than failing, so one flaky
or token-gated surface never removes an MR from the triage table.
"""
import datetime
import json
import os
import socket
import sys
import urllib.error
import urllib.request

item_raw   = sys.argv[1]
item_index = sys.argv[2] if len(sys.argv) > 2 else "0"
required_labels  = [x.strip() for x in (sys.argv[3] if len(sys.argv) > 3 else "").split(",") if x.strip()]
forbidden_labels = [x.strip() for x in (sys.argv[4] if len(sys.argv) > 4 else "").split(",") if x.strip()]
require_pipeline_raw = (sys.argv[5] if len(sys.argv) > 5 else "auto").lower()

try:
    timeout = float(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] else 25.0
except ValueError:
    timeout = 25.0
timeout = min(max(timeout, 1.0), 120.0)

# How long is too long is a judgement no API can make. It travels as a parameter.
try:
    stale_after_days = int(sys.argv[7]) if len(sys.argv) > 7 and sys.argv[7] else 14
except ValueError:
    stale_after_days = 14
stale_after_days = min(max(stale_after_days, 1), 3650)

# Bot reviewers (GitLabDuo and friends) are assigned to nearly everything and
# would dominate any load table. Which accounts to discount is a human call.
ignore_reviewers = {x.strip() for x in (sys.argv[8] if len(sys.argv) > 8 else "").split(",") if x.strip()}

try:
    mr = json.loads(item_raw)
except json.JSONDecodeError:
    sys.stderr.write("gitlab-mr-queue: fan-out item %s was not JSON\n" % item_index)
    raise SystemExit(1)

api_base = str(mr.get("api_base") or "")
iid = str(mr.get("iid") or "")
if not api_base or not iid:
    sys.stderr.write("gitlab-mr-queue: fan-out item %s missing api_base or iid\n" % item_index)
    raise SystemExit(1)

TOKEN = os.environ.get("GITLAB_TOKEN") or os.environ.get("CI_JOB_TOKEN") or ""


def get(path):
    """Return (data, reason). reason is "" on success, a code on degrade."""
    req = urllib.request.Request(api_base + path)
    if TOKEN:
        req.add_header("PRIVATE-TOKEN", TOKEN)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "rote-gitlab-mr-queue")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read()), ""
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            return None, "auth_required"
        if exc.code == 404:
            return None, "not_found"
        if exc.code == 429:
            return None, "rate_limited"
        if 500 <= exc.code < 600:
            return None, "server_error"
        return None, "http_%d" % exc.code
    except (socket.timeout, TimeoutError):
        return None, "timeout"
    except urllib.error.URLError:
        return None, "unreachable"
    except json.JSONDecodeError:
        return None, "bad_payload"


DMS_AUTHOR = {
    "conflict": "has conflicts with the target branch",
    "need_rebase": "needs a rebase",
    "requested_changes": "a reviewer requested changes",
    "draft_status": "is still a draft",
    "discussions_not_resolved": "has unresolved blocking discussions",
}

approvals, appr_reason      = get("/merge_requests/" + iid + "/approvals")
astate, astate_reason       = get("/merge_requests/" + iid + "/approval_state")
pipelines, pipe_reason      = get("/merge_requests/" + iid + "/pipelines")

# ---- aging, from timestamps the list endpoint supplies with no token ----
NOW = datetime.datetime.now(datetime.timezone.utc)


def days_since(stamp):
    """Whole days since an ISO8601 timestamp, or -1 when unreadable."""
    if not stamp:
        return -1
    try:
        parsed = datetime.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
    except ValueError:
        return -1
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=datetime.timezone.utc)
    return max((NOW - parsed).days, 0)


days_open = days_since(mr.get("created_at_full"))
days_idle = days_since(mr.get("updated_at_full"))
is_stale = days_idle >= 0 and days_idle >= stale_after_days

blockers = []
unknowns = []

# ---- token-only precision: WHEN did the current blocker actually start ----
# Anonymously these endpoints return 401, so the run degrades to days_idle as an
# approximation and says so, rather than inventing a blocker start time.
blocked_label_since = -1
last_comment_days = -1
timeline_reason = ""
if TOKEN:
    events, timeline_reason = get("/merge_requests/" + iid + "/resource_label_events?per_page=100")
    if isinstance(events, list):
        present = set(mr.get("labels") or [])
        for event in events:
            if event.get("action") != "add":
                continue
            label = ((event.get("label") or {}).get("name"))
            if label and label in present and label in set(forbidden_labels):
                age = days_since(event.get("created_at"))
                if age >= 0 and (blocked_label_since < 0 or age > blocked_label_since):
                    blocked_label_since = age
    notes, notes_reason = get("/merge_requests/" + iid + "/notes?per_page=1&sort=desc&order_by=created_at")
    if isinstance(notes, list) and notes:
        last_comment_days = days_since(notes[0].get("created_at"))
    elif notes_reason:
        timeline_reason = timeline_reason or notes_reason
else:
    timeline_reason = "no_token"

# ---- author-side, straight from the list payload ----
if mr.get("draft"):
    blockers.append(("author", "is still a draft"))
if mr.get("has_conflicts"):
    blockers.append(("author", "has merge conflicts"))
if not mr.get("blocking_discussions_resolved"):
    blockers.append(("author", "has unresolved blocking discussions"))

dms = str(mr.get("detailed_merge_status") or "unknown")
if dms in ("need_rebase", "requested_changes"):
    blockers.append(("author", DMS_AUTHOR[dms]))
if dms == "blocked_status":
    blockers.append(("other_mr", "is blocked until another merge request merges"))
if dms in ("checking", "unchecked", "approvals_syncing"):
    unknowns.append("mergeability still being computed by GitLab (%s)" % dms)

# ---- reviewers ----
appr_left = -1
appr_required = -1
if approvals is None:
    unknowns.append("approval counts not read (%s)" % (appr_reason or "unknown"))
else:
    appr_required = int(approvals.get("approvals_required") or 0)
    appr_left = int(approvals.get("approvals_left") or 0)
    if appr_left > 0:
        blockers.append(("reviewers", "needs %d more approval(s) of %d" % (appr_left, appr_required)))

unsatisfied_rules = []
if astate is None:
    unknowns.append("approval rules not read (%s)" % (astate_reason or "unknown"))
else:
    for rule in (astate.get("rules") or []):
        if rule.get("approved"):
            continue
        name = str(rule.get("name") or "unnamed")
        eligible = len(rule.get("eligible_approvers") or [])
        rtype = str(rule.get("rule_type") or "unknown")
        unsatisfied_rules.append({"name": name, "rule_type": rtype, "eligible": eligible})
        if eligible > 0:
            blockers.append(("reviewers",
                             "rule %s (%s) unsatisfied - %d eligible approver(s)"
                             % (name, rtype, eligible)))
        elif TOKEN:
            # With a token the approver list is authoritative, so an empty one
            # really does mean nobody can satisfy this rule.
            blockers.append(("maintainer",
                             "rule %s (%s) has NO eligible approvers - needs a maintainer "
                             "or CODEOWNERS fix" % (name, rtype)))
        else:
            # ANONYMOUSLY, GitLab returns eligible_approvers as an empty list for
            # some projects and a populated one for others. An empty list here
            # therefore does NOT prove the rule is unsatisfiable, so the rule is
            # reported as a certain reviewer blocker while WHO can satisfy it is
            # recorded as genuinely unknown. Claiming a CODEOWNERS fault from
            # absent data would be a fabricated finding.
            blockers.append(("reviewers", "rule %s (%s) unsatisfied" % (name, rtype)))
            unknowns.append(
                "who can satisfy rule %s is not visible without a GITLAB_TOKEN "
                "(GitLab returned an empty eligible-approver list anonymously)" % name)

# ---- CI ----
pipe_status = "unmeasured"
pipe_url = ""
if pipelines is None:
    unknowns.append("pipeline not read (%s)" % (pipe_reason or "unknown"))
else:
    items = pipelines if isinstance(pipelines, list) else []
    latest = items[0] if items else None
    pipe_status = str(latest.get("status")) if latest else "none"
    pipe_url = str(latest.get("web_url") or "") if latest else ""
    # Whether a missing pipeline blocks a merge is a PROJECT SETTING. Under
    # "auto" GitLab is asked rather than second-guessed: it reports
    # detailed_merge_status=ci_must_pass exactly when a passing pipeline is
    # mandatory. Defaulting to true reported "has no pipeline at all" as a
    # blocker on projects that merge perfectly well without CI.
    if require_pipeline_raw == "auto":
        require_pipeline = dms in ("ci_must_pass", "ci_still_running")
    else:
        require_pipeline = require_pipeline_raw != "false"

    if pipe_status == "none":
        if require_pipeline:
            blockers.append(("author", "has no pipeline, and this project requires one"))
        else:
            unknowns.append("no pipeline exists, and this project does not require one to merge")
    elif pipe_status in ("failed", "canceled"):
        blockers.append(("author", "latest pipeline %s" % pipe_status))
    elif pipe_status in ("running", "pending", "created", "preparing", "scheduled",
                         "waiting_for_resource"):
        blockers.append(("ci", "pipeline is %s" % pipe_status))
    elif pipe_status == "manual":
        blockers.append(("maintainer", "pipeline is blocked on a manual job"))

# ---- the team's own process rules ----
labels = mr.get("labels") or []
missing = [x for x in required_labels if x not in labels]
if missing:
    blockers.append(("process", "missing required label(s): " + ", ".join(missing)))
present_forbidden = [x for x in forbidden_labels if x in labels]
if present_forbidden:
    blockers.append(("process", "carries blocking label(s): " + ", ".join(present_forbidden)))

# ---- whose move is it? Earliest thing that must happen wins. ----
OWNER_ORDER = ["author", "ci", "reviewers", "maintainer", "process", "other_mr"]
OWNER_BUCKET = {
    "author": "WAITING_ON_AUTHOR",
    "ci": "WAITING_ON_CI",
    "reviewers": "WAITING_ON_REVIEWERS",
    "maintainer": "WAITING_ON_MAINTAINER",
    "process": "WAITING_ON_PROCESS",
    "other_mr": "WAITING_ON_ANOTHER_MR",
}

owners_present = {owner for owner, _ in blockers}
if blockers:
    primary = next((o for o in OWNER_ORDER if o in owners_present), "author")
    bucket = OWNER_BUCKET[primary]
    verdict = "BLOCKED"
elif unknowns:
    primary = "nobody"
    bucket = "READY_WITH_UNKNOWNS"
    verdict = "MERGEABLE_WITH_UNKNOWNS"
else:
    primary = "nobody"
    bucket = "READY_TO_MERGE"
    verdict = "MERGEABLE"

reviewers = [r for r in (mr.get("reviewers") or []) if r not in ignore_reviewers]
ignored_reviewers = [r for r in (mr.get("reviewers") or []) if r in ignore_reviewers]

# Who is accountable for the WAITING, which is not always who must act next.
# A pipeline nobody needs to push is nobody's queue.
if primary == "reviewers":
    waiting_on = reviewers or ["unassigned reviewers"]
elif primary == "author":
    waiting_on = [mr.get("author") or "author"]
elif primary == "maintainer":
    waiting_on = ["maintainer"]
elif primary == "ci":
    waiting_on = []
else:
    waiting_on = []

print(json.dumps({
    "iid": mr.get("iid"),
    "index": item_index,
    "verdict": verdict,
    "bucket": bucket,
    "primary_owner": primary,
    "days_open": days_open,
    "days_idle": days_idle,
    "stale": bool(is_stale),
    "stale_after_days": stale_after_days,
    "blocked_label_since_days": blocked_label_since,
    "last_comment_days": last_comment_days,
    "timeline_precision": "exact" if TOKEN and not timeline_reason else "approximate",
    "timeline_reason": timeline_reason,
    "reviewers": reviewers,
    "ignored_reviewers": ignored_reviewers,
    "assignees": mr.get("assignees") or [],
    "notes_count": mr.get("user_notes_count"),
    "waiting_on": waiting_on,
    "author": mr.get("author"),
    "target_branch": mr.get("target_branch"),
    "updated_at": mr.get("updated_at"),
    "web_url": mr.get("web_url"),
    "title_display_only": mr.get("title_display_only"),
    "labels": labels,
    "detailed_merge_status": dms,
    "approvals_left": appr_left,
    "approvals_required": appr_required,
    "unsatisfied_rules": unsatisfied_rules,
    "pipeline_status": pipe_status,
    "pipeline_url": pipe_url,
    "blockers": [{"owner": o, "statement": s} for o, s in blockers],
    "unknowns": unknowns,
}))
