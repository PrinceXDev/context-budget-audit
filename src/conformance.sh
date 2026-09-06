#!/bin/bash
# Conformance sweep for gitlab-mr-gate, gitlab-mr-queue and
# gitlab-pipeline-triage.
#
# Every row below is a REAL run against a REAL merge request on a REAL GitLab
# instance, with no credentials. The point is not that the plays produce a
# pretty answer on a happy path - it is that they produce an HONEST answer on
# instances and inputs the author does not control, and fail closed when they
# cannot.
#
# Five of the instances are self-hosted GitLab Community Edition, where the
# merge request approval-rules endpoint (a Premium/Ultimate feature) does not
# exist at all. That case is the one this sweep exists to keep honest.
#
# Usage:  bash src/conformance.sh [<path-to-play-dir-root>]
# Default play root is /root/rote-dev, i.e. the dev copies; pass a different
# root to sweep the installed or published packages instead.
set -u

ROOT="${1:-/root/rote-dev}"
GATE="$ROOT/gitlab-mr-gate/main.ts"
QUEUE="$ROOT/gitlab-mr-queue/main.ts"
TRIAGE="$ROOT/gitlab-pipeline-triage/main.ts"
export PATH="/root/.local/bin:$PATH"

# Run from a scratch directory so run artifacts never land in the repo.
WORK="$(mktemp -d)"
cd "$WORK" || exit 1

pass=0
fail=0

# Expected-verdict matching.
#
# A live third-party merge request is not a fixture: the KDE MR this sweep used
# to assert BLOCKED was rebased mid-afternoon and legitimately became a clean
# pass. Pinning an exact verdict to someone else's branch therefore guarantees a
# false failure sooner or later, and a suite that cries wolf gets ignored.
#
# So an expectation of LIVE means: the play completed and committed to a real
# verdict - anything except UNAVAILABLE (could not read) or WITHHELD (its own
# self-check failed). That is the property actually under test on a moving
# target. Deterministic inputs - merged, closed, nonexistent, malformed - still
# assert the exact verdict, because those genuinely cannot drift.
matches() {
  local verdict="$1" expect="$2"
  if [ "$expect" = "LIVE" ]; then
    [ -n "$verdict" ] \
      && ! printf '%s' "$verdict" | grep -q 'UNAVAILABLE' \
      && ! printf '%s' "$verdict" | grep -q 'WITHHELD'
  else
    printf '%s' "$verdict" | grep -q "$expect"
  fi
}

# gate_row <label> <expected-verdict-substring|LIVE> [params...]
gate_row() {
  local label="$1" expect="$2"
  shift 2
  local out verdict selfcheck
  out="$(rote play run "$GATE" "$@" 2>&1)"
  verdict="$(printf '%s' "$out" | grep -m1 '^VERDICT:' | sed 's/^VERDICT: //')"
  selfcheck="$(printf '%s' "$out" | grep -c '47/47 verdict-logic cases passed')"
  local mark
  if matches "$verdict" "$expect"; then
    mark=ok
    pass=$((pass + 1))
  else
    mark=FAIL
    fail=$((fail + 1))
  fi
  printf '%-4s %-32s %-20s selfcheck:%s\n' \
    "$mark" "$label" "${verdict:-<none>}" "$selfcheck"
}

# queue_row <label> <expected-substring-anywhere-in-report> [params...]
queue_row() {
  local label="$1" expect="$2"
  shift 2
  local out mark
  out="$(rote play run "$QUEUE" "$@" 2>&1)"
  if printf '%s' "$out" | grep -q "$expect"; then
    mark=ok
    pass=$((pass + 1))
  else
    mark=FAIL
    fail=$((fail + 1))
  fi
  # Widest line in the report, to catch anything that runs off a terminal. The
  # runner's own raw "error:" trailer is not the play's output and is not
  # wrappable by the play, so stop measuring there.
  local widest
  widest="$(printf '%s' "$out" | sed -n '/^GITLAB MR QUEUE/,$p' | sed '/^error:/,$d' | awk '{ if (length($0) > m) m = length($0) } END { print m + 0 }')"
  printf '%-4s %-32s %-20s widest:%s\n' "$mark" "$label" "matched" "$widest"
}

