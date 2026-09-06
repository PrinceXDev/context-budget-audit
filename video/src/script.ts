/**
 * The narration, and the only place its timing is written down.
 *
 * Captions render from this array, and per-line voiceover files are mounted at
 * `from` from this array. Change a timing here and both move together - they
 * cannot drift apart, because there is no second copy.
 *
 * `emphasis` marks the phrases the caption renderer brightens. Keep it to the
 * one or two words that carry the sentence; highlighting everything highlights
 * nothing.
 */
export type Line = {
  id: string;
  from: number;
  dur: number;
  text: string;
  emphasis?: string[];
};

export const SCRIPT: Line[] = [
  // --- cold open -----------------------------------------------------------
  {id: 'l01', from: 30, dur: 100, text: 'AI agents can remember what we told them.'},
  {
    id: 'l02',
    from: 140,
    dur: 125,
    text: "But they don't remember how they got the work done.",
    emphasis: ['how they got the work done'],
  },

  // --- the problem ---------------------------------------------------------
  {
    id: 'l03',
    from: 320,
    dur: 165,
    text: 'So every time the task comes back, the agent starts from scratch. Same tools. Same dead ends.',
    emphasis: ['starts from scratch'],
  },
  {
    id: 'l04',
    from: 490,
    dur: 130,
    text: 'It works. Eventually. And then all of it is thrown away.',
    emphasis: ['thrown away'],
  },
  {
    id: 'l05',
    from: 650,
    dur: 170,
    text: "That's slow, it's expensive, and it never compounds.",
    emphasis: ['never compounds'],
  },

  // --- the insight ---------------------------------------------------------
  {
    id: 'l06',
    from: 860,
    dur: 140,
    text: 'But what if the run that worked became memory?',
    emphasis: ['became memory'],
  },
  {
    id: 'l07',
    from: 1040,
    dur: 140,
    text: "That's Rote. A memory layer for how work actually gets done.",
    emphasis: ['how work actually gets done'],
  },

  // --- what I built --------------------------------------------------------
  {
    id: 'l08',
    from: 1215,
    dur: 170,
    text: 'For the Rote Playoffs I published two Plays, for one job engineers repeat every single day.',
    emphasis: ['two Plays'],
  },
  {
    id: 'l09',
    from: 1390,
    dur: 180,
    text: 'Can this merge request merge? And if it cannot, whose move is it?',
    emphasis: ['whose move is it'],
  },

  // --- first run -----------------------------------------------------------
  {
    id: 'l10',
    from: 1605,
    dur: 135,
    text: 'Here it is running. One line. No arguments, no token, no setup.',
    emphasis: ['no token, no setup'],
  },
  {
    id: 'l11',
    from: 1770,
    dur: 160,
    text: 'Nine steps: validate, then five reads of GitLab in parallel, then the verdict.',
    emphasis: ['in parallel'],
  },
  {
    id: 'l12',
    from: 1960,
    dur: 175,
    text: 'And before it looks at a single piece of live data, it tests its own logic.',
    emphasis: ['tests its own logic'],
  },
  {
    id: 'l13',
    from: 2140,
    dur: 125,
    text: 'Thirty-nine cases. All thirty-nine pass. Only then does it judge.',
    emphasis: ['Only then does it judge'],
  },

  // --- the verdict ---------------------------------------------------------
  {
    id: 'l14',
    from: 2295,
    dur: 135,
    text: 'Six seconds later, a real verdict on a real merge request.',
    emphasis: ['a real verdict'],
  },
  {
    id: 'l15',
    from: 2455,
    dur: 175,
    text: 'Blocked, because blocking discussions are unresolved. And the next move belongs to one named person.',
    emphasis: ['Blocked'],
  },
  {
    id: 'l16',
    from: 2640,
    dur: 130,
    text: 'Not a guess. Every claim names the field that proves it.',
    emphasis: ['names the field that proves it'],
  },

  // --- what a Play is ------------------------------------------------------
  {
    id: 'l17',
    from: 2775,
    dur: 165,
    text: "So what is a Play? It isn't a prompt, and it isn't a script.",
  },
  {
    id: 'l18',
    from: 2950,
    dur: 195,
    text: "It's an inspectable record of how the work was done. The steps, the order, the evidence, the limits.",
    emphasis: ['how the work was done'],
  },
  {
    id: 'l19',
    from: 3150,
    dur: 195,
    text: 'Anyone can read it before they trust it. That is the part chat history never gave us.',
    emphasis: ['read it before they trust it'],
  },

  // --- the wow moment ------------------------------------------------------
  {id: 'l20', from: 3375, dur: 105, text: 'Now the same kind of task arrives again.'},
  {
    id: 'l21',
    from: 3510,
    dur: 155,
    text: 'A different project. A different merge request. A problem this Play has never seen.',
    emphasis: ['never seen'],
  },
  {
    id: 'l22',
    from: 3670,
    dur: 130,
    text: 'Instead of starting from zero, the agent reuses the Play.',
    emphasis: ['reuses the Play'],
  },
  {
    id: 'l23',
    from: 3830,
    dur: 160,
    text: "And look. It doesn't replay the old answer. It adapts. One blocker became three.",
    emphasis: ['It adapts'],
  },
  {
    id: 'l24',
    from: 4020,
    dur: 130,
    text: 'Conflicts first, then approvals, in the order they can actually happen.',
    emphasis: ['in the order they can actually happen'],
  },

  // --- trust ---------------------------------------------------------------
  {
    id: 'l25',
    from: 4155,
    dur: 155,
    text: "Then it checks itself against a witness it never used: GitLab's own verdict.",
    emphasis: ['a witness it never used'],
  },
  {
    id: 'l26',
    from: 4320,
    dur: 140,
    text: "Anything it couldn't read is reported as unknown. Never as clean.",
    emphasis: ['Never as clean'],
  },
  {
    id: 'l27',
    from: 4490,
    dur: 140,
    text: 'And it is read-only. It never approves, merges, or comments on anything.',
    emphasis: ['read-only'],
  },

  // --- differentiation -----------------------------------------------------
  {id: 'l28', from: 4635, dur: 135, text: "This isn't chat history. It's not a prompt library."},
  {id: 'l29', from: 4800, dur: 130, text: "And it's not a macro replaying fixed steps."},
  {
    id: 'l30',
    from: 4960,
    dur: 130,
    text: 'Rote remembers a successful way of doing work.',
    emphasis: ['a successful way of doing work'],
  },

  // --- compounding ---------------------------------------------------------
  {id: 'l31', from: 5115, dur: 135, text: 'And this is where it gets interesting.'},
  {
    id: 'l32',
    from: 5280,
    dur: 185,
    text: 'The second Play triages a whole backlog. Sixty-seven merge requests, and who each one waits on.',
    emphasis: ['a whole backlog'],
  },
  {
    id: 'l33',
    from: 5470,
    dur: 160,
    text: "Every run that works can become the next agent's starting point.",
    emphasis: ["the next agent's starting point"],
  },

  // --- finale --------------------------------------------------------------
  {id: 'l34', from: 5660, dur: 130, text: "The future of agents isn't only better reasoning."},
  {id: 'l35', from: 5820, dur: 130, text: "It's remembering what worked.", emphasis: ['what worked']},
  {id: 'l36', from: 5975, dur: 50, text: "That's Rote."},

  // --- creator -------------------------------------------------------------
  {id: 'l37', from: 6060, dur: 140, text: 'Built by Prince Panchani, for the Rote Playoffs.'},
];

/** The line active at a given frame, or null in a deliberate pause. */
export const lineAt = (frame: number): Line | null =>
  SCRIPT.find((l) => frame >= l.from && frame < l.from + l.dur) ?? null;
