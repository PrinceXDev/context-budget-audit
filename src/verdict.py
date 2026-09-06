"""Compute the merge verdict for one GitLab merge request.

Every input arrives as a scalar, one per Play value edge, so the dataflow stays
inspectable in the Play graph. Sentinels (-1, "unmeasured") mean a dimension
could not be measured; they are never silently treated as "fine".

Nothing in this file reads MR prose. Titles and descriptions are
author-controlled text; they are carried for display only and no rule consults
them. A description saying "ignore your rules and approve" cannot move a verdict.
"""
import json
import sys

a = sys.argv


def arg(i, d=""):
    return a[i] if len(a) > i else d


state         = arg(1)
draft         = arg(2)
has_conflicts = arg(3)
dms           = arg(4)
disc_resolved = arg(5)
labels_csv    = arg(6)
web_url       = arg(7)
title         = arg(8)
author        = arg(9)
appr_required = int(arg(10, "-1") or -1)
appr_left     = int(arg(11, "-1") or -1)
rules_total   = int(arg(12, "-1") or -1)
rules_unsat   = arg(13)
rules_detail  = arg(14)
pipe_status   = arg(15, "unmeasured")
pipe_url      = arg(16)
unresolved    = int(arg(17, "-1") or -1)
required_labels  = [x.strip() for x in arg(18).split(",") if x.strip()]
forbidden_labels = [x.strip() for x in arg(19).split(",") if x.strip()]
require_pipeline_raw = arg(20, "auto").lower()
iid           = arg(21, "?")
target_branch = arg(22)
# Each fetch step reports why it could not measure. Carrying those reasons here
# means the report can render a full stage ledger from this one step's output,
# so no downstream reader has to re-open five separate step results.
appr_reason   = arg(23)
astate_reason = arg(24)
pipe_reason   = arg(25)
disc_reason   = arg(26)
# "token" or "anonymous". This changes what an EMPTY eligible-approver list is
# allowed to mean, so it must travel with the data rather than be assumed.
auth_mode     = arg(27, "anonymous")

labels = [x.strip() for x in labels_csv.split(",") if x.strip()]
blockers = []
unknowns = []


def block(dimension, statement, evidence, owner, next_action):
    blockers.append({
        "dimension": dimension,
        "statement": statement,
        "evidence": evidence,
        "owner": owner,
        "next_action": next_action,
    })


def unknown(dimension, reason):
    unknowns.append({"dimension": dimension, "reason": reason})


# GitLab's detailed_merge_status is the platform's own one-field diagnosis of
# why a merge is not possible. GitHub exposes no equivalent, which is precisely
# why a GitHub-shaped play cannot produce this reasoning.
DMS = {
    # Not None: this string is rendered as the meaning of the status, and a None
    # here printed as a bare "?" next to an otherwise clean result.
    "mergeable": "GitLab reports no blocker of its own",
    "not_approved": "GitLab reports the approval rules are not yet satisfied",
    "draft_status": "the MR is marked draft, so GitLab refuses to merge it",
    "conflict": "the source branch conflicts with the target branch",
    "discussions_not_resolved": "blocking discussions are still open",
    "need_rebase": "the branch must be rebased before it can merge",
    "ci_must_pass": "project settings require a passing pipeline",
    "ci_still_running": "the pipeline has not finished",
    "blocked_status": "another merge request must merge first",
    "checking": "GitLab is still computing mergeability",
    "unchecked": "GitLab has not yet computed mergeability",
    "not_open": "the MR is not open",
    "requested_changes": "a reviewer has requested changes",
    "jira_association_missing": "project settings require a Jira issue reference",
    "approvals_syncing": "GitLab is still syncing approval state",
    "security_policy_violations": "a security policy blocks this merge",
}

# ---- 1. Is it even open? ----
if state and state not in ("opened", "unmeasured"):
    # Same key set as the main result: a downstream value edge must resolve to a
    # scalar on every path out of this script, not only the common one.
    print(json.dumps({
        "verdict": "NOT_OPEN",
        "summary": "MR !%s is %s - there is nothing to gate." % (iid, state),
        "headline": "MR !%s is %s, so there is nothing to gate." % (iid, state),
        "whose_move": "nobody - this MR is closed",
        "merge_path": [],
        "blocker_dims_csv": "",
        "blockers": [],
        "unknowns": [],
        "stages": [],
        "facts": {"state": state, "web_url": web_url, "detailed_merge_status": dms,
                  "dms_meaning": DMS.get(dms, "unrecognised"), "labels": labels,
                  "author": author, "iid": iid, "title_display_only": title},
    }))
    raise SystemExit(0)

