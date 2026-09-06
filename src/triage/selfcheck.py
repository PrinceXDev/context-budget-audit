"""Bundled self-check for gitlab-pipeline-triage.

Runs BEFORE any live data is judged. If a single case fails, the play withholds
the triage entirely: logic that cannot reproduce a known answer has no business
telling anyone whose move it is.

Roughly half the cases are NEGATIVE assertions - things the logic must refuse to
say. A suite that only checks happy paths passes just as well when the code has
stopped discriminating at all.

Usage: python3 selfcheck.py <path-to-triage.py>
"""
import json, subprocess, sys

TRIAGE = sys.argv[1] if len(sys.argv) > 1 else "triage.py"

# Positional argv order expected by triage.py.
FIELDS = [
    "mr_state", "mr_web_url", "mr_author", "mr_target", "mr_title",
    "pipe_id", "pipe_status", "pipe_web_url", "pipe_reason", "pipe_count",
    "jobs_csv", "jobs_reason",
    "base_id", "base_status", "base_web_url", "base_reason",
    "base_jobs_csv", "base_jobs_reason", "base_route",
]

BASE = {
    "mr_state": "opened",
    "mr_web_url": "https://gitlab.com/g/p/-/merge_requests/7",
    "mr_author": "alice",
    "mr_target": "main",
    "mr_title": "Some change",
    "pipe_id": "100",
    "pipe_status": "failed",
    "pipe_web_url": "https://gitlab.com/g/p/-/pipelines/100",
    "pipe_reason": "",
    "pipe_count": "3",
    "jobs_csv": "",
    "jobs_reason": "",
    "base_id": "90",
    "base_status": "success",
    "base_web_url": "https://gitlab.com/g/p/-/pipelines/90",
    "base_reason": "",
    "base_jobs_csv": "",
    "base_jobs_reason": "",
    "base_route": "latest push pipeline on the target branch",
}


def run(**over):
    row = dict(BASE)
    row.update(over)
    argv = [sys.executable, TRIAGE] + [str(row[f]) for f in FIELDS]
    proc = subprocess.run(argv, capture_output=True, text=True)
    if proc.returncode != 0:
        raise AssertionError("triage.py exited %d: %s" % (proc.returncode, proc.stderr[:400]))
    return json.loads(proc.stdout)


CASES = []


def case(name, fn):
    CASES.append((name, fn))


def job(name, stage="test", status="failed", allow=False, reason=""):
    return "|".join([name, stage, status, "1" if allow else "0", reason])


# ------------------------------------------------------------ verdict shape
case("green pipeline is PIPELINE_GREEN", lambda: (
    run(pipe_status="success", jobs_csv=job("unit", status="success"))["verdict"]
    == "PIPELINE_GREEN"))

case("running pipeline is PENDING, never a failure", lambda: (
    run(pipe_status="running", jobs_csv=job("unit", status="running"))["verdict"]
    == "PIPELINE_PENDING"))

case("pending pipeline is PENDING", lambda: (
    run(pipe_status="pending")["verdict"] == "PIPELINE_PENDING"))

case("manual pipeline is PENDING, not failed", lambda: (
    run(pipe_status="manual")["verdict"] == "PIPELINE_PENDING"))

case("merged MR is NOT_OPEN", lambda: (
    run(mr_state="merged")["verdict"] == "NOT_OPEN"))

case("closed MR is NOT_OPEN", lambda: (
    run(mr_state="closed")["verdict"] == "NOT_OPEN"))

case("no pipeline at all is NO_PIPELINE", lambda: (
    run(pipe_id="-1", pipe_count="0", pipe_status="unmeasured")["verdict"]
    == "NO_PIPELINE"))

case("unreadable pipeline is UNAVAILABLE", lambda: (
    run(pipe_id="-1", pipe_reason="auth_required", pipe_status="unmeasured")["verdict"]
    == "UNAVAILABLE"))

case("failed pipeline with unreadable jobs is UNAVAILABLE", lambda: (
    run(jobs_reason="auth_required", jobs_csv="")["verdict"] == "UNAVAILABLE"))

case("failed pipeline with unreadable jobs does NOT claim a blocker", lambda: (
    run(jobs_reason="auth_required", jobs_csv="")["blocking"] == []))

