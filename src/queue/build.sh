#!/bin/bash
# Assemble the gitlab-mr-queue play package from src/queue into the local rote
# flows directory. Code only; presentation fixtures are harvested separately from
# a real run, because a hand-written fixture only tests my imagination.
set -e

# Resolve from this script's own location so the documented workflow works from
# any clone, not only the author's checkout.
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="/root/.rote/flows/princepanchani/gitlab-mr-queue"

mkdir -p "$DEST/resources"

cp "$SRC/main.ts"      "$DEST/main.ts"
cp "$SRC/deps.toml"    "$DEST/deps.toml"
cp "$SRC/validate.py"  "$DEST/resources/validate.py"
cp "$SRC/list_mrs.py"  "$DEST/resources/list_mrs.py"
cp "$SRC/gate_one.py"  "$DEST/resources/gate_one.py"

for f in "$DEST/main.ts" "$DEST/deps.toml" "$DEST/resources/validate.py" "$DEST/resources/list_mrs.py" "$DEST/resources/gate_one.py"; do
  sed -i 's/\r$//' "$f"
done

python3 -c "import ast,sys
for p in ['$DEST/resources/validate.py','$DEST/resources/list_mrs.py','$DEST/resources/gate_one.py']:
    ast.parse(open(p).read())
print('python syntax OK')"

echo "=== PACKAGE ==="
find "$DEST" -type f | sed "s#$DEST/##" | sort
