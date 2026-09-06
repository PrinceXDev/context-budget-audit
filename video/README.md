# Rote Playoffs — demo video

A ~3:27 Remotion piece for the Rote Playoffs submission: the memory-layer
argument, proved with the two published Plays in this repo.

```bash
npm install
npm run studio          # scrub the timeline
npm run render          # out/rote-demo.mp4  (1920x1080, 30fps)
npm run render:fast     # half-scale preview
```

## Two things you have to add

The project renders as-is, but it renders **silent** and with a monogram where
your face should be.

1. **Your portrait** → save it as `public/presenter.jpg`. Nothing else to change:
   the component probes for the file at render time, so it appears in the corner
   and on the end card automatically. Any square-ish head-and-shoulders shot
   works; the crop biases upward to keep the face centred in the circle.
2. **Your voice** → read [`VO-SCRIPT.md`](./VO-SCRIPT.md). It has all 37 lines
   with their exact in-points and target durations, generated from
   `src/script.ts` so it cannot drift from the captions. Record per-line into
   `public/vo/l01.mp3 …`, then set `VO_MODE = 'perline'` in `src/config.ts`.

Optional: `public/music.mp3` with `MUSIC = true`, and the eight cues in
`src/components/Sound.tsx` with `SFX = true`.

## What is real, and what is explanation

This mattered more than anything else in the build. A judge should never have to
wonder which is which, so the two are drawn in deliberately different visual
languages.

**Real product output** — everything inside a terminal window. The files in
`public/runs/` are stdout from actual `rote play run` invocations, copied in
unedited:

| File | Command it came from |
| --- | --- |
| `gate-demo.txt` | `rote play run princepanchani/gitlab-mr-gate` (zero-arg demo, `gitlab-org/gitlab` !143468) |
| `gate-cli-2912.txt` | `rote play run princepanchani/gitlab-mr-gate project=gitlab-org/cli mr=2912` |
| `queue-demo.txt` | `rote play run princepanchani/gitlab-mr-queue` (zero-arg demo, `gitlab-org/cli`) |
| `registry-search.txt` | `rote play search "gitlab" --source registry` |

The Play cards, the `39/39`, the `67 / 197d / 113d` figures and the frontmatter
excerpt are all read off those files or off `../src/main.ts`. Nothing on screen
is a field the product does not have.

**Explanatory motion graphics** — everything outside a terminal window. The
step graph in `AgentGraph.tsx` is the real `depends_on` structure, but drawn; the
`TASK → SEARCH → FAIL` chains in the problem scene are illustrative and drawn as
abstract pills precisely so they cannot be mistaken for tool output.

The one stand-in is the Rote wordmark in `components/Logo.tsx` — a neutral mark,
not Modiqo's official brand asset. Swap in the real SVG if you have it.

## The wow moment is a real diff

At 1:52 the same published Play runs against a merge request it has never seen.
The two reports genuinely differ: one blocker becomes three, the merge path goes
from one step to three ordered steps, and two unknowns get named. That contrast
was not staged — it is what the two captured runs actually printed.

## Structure

`src/script.ts` is the spine. It holds every narration line with its start frame
and duration, and it is the **only** place those numbers live — captions render
from it, per-line audio mounts from it, and `VO-SCRIPT.md` is generated from it.
Change a timing there and everything moves together.

`src/config.ts` holds the scene boundaries in frames. Scenes are cut at exact
frames rather than overlapped, because an overlapping transition would shift
every scene's internal clock away from the caption timings; instead each scene
dissolves through a persistent root backdrop, which reads as a cross-fade
without moving anything.

```
src/
  script.ts          narration + timings (single source of truth)
  config.ts          scene boundaries, VO/music/SFX switches
  theme.ts           colour and type tokens
  Main.tsx           the timeline
  components/        primitives, Terminal, AgentGraph, CodeWindow, Presenter…
  scenes/            S01…S13, one file per beat
public/
  runs/              real captured stdout
tools/
  make-vo-guide.mjs  regenerates VO-SCRIPT.md from script.ts
```

## Timeline

| | Scene | Beat |
| --- | --- | --- |
| 0:00 | cold open | two sentences on black, then the mark |
| 0:10 | the problem | the same task twice, same cost both times |
| 0:28 | the insight | *what if the run that worked became memory?* |
| 0:40 | the entry | the two published Plays |
| 0:53 | first run | one line, nine steps, self-check before live data |
| 1:16 | the verdict | the real report, blocker and evidence |
| 1:32 | what a Play is | the real frontmatter, walked |
| **1:52** | **reuse** | **same Play, unseen input, different execution** |
| 2:18 | trust | verify, unknowns, read-only |
| 2:34 | what this is not | chat history / prompts / macros / RAG |
| 2:50 | compounding | the queue Play, and the loop |
| 3:08 | finale | *Rote remembers what worked.* |
| 3:21 | creator card | |

## Regenerating the captured runs

Rote runs in WSL, not native Windows.

```bash
wsl bash -lc 'export PATH=/root/.local/bin:$PATH
  rote play run princepanchani/gitlab-mr-gate --yes'
```

Pipe stdout through `awk '/^GITLAB MR GATE/,0'` to drop the install banner, and
drop the result into `public/runs/`. If `rote` complains that the installed
entrypoint does not match the pulled archive, run
`rote registry play pull princepanchani/gitlab-mr-gate --yes` first — the flows
directory is build output, and `../src/build.sh` regenerates it.