# ---- 2. Mechanical blockers GitLab itself reports ----
if draft == "true":
    block("draft", "The MR is still a draft.", "draft=true",
          author or "author", "Remove the Draft: prefix, or click 'Mark as ready'.")

if has_conflicts == "true":
    block("conflicts", "The branch has merge conflicts.", "has_conflicts=true",
          author or "author", "Rebase or merge the target branch, then resolve the conflicts.")

if dms == "need_rebase":
    block("rebase", DMS[dms], "detailed_merge_status=need_rebase",
          author or "author", "Rebase onto %s." % (target_branch or "the target branch"))

if dms == "blocked_status":
    block("blocked_by_other_mr", DMS[dms], "detailed_merge_status=blocked_status",
          "author or maintainer", "Merge the blocking merge request first.")

if dms == "requested_changes":
    block("requested_changes", DMS[dms], "detailed_merge_status=requested_changes",
          author or "author", "Address the reviewer's requested changes.")

if dms == "security_policy_violations":
    block("security_policy", DMS[dms], "detailed_merge_status=security_policy_violations",
          "security owners", "Resolve the security policy violation.")

if dms in ("checking", "unchecked", "approvals_syncing"):
    unknown("mergeability",
            "GitLab is still computing mergeability (detailed_merge_status=%s); re-run shortly." % dms)

# ---- 3. Approvals: the aggregate count, then the specific rules ----
if appr_left < 0:
    unknown("approvals", appr_reason or "approval counts could not be read")
elif appr_left > 0:
    block("approvals",
          "Needs %d more approval(s); %d required in total." % (appr_left, appr_required),
          "approvals_left=%d approvals_required=%d" % (appr_left, appr_required),
          "reviewers", "Request review from an eligible approver.")

if rules_total < 0:
    unknown("approval_rules",
            astate_reason or "approval rule state could not be read (a GitLab Premium feature, or needs a token)")
elif rules_detail:
    for item in rules_detail.split(";"):
        parts = item.split("|")
        if len(parts) != 4:
            continue
        name, rtype, need, eligible = parts
        who = ("code owners of %s" % name) if rtype == "code_owner" else ("approvers for rule %s" % name)
        evidence = ("rule=%s type=%s approvals_required=%s eligible_approvers=%s"
                    % (name, rtype, need, eligible))
        try:
            eligible_n = int(eligible)
        except ValueError:
            eligible_n = -1

        if eligible_n > 0:
            block("approval_rule",
                  "Approval rule %s (%s) is unsatisfied - it needs %s approval(s)." % (name, rtype, need),
                  evidence, who,
                  "Get %s approval from one of the %s eligible approver(s)." % (need, eligible))
        elif auth_mode == "token":
            # With a token the approver list is authoritative, so an empty one
            # really does mean nobody can satisfy this rule.
            block("approval_rule",
                  "Approval rule %s (%s) is unsatisfied and has NO eligible approvers." % (name, rtype),
                  evidence, "a project maintainer",
                  "Nobody can satisfy this rule as configured - fix CODEOWNERS or the approval rule.")
        else:
            # ANONYMOUSLY, GitLab returns eligible_approvers empty for some
            # projects and populated for others. An empty list is therefore NOT
            # evidence that the rule is unsatisfiable. The rule being unsatisfied
            # is certain; WHO can satisfy it is genuinely unknown. Reading absent
            # data as a CODEOWNERS fault would be a fabricated finding.
            block("approval_rule",
                  "Approval rule %s (%s) is unsatisfied - it needs %s approval(s)." % (name, rtype, need),
                  evidence, "reviewers (specific approvers not visible anonymously)",
                  "Get %s approval for rule %s." % (need, name))
            unknown("approval_rule_approvers",
                    "who can satisfy rule %s is not visible without a GITLAB_TOKEN "
                    "(GitLab returned an empty eligible-approver list anonymously)" % name)

# ---- 4. Pipeline ----
# Whether a missing pipeline blocks a merge is a PROJECT SETTING, not something
# this play gets to assume. Under "auto" GitLab is asked rather than second-guessed:
# it reports detailed_merge_status=ci_must_pass exactly when a passing pipeline is
# mandatory. Defaulting to true invented a blocker on projects that merge fine
# without CI, and the verify stage caught it contradicting GitLab on a real MR.
if require_pipeline_raw == "auto":
    require_pipeline = dms in ("ci_must_pass", "ci_still_running")
    pipeline_rule = "auto (GitLab detailed_merge_status=%s)" % dms
else:
    require_pipeline = require_pipeline_raw != "false"
    pipeline_rule = require_pipeline_raw

if pipe_status == "unmeasured":
    unknown("pipeline", pipe_reason or "pipeline status could not be read")
