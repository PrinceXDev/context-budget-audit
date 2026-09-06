# Rote Playoffs — GitLab merge-readiness plays

Three published [Rote](https://play.modiqo.ai) plays that answer one question
each about GitLab merge requests. All run with **no arguments, no credentials and
no setup** against public projects, on gitlab.com and on self-hosted GitLab.

| Play | What it answers | Registry |
| --- | --- | --- |
| `gitlab-mr-gate` | Can **this** merge request merge? If not, what blocks it and whose move is it? | [princepanchani/gitlab-mr-gate](https://play.modiqo.ai/princepanchani/gitlab-mr-gate) |
| `gitlab-mr-queue` | Across **every** open merge request, whose move is it — and how long has it been waiting? | [princepanchani/gitlab-mr-queue](https://play.modiqo.ai/princepanchani/gitlab-mr-queue) |
| `gitlab-pipeline-triage` | The pipeline is red. **Which job** failed, is it your change or already broken, and does it even block? | [princepanchani/gitlab-pipeline-triage](https://play.modiqo.ai/princepanchani/gitlab-pipeline-triage) |

They compose, and each says so in its own description: the queue points you at a
merge request, the gate gates it in full, and when the blocker turns out to be a
red pipeline the triage takes over. Each is useful alone.

## Author

Built by **Prince Panchani** for [The First Rote Playoffs](https://play.modiqo.ai).

| | |
| --- | --- |
| Rote registry handle | `princepanchani` — every play above is published under this namespace, which is what identifies the author in the registry |
| GitHub | [@PrinceXDev](https://github.com/PrinceXDev) — this repository |
| LinkedIn | [prince-panchani-70757b202](https://www.linkedin.com/in/prince-panchani-70757b202/) |

The registry handle (`princepanchani`) and the GitHub account (`PrinceXDev`) are
the same person; they are spelled out here because the two names do not look
alike and nothing else in the repository asserts the link.

## Try them

```bash
rote play run princepanchani/gitlab-mr-gate
rote play run princepanchani/gitlab-mr-queue
rote play run princepanchani/gitlab-pipeline-triage
```

With no arguments each runs a built-in demo against a real public merge request,
so you can see the whole report before pointing it at your own:

```bash
rote play run princepanchani/gitlab-mr-gate project=your-group/your-repo mr=123
rote play run princepanchani/gitlab-mr-queue project=your-group/your-repo
```

Self-hosted GitLab works the same way — point `gitlab_host` at it. This one is a
real public instance, so it runs for anyone:

```bash
rote play run princepanchani/gitlab-mr-gate gitlab_host=invent.kde.org project=frameworks/kio mr=2417
```

## Why GitLab

Every other merge-readiness play in the registry targets GitHub. GitLab publishes
`detailed_merge_status` — its own one-field diagnosis of why a merge is refused —
and GitHub has no equivalent. Both plays read it, and the gate then turns it
around and uses it as an independent witness against its own verdict.

## Design rules

These are the constraints the code is actually written to, not aspirations.

- **Read-only.** Nothing approves, merges, rebases, comments or labels.
- **Unknown is never clean.** A dimension that could not be read is reported as
  unknown and downgrades the verdict; it is never silently treated as passing.
- **The stage ledger names the route.** When an answer came by a weaker route —
  for example discussions decided from the MR's `blocking_discussions_resolved`
  flag rather than a per-thread read — the report says so.
- **No judgment from author-controlled text.** Titles and descriptions are carried
  for display and read by no rule, so an MR asking to be approved cannot move the
  verdict.
- **Self-check before live data.** 47 cases run against the gate's verdict logic
  and 52 against the triage logic before any merge request is judged. If one
  fails the verdict is withheld entirely.
- **"Failed" is not one thing.** A red pipeline mixes jobs GitLab was told not to
  care about (`allow_failure`), runners that died, and jobs already broken on the
  target branch. Conflating them is why teams stop trusting red pipelines, so the
  triage play separates all four cases and only then names the author's work.
- **Verify by a different route.** A fresh second read plus GitLab's own
  server-side verdict. `CONTRADICTED` means trust GitLab, not this play.
- **Scalars only across step edges.** Rote value edges must resolve to scalars, so
  steps emit fixed-shape flat records — every key always present, sentinels
  (`-1`, `"unmeasured"`) on degrade, never `null` and never a missing key.

## Layout

```
src/                     gitlab-mr-gate (canonical source)
  main.ts                frontmatter + DAG + presentation program
  validate.py            input validation, fails closed
  fetch.py               one GitLab read per surface
  verdict.py             the gate logic; blockers, merge path, headline
  selfcheck.py           47 bundled cases, half negative assertions
  verify.py              re-derives claims by a second route
  build.sh               assemble into ~/.rote/flows/... inside WSL
  harvest_fixtures.py    copy real run evidence into presentation fixtures
  conformance.sh         real runs across 6 GitLab instances + failure modes
src/queue/               gitlab-mr-queue, same shape
src/triage/              gitlab-pipeline-triage, same shape
  triage.py              classifies each failed job; 52 self-check cases
```

`src/` is canonical. `build.sh` deploys into `/root/.rote/flows/princepanchani/`
inside WSL; the flows directory is build output, not source.

## Build, test, publish

Rote does not run on native Windows — everything below is inside WSL.

```bash
bash src/build.sh                                     # assemble the package
bash src/queue/build.sh                               # and the queue
bash src/triage/build.sh                              # and the triage
python3 src/selfcheck.py src/verdict.py               # 47/47 expected
python3 src/triage/selfcheck.py src/triage/triage.py  # 52/52 expected
rote play lint  /root/.rote/flows/princepanchani/gitlab-mr-gate/main.ts
rote play run   /root/.rote/flows/princepanchani/gitlab-mr-gate/main.ts
python3 src/harvest_fixtures.py                       # refresh fixtures from a real run
rote registry play push /root/.rote/flows/princepanchani/gitlab-mr-gate princepanchani --dry-run
```

Drop `--dry-run` to publish. **Registry versions are immutable** — every change is
a version bump, and a published version's bytes can never be edited. Publishing
does not replace the previous version: it stays in the registry, but `play info`
reports only the newest and `play pull` has no `--version` flag, so the newest is
what anyone actually gets. A version can be withdrawn — `registry play delete
--version` is a *recoverable* delete, with `registry play restore --version` as
its inverse — but it can never be rewritten in place.

Anyone who already installed an older version keeps running it: a bare
`<slug>/<name>` resolves to the local flows directory when one exists, so
converging on a new version needs an explicit `registry play pull`.

## Credentials

No credentials at all on public projects. A private or self-hosted project uses
your own `GITLAB_TOKEN` read from the environment, sent as a request header, never
as a query string, never printed, and never a play parameter.

The token path is verified end to end against a real private gitlab.com project.
**A token against a self-hosted instance is still untested** — the five
self-hosted instances below were all read anonymously — and that limit is stated
in both published descriptions rather than quietly dropped.

## Conformance

Every row is a real run against a real merge request on a real GitLab instance,
with no credentials. Reproduce it with:

```bash
bash src/conformance.sh
```

| Target | Edition | Case | Result |
| --- | --- | --- | --- |
| `gitlab.com` `gitlab-org/gitlab!143468` | EE | zero-arg demo, unresolved discussions | `BLOCKED` |
| `gitlab.com` `gitlab-org/cli!3852` | EE | merged MR | `NOT OPEN` |
| `gitlab.com` `gitlab-org/cli!3857` | EE | closed MR | `NOT OPEN` |
| `invent.kde.org` `frameworks/kio!2417` | CE | `need_rebase` + conflicts | `BLOCKED` |
| `salsa.debian.org` `debian/adduser!143` | CE | nothing blocking | `PASS WITH UNKNOWNS` |
| `gitlab.gnome.org` `GNOME/gnome-settings-daemon!493` | CE | draft | `BLOCKED` |
| `gitlab.freedesktop.org` `xdg/shared-mime-info!431` | CE | mergeability still computing | `PASS WITH UNKNOWNS` |
| `code.videolan.org` `videolan/vlc!10155` | CE | `need_rebase` | `BLOCKED` |
| nonexistent MR / project / host / non-numeric `mr` | — | must never read green | `UNAVAILABLE` ×4 |

For live third-party merge requests the sweep asserts only that the play
**committed to a real verdict** — anything but `UNAVAILABLE` or `WITHHELD` —
rather than a specific one. That is deliberate: the KDE merge request above was
rebased while this was being written and legitimately changed verdict, and a
suite that pins an exact answer to someone else's branch produces false failures
and then gets ignored. Deterministic inputs (merged, closed, nonexistent,
malformed) still assert the exact verdict, because those cannot drift.

`gitlab-pipeline-triage` is swept the same way, including the states that are
easy to get wrong: a merged MR, an MR that has never had a pipeline at all, and
a green pipeline — which must report `PIPELINE GREEN` rather than inventing a
failure to triage.

**Why Community Edition is the interesting column.** Merge request approval
*rules* are a GitLab Premium/Ultimate feature, so on Community Edition — which
is most self-hosted GitLab — `/approval_state` returns **404 while every other
dimension reads perfectly well**. The gate used to treat that 404 as "project
not found", which made it unrunnable against any CE instance. It now reports
approval rules as unknown and downgrades the verdict, exactly as the
"unknown is never clean" rule requires. Plain `/approvals` still works on CE, so
approval counts are unaffected.

The sweep also asserts that no line of either report exceeds 78 columns, because
every field built from live data — usernames, branch names, rule paths, MR titles
— has unpredictable length and will otherwise break mid-word in a terminal.
