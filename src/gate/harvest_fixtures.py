"""Harvest presentation fixtures for gitlab-mr-gate from a fully successful run.

rote writes the exact observation the presentation program saw to
.rote/presentation/<run-id>/input.json. Copying representative evidence from
there (rather than hand-writing a fixture) is what makes `rote play lint` a real
test of the presentation contract instead of a test of my imagination.
"""
import glob
import json
import os
import sys

STEPS = {
    "self_check": 90000,
    "validate_input": 15000,
    "fetch_mr": 130000,
    "fetch_approvals": 130000,
    "fetch_approval_state": 130000,
    "fetch_pipelines": 130000,
    "fetch_discussions": 130000,
    "compute_verdict": 30000,
    "verify": 130000,
}
DEST = "/root/.rote/flows/princepanchani/gitlab-mr-gate/resources/presentation-fixtures"

candidates = []
for workspace in glob.glob("/root/.rote/workspaces/dag-gitlab-mr-gate-*"):
    candidates.extend(glob.glob(os.path.join(workspace, ".rote", "presentation", "*", "input.json")))
candidates.sort(key=os.path.getmtime, reverse=True)

chosen = None
for path in candidates:
    try:
        data = json.load(open(path))
    except Exception:
        continue
    steps = data.get("steps") or {}
    if not all(s in steps for s in STEPS):
        continue
    if any((steps[s].get("outcome") or {}).get("status") not in ("completed", "restored")
           for s in STEPS):
        continue
    chosen = (path, data)
    break

if not chosen:
    sys.stderr.write("no fully successful 9-step gitlab-mr-gate run found\n")
    raise SystemExit(1)

path, data = chosen
print("harvesting from:", path)

for step, timeout_ms in STEPS.items():
    outcome = data["steps"][step].get("outcome") or {}
    body = ((outcome.get("output") or {}).get("body") or {})
    stdout_text = (body.get("stdout") or {}).get("text") or ""
    stderr_text = (body.get("stderr") or {}).get("text") or ""
    code = (outcome.get("exit") or body.get("exit") or {}).get("code", 0)
    duration = outcome.get("duration_ms") or body.get("duration_ms") or 100

    out_dir = os.path.join(DEST, step)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "stdout.json"), "w") as fh:
        fh.write(stdout_text)
    with open(os.path.join(out_dir, "stderr.txt"), "w") as fh:
        fh.write(stderr_text)
    with open(os.path.join(out_dir, "fixture.yaml"), "w") as fh:
        fh.write(
            "schema_version: 1\n"
            "kind: process.exec\n"
            "status:\n"
            "  exit: { kind: code, code: %d }\n"
            "  duration_ms: %d\n"
            "  timeout_ms: %d\n"
            "stdout: resources/presentation-fixtures/%s/stdout.json\n"
            "stderr: resources/presentation-fixtures/%s/stderr.txt\n"
            % (int(code or 0), int(duration or 100), timeout_ms, step, step)
        )
    print("  %-22s exit=%s stdout_bytes=%d" % (step, code, len(stdout_text)))