echo "== gate: gitlab.com (Enterprise Edition: approval rules ARE readable) =="
gate_row "zero-arg demo"          "LIVE"
gate_row "merged MR"              "NOT OPEN"  project=gitlab-org/cli mr=3852
gate_row "closed MR"              "NOT OPEN"  project=gitlab-org/cli mr=3857

echo
echo "== gate: self-hosted Community Edition (NO approval-rules endpoint) =="
gate_row "KDE  live MR"           "LIVE"               gitlab_host=invent.kde.org          project=frameworks/kio              mr=2417
gate_row "Debian Salsa  live MR"  "LIVE"                gitlab_host=salsa.debian.org        project=debian/adduser              mr=143
gate_row "GNOME  live MR"         "LIVE"               gitlab_host=gitlab.gnome.org        project=GNOME/gnome-settings-daemon mr=493
gate_row "freedesktop  live MR"   "LIVE"               gitlab_host=gitlab.freedesktop.org  project=xdg/shared-mime-info        mr=431
gate_row "VideoLAN  live MR"      "LIVE"               gitlab_host=code.videolan.org       project=videolan/vlc                mr=10155

echo
echo "== gate: must fail closed, never green =="
gate_row "nonexistent MR"         "UNAVAILABLE" project=gitlab-org/cli mr=999999
gate_row "nonexistent project"    "UNAVAILABLE" project=gitlab-org/no-such-proj-xyz9 mr=1
gate_row "unreachable host"       "UNAVAILABLE" gitlab_host=nope.invalid project=gitlab-org/cli mr=3852
gate_row "non-numeric mr"         "UNAVAILABLE" project=gitlab-org/cli mr=abc

echo
echo "== queue =="
queue_row "gitlab.com zero-arg demo" "GITLAB MR QUEUE"
queue_row "KDE self-hosted (CE)"     "not_available"   gitlab_host=invent.kde.org project=frameworks/kio max_mrs=4
queue_row "empty result set"         "GITLAB MR QUEUE" project=gitlab-org/cli target_branch=no-such-branch-xyz9
queue_row "nonexistent project"      "GITLAB MR QUEUE" project=gitlab-org/no-such-proj-xyz9


# triage_row <label> <expected-verdict-substring> [params...]
# Also reports the widest report line, since every job and stage name in this
# play's output is live data of unpredictable length.
triage_row() {
  local label="$1" expect="$2"
  shift 2
  local out verdict selfcheck widest mark
  out="$(rote play run "$TRIAGE" "$@" 2>&1)"
  verdict="$(printf '%s' "$out" | grep -m1 '^VERDICT:' | sed 's/^VERDICT: //')"
  selfcheck="$(printf '%s' "$out" | grep -c '52/52 triage-logic cases passed')"
  widest="$(printf '%s' "$out" | sed -n '/^GITLAB PIPELINE TRIAGE/,$p' | sed '/^error:/,$d' \
    | grep -v 'https\{0,1\}://' \
    | awk '{ if (length($0) > m) m = length($0) } END { print m + 0 }')"
  if matches "$verdict" "$expect"; then
    mark=ok
    pass=$((pass + 1))
  else
    mark=FAIL
    fail=$((fail + 1))
  fi
  printf '%-4s %-32s %-22s selfcheck:%s widest:%s\n' \
    "$mark" "$label" "${verdict:-<none>}" "$selfcheck" "$widest"
}

echo
echo "== pipeline triage =="
triage_row "zero-arg demo"          "LIVE"
triage_row "KDE (CE) live MR"       "LIVE"                gitlab_host=invent.kde.org project=frameworks/kio mr=2380
triage_row "KDE (CE) live MR 2"     "LIVE"                gitlab_host=invent.kde.org project=frameworks/kio mr=2282
triage_row "merged MR"              "NOT OPEN"            project=gitlab-org/cli mr=3852
triage_row "MR with no pipeline"    "NO PIPELINE"         project=gitlab-org/cli mr=2950
triage_row "nonexistent project"    "UNAVAILABLE"         project=gitlab-org/no-such-proj-xyz9 mr=1
triage_row "non-numeric mr"         "UNAVAILABLE"         project=gitlab-org/cli mr=abc

echo
echo "== $pass passed, $fail failed =="
rm -rf "$WORK"
[ "$fail" -eq 0 ]
