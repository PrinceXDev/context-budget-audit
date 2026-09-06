"""One GitLab read per surface, for gitlab-pipeline-triage.

Every dimension emits a FIXED-SHAPE FLAT record: every key is always present,
with a sentinel ("unmeasured", -1, "") when a value could not be measured, never
null and never a missing key. Rote value edges must resolve to scalars, so a
downstream jq expression that reaches for a key which sometimes vanishes breaks
the run rather than degrading it.

Job lists cannot cross a step edge as JSON - value edges are scalars only and
tojson is prohibited - so they are encoded as a delimited string, the same way
the sibling gate play carries its approval-rule detail. See pack_jobs().
"""
import json, os, socket, sys, urllib.error, urllib.request

kind     = sys.argv[1] if len(sys.argv) > 1 else ""
api_base = sys.argv[2] if len(sys.argv) > 2 else ""
selector = sys.argv[3] if len(sys.argv) > 3 else ""

try:
    timeout = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 25.0
except ValueError:
    timeout = 25.0
timeout = min(max(timeout, 1.0), 120.0)

PATHS = {
    # The merge request itself, and the pipelines GitLab associates with it.
    "mr":            "/merge_requests/" + selector,
    "mr_pipelines":  "/merge_requests/" + selector + "/pipelines?per_page=20",
    # selector is a pipeline id here.
    "jobs":          "/pipelines/" + selector + "/jobs?per_page=100",
    # selector is a branch name here; GitLab wants it as a ref query. Ten are
    # fetched rather than one because the NEWEST pipeline on a branch is often a
    # scheduled or security-policy run whose job list does not resemble what a
    # push builds - comparing against it would report half the jobs as having no
    # baseline. pick_base() below chooses a comparable one.
    "base_pipeline": "/pipelines?per_page=10&ref=" + selector,
}

# Only the MR itself is critical. Everything else may honestly be unknown: a
# triage that cannot read the baseline still has something true to say about the
# failing jobs, and saying it with the baseline marked unknown beats saying
# nothing.
CRITICAL = {"mr"}

SHAPE = {
    "mr": {
        "state": "unmeasured", "source_branch": "", "target_branch": "",
        "web_url": "", "author": "", "sha": "", "title_display_only": "",
        "detailed_merge_status": "unmeasured",
    },
    "mr_pipelines": {
        "pipeline_id": -1, "pipeline_status": "unmeasured", "pipeline_web_url": "",
        "pipeline_sha": "", "pipeline_source": "", "pipeline_count": -1,
    },
    "jobs": {"jobs_csv": "", "job_count": -1, "failed_count": -1},
    "base_pipeline": {
        "base_pipeline_id": -1, "base_pipeline_status": "unmeasured",
        "base_pipeline_web_url": "", "base_pipeline_source": "",
        "base_pipeline_route": "",
    },
}

if kind not in PATHS:
    sys.stderr.write("gitlab-pipeline-triage: unknown dimension %r\n" % kind)
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
            "gitlab-pipeline-triage: cannot read the merge request itself (%s) %s\n"
            % (reason, detail))
        raise SystemExit(1)
    emit(False, reason, detail, {})
    raise SystemExit(0)


def clean(value):
    """Make one field safe to place inside the packed job string.

    Job and stage names are author-controlled and may contain the delimiters, so
    they are replaced rather than escaped: this string is read by a report, not
    round-tripped, and a mangled name is a far smaller problem than a record
    boundary appearing in the middle of a field.
    """
    return str(value if value is not None else "").replace("|", "/").replace(";", ",").strip()


def pack_jobs(items):
    """Encode jobs as name|stage|status|allow_failure|failure_reason, ; between.

    Only the fields the triage logic actually reasons about are carried, so the
    string stays short enough to pass as one process argument.
    """
    packed = []
    for j in items:
        packed.append("|".join([
            clean(j.get("name")),
            clean(j.get("stage")),
            clean(j.get("status")),
            "1" if j.get("allow_failure") else "0",
            clean(j.get("failure_reason")),
        ]))
    return ";".join(packed)


req = urllib.request.Request(api_base + PATHS[kind])
# GitLab authenticates these two token kinds with DIFFERENT headers:
# PRIVATE-TOKEN carries personal/project/group access tokens, JOB-TOKEN carries
# CI_JOB_TOKEN. Collapsing them and always sending PRIVATE-TOKEN makes a
# correctly configured CI job token fail authentication.
access_token = os.environ.get("GITLAB_TOKEN") or ""
job_token = os.environ.get("CI_JOB_TOKEN") or ""
token = access_token or job_token
if access_token:
    req.add_header("PRIVATE-TOKEN", access_token)
elif job_token:
    req.add_header("JOB-TOKEN", job_token)
req.add_header("Accept", "application/json")
req.add_header("User-Agent", "rote-gitlab-pipeline-triage")

