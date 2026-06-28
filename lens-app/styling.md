# Lens Arc — GUI Styling Specification

> This document is the single source of truth for Lens Arc's visual design system.
> When applying this to the codebase, every value here takes precedence over defaults.
> Do not alter gradient hex values, font, or spacing units without explicit instruction.

---

## Core Philosophy

Lens Arc sits at the intersection of institutional-grade analytics and everyday usability.
The UI communicates precision without intimidation. Every decision either serves the data or gets removed.
The product is doing serious analytical work — the interface should feel like it knows that.

---

## Signature Elements

### 1. Tick Mark Grid

A sparse field of `+` crosshair ticks rendered across the main dashboard background.
This is the ambient texture of the entire app — it references financial charting and precision,
and makes every card feel like it is *plotted* on a surface rather than floating on one.

Apply to the root dashboard background only. Not to cards, modals, or sidebars.
The tick grid lives beneath everything — cards sit on top of it.

**Implementation — SVG data URI (use this one):**

```css
.tick-grid-bg {
  background-image: url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='16' y1='14' x2='16' y2='18' stroke='%231e2028' stroke-width='1'/%3E%3Cline x1='14' y1='16' x2='18' y2='16' stroke='%231e2028' stroke-width='1'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 32px 32px;
}
```

**Opacity note:** The tick color `#1e2028` on base `#111318` is intentionally near-invisible.
Do not increase contrast. It should be sensed, not seen.

---

### 2. Gradient Hairlines

Thin `1px` horizontal rules using the Lens Arc gradient, fading to transparent at both ends.
Used to separate major layout zones — primarily the Caution Score panel from content below it.
Also used as the active indicator on the sidebar nav (left edge, vertical, 2px wide).

**Horizontal hairline:**

```css
.gradient-hairline {
  height: 1px;
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #38bdf8 20%,
    #60a5fa 80%,
    transparent 100%
  );
  border: none;
  margin: 0;
}
```

**Sidebar active nav indicator (vertical):**

```css
.nav-item-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: linear-gradient(180deg, #38bdf8, #60a5fa);
  border-radius: 0 2px 2px 0;
}
```

**Usage rules:**
- Maximum 2 gradient hairlines visible on any screen at once
- Never use as a card border — only as a layout separator or nav indicator
- Horizontal hairlines fade to transparent at both ends always

---

## Color System

```css
:root {
  /* Backgrounds */
  --color-bg-base:        #111318;   /* Root canvas */
  --color-bg-surface:     #1a1d24;   /* Cards, panels */
  --color-bg-elevated:    #21242d;   /* Dropdowns, tooltips, hover states */

  /* Borders */
  --color-border-subtle:  #2a2d35;   /* Dividers, table lines, card edges */

  /* Text */
  --color-text-primary:   #f0f2f5;   /* Main readable text — never pure white */
  --color-text-secondary: #8b90a0;   /* Labels, timestamps, helper copy */
  --color-text-tertiary:  #4a4f5e;   /* Disabled, placeholder */

  /* Brand Gradient — DO NOT CHANGE THESE VALUES */
  --color-brand-sky:      #38bdf8;   /* gradient start */
  --color-brand-blue:     #60a5fa;   /* gradient end */
  --color-accent:         #4cb1f9;   /* solid mid-tone for flat highlights/selection/borders */
  --gradient-brand:       linear-gradient(135deg, #38bdf8 0%, #60a5fa 100%);
  --gradient-brand-text:  linear-gradient(135deg, #38bdf8, #60a5fa);

  /* Semantic */
  --color-gain:           #3ecf8e;   /* Positive returns — desaturated green */
  --color-loss:           #f16b6b;   /* Negative returns — soft red */
  --color-caution:        #f5a623;   /* Mid-risk amber — Caution Score tier 2 only */
}
```

### Gradient Usage — Hard Rules

The gradient appears in exactly these four places only:

1. Caution Score gauge arc stroke
2. Primary CTA button fill
3. Gradient hairline separators
4. Active sidebar nav indicator

Nowhere else. If adding a fifth usage, remove it from one of the four above first.

---

## Typography

**Font family:** `'Sora', sans-serif` — applied globally. No fallback mixing. Do not substitute.

### Type Scale

| Token               | Size  | Weight | Use                                          |
|---------------------|-------|--------|----------------------------------------------|
| `--text-axis`       | 11px  | 400    | Chart axis labels, footnotes                 |
| `--text-caption`    | 12px  | 400    | Timestamps, fine print                       |
| `--text-label`      | 13px  | 500    | Table headers, input labels, badges          |
| `--text-body`       | 14px  | 400    | Table body, descriptions, secondary copy     |
| `--text-ui`         | 14px  | 500    | Nav items, button text, card subtitles       |
| `--text-heading-sm` | 16px  | 500    | Subheadings, sidebar section labels          |
| `--text-heading-md` | 20px  | 600    | Card titles, page section headers            |
| `--text-metric`     | 28px  | 600    | Key data values — portfolio total, returns   |
| `--text-score`      | 56px  | 600    | Caution Score number — this size only        |

### Tracking Rules

```
font-size >= 20px  →  letter-spacing: -0.02em
font-size <  20px  →  letter-spacing: normal (0em)
```

### Weight Discipline

Only three weights used across the entire app: `400`, `500`, `600`.
Never use `700` or `300`.
`600` is reserved for numbers that carry meaning — metric values and the Caution Score.
Do not use `600` on descriptive or label text.

---

## Spacing System

Base unit: `8px`. Every spacing value is a multiple. No exceptions.

```css
:root {
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
  --space-6: 64px;
}
```

`12px` appears only as a `border-radius` value, never as a spacing gap.
Card internal padding: `--space-3` (24px) on all sides.
Section gaps between major layout blocks: `--space-4` (32px).
Max content width: `1280px`, centered.

---

## Layout

### Dashboard Structure

The Caution Score panel occupies the dominant visual position.
It is not a widget or sidebar element — it commands the page.

Grid: 12-column CSS Grid, `24px` gutters.
Caution Score panel: 5 of 12 columns on desktop.
Content panels (charts, CTA list, holdings table): remaining 7 columns.
Below `1024px`: Caution Score panel goes full width, stacks above content.

### Z-Index Stack

```
Tick grid / base canvas:   z-index: 0
Surface cards:             z-index: 1
Sticky sidebar / nav:      z-index: 10
Modals / drawers:          z-index: 100
Tooltips:                  z-index: 200
```

---

## Components

### Cards

```css
.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: var(--space-3);
}
```

No box shadows. Depth is created by the surface color lift over the tick grid, not shadows.

---

### Buttons

**Primary:**

```css
.btn-primary {
  background: linear-gradient(135deg, #38bdf8 0%, #60a5fa 100%);
  color: #0a0d12;
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 500;
  height: 40px;
  padding: 0 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: opacity 200ms ease-out;
}
.btn-primary:hover {
  opacity: 0.88;
}
```

**Secondary:**

```css
.btn-secondary {
  background: transparent;
  color: var(--color-text-primary);
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 500;
  height: 40px;
  padding: 0 20px;
  border-radius: 6px;
  border: 1px solid var(--color-border-subtle);
  cursor: pointer;
  transition: border-color 200ms ease-out, background 200ms ease-out;
}
.btn-secondary:hover {
  border-color: #3a3f4e;
  background: var(--color-bg-elevated);
}
```

No ghost buttons with colored text. No icon-only buttons without tooltips.

---

### Tables