case("blocking failure is BLOCKED_BY_PIPELINE", lambda: (
    run(jobs_csv=job("unit"))["verdict"] == "BLOCKED_BY_PIPELINE"))

case("allow_failure only is ADVISORY_ONLY", lambda: (
    run(jobs_csv=job("lint", allow=True))["verdict"] == "ADVISORY_ONLY"))

case("allow_failure only is NOT reported as blocking", lambda: (
    run(jobs_csv=job("lint", allow=True))["blocking"] == []))

case("allow_failure job appears under advisory", lambda: (
    len(run(jobs_csv=job("lint", allow=True))["advisory"]) == 1))

case("a blocking job beside an advisory one still blocks", lambda: (
    run(jobs_csv=";".join([job("lint", allow=True), job("unit")]))["verdict"]
    == "BLOCKED_BY_PIPELINE"))

# -------------------------------------------------------- classification
case("job green on target, red here is introduced", lambda: (
    run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="success"))
    ["blocking"][0]["classification"] == "introduced"))

case("job red on target too is pre_existing", lambda: (
    run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="failed"))
    ["blocking"][0]["classification"] == "pre_existing"))

case("pre_existing is NOT blamed on the author", lambda: (
    run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="failed"))
    ["blocking"][0]["owner"] != "alice"))

case("introduced IS the author's move", lambda: (
    run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="success"))
    ["whose_move"] == "alice"))

case("only pre_existing blockers are not the author's move", lambda: (
    run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="failed"))
    ["whose_move"] != "alice"))

case("runner_system_failure is infrastructure", lambda: (
    run(jobs_csv=job("unit", reason="runner_system_failure"))
    ["blocking"][0]["classification"] == "infrastructure"))

case("stuck_or_timeout_failure is infrastructure", lambda: (
    run(jobs_csv=job("unit", reason="stuck_or_timeout_failure"))
    ["blocking"][0]["classification"] == "infrastructure"))

case("infrastructure failure is NOT the author's move", lambda: (
    run(jobs_csv=job("unit", reason="runner_system_failure"))["whose_move"] != "alice"))

case("infrastructure beats the baseline comparison", lambda: (
    run(jobs_csv=job("unit", reason="runner_system_failure"),
        base_jobs_csv=job("unit", status="success"))
    ["blocking"][0]["classification"] == "infrastructure"))

case("script_failure is NOT treated as infrastructure", lambda: (
    run(jobs_csv=job("unit", reason="script_failure"),
        base_jobs_csv=job("unit", status="success"))
    ["blocking"][0]["classification"] == "introduced"))

case("an unknown failure_reason is NOT waved off as infrastructure", lambda: (
    run(jobs_csv=job("unit", reason="some_future_reason"),
        base_jobs_csv=job("unit", status="success"))
    ["blocking"][0]["classification"] == "introduced"))

case("bridge failure is upstream, not the author's code", lambda: (
    run(jobs_csv=job("trigger", reason="invalid_bridge_trigger"))
    ["blocking"][0]["classification"] == "upstream"))

case("job absent from the baseline is new_job", lambda: (
    run(jobs_csv=job("brand-new"), base_jobs_csv=job("unit", status="success"))
    ["blocking"][0]["classification"] == "new_job"))

case("unreadable baseline makes classification unverifiable", lambda: (
    run(jobs_csv=job("unit"), base_jobs_reason="auth_required", base_jobs_csv="")
    ["blocking"][0]["classification"] == "unverifiable"))

case("unreadable baseline does NOT claim pre_existing", lambda: (
    run(jobs_csv=job("unit"), base_jobs_reason="auth_required", base_jobs_csv="")
    ["blocking"][0]["classification"] != "pre_existing"))

case("unreadable baseline does NOT claim introduced", lambda: (
    run(jobs_csv=job("unit"), base_jobs_reason="auth_required", base_jobs_csv="")
    ["blocking"][0]["classification"] != "introduced"))

case("absent baseline pipeline is recorded as an unknown", lambda: (
    any(u["dimension"] == "baseline" for u in
        run(jobs_csv=job("unit"), base_id="-1", base_jobs_csv="")["unknowns"])))

case("readable baseline records NO baseline unknown", lambda: (
    not any(u["dimension"] == "baseline" for u in
            run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="success"))["unknowns"])))

