"""Read one GitLab dimension for a merge request, over the public REST API.

Two lanes, deliberately:

  * A dimension that can be read emits measured=true with distilled fields.
  * A dimension that is genuinely unavailable (needs a token, rate limited,
    timed out) emits measured=false with a reason code AND EXITS 0, so one
    unreadable surface never kills the parallel peers or the whole verdict.
  * Only the merge request itself is load-bearing. If that cannot be read
    there is no verdict to give, so that case exits non-zero and blocks
    dependents, which is what --resume is for.

Output is FIXED SHAPE per kind: every key is always present, measured or not,
because a Play value edge must resolve to a scalar. A degraded dimension
carries a sentinel ("unmeasured", -1), never a missing key and never null.

Credential handling: the token is read from the environment, sent as a header
(never a query string, which lands in proxy and server logs), and never
printed. Only a boolean about its presence ever leaves this process.
"""
import json
import os
import socket
import sys
import urllib.parse
import urllib.error
import urllib.request

kind     = sys.argv[1]
api_base = sys.argv[2]
iid      = sys.argv[3]

try:
    timeout = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 25.0
except ValueError:
    timeout = 25.0
timeout = min(max(timeout, 1.0), 120.0)

PATHS = {
    "mr":             "/merge_requests/" + iid,
    "approvals":      "/merge_requests/" + iid + "/approvals",
    "approval_state": "/merge_requests/" + iid + "/approval_state",
    "pipelines":      "/merge_requests/" + iid + "/pipelines",
    "discussions":    "/merge_requests/" + iid + "/discussions?per_page=100",
}

# Only the MR itself is critical. Everything else may honestly be unknown.
CRITICAL = {"mr"}

SHAPE = {
    "mr": {
        "state": "unmeasured", "draft": "unmeasured", "has_conflicts": "unmeasured",
        "merge_status": "unmeasured", "detailed_merge_status": "unmeasured",
        "blocking_discussions_resolved": "unmeasured", "labels_csv": "",
        "source_branch": "", "target_branch": "", "web_url": "", "author": "",
        "sha": "", "title_display_only": "",
    },
    "approvals": {"approvals_required": -1, "approvals_left": -1, "approved_by_count": -1},
    "approval_state": {"rules_total": -1, "rules_unsatisfied_csv": "", "rules_detail_csv": ""},
    "pipelines": {"pipeline_count": -1, "latest_status": "unmeasured", "latest_web_url": ""},
    "discussions": {"threads": -1, "unresolved_threads": -1},
}

if kind not in PATHS:
    sys.stderr.write("gitlab-mr-gate: unknown dimension %r\n" % kind)
    raise SystemExit(1)


def emit(measured, reason, detail, fields):
    # reason is "" (not null) when measured, so a downstream value edge always
    # resolves to a scalar string.
    rec = {"kind": kind, "measured": measured, "reason": reason, "detail": detail}
    rec.update(SHAPE[kind])
    rec.update(fields)
    print(json.dumps(rec))


def degrade(reason, detail=""):
    if kind in CRITICAL:
        sys.stderr.write(
            "gitlab-mr-gate: cannot read the merge request itself (%s) %s\n" % (reason, detail))
        raise SystemExit(1)
    emit(False, reason, detail, {})
    raise SystemExit(0)


req = urllib.request.Request(api_base + PATHS[kind])
# GitLab authenticates these two token kinds with DIFFERENT headers: PRIVATE-TOKEN
# carries personal/project/group access tokens, JOB-TOKEN carries CI_JOB_TOKEN.
# Collapsing them and always sending PRIVATE-TOKEN makes a correctly configured
# CI job token fail authentication.
access_token = os.environ.get("GITLAB_TOKEN") or ""
job_token = os.environ.get("CI_JOB_TOKEN") or ""
token = access_token or job_token
if access_token:
    req.add_header("PRIVATE-TOKEN", access_token)
elif job_token:
    req.add_header("JOB-TOKEN", job_token)
req.add_header("Accept", "application/json")
req.add_header("User-Agent", "rote-gitlab-mr-gate")

page_headers = {}
try:
    with urllib.request.urlopen(req, timeout=timeout) as response:
        page_headers = response.headers
        raw = json.loads(response.read())
except urllib.error.HTTPError as exc:
    if exc.code in (401, 403):
        # A token WAS supplied and still got refused, so telling the caller they
        # need a token sends them hunting a credential problem they do not have.
        # This wording cost a real user several rounds of debugging.
        if token:
            degrade("auth_rejected",
                    "HTTP %d - the supplied token was refused for this dimension: it may be "
                    "expired, lack read_api scope, or not have access to this project" % exc.code)
        degrade("auth_required",
                "HTTP %d - this dimension needs a GITLAB_TOKEN with read_api scope" % exc.code)
    if exc.code == 404:
        # Fail closed. A 404 means the project/MR does not exist, or it is
        # private and was addressed anonymously. Never report a green verdict.
        if token:
            sys.stderr.write(
                "gitlab-mr-gate: HTTP 404 reading %s - no project or MR at this path that the "
                "supplied token can see. Check the full namespace path exactly as it appears in "
                "the GitLab URL, including any subgroups\n" % kind)
            raise SystemExit(1)
        sys.stderr.write(
            "gitlab-mr-gate: HTTP 404 reading %s - project or MR not found, or the project is "
            "private and no GITLAB_TOKEN was supplied\n" % kind)
        raise SystemExit(1)
    if exc.code == 429:
        degrade("rate_limited", "HTTP 429 - GitLab is rate limiting; re-run later")
    if 500 <= exc.code < 600:
        degrade("server_error", "HTTP %d from GitLab" % exc.code)
    degrade("http_error", "HTTP %d" % exc.code)
