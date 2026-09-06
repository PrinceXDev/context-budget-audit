"""Validate and normalise inputs for the MR queue triage.

Fails closed. Nothing is guessed, and every value that becomes part of a URL is
either matched against a strict pattern or URL-encoded before use.
"""
import json
import os
import re
import sys
import urllib.parse


def fail(msg):
    sys.stderr.write("gitlab-mr-queue: " + msg + "\n")
    raise SystemExit(1)


def arg(i, d=""):
    return sys.argv[i].strip() if len(sys.argv) > i else d


project        = arg(1)
host           = arg(2, "gitlab.com") or "gitlab.com"
target_branch  = arg(3)
filter_labels  = arg(4)
max_mrs_raw    = arg(5, "15") or "15"
concurrency_raw = arg(6, "3") or "3"
order          = (arg(7, "stalest") or "stalest").lower()

if not project:
    fail("project is required (for example gitlab-org/cli). Refusing to guess.")

if not re.fullmatch(r"[A-Za-z0-9]([A-Za-z0-9._-]{0,251}[A-Za-z0-9])?", host):
    fail("gitlab_host must be a bare hostname (for example gitlab.com or "
         "gitlab.internal.corp), got: " + repr(host))

if re.fullmatch(r"[0-9]{1,12}", project):
    project_id = project
else:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,254}", project) or ".." in project:
        fail("project must be a numeric id or a namespace/path, got: " + repr(project))
    project_id = urllib.parse.quote(project, safe="")

# A branch name goes into a query string, so it is encoded rather than trusted.
if target_branch and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,254}", target_branch):
    fail("target_branch must look like a branch name, got: " + repr(target_branch))

try:
    max_mrs = int(max_mrs_raw)
except ValueError:
    fail("max_mrs must be an integer, got: " + repr(max_mrs_raw))
max_mrs = min(max(max_mrs, 1), 50)

try:
    concurrency = int(concurrency_raw)
except ValueError:
    fail("concurrency must be an integer, got: " + repr(concurrency_raw))
concurrency = min(max(concurrency, 1), 8)

# Which end of the queue gets the expensive per-MR gating actually decides
# whether this play is useful. Ordering newest-first means max_mrs spends the
# whole budget on the HEALTHIEST merge requests and the rotting ones fall past
# the cap unexamined, so "stalest" is the default: least recently touched first.
if order not in ("stalest", "newest"):
    fail("order must be stalest or newest, got: " + repr(order))

token = os.environ.get("GITLAB_TOKEN") or os.environ.get("CI_JOB_TOKEN") or ""

print(json.dumps({
    "ok": True,
    "order": order,
    "sort": "asc" if order == "stalest" else "desc",
    "project_input": project,
    "project_id": project_id,
    "host": host,
    "api_base": "https://" + host + "/api/v4/projects/" + project_id,
    "target_branch": target_branch,
    "filter_labels": filter_labels,
    "max_mrs": max_mrs,
    "concurrency": concurrency,
    # Only ever a boolean. The token value never enters a record.
    "has_token": bool(token),
    "auth_mode": "token" if token else "anonymous",
}))
