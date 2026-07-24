---
name: Treasury RAG Lab
description: A light, airy clean-room instrument that makes RAG evidence visible and traceable.
colors:
  ink: "#0E1521"
  text: "#333B49"
  muted: "#667085"
  faint: "#6E7887"
  canvas: "#F4F6FA"
  panel: "#FFFFFF"
  panel-sunken: "#F0F3F8"
  border: "#E4E8EF"
  border-strong: "#D3D9E3"
  divider: "#EDEFF4"
  gold: "#E2A320"
  gold-bright: "#F3B63D"
  gold-ink: "#94640A"
  gold-wash: "#FBF1DC"
  gold-wash-strong: "#F6E6BF"
  context-slate: "#4E6B8F"
  context-wash: "#EEF3F9"
  good: "#0F7A47"
  good-wash: "#E4F5EC"
  bad: "#C93A3A"
  bad-wash: "#FBEBEA"
  warn: "#B77812"
typography:
  hero:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  subtitle:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 650
    lineHeight: 1.35
  hero-number:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
  base:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  overline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  micro:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  2xs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
    rounded: "{rounded.sm}"
    padding: "13px 18px"
  button-primary-hover:
    backgroundColor: "#232B3B"
    textColor: "{colors.panel}"
  nav-tab-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  callout-learning:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
---

# Design System: Treasury RAG Lab

## Overview

**Creative North Star: "The Clean-Room Instrument"**

Treasury RAG Lab is a precision instrument for reading evidence, rendered as a bright,
calm clean room rather than a dark hacker terminal. Everything sits on a soft cool-gray
canvas; the working surfaces are crisp white cards with hairline borders and low, diffuse
shadows, so information floats forward and the eye always knows what is a control, what is
evidence, and what is a note. The atmosphere is confident and unhurried — closer to a
modern developer tool (Linear, Vercel, Stripe) than to a lab-coat aesthetic — because the
job is to make an intimidating subject (RAG internals) feel learnable and worth screenshotting.

The system runs on **one workhorse sans and two meaning-colors**. Ink-near-black carries
structure and primary action; a single **gold** is the brand voice, reserved almost
entirely for *evidence and attention* — the highlighter over duplicated text, the current
selection, the "qué mirar" callouts, the focus ring. Gold is rare on purpose: when it
appears, it means "look here, this is the point." A cool blue-slate marks steering context
that is deliberately *not* citable, and green/red carry pass/fail and improved/regressed.

This is an Operate surface first: familiarity and scanability outrank expression. Delight
lives in precise details — a gold rank badge, a soft hover lift, a friendly empty state —
never in decoration that competes with the data.

**Key Characteristics:**
- Light, airy, cool-neutral canvas; white cards; low diffuse shadows.
- One sans (Inter) across headings, labels, body, and data; mono for IDs/offsets/scores.
- Gold as a rare "evidence & attention" accent; ink for action; blue-slate for non-cited context.
- Fixed rem type scale, generous 8px spacing rhythm, rounded-12px cards.
- Anti-reference: the previous dark `#0c100f` ground, olive-lime `#bad66b` accent, and Georgia serif display are fully retired.

## Colors

A cool, neutral base carrying one warm brand accent (gold) and a disciplined semantic set.