try:
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = json.loads(response.read())
except urllib.error.HTTPError as exc:
    if exc.code in (401, 403):
        # A token WAS supplied and still got refused, so telling the caller they
        # need a token sends them hunting a credential problem they do not have.
        if token:
            degrade("auth_rejected",
                    "HTTP %d - the supplied token was refused for this dimension: it may be "
                    "expired, lack read_api scope, or not have access to this project" % exc.code)
        degrade("auth_required",
                "HTTP %d - this dimension needs a GITLAB_TOKEN with read_api scope" % exc.code)
    if exc.code == 404:
        # Fail closed ONLY where a 404 is genuinely ambiguous, which is the merge
        # request itself. That dimension guards project existence for every other
        # one: if the path is wrong, or the project is private and was addressed
        # anonymously, `mr` 404s and the run aborts there with no triage. A 404 on
        # a sub-resource that was reached at all means that endpoint is absent,
        # and the honest answer is unknown - not a bad project path. The sibling
        # gate play learned this the hard way against GitLab Community Edition.
        if kind in CRITICAL:
            if token:
                sys.stderr.write(
                    "gitlab-pipeline-triage: HTTP 404 reading %s - no project or MR at this path "
                    "that the supplied token can see. Check the full namespace path exactly as it "
                    "appears in the GitLab URL, including any subgroups\n" % kind)
                raise SystemExit(1)
            sys.stderr.write(
                "gitlab-pipeline-triage: HTTP 404 reading %s - project or MR not found, or the "
                "project is private and no GITLAB_TOKEN was supplied\n" % kind)
            raise SystemExit(1)
        degrade("absent",
                "HTTP 404 - this dimension is not available for this merge request on this "
                "GitLab instance")
    if exc.code == 429:
        degrade("rate_limited", "HTTP 429 - GitLab is rate limiting; re-run later")
    if 500 <= exc.code < 600:
        degrade("server_error", "HTTP %d from GitLab" % exc.code)
    degrade("http_error", "HTTP %d" % exc.code)
except (socket.timeout, TimeoutError):
    degrade("timeout", "no response within %gs" % timeout)
except urllib.error.URLError:
    degrade("unreachable", "could not reach the GitLab host")
except json.JSONDecodeError:
    degrade("bad_payload", "GitLab returned a body that is not JSON")

if kind == "mr":
    emit(True, "", "", {
        "state": str(raw.get("state") or "unmeasured"),
        "source_branch": str(raw.get("source_branch") or ""),
        "target_branch": str(raw.get("target_branch") or ""),
        "web_url": str(raw.get("web_url") or ""),
        "author": str((raw.get("author") or {}).get("username") or ""),
        "sha": str(raw.get("sha") or ""),
        "title_display_only": str(raw.get("title") or ""),
        "detailed_merge_status": str(raw.get("detailed_merge_status") or "unmeasured"),
    })

elif kind == "mr_pipelines":
    items = raw if isinstance(raw, list) else []
    if not items:
        # An MR with no pipeline at all is a real, reportable state, not a
        # failure to measure. Say so with a measured record.
        emit(True, "", "no pipeline has ever run for this merge request", {
            "pipeline_count": 0,
        })
        raise SystemExit(0)
    # GitLab returns these newest-first; the newest is the one that decides
    # whether the merge is currently blocked.
    latest = items[0]
    emit(True, "", "", {
        "pipeline_id": int(latest.get("id") or -1),
        "pipeline_status": str(latest.get("status") or "unmeasured"),
        "pipeline_web_url": str(latest.get("web_url") or ""),
        "pipeline_sha": str(latest.get("sha") or ""),
        "pipeline_source": str(latest.get("source") or ""),
        "pipeline_count": len(items),
    })

elif kind == "jobs":
    items = raw if isinstance(raw, list) else []
    failed = [j for j in items if str(j.get("status")) == "failed"]
    emit(True, "", "", {
        "jobs_csv": pack_jobs(items),
        "job_count": len(items),
        "failed_count": len(failed),
    })

elif kind == "base_pipeline":
    items = raw if isinstance(raw, list) else []
    if not items:
        emit(True, "", "no pipeline has run on the target branch", {})
        raise SystemExit(0)

    def pick_base(candidates):
        """Choose the target-branch pipeline worth comparing against.

        A push pipeline is what the branch builds when code lands, so it is the
        fair comparison for a merge request. A scheduled or security-policy run
        on the same branch usually has a different job list entirely, and
        picking it would report unrelated jobs as having no baseline. Falling
        back to the newest of anything keeps a project that only ever runs
        scheduled pipelines from losing its baseline completely - the route is
        reported either way, so the reader knows which comparison was made.
        """
        for preferred in ("push", "merge_request_event"):
            for candidate in candidates:
                if str(candidate.get("source")) == preferred:
                    return candidate, "latest %s pipeline on the target branch" % preferred
        return (candidates[0],
                "newest pipeline on the target branch (no push pipeline found, so the "
                "job lists may not be comparable)")

    chosen, route = pick_base(items)
    emit(True, "", "", {
        "base_pipeline_id": int(chosen.get("id") or -1),
        "base_pipeline_status": str(chosen.get("status") or "unmeasured"),
        "base_pipeline_web_url": str(chosen.get("web_url") or ""),
        "base_pipeline_source": str(chosen.get("source") or ""),
        "base_pipeline_route": route,
    })
