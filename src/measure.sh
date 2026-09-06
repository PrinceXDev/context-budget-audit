#!/bin/bash
# Measure the real token/context cost of doing this task the naive way (pull the
# raw API payloads into an agent's context and reason over them) versus running
# the Play (which distils to a fixed structured result).
#
# Every number here is measured with `rote count-tokens`. Nothing is estimated.
set -e
export PATH="/root/.local/bin:$PATH"

B="https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab"
IID=253806
WORK=/tmp/measure
rm -rf "$WORK"; mkdir -p "$WORK"

echo "=== RAW PAYLOADS (what a naive agent would pull into context) ==="
curl -s "$B/merge_requests/$IID"                 -o "$WORK/mr.json"
curl -s "$B/merge_requests/$IID/approvals"       -o "$WORK/approvals.json"
curl -s "$B/merge_requests/$IID/approval_state"  -o "$WORK/approval_state.json"
curl -s "$B/merge_requests/$IID/pipelines"       -o "$WORK/pipelines.json"

for f in mr approvals approval_state pipelines; do
  printf "  %-16s %8d bytes\n" "$f" "$(wc -c < "$WORK/$f.json")"
done

cat "$WORK"/mr.json "$WORK"/approvals.json "$WORK"/approval_state.json "$WORK"/pipelines.json > "$WORK/raw_all.json"
RAW_BYTES=$(wc -c < "$WORK/raw_all.json")
printf "  %-16s %8d bytes  <- total raw context\n" "TOTAL" "$RAW_BYTES"
echo
echo "  raw tokens:"
rote count-tokens "$WORK/raw_all.json" 2>&1 | head -6

echo
echo "=== PLAY OUTPUT (what the Play actually returns) ==="
FIX=/root/.rote/flows/princepanchani/gitlab-mr-gate/resources/presentation-fixtures
RESULT_BYTES=$(wc -c < "$FIX/compute_verdict/stdout.json")
printf "  %-16s %8d bytes  <- canonical structured result\n" "result" "$RESULT_BYTES"
echo
echo "  result tokens:"
rote count-tokens "$FIX/compute_verdict/stdout.json" 2>&1 | head -6

echo
echo "=== RATIO ==="
python3 -c "
raw = $RAW_BYTES
res = $RESULT_BYTES
print('  raw bytes    : %d' % raw)
print('  result bytes : %d' % res)
print('  reduction    : %.1fx smaller (%.1f%% less context)' % (raw/res, 100*(1-res/raw)))
"