### Primary
- **Instrument Gold** (#E2A320, bright fill #F3B63D, text-on-white #94640A): the brand
  voice. Used for the current selection/active indicator, chunk/result rank badges,
  slider fills, focus rings, learning-callout accents, and the evidence highlighter. It is
  the "look here" color and appears sparingly.

### Secondary
- **Ink** (#0E1521): primary buttons, active-tab text, headings — structure and action.
- **Context Slate** (#4E6B8F, wash #EEF3F9): the contextual-prefix / steering-context
  marker. Signals text that shaped the vector but must never be read as citable evidence.

### Tertiary (semantic states)
- **Pass Green** (#0F7A47, wash #E4F5EC): guardrail pass, improved cases, positive deltas.
- **Fail Red** (#C93A3A, wash #FBEBEA): guardrail fail, degraded cases, negative deltas, errors.
- **Warn Amber** (#B77812): warning metrics (duplicated chars, extra contextual cost).

### Neutral
- **Canvas** (#F4F6FA): app background and inspector area — the cool gray cards sit on.
- **Panel** (#FFFFFF): cards, control panel, top bar.
- **Sunken** (#F0F3F8): segmented-control track, code/pre blocks, inset fields.
- **Ink Text** (#333B49) / **Muted** (#667085) / **Faint** (#6E7887): body, secondary, meta/labels.
- **Border** (#E4E8EF) / **Border Strong** (#D3D9E3) / **Divider** (#EDEFF4): hairlines and separations.

**The Rare Gold Rule.** Gold marks evidence and attention only. Never use it as a page
background, a body-text color, or generic decoration; if more than roughly a tenth of a
screen is gold, it has stopped meaning "look here."

**The Not-Evidence Rule.** The contextual prefix is always blue-slate on its wash with a
dashed edge — visually separate from real chunk text — because it steers retrieval but is
never quotable.

### Dark theme

The system is theme-aware via CSS custom properties. `:root[data-theme="dark"]` overrides
the color tokens (an inline `index.html` script sets `data-theme` from `localStorage`, then
the OS `prefers-color-scheme`, before first paint; a top-bar sun/moon toggle flips it and
persists the choice). Same identity, darker room:

- **Canvas** deepens to a cool near-black slate (#0E1218) — never olive, never pure black;
  **Panel** (#161C25) and **Sunken** (#0F141B) step up from it, with borders (#262D39) carrying depth.
- **Ink/text** invert to near-white (#F0F4F9 / #C8D0DB); **muted** and **faint** lighten to stay legible.
- **Gold** brightens slightly (#E6A92A); crucially `gold-ink` flips to a *light* gold (#F0C25F)
  so evidence text and badges read on dark, and the gold washes become dark warm tints (#241C0D).
- **Primary action** inverts: in dark it is near-white (#EEF2F7) with dark text — the same
  high-contrast neutral as the light theme's ink button, mirrored.
- **Semantic + context** colors brighten (good #48C78A, bad #EF6A63, context #93B0D4) over dark washes.
- Frosted top-bar / inspector headers use a dark glass token (`--glass`); shadows deepen.

**The Same-Room Rule.** Dark is a re-lit version of the one world, not a second design.
Gold stays the rare evidence accent, blue-slate stays non-cited context, and no token may
resolve to a value that breaks contrast — every text/background pair holds legibility in both themes.

## Typography

**Display / Body / Label Font:** Hanken Grotesk (with system-ui, -apple-system, "Segoe UI", Roboto fallback)
**Mono Font:** system monospace (ui-monospace, SF Mono, Menlo, Consolas)

**Character:** One warm, slightly humanist grotesk (Hanken Grotesk) does all the UI work —
more character than the default UI sans without sacrificing legibility at small sizes; the
only pairing is with a system mono used strictly for machine facts — chunk IDs, offsets,
scores, cache counts. Numbers use tabular figures so metrics and tables align.

### Hierarchy
- **Hero** (800, 2.25rem, -0.03em): the Home headline only.
- **Display** (700, 1.75rem, -0.02em): lab titles (`h1`) in the control panel.
- **Headline** (650, 1.375rem, -0.015em): inspector / response titles (`h2`).
- **Title** (650, 1.0625rem): section and tab-intro headings (`h3`).
- **Body** (400, 0.9375rem, 1.6): descriptions, notes, answers, claims.
- **Label** (600, 0.75rem): field labels, table headers, metric captions.
- **Overline** (700, 0.6875rem, 0.08em, uppercase): eyebrow/slice tags — in gold-ink or muted.
- **Mono** (500, 0.75rem, tabular): IDs, offsets, scores, timestamps, deltas.

**The One Voice Rule.** No display serif and no second sans. Hierarchy comes from weight,
size, and color — not from switching families. (The retired design's Georgia headings are the anti-pattern.)

## Layout

Two-pane workspaces on a fixed shell. A sticky top bar (brand, lab nav, connection status)
sits above either a **control-panel + inspector** two-column grid (Chunking, Search,
Failure: left panel `minmax(300px, 360px)`, right inspector fluid) or the Grounded Answer
**chat + evidence-inspector** split. Content max-widths keep prose readable (~70ch) while
tables and data may run denser. Spacing follows an 8px rhythm with more space above a
heading than below it. Responsive behavior is structural: below ~900px the two columns
stack (control panel on top with a bottom divider), metric grids drop from four to two
columns, and the chat/inspector split becomes vertical; type sizes stay fixed.

## Elevation & Depth

Hybrid, leaning flat. Depth comes mostly from the canvas-vs-white tonal step and hairline
borders; shadows are low, cool, and diffuse, used to lift interactive or focused surfaces,
never for drama.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.04)`): white cards at rest.
- **Raised** (`0 2px 4px rgba(16,24,40,.04), 0 10px 24px -10px rgba(16,24,40,.14)`): hover lift, composer, popovers.
- **Overlay** (`0 12px 32px -12px rgba(16,24,40,.18)`): the sticky top bar's blur layer and any floating panel.
- **Gold glow** (`0 8px 20px -8px rgba(226,163,32,.45)`): reserved for the primary CTA hover and gold focus emphasis.

**The Flat-At-Rest Rule.** Surfaces are calm at rest (border + tonal step); a shadow that
grows is a response to state (hover, focus, elevation), not a default costume.

## Shapes

Softly rounded, engineered, not pill-soft. Cards and inputs use a 12px / 8px radius; small
chips and badges use 6–8px; only true toggles and status pills go fully rounded (999px).
Borders are hairline (1px) in cool neutrals; the accent border (gold) appears only on the
current selection or focus. Rank badges are small rounded squares/circles, not decorative.
Score bars are thin 2–3px tracks. Corners stay consistent within a component family.

## Components

### Buttons
- **Shape:** 8px radius, no uppercase, 600–700 weight.
- **Primary:** ink background (#0E1521), white text, ~13×18px padding; used for "Buscar
  evidencia", "Preguntar", "Ejecutar comparación".
- **Hover / Focus:** hover shifts to #232B3B and lifts with the gold-glow shadow on the
  main CTAs; focus shows a gold ring. Disabled drops opacity and shows a wait cursor.
- **Segmented control:** sunken track, active segment becomes a white card with soft shadow
  and ink text; inactive is muted. Same vocabulary everywhere (strategy pickers, chunking).

### Chips / Pills
- **Meta pills** (document meta, model strip, answer stats): sunken/neutral background,
  faint text, 6px radius — quiet metadata.
- **Status pills** (tenant, run-state, connection): rounded-full with a leading dot; green
  dot = live/connected, gray = idle, red = error.

### Cards / Containers
- **Corner:** 12px. **Background:** white on the canvas. **Border:** 1px #E4E8EF.
- **Shadow:** resting-card at rest, raised on hover for interactive lists (chunk/result cards).
- **Padding:** 16px; card headers/footers separated by 1px dividers, footers in mono/faint.
- **Selected/target** (cited source): gold border + faint gold ring.

### Inputs / Fields
- **Style:** white (or sunken) background, 1px border, 8px radius, ink text.
- **Focus:** border shifts to gold and a 3px gold ring appears. Range inputs use a gold
  fill/thumb. Labels are 600/0.75rem, muted.

### Navigation
- **Top bar:** sticky, white with a blurred translucent layer and bottom hairline; brand
  mark "TR" as an ink or gold rounded square + wordmark and "Laboratorio de evidencia".
- **Lab nav:** a sunken segmented group; active tab is a white pill (ink text, soft shadow);
  hover lightens inactive tabs. Inspector tabs use an underline-on-active (gold) pattern.

### Signature: Evidence cards & the Highlighter
- **Chunk / result / retrieval cards:** rank in a gold badge, title + mono metadata, a
  `pre` body, and a mono footer (chunk id, offsets). Result cards carry a thin gold score bar.
- **The Highlighter:** duplicated-by-overlap text is wrapped in `mark` with a translucent
  gold background and a gold underline — the literal "look here" of the chunking lab.
- **Learning callouts:** gold-wash cards with a gold left accent and a small dot; they carry
  "Qué mirar", "Qué aprendemos", "Modelo local", "Sin costo" — teaching, made inviting.

## Do's and Don'ts

### Do:
- **Do** keep the canvas light and cool (#F4F6FA) with white working surfaces; let tonal
  step + hairline borders do most of the depth work.
- **Do** reserve gold for evidence, selection, focus, and teaching cues — the "look here" color.
- **Do** render the contextual prefix in blue-slate with a dashed edge, visually apart from
  chunk text, so it never reads as citable evidence.
- **Do** use tabular mono for IDs, offsets, scores, and deltas; align numbers in tables and metrics.
- **Do** keep all Spanish copy and pedagogical notes prominent; treat them as first-class content.
- **Do** give every interactive control default/hover/focus/active/disabled states with 150–250ms transitions.

### Don't:
- **Don't** reintroduce the retired world: no near-black `#0c100f` ground, no olive-lime
  `#bad66b`, no Georgia/serif display, no giant serif numerals.
- **Don't** flood the screen with gold; if it stops being rare it stops meaning "evidence."
- **Don't** add display fonts, decorative motion, or invented affordances — this is an Operate tool; the mechanism must stay legible.
- **Don't** change presenter view-model shapes or class hooks the presenters rely on; the redesign is visual.
- **Don't** hide the tenant-isolation guardrail's locked state or blur the free/paid distinction.
