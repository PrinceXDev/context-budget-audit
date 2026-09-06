#!/bin/bash
# Records the verdict step against the real measurements taken from
# gitlab-org/gitlab MR !253806. Every value here came from CAUs @13-@17.
# Run from inside the rote workspace.
export PATH="$HOME/.local/bin:$PATH"
cd /root/.rote/workspaces/gitlab-mr-gate || exit 1

rote proc run python3 verdict.py \
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
  "master"
