"""Bundled self-check for the verdict logic.

Runs verdict.py against 39 crafted cases with known answers before the play is
allowed to report anything about a real merge request. If any case fails, this
step exits non-zero, the verdict step is blocked, and no result is published.
A gate whose own decision logic is broken must withhold, not guess.

Half the cases are negative: they assert the verdict does NOT say something.
The most important is case 13 - an unmeasured dimension must never be allowed to
produce a clean MERGEABLE.
"""
import json
import subprocess
import sys

VERDICT = sys.argv[1]

#            1        2        3        4           5       6   7   8   9
BASE = ["opened", "false", "false", "mergeable", "true", "", "", "", "author",
        #  10   11   12   13  14
        "0", "0", "0", "", "",
        #  15         16  17
        "success", "", "0",
        #  18  19  20      21   22
        "", "", "auto", "1", "main",
        #  23  24  25  26  27
        "", "", "", "", "token"]


def run(**overrides):
    args = list(BASE)
    for index, value in overrides.items():
        args[int(index[1:]) - 1] = value
    proc = subprocess.run([sys.executable, VERDICT] + args,
                          capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError("verdict.py exited %d: %s" % (proc.returncode, proc.stderr[:200]))
    return json.loads(proc.stdout)


def dims(result):
    return [b["dimension"] for b in result.get("blockers", [])]


def unknown_dims(result):
    return [u["dimension"] for u in result.get("unknowns", [])]


def path_dims(result):
    return [s["dimension"] for s in result.get("merge_path", [])]


CASES = []


def case(name, fn):
    CASES.append((name, fn))


case("clean MR is MERGEABLE", lambda: (
    lambda r: r["verdict"] == "MERGEABLE" and not r["blockers"] and not r["unknowns"])(run()))

case("draft blocks", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "draft" in dims(r))(run(a2="true")))

case("conflicts block", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "conflicts" in dims(r))(run(a3="true")))

case("outstanding approvals block", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "approvals" in dims(r))(
        run(a10="2", a11="2", a4="not_approved")))

case("failed pipeline blocks", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "pipeline" in dims(r))(run(a15="failed")))

case("running pipeline blocks and is nobody's task", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and any(
        b["dimension"] == "pipeline" and "wait" in b["owner"] for b in r["blockers"]))(
            run(a15="running")))

case("no pipeline blocks when require_pipeline=true", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "pipeline" in dims(r))(
        run(a15="none", a20="true")))

case("NEGATIVE: no pipeline does NOT block when require_pipeline=false", lambda: (
    lambda r: r["verdict"] == "MERGEABLE_WITH_UNKNOWNS"
    and "pipeline" not in dims(r) and "pipeline" in unknown_dims(r))(
        run(a15="none", a20="false")))

case("CRITICAL NEGATIVE: auto does NOT invent a pipeline rule GitLab has not set", lambda: (
    lambda r: r["verdict"] == "MERGEABLE_WITH_UNKNOWNS"
    and "pipeline" not in dims(r) and "pipeline" in unknown_dims(r))(
        run(a15="none", a20="auto", a4="mergeable")))

case("auto DOES block when GitLab says ci_must_pass", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "pipeline" in dims(r))(
        run(a15="none", a20="auto", a4="ci_must_pass")))

case("forbidden label blocks", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "process_labels" in dims(r))(
        run(a6="Do Not Merge,x", a19="Do Not Merge")))

case("missing required label blocks", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "process_labels" in dims(r))(
        run(a6="other", a18="Status::Ready")))

case("NEGATIVE: required label present does NOT block", lambda: (
    lambda r: r["verdict"] == "MERGEABLE")(run(a6="Status::Ready", a18="Status::Ready")))

case("merged MR is NOT_OPEN and reports no blockers", lambda: (
    lambda r: r["verdict"] == "NOT_OPEN" and not r["blockers"])(run(a1="merged")))

case("unresolved threads block", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "discussions" in dims(r))(run(a17="3")))

case("CRITICAL NEGATIVE: unmeasured discussions never yield clean MERGEABLE", lambda: (
    lambda r: r["verdict"] == "MERGEABLE_WITH_UNKNOWNS"
    and "discussions" in unknown_dims(r))(run(a17="-1", a5="true")))

case("unmeasured threads still block when the MR flag says unresolved", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "discussions" in dims(r))(
        run(a17="-1", a5="false")))

case("NEGATIVE: empty approver list anonymously is NOT a CODEOWNERS fault", lambda: (
    lambda r: r["verdict"] == "BLOCKED"
    and "approval_rule" in dims(r)
    and "approval_rule_approvers" in unknown_dims(r)
    and not any("maintainer" in b["owner"] for b in r["blockers"]))(
        run(a12="1", a14="/docs/|code_owner|1|0", a27="anonymous")))

case("empty approver list WITH a token IS a maintainer fault", lambda: (
    lambda r: r["verdict"] == "BLOCKED"
    and any("maintainer" in b["owner"] for b in r["blockers"])
    and "approval_rule_approvers" not in unknown_dims(r))(
        run(a12="1", a14="/docs/|code_owner|1|0", a27="token")))

case("populated approver list names the count", lambda: (
    lambda r: any("77" in b["next_action"] for b in r["blockers"]))(
        run(a12="1", a14="/docs/|code_owner|1|77")))

