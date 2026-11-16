---
name: idea-review
description: Pressure-test a product idea, value proposition, feature direction or pivot for Ghoomlo against a fixed set of startup and product-thinking lenses, and name the riskiest assumption and the cheapest way to test it. Use this whenever the founder floats a "what if we…" idea, asks "why would someone use this", "is this a good idea", "what's our value prop", compares directions, or wants a sanity check before building something new — even if they don't ask for a "review" by name.
---

# Idea review

The founder thinks out loud about directions. The job here is to be the honest product partner: take the idea seriously, run it through the same lenses every time so ideas can be compared, and end with one thing to test. Flattery is useless to them and so is a wall of theory.

## Before reviewing

Read these so the review builds on what is already known instead of starting from zero:

- `CLAUDE.md` (repo root): what Ghoomlo is and what exists today.
- `DISCOVERY_NOTES.md`: the evidence so far. Note how thin it is and say so.
- `research/idea-log.md`: earlier ideas and verdicts, so you can compare and spot repeats.
- `research/`: any study results that have come back.

If the idea is vague, restate it in one sentence as "For [who], when [situation], Ghoomlo [does what], so they [outcome]" and review that. Say that you did this, so the founder can correct it.

## The lenses

Apply all seven, briefly. `references/lenses.md` has the questions and sources for each; read it the first time and whenever you need the detail.

1. **Problem quality** — popular, growing, urgent, expensive, mandatory, frequent.
2. **Job to be done** — what the person is trying to get done, and the four forces: push, pull, anxiety, habit.
3. **Four risks** — value, usability, feasibility, viability.
4. **Tarpit check** — is this an idea many have tried that looks easy and is not? What is newly possible now?
5. **Frequency and retention** — how often does the need arise, and what brings someone back?
6. **Defensibility** — what would make this hard to copy once it works?
7. **Evidence** — what do we actually know, from whom, and how strong is it?

Two facts about this market colour most reviews, so weigh them every time: leisure trips are rare for a household (a few a year), which makes retention and acquisition cost the default problems; and a general AI chatbot already drafts itineraries for free, so "an AI plan" alone is not a reason to come.

Also check the idea against Ghoomlo's trust rules in `PRODUCT_BRIEF.md` (never invent facts, label what is unverified, respect content and data rights). An idea that only works by breaking them is not viable as stated; say what would have to change.

## What to produce

Answer in chat, in plain language the founder can act on. They are not a product specialist: explain a term the first time you use it, or avoid it.

Use this shape:

1. **Verdict** — one or two sentences: promising, promising with a catch, or weak, and the main reason.
2. **What is strong** — two or three points.
3. **What is weak or unknown** — two or three points. Lead with the one that could kill it.
4. **Lens table** — one row per lens, a rating (strong / mixed / weak / unknown) and a short reason. Unknown is an honest answer; do not guess a rating to fill a cell.
5. **Riskiest assumption** — the single belief that, if false, makes the rest not matter.
6. **Cheapest test** — something doable in one or two weeks without building the product, and what result would count as a yes or a no. Use the `assumption-test` skill for the detailed design if the founder wants to run it.

When several ideas are reviewed together, add a short comparison and a recommendation on order. Recommend; the founder decides.

Keep the whole thing to what fits on a screen or two. Cite a source only where it backs a specific claim.

## Afterwards

Add a row to `research/idea-log.md` (create it if missing) with the date, the one-sentence idea, the verdict, the riskiest assumption and the status (`untested`, `testing`, `supported`, `dropped`). Save the full review to `research/idea-reviews/YYYY-MM-DD-short-name.md` when the founder is likely to come back to it. This is the project's memory of what has been considered, so a later session does not re-argue it from scratch.

Do not rewrite `PRODUCT_BRIEF.md` or start building because a review came out well. A good review earns a test, not a roadmap change.
