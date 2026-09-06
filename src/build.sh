#!/bin/bash
# Assemble the gitlab-mr-gate play package from src/ into the local rote flows
# directory, and generate the presentation fixture from real measured values.
set -e

# Resolve from this script's own location so the documented workflow works from
# any clone, not only the author's checkout.
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="/root/.rote/flows/princepanchani/gitlab-mr-gate"
FIX="$DEST/resources/presentation-fixtures/compute_verdict"

mkdir -p "$DEST/resources"
mkdir -p "$FIX"

cp "$SRC/main.ts"    "$DEST/main.ts"
cp "$SRC/deps.toml"  "$DEST/deps.toml"
cp "$SRC/validate.py"  "$DEST/resources/validate.py"
cp "$SRC/fetch.py"     "$DEST/resources/fetch.py"
cp "$SRC/verdict.py"   "$DEST/resources/verdict.py"
cp "$SRC/selfcheck.py" "$DEST/resources/selfcheck.py"
cp "$SRC/verify.py"    "$DEST/resources/verify.py"

# Strip any CRLF that survived the Windows filesystem round-trip.
for f in "$DEST/main.ts" "$DEST/deps.toml" "$DEST/resources/validate.py" "$DEST/resources/fetch.py" "$DEST/resources/verdict.py" "$DEST/resources/selfcheck.py" "$DEST/resources/verify.py"; do
  sed -i 's/\r$//' "$f"
done

python3 -c "import ast
for p in ['$DEST/resources/validate.py','$DEST/resources/fetch.py','$DEST/resources/verdict.py','$DEST/resources/selfcheck.py','$DEST/resources/verify.py']:
    ast.parse(open(p).read())
print('python syntax OK')"

# Seed a compute_verdict fixture ONLY if none exists yet. Once
# harvest_fixtures.py has copied real run evidence out of
# .rote/presentation/<run-id>/input.json, that evidence is authoritative and
# must not be clobbered by a synthetic re-generation on every rebuild.
if [ ! -s "$FIX/stdout.json" ]; then
python3 "$DEST/resources/verdict.py" \
  "opened" \
  "false" \
  "false" \
  "not_approved" \
  "true" \
  "Community contribution,pipeline::tier-1,workflow::in dev" \
  "https://gitlab.com/gitlab-org/gitlab/-/merge_requests/253806" \
  "Show checking message for need_rebase check while CHECKING" \
  "Gamezordd" \
  "3" \
  "3" \
  "4" \
  "/app/assets/,/locale/,/spec/frontend/" \
  "/app/assets/|code_owner|1|77;/locale/|code_owner|1|228;/spec/frontend/|code_owner|1|77" \
  "success" \
  "https://gitlab.com/gitlab-community/gitlab-org/gitlab/-/pipelines/2822564143" \
  "-1" \
  "" \
  "workflow::in dev" \
  "true" \
  "253806" \
  "master" \
  "" \
  "" \
  "" \
  "auth_required" \
  > "$FIX/stdout.json"

: > "$FIX/stderr.txt"

cat > "$FIX/fixture.yaml" <<'YEOF'
schema_version: 1
kind: process.exec
status:
  exit: { kind: code, code: 0 }
  duration_ms: 31
  timeout_ms: 30000
stdout: resources/presentation-fixtures/compute_verdict/stdout.json
stderr: resources/presentation-fixtures/compute_verdict/stderr.txt
YEOF
fi

echo "=== PACKAGE ==="
find "$DEST" -type f | sed "s#$DEST/##" | sort
echo
echo "=== FIXTURE VERDICT ==="
python3 -c "import json,sys; d=json.load(open('$FIX/stdout.json')); print(d['verdict'], '|', d['summary']); print('stages:', [(s['name'], s['measured']) for s in d['stages']])"
