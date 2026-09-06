# Voiceover script — Rote Playoffs demo

Generated from `src/script.ts`. Do not edit by hand; edit the script and re-run
`node --experimental-strip-types tools/make-vo-guide.mjs`.

**37 lines · 414 words · 178s of speech across a 3:26.7 timeline.**
The gaps between lines are deliberate pauses — let them breathe, they are where
the visuals land.

## How to record

**Per-line (recommended).** Record each line as its own file, named by its id,
into `public/vo/` — `l01.mp3`, `l02.mp3`, and so on. Then set
`VO_MODE = 'perline'` in `src/config.ts`. Each clip is mounted at its own start
frame, so re-recording one line never shifts any other.

**Single take.** Read straight through, watching the target times below, save as
`public/vo/narration.mp3`, and set `VO_MODE = 'single'`.

A line that runs slightly long is fine — the next one simply starts over the tail
of it. A line that runs *much* long will collide with the next caption; either
retake it or widen `dur` in the script and regenerate this guide.

## Delivery

Confident, calm, conversational. Slightly dramatic, not advertising. You are
explaining something you actually believe to one person, not pitching a room.
Let the punctuation do the pausing. **Bold** marks the words to lean on — they are
also the words the captions brighten, so the emphasis is visible as well as
audible.

## Lines

| # | in | target | words | pace | line |
|---|----|--------|-------|------|------|
| `l01` | 0:01.0 | 3.3s | 8 | 144 wpm | AI agents can remember what we told them. |
| `l02` | 0:04.7 | 4.2s | 10 | 144 wpm | But they don't remember **how they got the work done**. |
| `l03` | 0:10.7 | 5.5s | 17 | 185 wpm | So every time the task comes back, the agent **starts from scratch**. Same tools. Same dead ends. |
| `l04` | 0:16.3 | 4.3s | 11 | 152 wpm | It works. Eventually. And then all of it is **thrown away**. |
| `l05` | 0:21.7 | 5.7s | 8 | 85 wpm | That's slow, it's expensive, and it **never compounds**. |
| `l06` | 0:28.7 | 4.7s | 9 | 116 wpm | But what if the run that worked **became memory**? |
| `l07` | 0:34.7 | 4.7s | 11 | 141 wpm | That's Rote. A memory layer for **how work actually gets done**. |
| `l08` | 0:40.5 | 5.7s | 16 | 169 wpm | For the Rote Playoffs I published **two Plays**, for one job engineers repeat every single day. |
| `l09` | 0:46.3 | 6.0s | 13 | 130 wpm | Can this merge request merge? And if it cannot, **whose move is it**? |
| `l10` | 0:53.5 | 4.5s | 12 | 160 wpm | Here it is running. One line. No arguments, **no token, no setup**. |
| `l11` | 0:59.0 | 5.3s | 13 | 146 wpm | Nine steps: validate, then five reads of GitLab **in parallel**, then the verdict. |
| `l12` | 1:05.3 | 5.8s | 16 | 165 wpm | And before it looks at a single piece of live data, it **tests its own logic**. |
| `l13` | 1:11.3 | 4.2s | 10 | 144 wpm | Thirty-nine cases. All thirty-nine pass. **Only then does it judge**. |
| `l14` | 1:16.5 | 4.5s | 11 | 147 wpm | Six seconds later, **a real verdict** on a real merge request. |
| `l15` | 1:21.8 | 5.8s | 15 | 154 wpm | **Blocked**, because blocking discussions are unresolved. And the next move belongs to one named person. |
| `l16` | 1:28.0 | 4.3s | 11 | 152 wpm | Not a guess. Every claim **names the field that proves it**. |
| `l17` | 1:32.5 | 5.5s | 14 | 153 wpm | So what is a Play? It isn't a prompt, and it isn't a script. |
| `l18` | 1:38.3 | 6.5s | 18 | 166 wpm | It's an inspectable record of **how the work was done**. The steps, the order, the evidence, the limits. |
| `l19` | 1:45.0 | 6.5s | 17 | 157 wpm | Anyone can **read it before they trust it**. That is the part chat history never gave us. |
| `l20` | 1:52.5 | 3.5s | 8 | 137 wpm | Now the same kind of task arrives again. |
| `l21` | 1:57.0 | 5.2s | 14 | 163 wpm | A different project. A different merge request. A problem this Play has **never seen**. |
| `l22` | 2:02.3 | 4.3s | 10 | 138 wpm | Instead of starting from zero, the agent **reuses the Play**. |
| `l23` | 2:07.7 | 5.3s | 14 | 158 wpm | And look. It doesn't replay the old answer. **It adapts**. One blocker became three. |
| `l24` | 2:14.0 | 4.3s | 11 | 152 wpm | Conflicts first, then approvals, **in the order they can actually happen**. |
| `l25` | 2:18.5 | 5.2s | 13 | 151 wpm | Then it checks itself against **a witness it never used**: GitLab's own verdict. |
| `l26` | 2:24.0 | 4.7s | 11 | 141 wpm | Anything it couldn't read is reported as unknown. **Never as clean**. |
| `l27` | 2:29.7 | 4.7s | 12 | 154 wpm | And it is **read-only**. It never approves, merges, or comments on anything. |
| `l28` | 2:34.5 | 4.5s | 9 | 120 wpm | This isn't chat history. It's not a prompt library. |
| `l29` | 2:40.0 | 4.3s | 8 | 111 wpm | And it's not a macro replaying fixed steps. |
| `l30` | 2:45.3 | 4.3s | 8 | 111 wpm | Rote remembers **a successful way of doing work**. |
| `l31` | 2:50.5 | 4.5s | 7 | 93 wpm | And this is where it gets interesting. |
| `l32` | 2:56.0 | 6.2s | 16 | 156 wpm | The second Play triages **a whole backlog**. Sixty-seven merge requests, and who each one waits on. |
| `l33` | 3:02.3 | 5.3s | 11 | 124 wpm | Every run that works can become **the next agent's starting point**. |
| `l34` | 3:08.7 | 4.3s | 8 | 111 wpm | The future of agents isn't only better reasoning. |
| `l35` | 3:14.0 | 4.3s | 4 | 55 wpm | It's remembering **what worked**. |
| `l36` | 3:19.2 | 1.7s | 2 | 72 wpm | That's Rote. |
| `l37` | 3:22.0 | 4.7s | 8 | 103 wpm | Built by Prince Panchani, for the Rote Playoffs. |

