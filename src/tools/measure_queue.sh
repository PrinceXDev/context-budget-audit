#!/bin/bash
# Measure the queue play the same honest way: raw payloads a naive agent would
# pull into context for N merge requests, versus the Play's structured result.
# The point of this one is SCALING - naive cost grows with N, the Play's does not.
set -e
export PATH="/root/.local/bin:$PATH"

B="https://gitlab.com/api/v4/projects/gitlab-org%2Fcli"
N=15
WORK=/tmp/measure_queue
rm -rf "$WORK"; mkdir -p "$WORK"

echo "=== NAIVE: list + 3 endpoints per merge request (N=$N) ==="
curl -s "$B/merge_requests?state=opened&per_page=100&order_by=updated_at&sort=desc" -o "$WORK/list.json"
LIST_BYTES=$(wc -c < "$WORK/list.json")
OPEN_TOTAL=$(python3 -c "import json;print(len(json.load(open('$WORK/list.json'))))")
printf "  open merge requests in project : %s\n" "$OPEN_TOTAL"
printf "  %-28s %9d bytes\n" "list endpoint" "$LIST_BYTES"

IIDS=$(python3 -c "
import json
d=json.load(open('$WORK/list.json'))
print(' '.join(str(m['iid']) for m in d[:$N]))
")

REQ=1
cat "$WORK/list.json" > "$WORK/raw_all.json"
for iid in $IIDS; do
  curl -s "$B/merge_requests/$iid/approvals"      -o "$WORK/a_$iid.json"
  curl -s "$B/merge_requests/$iid/approval_state" -o "$WORK/s_$iid.json"
  curl -s "$B/merge_requests/$iid/pipelines"      -o "$WORK/p_$iid.json"
  cat "$WORK/a_$iid.json" "$WORK/s_$iid.json" "$WORK/p_$iid.json" >> "$WORK/raw_all.json"
  REQ=$((REQ+3))
done

RAW_BYTES=$(wc -c < "$WORK/raw_all.json")
printf "  %-28s %9d bytes\n" "+ 3 endpoints x $N MRs" "$((RAW_BYTES-LIST_BYTES))"
printf "  %-28s %9d bytes  <- total raw context\n" "TOTAL" "$RAW_BYTES"
printf "  %-28s %9d\n" "HTTP requests" "$REQ"
echo
echo "  raw tokens:"
rote count-tokens "$WORK/raw_all.json" 2>&1 | head -3

echo
echo "=== PLAY: the structured result for the same work ==="
cd /tmp
timeout 600 rote play run gitlab-mr-queue project=gitlab-org/cli max_mrs=$N --output=json > "$WORK/play_out.json" 2>/dev/null || \
  timeout 600 rote play run gitlab-mr-queue project=gitlab-org/cli max_mrs=$N > "$WORK/play_out.txt" 2>/dev/null || true

if [ -s "$WORK/play_out.json" ]; then
  PLAY_FILE="$WORK/play_out.json"
else
  PLAY_FILE="$WORK/play_out.txt"
fi
PLAY_BYTES=$(wc -c < "$PLAY_FILE")
printf "  %-28s %9d bytes\n" "play report" "$PLAY_BYTES"
echo
echo "  play report tokens:"
rote count-tokens "$PLAY_FILE" 2>&1 | head -3

echo
echo "=== RATIO ==="
python3 -c "
raw = $RAW_BYTES
res = $PLAY_BYTES
print('  raw bytes    : %d' % raw)
print('  report bytes : %d' % res)
print('  reduction    : %.1fx smaller (%.1f%% less context)' % (raw/res, 100*(1-res/raw)))
print('  requests      : %d hand-issued, versus 1 command' % $REQ)
"