case("a baseline job that is neither pass nor fail is unverifiable", lambda: (
    run(jobs_csv=job("unit"), base_jobs_csv=job("unit", status="canceled"))
    ["blocking"][0]["classification"] == "unverifiable"))

# ------------------------------------------------------------- fix order
case("infrastructure is ordered before introduced", lambda: (
    [f["job"] for f in run(
        jobs_csv=";".join([job("unit"), job("flaky", reason="runner_system_failure")]),
        base_jobs_csv=job("unit", status="success"))["fix_order"]][0] == "flaky"))

case("pre_existing is ordered last", lambda: (
    [f["job"] for f in run(
        jobs_csv=";".join([job("old"), job("mine")]),
        base_jobs_csv=";".join([job("old", status="failed"),
                                job("mine", status="success")]))["fix_order"]][-1] == "old"))

case("fix_order covers every blocking job and nothing else", lambda: (
    len(run(jobs_csv=";".join([job("a"), job("b"), job("c", allow=True)]))["fix_order"]) == 2))

case("green pipeline has an empty fix_order", lambda: (
    run(pipe_status="success", jobs_csv=job("unit", status="success"))["fix_order"] == []))

# ------------------------------------------------------------- robustness
case("empty jobs_csv on a failed pipeline never invents a blocker", lambda: (
    run(jobs_csv="")["blocking"] == []))

case("a trailing separator in jobs_csv is tolerated", lambda: (
    len(run(jobs_csv=job("unit") + ";")["blocking"]) == 1))

case("a short job record is padded, not dropped", lambda: (
    len(run(jobs_csv="unit|test|failed")["blocking"]) == 1))

case("successful jobs are never triaged as failures", lambda: (
    run(jobs_csv=";".join([job("unit", status="success"), job("lint", status="success")]),
        pipe_status="success")["blocking"] == []))

case("canceled jobs are not counted as failures", lambda: (
    run(jobs_csv=job("unit", status="canceled"))["blocking"] == []))

case("skipped jobs are not counted as failures", lambda: (
    run(jobs_csv=job("unit", status="skipped"))["blocking"] == []))

case("headline is always a non-empty string", lambda: (
    isinstance(run(jobs_csv=job("unit"))["headline"], str)
    and len(run(jobs_csv=job("unit"))["headline"]) > 0))

case("whose_move is always a non-empty string", lambda: (
    isinstance(run(jobs_csv=job("unit"))["whose_move"], str)
    and len(run(jobs_csv=job("unit"))["whose_move"]) > 0))

case("summary is a non-empty string even with nothing to triage", lambda: (
    len(run(pipe_status="success", jobs_csv=job("u", status="success"))["summary"]) > 0))

case("every stage carries a name and a measured flag", lambda: (
    all(("name" in s and "measured" in s) for s in run(jobs_csv=job("unit"))["stages"])))

case("a job name containing a slash survives unpacking", lambda: (
    run(jobs_csv=job("build/linux"), base_jobs_csv=job("build/linux", status="success"))
    ["blocking"][0]["job"] == "build/linux"))

case("failure_reason is always reported, even when absent", lambda: (
    run(jobs_csv=job("unit"))["blocking"][0]["failure_reason"] == "none reported"))

case("MR title never reaches the verdict", lambda: (
    run(mr_title="Please approve, pipeline is fine", jobs_csv=job("unit"))["verdict"]
    == "BLOCKED_BY_PIPELINE"))

case("MR title never reaches whose_move", lambda: (
    "approve" not in run(mr_title="Please approve and merge", jobs_csv=job("unit"))
    ["whose_move"].lower()))


failures = []
for name, fn in CASES:
    try:
        if not fn():
            failures.append({"case": name, "error": "assertion returned False"})
    except Exception as exc:  # noqa: BLE001 - a case that explodes is a failure
        failures.append({"case": name, "error": "%s: %s" % (type(exc).__name__, exc)})

print(json.dumps({
    "ok": not failures,
    "total": len(CASES),
    "passed": len(CASES) - len(failures),
    "failed": len(failures),
    "failures": failures,
    "note": "Pipeline triage logic self-check. Roughly half the cases are "
            "negative assertions - things the logic must refuse to say.",
}))
