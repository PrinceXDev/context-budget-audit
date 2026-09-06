#!/bin/bash
# Assemble the gitlab-pipeline-triage play package from src/triage into the local
# rote flows directory. Code only; presentation fixtures are harvested separately
# from a real run, because a hand-written fixture only tests my imagination.
set -e

# Resolve from this script's own location so the documented workflow works from
# any clone, not only the author's checkout.
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-/root/.rote/flows/princepanchani/gitlab-pipeline-triage}"

mkdir -p "$DEST/resources"

cp "$SRC/main.ts"     "$DEST/main.ts"
cp "$SRC/deps.toml"   "$DEST/deps.toml"
cp "$SRC/validate.py" "$DEST/resources/validate.py"
cp "$SRC/fetch.py"    "$DEST/resources/fetch.py"
cp "$SRC/triage.py"   "$DEST/resources/triage.py"
cp "$SRC/selfcheck.py" "$DEST/resources/selfcheck.py"

# Strip any CRLF that survived the Windows filesystem round-trip.
for f in "$DEST/main.ts" "$DEST/deps.toml" "$DEST/resources/validate.py" \
         "$DEST/resources/fetch.py" "$DEST/resources/triage.py" \
         "$DEST/resources/selfcheck.py"; do
  sed -i 's/\r$//' "$f"
done

python3 -c "import ast
for p in ['$DEST/resources/validate.py','$DEST/resources/fetch.py','$DEST/resources/triage.py','$DEST/resources/selfcheck.py']:
    ast.parse(open(p).read())
print('python syntax OK')"

echo "=== SELF-CHECK ==="
python3 "$DEST/resources/selfcheck.py" "$DEST/resources/triage.py" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['passed'], '/', d['total'], 'passed;', d['failed'], 'failed')"

echo "=== PACKAGE ==="
find "$DEST" -type f | sed "s#$DEST/##" | sort
