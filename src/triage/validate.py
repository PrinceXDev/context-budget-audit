import json, os, re, sys, urllib.parse

def fail(msg):
    sys.stderr.write("gitlab-pipeline-triage: " + msg + "\n")
    raise SystemExit(1)

project = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
mr_raw  = (sys.argv[2] if len(sys.argv) > 2 else "").strip()
host    = (sys.argv[3] if len(sys.argv) > 3 else "gitlab.com").strip()

# Fail closed on missing input: never guess a project or an MR.
if not project:
    fail("project is required (e.g. gitlab-org/cli). Refusing to guess.")
if not mr_raw:
    fail("mr is required (the MR iid, e.g. 2912). Refusing to guess.")

# MR iid must be a positive integer. Rejects path traversal and query injection.
if not re.fullmatch(r"[1-9][0-9]{0,9}", mr_raw):
    fail("mr must be a positive integer iid, got: " + repr(mr_raw))

# Host must look like a hostname: no scheme, no path, no credentials, no port.
if not re.fullmatch(r"[A-Za-z0-9]([A-Za-z0-9._-]{0,251}[A-Za-z0-9])?", host):
    fail("gitlab_host must be a bare hostname (e.g. gitlab.com or "
         "invent.kde.org), got: " + repr(host))

# Project may be a numeric id or a namespace path. Reject anything that could
# escape the path segment; we URL-encode rather than trusting the input.
if re.fullmatch(r"[0-9]{1,12}", project):
    project_id = project
else:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,254}", project) or ".." in project:
        fail("project must be a numeric id or a namespace/path, got: " + repr(project))
    project_id = urllib.parse.quote(project, safe="")

token = os.environ.get("GITLAB_TOKEN") or os.environ.get("CI_JOB_TOKEN") or ""

out = {
    "ok": True,
    "project_input": project,
    "project_id": project_id,
    "iid": int(mr_raw),
    "host": host,
    "api_base": "https://" + host + "/api/v4/projects/" + project_id,
    # Only ever a boolean. The token value itself never enters a record.
    "has_token": bool(token),
    "auth_mode": "token" if token else "anonymous",
}
print(json.dumps(out))