No outer card border wrapping tables. The table stands on its own.

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  letter-spacing: 0.01em;
  text-transform: uppercase;
}
.data-table td {
  font-size: 14px;
  font-weight: 400;
  color: var(--color-text-primary);
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-subtle);
}
.data-table tr:last-child td {
  border-bottom: none;
}
.data-table tr:hover td {
  background: var(--color-bg-elevated);
}
```

No zebra striping. Hover state handles row identification.

---

### Caution Score Component

The score is the visual centerpiece. Largest type on the page. Most real estate.

```css
.caution-score-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.caution-score-value {
  font-size: 56px;
  font-weight: 600;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #38bdf8, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.caution-score-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 4px;
}
```

The gauge arc uses the brand gradient as its SVG stroke always.
Score tier coloring applies to supplementary text/badges only — not the arc itself:
- Tier 1 (1–33): `--color-gain` (#3ecf8e)
- Tier 2 (34–66): `--color-caution` (#f5a623)
- Tier 3 (67–99): `--color-loss` (#f16b6b)

---

### Charts (Custom Graph System)

```
Line stroke:      linear gradient #38bdf8 → #60a5fa applied as SVG linearGradient
Area fill:        same gradient at 10% opacity beneath the line
Grid lines:       horizontal only, 1px, --color-border-subtle
Vertical grids:   none
Chart background: transparent — base canvas shows through
Chart borders:    none
Axis labels:      11px, weight 400, --color-text-tertiary
Tooltip bg:       --color-bg-elevated
Tooltip border:   1px solid --color-border-subtle
Tooltip radius:   8px
```

---

## Motion

**Default transition:** `200ms ease-out` on all interactive state changes.
Never use `ease-in` on UI elements.

**Caution Score arc — load animation:**
Sweeps from `0` to actual value on page load only.
Duration: `600ms`
Timing: `cubic-bezier(0.16, 1, 0.3, 1)`
This is the only load animation in the app.

**Page transitions:**
`opacity: 0` to `opacity: 1` at `150ms ease-out`. No slide, scale, or blur.

**No skeleton loaders with pulse animations.** Use opacity fade only.

---

## Hard Rules — Do Not Violate

- No glassmorphism (`backdrop-filter: blur`) anywhere
- No purple in the palette
- No `border-radius` above `8px` on data cards
- No gradient usage outside the four designated cases
- No font weight above `600`
- No spacing values that are not multiples of `8px`
- No box shadows — depth comes from surface color layering only
- No sidebar icons with text labels stacked below them
- No more than 2 gradient hairlines visible on screen simultaneously
- No vertical grid lines in charts
- No zebra striping in tables

---

## Quick Reference

```
── BACKGROUNDS ──────────────────────────────
Base canvas:        #111318
Surface (cards):    #1a1d24
Elevated:           #21242d
Border:             #2a2d35

── TEXT ─────────────────────────────────────
Primary:            #f0f2f5
Secondary:          #8b90a0
Tertiary:           #4a4f5e

── BRAND ────────────────────────────────────
Sky (start):        #38bdf8
Blue (end):         #60a5fa
Accent (flat):      #4cb1f9
Gradient:           linear-gradient(135deg, #38bdf8, #60a5fa)

── SEMANTIC ─────────────────────────────────
Gain:               #3ecf8e
Loss:               #f16b6b
Caution amber:      #f5a623

── TYPOGRAPHY ───────────────────────────────
Font:               Sora
Weights:            400 / 500 / 600 only
Score:              56px / 600
Metric:             28px / 600
Heading:            20px / 600
Tracking (≥20px):   -0.02em

── STRUCTURE ────────────────────────────────
Base radius:        8px
Spacing unit:       8px (all gaps are multiples)
Max width:          1280px
Transition:         200ms ease-out
Score animation:    600ms cubic-bezier(0.16, 1, 0.3, 1)

── SIGNATURE ELEMENTS ───────────────────────
Tick grid:          SVG crosshair, #1e2028 on #111318, 32px repeat
Hairline:           linear-gradient(90deg, transparent, #38bdf8, #60a5fa, transparent)
```