except (socket.timeout, TimeoutError):
    degrade("timeout", "no response within %gs" % timeout)
except urllib.error.URLError as exc:
    degrade("unreachable", "could not reach the GitLab host")
except json.JSONDecodeError:
    degrade("bad_payload", "response was not JSON - the API shape may have drifted")

if kind == "mr":
    emit(True, "", "", {
        "state": str(raw.get("state")),
        "draft": "true" if raw.get("draft") else "false",
        "has_conflicts": "true" if raw.get("has_conflicts") else "false",
        "merge_status": str(raw.get("merge_status")),
        "detailed_merge_status": str(raw.get("detailed_merge_status")),
        "blocking_discussions_resolved": "true" if raw.get("blocking_discussions_resolved") else "false",
        "labels_csv": ",".join(raw.get("labels") or []),
        "source_branch": str(raw.get("source_branch") or ""),
        "target_branch": str(raw.get("target_branch") or ""),
        "web_url": str(raw.get("web_url") or ""),
        "author": str((raw.get("author") or {}).get("username") or ""),
        "sha": str(raw.get("sha") or "")[:12],
        # DISPLAY ONLY. Author-controlled prose. No rule ever reads this.
        "title_display_only": (raw.get("title") or "")[:160],
    })
elif kind == "approvals":
    emit(True, "", "", {
        "approvals_required": int(raw.get("approvals_required") or 0),
        "approvals_left": int(raw.get("approvals_left") or 0),
        "approved_by_count": len(raw.get("approved_by") or []),
    })
elif kind == "approval_state":
    rules = raw.get("rules") or []
    unsatisfied = []
    detail = []
    for rule in rules:
        # Separators are stripped from names so the packed scalar cannot be
        # broken by a rule name that happens to contain one.
        name = str(rule.get("name") or "unnamed").replace(",", " ").replace(";", " ").replace("|", " ")
        if not rule.get("approved"):
            unsatisfied.append(name)
            detail.append("|".join([
                name,
                str(rule.get("rule_type") or "unknown"),
                str(rule.get("approvals_required") or 0),
                str(len(rule.get("eligible_approvers") or [])),
            ]))
    emit(True, "", "", {
        "rules_total": len(rules),
        "rules_unsatisfied_csv": ",".join(unsatisfied),
        "rules_detail_csv": ";".join(detail),
    })
elif kind == "pipelines":
    items = raw if isinstance(raw, list) else []
    latest = items[0] if items else None
    emit(True, "", "", {
        "pipeline_count": len(items),
        "latest_status": str(latest.get("status")) if latest else "none",
        "latest_web_url": str(latest.get("web_url") or "") if latest else "",
    })
elif kind == "discussions":
    # GitLab PAGINATES discussions and caps per_page at 100. Reading only the
    # first page and reporting zero unresolved would call an MR clean because its
    # blocking thread happened to sit on page 2. That is precisely the kind of
    # confidently-wrong answer this gate exists to avoid, so pages are followed
    # until the question is settled, and a page that cannot be read degrades the
    # whole dimension to unmeasured rather than passing a partial count off as a
    # complete one.
    MAX_PAGES = 20

    def count_unresolved(threads):
        found = 0
        for thread in threads:
            for note in (thread.get("notes") or []):
                if note.get("resolvable") and not note.get("resolved"):
                    found += 1
                    break
        return found

    def next_page_of(headers):
        try:
            return (headers.get("x-next-page") or "").strip()
        except AttributeError:
            return ""

    threads = raw if isinstance(raw, list) else []
    unresolved = count_unresolved(threads)
    seen = len(threads)
    next_page = next_page_of(page_headers)
    pages = 1

    # Once one unresolved thread is found the dimension is already decided as
    # blocking, so further pages cannot change the verdict and are not fetched.
    while next_page and unresolved == 0:
        if pages >= MAX_PAGES:
            degrade("too_many_pages",
                    "more than %d pages of discussions; refusing to report a partial "
                    "thread count as complete" % MAX_PAGES)
        page_req = urllib.request.Request(
            api_base + PATHS[kind] + "&page=" + urllib.parse.quote(next_page))
        if access_token:
            page_req.add_header("PRIVATE-TOKEN", access_token)
        elif job_token:
            page_req.add_header("JOB-TOKEN", job_token)
        page_req.add_header("Accept", "application/json")
        page_req.add_header("User-Agent", "rote-gitlab-mr-gate")
        try:
            with urllib.request.urlopen(page_req, timeout=timeout) as page_response:
                more = json.loads(page_response.read())
                next_page = next_page_of(page_response.headers)
        except Exception:
            degrade("partial_pages",
                    "page %d of discussions could not be read; the unresolved count so far "
                    "is incomplete and is not reported as clean" % (pages + 1))
        items = more if isinstance(more, list) else []
        unresolved += count_unresolved(items)
        seen += len(items)
        pages += 1

    # Only counts cross this boundary. No comment prose enters any record.
    emit(True, "", "", {"threads": seen, "unresolved_threads": unresolved})