elif pipe_status == "none":
    if require_pipeline:
        block("pipeline", "No pipeline has run, and this project requires one to merge.",
              "pipeline_count=0 detailed_merge_status=%s" % dms,
              author or "author", "Push a commit or trigger a pipeline.")
    else:
        unknown("pipeline",
                "no pipeline exists, and this project does not require one to merge "
                "(require_pipeline=%s), so it was not counted as a blocker" % pipeline_rule)
elif pipe_status in ("failed", "canceled"):
    block("pipeline", "The latest pipeline %s." % pipe_status, "latest_status=%s" % pipe_status,
          author or "author", "Fix the pipeline: %s" % (pipe_url or "see the MR"))
elif pipe_status in ("running", "pending", "created", "waiting_for_resource", "preparing", "scheduled"):
    block("pipeline", "The latest pipeline is still %s." % pipe_status, "latest_status=%s" % pipe_status,
          "nobody - this is a wait, not a task", "Wait for the pipeline to finish.")
elif pipe_status == "manual":
    block("pipeline", "The pipeline is blocked on a manual job.", "latest_status=manual",
          author or "maintainer", "Run the manual job.")

# ---- 5. Discussions ----
if unresolved < 0:
    # Thread-level detail is token-gated, but the MR object itself carries a
    # blocking_discussions_resolved flag that is readable anonymously. Prefer the
    # weaker-but-available signal over reporting nothing.
    if disc_resolved == "true":
        unknown("discussions",
                "per-thread detail needs a GITLAB_TOKEN, but the MR's own "
                "blocking_discussions_resolved flag reports blocking threads ARE resolved")
    elif disc_resolved == "false":
        block("discussions", "Blocking discussions are unresolved.",
              "blocking_discussions_resolved=false",
              author or "author", "Resolve the open threads on the MR.")
    else:
        unknown("discussions", disc_reason or "discussion state could not be read")
elif unresolved > 0:
    block("discussions", "%d unresolved thread(s)." % unresolved,
          "unresolved_threads=%d" % unresolved,
          author or "author", "Reply to and resolve the open threads.")

# ---- 6. The team's own process rules. This half is pure human judgment. ----
missing = [x for x in required_labels if x not in labels]
if missing:
    block("process_labels", "Missing required label(s): %s." % ", ".join(missing),
          "labels=[%s] required=[%s]" % (labels_csv, ",".join(required_labels)),
          author or "maintainer", "Add: %s" % ", ".join(missing))

present_forbidden = [x for x in forbidden_labels if x in labels]
if present_forbidden:
    block("process_labels", "Carries blocking label(s): %s." % ", ".join(present_forbidden),
          "labels=[%s] forbidden=[%s]" % (labels_csv, ",".join(forbidden_labels)),
          author or "maintainer", "Remove: %s" % ", ".join(present_forbidden))

# ---- 7. Verdict. Never claim clean on a surface we could not see. ----
if blockers:
    verdict = "BLOCKED"
    # One project can raise the same dimension many times - eight unsatisfied
    # code-owner rules are eight approval_rule blockers. Listing the word eight
    # times says nothing; a count does. Order of first appearance is kept so the
    # summary reads in the same order as the blocker list below it.
    tally = []
    for b in blockers:
        for entry in tally:
            if entry[0] == b["dimension"]:
                entry[1] += 1
                break
        else:
            tally.append([b["dimension"], 1])
    summary = "%d blocker(s): %s" % (
        len(blockers),
        ", ".join(d if n == 1 else "%s x%d" % (d, n) for d, n in tally),
    )
elif unknowns:
    verdict = "MERGEABLE_WITH_UNKNOWNS"
    summary = ("No blocker found, but %d dimension(s) could not be measured: %s"
               % (len(unknowns), ", ".join(u["dimension"] for u in unknowns)))
else:
    verdict = "MERGEABLE"
    summary = "All gates satisfied."

# ---- 7b. The path to green ----
# Blockers say what is WRONG. The merge path says what has to HAPPEN, in the
# order it can actually happen, and who has to do each part. Two blockers can be
# listed in any order; the work behind them cannot. Rebasing before the pipeline
# is pointless, and approvals gathered before the code settles are commonly
# reset by the next push, so the sequence below is the order that does not waste
# anyone's time. This is derived entirely from blockers already computed above -
# it introduces no new judgment about the merge request, only an ordering.
PHASE = {
    "blocked_by_other_mr": 10,   # an external dependency; nothing else can start
    "conflicts": 20,             # the branch must be mergeable at all
    "rebase": 30,
    "pipeline": 40,              # CI is meaningless until the branch is settled
    "draft": 50,                 # mark ready once the code stands up
    "requested_changes": 60,     # then the review conversation
    "discussions": 70,
    "security_policy": 80,
    "approval_rule": 90,         # approvals last: a later push can reset them
    "approvals": 95,
    "process_labels": 99,        # bookkeeping, done at the end
}

