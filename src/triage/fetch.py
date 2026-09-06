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
import json, os, socket, sys, urllib.error, urllib.parse, urllib.request

kind     = sys.argv[1] if len(sys.argv) > 1 else ""
api_base = sys.argv[2] if len(sys.argv) > 2 else ""
selector = sys.argv[3] if len(sys.argv) > 3 else ""

# A branch name is not URL-safe. Git allows "&", "#", "+" and more, and pasting
# one raw after "ref=" either truncates the query at the "#" or invents extra
# parameters at the "&" - and the wrong baseline silently drives every
# introduced/pre-existing ownership call downstream. Encode it.
selector_q = urllib.parse.quote(str(selector), safe="")

# Only base_pipeline uses this: the target branch, as a FALLBACK when the merge
# base has no pipeline of its own.
fallback_ref = sys.argv[5] if len(sys.argv) > 5 else ""
fallback_ref_q = urllib.parse.quote(str(fallback_ref), safe="")

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
    # selector is the MERGE BASE sha here - the commit this merge request
    # branched from. That is the only baseline that can honestly answer "was
    # this already broken before my change?", because the branch's CURRENT
    # pipeline may be newer than the merge request's and may carry a regression
    # somebody else pushed afterwards. Ten are fetched rather than one because
    # a given commit can have several pipelines (push, schedule, security
    # policy) whose job lists differ; pick_base() chooses a comparable one.
    "base_pipeline": "/pipelines?per_page=10&sha=" + selector_q,
    # Fallback, used only when the merge base has no pipeline at all.
    "base_pipeline_by_ref": "/pipelines?per_page=10&ref=" + fallback_ref_q,
}

# GitLab caps per_page at 100 and pages the rest. A pipeline with more than 100
# jobs is normal on a large project - gitlab-org/gitlab runs hundreds - and
# reading only the first page would drop later failures out of the triage
# entirely, understating the blockers and even turning a blocked pipeline into
# ADVISORY_ONLY. These dimensions are therefore followed to exhaustion.
PAGINATED = {"jobs"}

# Only the MR itself is critical. Everything else may honestly be unknown: a
# triage that cannot read the baseline still has something true to say about the
# failing jobs, and saying it with the baseline marked unknown beats saying
# nothing.
CRITICAL = {"mr"}

SHAPE = {
    "mr": {
        "state": "unmeasured", "source_branch": "", "target_branch": "",
        "web_url": "", "author": "", "sha": "", "title_display_only": "",
        "detailed_merge_status": "unmeasured", "base_sha": "",
    },
    "mr_pipelines": {
        "pipeline_id": -1, "pipeline_status": "unmeasured", "pipeline_web_url": "",
        "pipeline_sha": "", "pipeline_source": "", "pipeline_count": -1,
        "pipeline_created_at": "",
    },
    "jobs": {"jobs_csv": "", "job_count": -1, "failed_count": -1, "jobs_truncated": 0},
    "base_pipeline": {
        "base_pipeline_id": -1, "base_pipeline_status": "unmeasured",
        "base_pipeline_web_url": "", "base_pipeline_source": "",
        "base_pipeline_route": "", "base_pipeline_final": 0,
        "base_pipeline_created_at": "",
        # 1 when the baseline really is the merge base, so a failure there
        # provably predates this merge request's changes. 0 when we had to fall
        # back to the branch tip, where it provably does not.
        "base_at_merge_base": 0,
    },
}

SHAPE["base_pipeline_by_ref"] = SHAPE["base_pipeline"]

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
    """Escape one field so the packed job string can be decoded losslessly.

    Job and stage names are author-controlled and may contain the delimiters.
    An earlier version REPLACED them ("|" -> "/"), which collapsed two distinct
    jobs named "a|b" and "a/b" onto the same key - and since the baseline is
    matched by name, either job could then inherit the other's status and
    ownership. Percent-escaping the three meaningful characters keeps the
    mapping injective, so distinct names stay distinct.
    """
    text = str(value if value is not None else "").strip()
    return (text.replace("%", "%25")
                .replace("|", "%7C")
                .replace(";", "%3B"))


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


# GitLab authenticates these two token kinds with DIFFERENT headers:
# PRIVATE-TOKEN carries personal/project/group access tokens, JOB-TOKEN carries
# CI_JOB_TOKEN. Collapsing them and always sending PRIVATE-TOKEN makes a
# correctly configured CI job token fail authentication.
access_token = os.environ.get("GITLAB_TOKEN") or ""
job_token = os.environ.get("CI_JOB_TOKEN") or ""
token = access_token or job_token


