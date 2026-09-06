# Rote Playoffs — GitLab merge-readiness plays

Two published [Rote](https://play.modiqo.ai) plays that answer one question each
about GitLab merge requests. Both run with **no arguments, no credentials and no
setup** against public projects.

| Play | What it answers | Registry |
| --- | --- | --- |
| `gitlab-mr-gate` | Can **this** merge request merge? If not, what blocks it and whose move is it? | [princepanchani/gitlab-mr-gate](https://play.modiqo.ai/princepanchani/gitlab-mr-gate) |
| `gitlab-mr-queue` | Across **every** open merge request, whose move is it — and how long has it been waiting? | [princepanchani/gitlab-mr-queue](https://play.modiqo.ai/princepanchani/gitlab-mr-queue) |

## Try them

```bash
rote play run princepanchani/gitlab-mr-gate
rote play run princepanchani/gitlab-mr-queue
```

With no arguments each runs a built-in demo against a real public merge request,
so you can see the whole report before pointing it at your own:

```bash
rote play run princepanchani/gitlab-mr-gate project=your-group/your-repo mr=123
rote play run princepanchani/gitlab-mr-queue project=your-group/your-repo
```

## Demo video

A ~3:27 walkthrough of both plays lives in [`video/`](./video) — a Remotion
project. Every terminal window in it replays real captured stdout from
`rote play run` (kept in `video/public/runs/`); everything outside a terminal is
explanatory motion graphics. See [`video/README.md`](./video/README.md).

```bash
cd video && npm install && npm run render     # out/rote-demo.mp4
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
- **Self-check before live data.** 47 cases run against the verdict logic before
  any merge request is judged. If one fails the verdict is withheld entirely.
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
src/queue/               gitlab-mr-queue, same shape
```

`src/` is canonical. `build.sh` deploys into `/root/.rote/flows/princepanchani/`
inside WSL; the flows directory is build output, not source.

## Build, test, publish

Rote does not run on native Windows — everything below is inside WSL.

```bash
bash src/build.sh                                     # assemble the package
python3 src/selfcheck.py src/verdict.py               # 47/47 expected
rote play lint  /root/.rote/flows/princepanchani/gitlab-mr-gate/main.ts
rote play run   /root/.rote/flows/princepanchani/gitlab-mr-gate/main.ts
python3 src/harvest_fixtures.py                       # refresh fixtures from a real run
rote registry play push /root/.rote/flows/princepanchani/gitlab-mr-gate princepanchani --dry-run
```

Drop `--dry-run` to publish. **Registry versions are immutable** — every change is
a version bump, and a published version can never be edited or withdrawn.

## Credentials

No credentials at all on public projects. A private or self-hosted project uses
your own `GITLAB_TOKEN` read from the environment, sent as a request header, never
as a query string, never printed, and never a play parameter.

The token path is verified end to end against a real private gitlab.com project.
**A self-hosted `gitlab_host` is unverified** — there was no self-hosted instance
to test against, and that limit is stated in both published descriptions rather
than quietly dropped.