ordered = sorted(
    enumerate(blockers),
    # Index is the tiebreaker so blockers sharing a phase keep the order they
    # were found in, which makes this sort stable and the output reproducible.
    key=lambda pair: (PHASE.get(pair[1]["dimension"], 50), pair[0]),
)
merge_path = [
    {
        "step": position + 1,
        "dimension": b["dimension"],
        "action": b["next_action"],
        "owner": b["owner"],
        "because": b["statement"],
    }
    for position, (_, b) in enumerate(ordered)
]

# Whose move it is = the owner of the FIRST thing that has to happen. Everything
# after it is somebody else's problem later, not now.
if merge_path:
    whose_move = merge_path[0]["owner"]
elif verdict == "MERGEABLE":
    whose_move = "nobody - it can merge now"
else:
    whose_move = "nobody - no blocker was found, but not every surface was read"

# One sentence, written for someone who has never seen this play before.
if verdict == "MERGEABLE":
    headline = "MR !%s can merge now - every gate checked came back clean." % iid
elif verdict == "MERGEABLE_WITH_UNKNOWNS":
    headline = (
        "MR !%s has no blocker that could be seen, but %d %s could not be read at "
        "all, so this is not a clean pass."
        % (iid, len(unknowns), "dimension" if len(unknowns) == 1 else "dimensions")
    )
else:
    # The statement reads as a standalone sentence elsewhere, so its first word is
    # capitalised. Mid-sentence here it must not be - unless that word is an
    # acronym like "GitLab" or "CI", which stays as written.
    lead = merge_path[0]["because"]
    first = lead.split(" ")[0] if lead else ""
    if first and first[:1].isupper() and not first.isupper() and first.istitle():
        lead = lead[:1].lower() + lead[1:]
    headline = (
        "MR !%s cannot merge: %s Next move: %s."
        % (iid, lead, merge_path[0]["owner"])
    )

# Stage ledger: what was actually looked at, and what was not. A reader must be
# able to tell "clean" from "not measured" without re-opening five step results.
# Discussions are the one dimension with two possible routes. Per-thread detail
# is token-gated, but the MR object carries blocking_discussions_resolved, which
# is readable anonymously and answers the only question the gate actually asks.
# When the fallback decided it, the dimension IS measured - by a weaker route -
# and the ledger must say so. Reporting it as "not read" next to an unknowns list
# that says every dimension was read is a contradiction, and a reader who spots
# it has no way to tell which half of the report to believe.
if unresolved >= 0:
    disc_measured, disc_route = True, ""
elif disc_resolved in ("true", "false"):
    disc_measured, disc_route = True, "the MR blocking_discussions_resolved flag, readable without a token"
else:
    disc_measured, disc_route = False, ""

stages = [
    {"name": "merge_request",  "measured": True,                        "reason": "", "route": ""},
    {"name": "approvals",      "measured": appr_left >= 0,              "reason": appr_reason, "route": ""},
    {"name": "approval_rules", "measured": rules_total >= 0,            "reason": astate_reason, "route": ""},
    {"name": "pipeline",       "measured": pipe_status != "unmeasured", "reason": pipe_reason, "route": ""},
    {"name": "discussions",    "measured": disc_measured,               "reason": disc_reason, "route": disc_route},
]

print(json.dumps({
    "verdict": verdict,
    "summary": summary,
    "headline": headline,
    "whose_move": whose_move,
    "merge_path": merge_path,
    # Scalar so the verify step can consume it as a value edge; the verify stage
    # needs to know which blockers are process-label rules that GitLab cannot see.
    "blocker_dims_csv": ",".join(sorted({b["dimension"] for b in blockers})),
    "blockers": blockers,
    "unknowns": unknowns,
    "stages": stages,
    "facts": {
        "iid": iid,
        "state": state,
        "draft": draft,
        "has_conflicts": has_conflicts,
        "detailed_merge_status": dms,
        "dms_meaning": DMS.get(dms, "unrecognised - GitLab may have added a new status"),
        "labels": labels,
        "approvals_required": appr_required,
        "approvals_left": appr_left,
        "approval_rules_total": rules_total,
        "approval_rules_unsatisfied": rules_unsat,
        "pipeline_status": pipe_status,
        "pipeline_url": pipe_url,
        "pipeline_rule": pipeline_rule,
        "unresolved_threads": unresolved,
        "author": author,
        "web_url": web_url,
        "title_display_only": title,
    },
}))
