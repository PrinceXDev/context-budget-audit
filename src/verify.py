"""Independently re-derive the verdict's top claims by a DIFFERENT route.

Two witnesses the verdict step never consulted:

  1. A FRESH read of the merge request. The gate composed its answer from five
     reads taken earlier; if someone approved, pushed, resolved a thread or
     relabelled in between, the verdict is already stale. That is reported as
     CHANGED with the fields that moved, rather than printed as live.

  2. GitLab's OWN composed judgement, detailed_merge_status. The gate builds its
     answer by composing separate dimensions; GitLab computes a single verdict
     server-side by its own logic. Where the two disagree, that disagreement is
     the finding.

Process-label blockers are excluded from the contradiction test on purpose:
GitLab cannot know that a label means do-not-merge, so it calling such an MR
mergeable is agreement, not conflict.
"""
import json
import os
import socket
import sys
import urllib.error
import urllib.request


def arg(i, d=""):
    return sys.argv[i] if len(sys.argv) > i else d


api_base       = arg(1)
iid            = arg(2)
our_verdict    = arg(3)
our_dms        = arg(4)
our_labels_csv = arg(5)
our_draft      = arg(6)
our_conflicts  = arg(7)
our_disc       = arg(8)
blocker_dims   = [x for x in arg(9).split(",") if x]

try:
    timeout = float(arg(10, "25") or 25)
except ValueError:
    timeout = 25.0
timeout = min(max(timeout, 1.0), 120.0)

checks = []


def check(name, status, detail):
    checks.append({"check": name, "status": status, "detail": detail})


req = urllib.request.Request(api_base + "/merge_requests/" + iid)
token = os.environ.get("GITLAB_TOKEN") or os.environ.get("CI_JOB_TOKEN") or ""
if token:
    req.add_header("PRIVATE-TOKEN", token)
req.add_header("Accept", "application/json")
req.add_header("User-Agent", "rote-gitlab-mr-gate-verify")

fresh = None
reason = ""
try:
    with urllib.request.urlopen(req, timeout=timeout) as response:
        fresh = json.loads(response.read())
except urllib.error.HTTPError as exc:
    reason = "HTTP %d" % exc.code
except (socket.timeout, TimeoutError):
    reason = "timeout after %gs" % timeout
except urllib.error.URLError:
    reason = "host unreachable"
except json.JSONDecodeError:
    reason = "response was not JSON"

if fresh is None:
    # Verification is itself a dimension that can be unknown. It must never be
    # reported as CONFIRMED just because it could not run.
    check("second_read", "UNCERTAIN",
          "could not re-read the merge request (%s), so nothing was re-derived" % reason)
    print(json.dumps({
        "verified": False,
        "checks": checks,
        "confirmed": 0,
        "changed": 0,
        "contradicted": 0,
        "uncertain": len(checks),
        "note": "Verification could not run. The verdict above stands unverified.",
    }))
    raise SystemExit(0)

# ---- witness 1: did anything move between the two reads? ----
fresh_labels = ",".join(fresh.get("labels") or [])
fresh_draft = "true" if fresh.get("draft") else "false"
fresh_conflicts = "true" if fresh.get("has_conflicts") else "false"
fresh_disc = "true" if fresh.get("blocking_discussions_resolved") else "false"
fresh_dms = str(fresh.get("detailed_merge_status"))

moved = []
if fresh_dms != our_dms:
    moved.append("detailed_merge_status %s -> %s" % (our_dms, fresh_dms))
if fresh_labels != our_labels_csv:
    moved.append("labels changed")
if fresh_draft != our_draft:
    moved.append("draft %s -> %s" % (our_draft, fresh_draft))
if fresh_conflicts != our_conflicts:
    moved.append("has_conflicts %s -> %s" % (our_conflicts, fresh_conflicts))
if fresh_disc != our_disc:
    moved.append("blocking_discussions_resolved %s -> %s" % (our_disc, fresh_disc))

if moved:
    check("second_read", "CHANGED",
          "the merge request moved between the gate's read and this one: " + "; ".join(moved))
else:
    check("second_read", "CONFIRMED",
          "a fresh read returned the same state the gate reasoned about")

# ---- witness 2: GitLab's own composed judgement ----
gitlab_says_mergeable = fresh_dms == "mergeable"
gitlab_undecided = fresh_dms in ("checking", "unchecked", "approvals_syncing")
non_process = [d for d in blocker_dims if d != "process_labels"]

if gitlab_undecided:
    check("cross_check_detailed_merge_status", "UNCERTAIN",
          "GitLab has not finished computing mergeability (%s), so it cannot act as a "
          "second witness yet" % fresh_dms)
elif our_verdict in ("MERGEABLE", "MERGEABLE_WITH_UNKNOWNS"):
    if gitlab_says_mergeable:
        check("cross_check_detailed_merge_status", "CONFIRMED",
              "GitLab independently reports detailed_merge_status=mergeable")
    else:
        check("cross_check_detailed_merge_status", "CONTRADICTED",
              "this gate found no blocker, but GitLab reports detailed_merge_status=%s - "
              "trust GitLab and treat the pass as unsafe" % fresh_dms)
elif our_verdict == "BLOCKED":
    if not gitlab_says_mergeable:
        check("cross_check_detailed_merge_status", "CONFIRMED",
              "GitLab also refuses this merge (detailed_merge_status=%s)" % fresh_dms)
    elif non_process:
        check("cross_check_detailed_merge_status", "CONTRADICTED",
              "this gate blocked on %s, but GitLab reports mergeable - the gate may be "
              "stricter than GitLab, or a blocker cleared between reads"
              % ", ".join(sorted(set(non_process))))
    else:
        check("cross_check_detailed_merge_status", "CONFIRMED",
              "GitLab reports mergeable and every blocker here is one of your own process "
              "label rules, which GitLab cannot know about - the two agree")
else:
    check("cross_check_detailed_merge_status", "UNCERTAIN",
          "verdict %s has no defined cross-check" % our_verdict)

counts = {"CONFIRMED": 0, "CHANGED": 0, "CONTRADICTED": 0, "UNCERTAIN": 0}
for item in checks:
    counts[item["status"]] = counts.get(item["status"], 0) + 1

print(json.dumps({
    "verified": True,
    "checks": checks,
    "confirmed": counts["CONFIRMED"],
    "changed": counts["CHANGED"],
    "contradicted": counts["CONTRADICTED"],
    "uncertain": counts["UNCERTAIN"],
    "fresh_detailed_merge_status": fresh_dms,
    "note": "Re-derived by a fresh read and by GitLab's own composed judgement, "
            "neither of which the gate step consulted.",
}))
