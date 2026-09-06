"""Harvest presentation fixtures for gitlab-mr-queue from a real successful run.

validate_input and list_mrs are single steps, so their own captured stdout is the
fixture. gate_one is a for_each fan-out, so one representative item observation
from output.items is the fixture, exactly as the reference play does it.
"""
import glob
import json
import os
import sys

DEST = "/root/.rote/flows/princepanchani/gitlab-mr-queue/resources/presentation-fixtures"
TIMEOUTS = {"validate_input": 15000, "list_mrs": 130000, "gate_one": 140000}

candidates = []
for ws in glob.glob("/root/.rote/workspaces/dag-gitlab-mr-queue-*"):
    candidates.extend(glob.glob(os.path.join(ws, ".rote", "presentation", "*", "input.json")))
candidates.sort(key=os.path.getmtime, reverse=True)

chosen = None
for path in candidates:
    try:
        data = json.load(open(path))
    except Exception:
        continue
    steps = data.get("steps") or {}
    if not all(s in steps for s in TIMEOUTS):
        continue
    if any((steps[s].get("outcome") or {}).get("status") not in ("completed", "restored")
           for s in TIMEOUTS):
        continue
    items = ((steps["gate_one"].get("outcome") or {}).get("output") or {}).get("items")
    if not isinstance(items, list) or not items:
        continue
    chosen = (path, data)
    break

if not chosen:
    sys.stderr.write("no fully successful gitlab-mr-queue run found\n")
    raise SystemExit(1)

path, data = chosen
print("harvesting from:", path)


def write(step, stdout_text, stderr_text, code, duration):
    out_dir = os.path.join(DEST, step)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "stdout.json"), "w") as fh:
        fh.write(stdout_text or "")
    with open(os.path.join(out_dir, "stderr.txt"), "w") as fh:
        fh.write(stderr_text or "")
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
            % (int(code or 0), int(duration or 100), TIMEOUTS[step], step, step)
        )
    print("  %-16s stdout_bytes=%d" % (step, len(stdout_text or "")))


for step in ("validate_input", "list_mrs"):
    outcome = data["steps"][step].get("outcome") or {}
    body = ((outcome.get("output") or {}).get("body") or {})
    write(step,
          (body.get("stdout") or {}).get("text"),
          (body.get("stderr") or {}).get("text"),
          (outcome.get("exit") or body.get("exit") or {}).get("code", 0),
          outcome.get("duration_ms") or body.get("duration_ms") or 100)

# gate_one: one representative fan-out observation.
outcome = data["steps"]["gate_one"].get("outcome") or {}
items = ((outcome.get("output") or {}).get("items") or [])
representative = None
for item in items:
    text = ((item.get("body") or {}).get("stdout") or {}).get("text") or ""
    if text.strip():
        representative = item
        break
if representative is None:
    sys.stderr.write("gate_one produced no readable item observation\n")
    raise SystemExit(1)

body = representative.get("body") or {}
write("gate_one",
      (body.get("stdout") or {}).get("text"),
      (body.get("stderr") or {}).get("text"),
      (body.get("exit") or {}).get("code", 0),
      body.get("duration_ms") or 1500)