def build_request(path):
    req = urllib.request.Request(api_base + path)
    if access_token:
        req.add_header("PRIVATE-TOKEN", access_token)
    elif job_token:
        req.add_header("JOB-TOKEN", job_token)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "rote-gitlab-pipeline-triage")
    return req


# A hard ceiling on paging, so a pathological project cannot make this run
# forever. Reaching it is REPORTED rather than silently accepted - see
# jobs_truncated - because a partial job list that claims to be complete is
# exactly the kind of quiet wrongness this play exists to avoid.
MAX_PAGES = 20

truncated = False


def fetch_all(path):
    """GET path, following x-next-page when this dimension is paginated."""
    global truncated
    if kind not in PAGINATED:
        return fetch_page(path)[0]

    collected = []
    next_path = path
    for _ in range(MAX_PAGES):
        page, headers = fetch_page(next_path)
        if not isinstance(page, list):
            return page
        collected.extend(page)
        nxt = str(headers.get("x-next-page") or "").strip()
        if not nxt:
            return collected
        sep = "&" if "?" in path else "?"
        next_path = path + sep + "page=" + urllib.parse.quote(nxt, safe="")
    truncated = True
    return collected


def fetch_page(path):
    try:
        with urllib.request.urlopen(build_request(path), timeout=timeout) as response:
            return json.loads(response.read()), response.headers
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


raw = fetch_all(PATHS[kind])

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
        # The commit this merge request branched from. The baseline pipeline is
        # looked up at THIS sha, not at the branch tip.
        "base_sha": str((raw.get("diff_refs") or {}).get("base_sha") or ""),
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
        "pipeline_created_at": str(latest.get("created_at") or ""),
    })

elif kind == "jobs":
    items = raw if isinstance(raw, list) else []
    failed = [j for j in items if str(j.get("status")) == "failed"]
    emit(True, "", "", {
        "jobs_csv": pack_jobs(items),
        "job_count": len(items),
        "failed_count": len(failed),
        # Say so when the page ceiling was hit. A partial job list that presents
        # itself as complete would let the triage miss a blocker.
        "jobs_truncated": 1 if truncated else 0,
    })

elif kind == "base_pipeline":
    items = raw if isinstance(raw, list) else []
    at_merge_base = bool(items)
    if not items and fallback_ref:
        # No pipeline ever ran at the merge base. Fall back to the branch tip,
        # which is still informative - but it CANNOT establish that a failure
        # predates this merge request, and the record says so.
        items = fetch_all(PATHS["base_pipeline_by_ref"])
        items = items if isinstance(items, list) else []
    if not items:
        emit(True, "",
             "no pipeline ran at the merge base or on the target branch", {})
        raise SystemExit(0)

    # A pipeline still in flight has an incomplete job list, so comparing
    # against it can call a job "new" merely because it has not started yet.
    # Only these statuses mean the branch has finished telling us something.
    FINAL = {"success", "failed", "canceled", "skipped"}

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
        # Prefer a FINISHED pipeline of a comparable kind. Only if the branch
        # has nothing finished at all do we fall back to an unfinished one, and
        # then the record says so rather than quietly comparing against a
        # moving target.
        for require_final in (True, False):
            for preferred in ("push", "merge_request_event"):
                for candidate in candidates:
                    if str(candidate.get("source")) != preferred:
                        continue
                    if require_final and str(candidate.get("status")) not in FINAL:
                        continue
                    return candidate, "latest %s%s pipeline" % (
                        "" if require_final else "unfinished ", preferred)
        return (candidates[0],
                "newest pipeline of any kind (no push pipeline found, so the job "
                "lists may not be comparable)")

    chosen, route = pick_base(items)
    route = (("the merge base commit, " + route) if at_merge_base
             else ("the TARGET BRANCH TIP rather than the merge base, " + route +
                   " - so it cannot establish that a failure predates this change"))
    emit(True, "", "", {
        "base_pipeline_id": int(chosen.get("id") or -1),
        "base_pipeline_status": str(chosen.get("status") or "unmeasured"),
        "base_pipeline_web_url": str(chosen.get("web_url") or ""),
        "base_pipeline_source": str(chosen.get("source") or ""),
        "base_pipeline_route": route,
        "base_pipeline_final": 1 if str(chosen.get("status")) in FINAL else 0,
        "base_pipeline_created_at": str(chosen.get("created_at") or ""),
        "base_at_merge_base": 1 if at_merge_base else 0,
    })