## Pauses

These are the silences. They are part of the edit, not gaps to fill.

- **1.8s** after `l02`, before `l03` — problem
- **1.0s** after `l04`, before `l05` — problem
- **1.3s** after `l05`, before `l06` — insight
- **1.3s** after `l06`, before `l07` — insight
- **1.2s** after `l07`, before `l08` — whatIBuilt
- **1.2s** after `l09`, before `l10` — firstRun
- **1.0s** after `l10`, before `l11` — firstRun
- **1.0s** after `l11`, before `l12` — firstRun
- **1.0s** after `l13`, before `l14` — verdict
- **1.0s** after `l19`, before `l20` — reuse
- **1.0s** after `l20`, before `l21` — reuse
- **1.0s** after `l22`, before `l23` — reuse
- **1.0s** after `l23`, before `l24` — reuse
- **1.0s** after `l26`, before `l27` — trust
- **1.0s** after `l28`, before `l29` — different
- **1.0s** after `l29`, before `l30` — different
- **1.0s** after `l31`, before `l32` — compounding
- **1.0s** after `l33`, before `l34` — finale
- **1.0s** after `l34`, before `l35` — finale
- **1.2s** after `l36`, before `l37` — creator

## Music and sound

Set `MUSIC = true` in `src/config.ts` and drop `public/music.mp3`. It sits at
0.16 gain under the voice and fades out over the last two seconds. Something
sparse and rhythmic — the piece is already busy visually and does not need help.

Set `SFX = true` and add the eight cues listed in `src/components/Sound.tsx`
under `public/sfx/`. All eight are optional; a missing file fails the render, so
add every one or leave the flag off.