case("unchecked mergeability is an unknown, not a blocker", lambda: (
    lambda r: r["verdict"] == "MERGEABLE_WITH_UNKNOWNS"
    and "mergeability" in unknown_dims(r))(run(a4="unchecked")))

case("need_rebase blocks and is the author's move", lambda: (
    lambda r: r["verdict"] == "BLOCKED" and "rebase" in dims(r)
    and any(b["dimension"] == "rebase" and b["owner"] == "author" for b in r["blockers"]))(
        run(a4="need_rebase")))

case("NEGATIVE: unmeasured approvals is an unknown, not a blocker", lambda: (
    lambda r: "approvals" in unknown_dims(r) and "approvals" not in dims(r))(
        run(a11="-1", a10="-1")))

case("merge path orders branch work before approvals", lambda: (
    lambda r: path_dims(r).index("conflicts") < path_dims(r).index("approvals"))(
        run(a3="true", a10="2", a11="2", a4="not_approved")))

case("merge path orders the pipeline before the approvals it can reset", lambda: (
    lambda r: path_dims(r).index("pipeline") < path_dims(r).index("approvals"))(
        run(a15="failed", a10="2", a11="2", a4="not_approved")))

case("merge path puts process-label bookkeeping last", lambda: (
    lambda r: path_dims(r)[-1] == "process_labels")(
        run(a3="true", a17="3", a6="Do Not Merge", a19="Do Not Merge")))

case("merge path covers every blocker exactly once", lambda: (
    lambda r: sorted(path_dims(r)) == sorted(dims(r)) and len(path_dims(r)) == len(dims(r)))(
        run(a2="true", a3="true", a15="failed", a17="3", a10="2", a11="2", a4="not_approved")))

case("merge path is numbered from 1 with no gaps", lambda: (
    lambda r: [s["step"] for s in r["merge_path"]] == list(range(1, len(r["merge_path"]) + 1)))(
        run(a2="true", a3="true", a17="3")))

case("whose_move names the owner of the FIRST step, not of any later one", lambda: (
    lambda r: r["whose_move"] == r["merge_path"][0]["owner"] == "author"
    and any(s["owner"] == "reviewers" for s in r["merge_path"]))(
        run(a3="true", a10="2", a11="2", a4="not_approved")))

case("CRITICAL NEGATIVE: a clean MR has an EMPTY merge path", lambda: (
    lambda r: r["merge_path"] == [] and "merge" in r["headline"])(run()))

case("NEGATIVE: unknowns do NOT become merge path steps", lambda: (
    lambda r: r["merge_path"] == [] and "not a clean pass" in r["headline"])(
        run(a17="-1", a5="true")))

case("NEGATIVE: a closed MR has no merge path and blames nobody", lambda: (
    lambda r: r["merge_path"] == [] and "nobody" in r["whose_move"])(run(a1="merged")))

case("headline of a blocked MR names the blocker and the mover", lambda: (
    lambda r: "cannot merge" in r["headline"] and "conflict" in r["headline"]
    and r["headline"].rstrip().endswith("Next move: author."))(run(a3="true")))

def stage(result, name):
    return next(s for s in result["stages"] if s["name"] == name)


case("CRITICAL NEGATIVE: the ledger never calls a dimension unread that the "
     "unknowns list claims was read", lambda: (
    lambda r: all(
        s["measured"] or s["name"] in unknown_dims(r) or any(
            b["dimension"].startswith(s["name"][:5]) for b in r["blockers"])
        for s in r["stages"]))(run(a17="-1", a5="false")))

case("discussions decided by the MR flag count as READ, by the weaker route", lambda: (
    lambda r: stage(r, "discussions")["measured"] is True
    and "without a token" in stage(r, "discussions")["route"])(run(a17="-1", a5="false")))

case("NEGATIVE: a per-thread read names no fallback route", lambda: (
    lambda r: stage(r, "discussions")["measured"] is True
    and stage(r, "discussions")["route"] == "")(run(a17="0")))

case("discussions with neither route stay genuinely unread", lambda: (
    lambda r: stage(r, "discussions")["measured"] is False
    and "discussions" in unknown_dims(r))(run(a17="-1", a5="unmeasured")))

case("repeated dimensions are counted in the summary, not repeated", lambda: (
    lambda r: "approval_rule x2" in r["summary"]
    and r["summary"].count("approval_rule") == 1)(
        run(a12="2", a14="/a/|code_owner|1|5;/b/|code_owner|1|5")))

case("NEGATIVE: a single blocker gets no count suffix", lambda: (
    lambda r: "conflicts" in r["summary"] and "x1" not in r["summary"])(run(a3="true")))

failures = []
for name, fn in CASES:
    try:
        if not fn():
            failures.append({"case": name, "reason": "assertion returned false"})
    except Exception as exc:  # a crash is a failure, and must be reported as one
        failures.append({"case": name, "reason": "%s: %s" % (type(exc).__name__, exc)})

result = {
    "ok": not failures,
    "total": len(CASES),
    "passed": len(CASES) - len(failures),
    "failed": len(failures),
    "failures": failures,
    "note": "Verdict logic self-check. Half the cases are negative assertions.",
}
print(json.dumps(result))

if failures:
    sys.stderr.write(
        "gitlab-mr-gate: self-check FAILED %d of %d cases; withholding the verdict rather "
        "than reporting from logic that does not pass its own tests. First failure: %s\n"
        % (len(failures), len(CASES), failures[0]))
    raise SystemExit(1)
