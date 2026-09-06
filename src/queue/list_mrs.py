"""List the open merge requests for one project, in a single request.

The GitLab list endpoint already carries detailed_merge_status, draft,
has_conflicts, blocking_discussions_resolved, labels, author and target_branch.
That means every open MR can be classified from ONE request, and the expensive
per-MR calls (approvals, approval rules, pipeline) are only needed to enrich the
ones actually being gated.

MRs beyond max_mrs are reported as listed-but-not-gated, with the status the list
already gave, rather than being silently dropped. Capped is not the same as clean.

Each emitted item carries api_base so the fan-out step downstream depends on this
step alone: a for_each source resolves against its single dependency, and adding a
second dependency to that step would make `$.` ambiguous.
"""
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

api_base      = sys.argv[1]
target_branch = sys.argv[2] if len(sys.argv) > 2 else ""
filter_labels = sys.argv[3] if len(sys.argv) > 3 else ""
max_mrs       = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 15

try:
    timeout = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] else 25.0
except ValueError:
    timeout = 25.0
timeout = min(max(timeout, 1.0), 120.0)

# "asc" on updated_at puts the least recently touched merge requests first, so
# the per-MR gating budget is spent on the ones nobody has looked at.
sort = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] in ("asc", "desc") else "asc"

query = {"state": "opened", "per_page": "100", "order_by": "updated_at", "sort": sort}
if target_branch:
    query["target_branch"] = target_branch
if filter_labels:
    query["labels"] = filter_labels

url = api_base + "/merge_requests?" + urllib.parse.urlencode(query)

req = urllib.request.Request(url)
token = os.environ.get("GITLAB_TOKEN") or os.environ.get("CI_JOB_TOKEN") or ""
if token:
    req.add_header("PRIVATE-TOKEN", token)
req.add_header("Accept", "application/json")
req.add_header("User-Agent", "rote-gitlab-mr-queue")

try:
    with urllib.request.urlopen(req, timeout=timeout) as response:
        total_header = response.headers.get("x-total")
        raw = json.loads(response.read())
except urllib.error.HTTPError as exc:
    if exc.code in (401, 403):
        # A token WAS supplied and still got refused. Saying "you need a token"
        # here sends the caller hunting a credential problem they do not have.
        if token:
            sys.stderr.write(
                "gitlab-mr-queue: HTTP %d listing merge requests - the supplied token was "
                "refused. It may be expired, lack read_api scope, or have no access to this "
                "project. Note that a project path which does not exist can also answer 401 "
                "rather than 404, so check the full namespace path exactly as it appears in "
                "the GitLab URL, including any subgroups\n" % exc.code)
            raise SystemExit(1)
        sys.stderr.write(
            "gitlab-mr-queue: HTTP %d listing merge requests - this project needs a "
            "GITLAB_TOKEN with read_api scope\n" % exc.code)
        raise SystemExit(1)
    if exc.code == 404:
        if token:
            sys.stderr.write(
                "gitlab-mr-queue: HTTP 404 - no project at this path that the supplied token "
                "can see. Check the full namespace path exactly as it appears in the GitLab "
                "URL, including any subgroups\n")
            raise SystemExit(1)
        sys.stderr.write(
            "gitlab-mr-queue: HTTP 404 - project not found, or it is private and no "
            "GITLAB_TOKEN was supplied\n")
        raise SystemExit(1)
    if exc.code == 429:
        sys.stderr.write("gitlab-mr-queue: HTTP 429 - GitLab is rate limiting; re-run later\n")
        raise SystemExit(1)
    sys.stderr.write("gitlab-mr-queue: HTTP %d listing merge requests\n" % exc.code)
    raise SystemExit(1)
except (socket.timeout, TimeoutError):
    sys.stderr.write("gitlab-mr-queue: timed out listing merge requests after %gs\n" % timeout)
    raise SystemExit(1)
except urllib.error.URLError:
    sys.stderr.write("gitlab-mr-queue: could not reach the GitLab host\n")
    raise SystemExit(1)
except json.JSONDecodeError:
    sys.stderr.write("gitlab-mr-queue: list response was not JSON - the API shape may have drifted\n")
    raise SystemExit(1)

if not isinstance(raw, list):
    sys.stderr.write("gitlab-mr-queue: expected a list of merge requests\n")
    raise SystemExit(1)


def people(seq):
    """Usernames only. No display names, emails or avatar URLs enter a record."""
    out = []
    for entry in (seq or []):
        name = (entry or {}).get("username")
        if name:
            out.append(str(name))
    return out


def brief(mr):
    return {
        "iid": mr.get("iid"),
        "draft": bool(mr.get("draft")),
        "has_conflicts": bool(mr.get("has_conflicts")),
        "detailed_merge_status": str(mr.get("detailed_merge_status") or "unknown"),
        "blocking_discussions_resolved": bool(mr.get("blocking_discussions_resolved")),
        "labels": mr.get("labels") or [],
        "author": str((mr.get("author") or {}).get("username") or ""),
        "target_branch": str(mr.get("target_branch") or ""),
        "web_url": str(mr.get("web_url") or ""),
        "updated_at": str(mr.get("updated_at") or "")[:10],
        # Full timestamps: the aging arithmetic happens downstream, and the date
        # alone loses the precision needed to distinguish hours from days.
        "created_at_full": str(mr.get("created_at") or ""),
        "updated_at_full": str(mr.get("updated_at") or ""),
        # Readable anonymously, which is what lets review load work with no token.
        "reviewers": people(mr.get("reviewers")),
        "assignees": people(mr.get("assignees")),
        "user_notes_count": int(mr.get("user_notes_count") or 0),
        # DISPLAY ONLY. Author-controlled prose; no rule reads it.
        "title_display_only": (mr.get("title") or "")[:100],
    }


gated = []
for mr in raw[:max_mrs]:
    item = brief(mr)
    item["api_base"] = api_base
    gated.append(item)

not_gated = [brief(mr) for mr in raw[max_mrs:]]

print(json.dumps({
    "ok": True,
    "open_total": len(raw),
    "open_total_header": total_header,
    "gating": len(gated),
    "not_gated_count": len(not_gated),
    "target_branch_filter": target_branch,
    "labels_filter": filter_labels,
    "sort": sort,
    "mrs": gated,
    "not_gated": not_gated,
}))
