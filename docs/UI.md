# Nivaran v2: UI rules

Status: **v1, revisit in Phase 7 design critique.** Owner of fonts, colours, tokens, motion and copy rules.
`CLAUDE.md` links here and repeats none of it. Product rules live in `docs/DESIGN.md` (§7B SLA, §7C India rules, §7D principles).
If code and this file disagree, fix the code or open a change to this file; never hardcode a hex, font or duration.

## 1. Direction

**The idea: a public counter that works.** Nivaran should feel like the best version of an Indian public office:
the India Post counter with clear forms, a stamped receipt and a clerk who tells you when to come back. Calm, plainly
official, never bureaucratic. It is not a startup dashboard: no gradients, no glass, no hero illustrations, no confetti. (Magic UI accents are allowed only within the limits in §6.1.)

| Choice | Value | Why (one line) |
|---|---|---|
| Accent (only one) | **Peacock**, `oklch(0.47 0.08 215)` light / `oklch(0.76 0.10 205)` dark | Mor-pankhi blue-green is native to Indian craft and signage, reads as calm and official, and is not the default SaaS indigo. |
| Display font | **Anek Devanagari** (variable, wght axis), `@fontsource-variable/anek-devanagari` | Ek Type designed it from Indian multi-script signage, so headings in English and Hindi feel like one civic voice. |
| Body font | **Mukta** (400, 500, 600), `@fontsource/mukta` | Also by Ek Type, built for small sizes in Latin and Devanagari, so it pairs with Anek and stays legible on cheap phones. |

- Neutrals are cool "chalk and ink" greys with a trace of the peacock hue (hue 220-235). No cream, no pure black.
- **Spend boldness in one place: the pincode and the ticket.** Step 1 shows the pincode as six boxed digits, like the PIN boxes on an
  India Post envelope; the success screen shows the ticket ID as a stamped counterfoil (display font, large, a perforated top edge,
  copy button). Everything between is quiet: white cards, thin borders, one accent.
- Status colours are information, not decoration. The accent is never used to mean a status.
- Don't: all-caps labels, eyebrow text above headings, one highlighted word in a headline, middle-dot meta strings,
  `→` on buttons, monospace for data, identical cards with the same shadow everywhere, stock illustrations.

### Typography

- Load both fonts in `client/src/main.jsx`: `@fontsource-variable/anek-devanagari/wght.css` and `@fontsource/mukta/{400,500,600}.css`.
  Fontsource splits files by `unicode-range`, so Devanagari files only download when Hindi text is on screen. No Google Fonts `<link>`.
- `--font-display: "Anek Devanagari Variable", "Mukta", system-ui, sans-serif;` `--font-sans: "Mukta", system-ui, sans-serif;`
- Display font: h1-h3, ticket IDs, the pincode boxes, big counts on staff dashboards. Weight 600 (headings) or 700 (ticket ID). Everything else is Mukta.
- Scale (1.25 ratio, 16px base): 12 / 14 / **16 body** / 20 / 25 / 31 / 39 px. Mobile h1 is 31px, desktop 39px. Never below 12px; body text never below 16px on mobile.
- Line height: body 1.6, headings 1.2. For `lang="hi"` raise body to 1.75 and headings to 1.35 (Devanagari matras need room).
- Measure: 65ch max for paragraphs. Left-aligned everywhere; centre only the empty-state block and the counterfoil.
- Numbers that change in place (counts, countdowns, ticket IDs) use `tabular-nums`. Indian grouping: `1,50,000` via `Intl.NumberFormat('en-IN')`.

## 2. Colour tokens

shadcn/ui Tailwind v4 format: define in `client/src/styles/globals.css`, then map with `@theme inline` (section 2.2). OKLCH, all values inside the sRGB gamut.

```css
:root {
  --radius: 0.625rem;
  --background: oklch(0.985 0.004 220);
  --foreground: oklch(0.22 0.02 235);
  --card: oklch(1 0 0); --card-foreground: oklch(0.22 0.02 235);
  --popover: oklch(1 0 0); --popover-foreground: oklch(0.22 0.02 235);
  --primary: oklch(0.47 0.08 215); --primary-foreground: oklch(0.985 0.004 220);
  --secondary: oklch(0.955 0.008 220); --secondary-foreground: oklch(0.26 0.02 235);
  --muted: oklch(0.955 0.008 220); --muted-foreground: oklch(0.5 0.02 235);
  --accent: oklch(0.94 0.025 210); --accent-foreground: oklch(0.3 0.055 220);
  --destructive: oklch(0.52 0.19 25); --destructive-foreground: oklch(0.985 0.004 220);
  --border: oklch(0.9 0.008 225);
  --input: oklch(0.62 0.015 230);
  --ring: oklch(0.47 0.08 215);
  --chart-1: oklch(0.47 0.08 215); --chart-2: oklch(0.7 0.13 75);
  --chart-3: oklch(0.55 0.03 250); --chart-4: oklch(0.58 0.11 150);
  --chart-5: oklch(0.56 0.13 350);
  --sidebar: oklch(0.97 0.006 220); --sidebar-foreground: oklch(0.22 0.02 235);
  --sidebar-primary: oklch(0.47 0.08 215); --sidebar-primary-foreground: oklch(0.985 0.004 220);
  --sidebar-accent: oklch(0.93 0.02 215); --sidebar-accent-foreground: oklch(0.26 0.04 225);
  --sidebar-border: oklch(0.9 0.008 225);
  --sidebar-ring: oklch(0.47 0.08 215);
  --status-submitted: oklch(0.95 0.008 250); --status-submitted-foreground: oklch(0.4 0.03 250);
  --status-assigned: oklch(0.95 0.025 290); --status-assigned-foreground: oklch(0.42 0.13 290);
  --status-in-progress: oklch(0.95 0.02 250); --status-in-progress-foreground: oklch(0.42 0.12 250);
  --status-resolved: oklch(0.95 0.04 150); --status-resolved-foreground: oklch(0.42 0.1 150);
  --status-closed: oklch(0.92 0.005 250); --status-closed-foreground: oklch(0.36 0.01 250);
  --status-reopened: oklch(0.95 0.03 60); --status-reopened-foreground: oklch(0.45 0.12 50);
  --status-rejected: oklch(0.95 0.025 20); --status-rejected-foreground: oklch(0.45 0.15 20);
  --sla-on-track: oklch(0.95 0.04 150); --sla-on-track-foreground: oklch(0.42 0.1 150);
  --sla-at-risk: oklch(0.95 0.06 90); --sla-at-risk-foreground: oklch(0.43 0.09 70);
  --sla-breached: oklch(0.94 0.03 25); --sla-breached-foreground: oklch(0.45 0.17 25);
  --sla-paused: oklch(0.95 0.008 250); --sla-paused-foreground: oklch(0.4 0.03 250);
}
.dark {
  --background: oklch(0.18 0.018 235);
  --foreground: oklch(0.95 0.008 220);
  --card: oklch(0.21 0.018 235); --card-foreground: oklch(0.95 0.008 220);
  --popover: oklch(0.23 0.018 235); --popover-foreground: oklch(0.95 0.008 220);
  --primary: oklch(0.76 0.1 205); --primary-foreground: oklch(0.16 0.02 230);
  --secondary: oklch(0.26 0.02 235); --secondary-foreground: oklch(0.92 0.01 220);
  --muted: oklch(0.26 0.02 235); --muted-foreground: oklch(0.72 0.02 230);
  --accent: oklch(0.3 0.045 220); --accent-foreground: oklch(0.92 0.03 210);
  --destructive: oklch(0.72 0.15 22); --destructive-foreground: oklch(0.16 0.02 230);
  --border: oklch(0.3 0.02 235);
  --input: oklch(0.52 0.02 235);
  --ring: oklch(0.76 0.1 205);
  --chart-1: oklch(0.76 0.1 205); --chart-2: oklch(0.8 0.13 80);
  --chart-3: oklch(0.7 0.03 250); --chart-4: oklch(0.74 0.12 150);
  --chart-5: oklch(0.72 0.13 350);
  --sidebar: oklch(0.2 0.018 235); --sidebar-foreground: oklch(0.95 0.008 220);
  --sidebar-primary: oklch(0.76 0.1 205); --sidebar-primary-foreground: oklch(0.16 0.02 230);
  --sidebar-accent: oklch(0.28 0.03 225); --sidebar-accent-foreground: oklch(0.95 0.008 220);
  --sidebar-border: oklch(0.3 0.02 235);
  --sidebar-ring: oklch(0.76 0.1 205);
  --status-submitted: oklch(0.3 0.02 250); --status-submitted-foreground: oklch(0.88 0.02 250);
  --status-assigned: oklch(0.31 0.07 290); --status-assigned-foreground: oklch(0.86 0.07 290);
  --status-in-progress: oklch(0.31 0.07 250); --status-in-progress-foreground: oklch(0.86 0.07 250);
  --status-resolved: oklch(0.3 0.06 150); --status-resolved-foreground: oklch(0.86 0.1 150);
  --status-closed: oklch(0.26 0.005 250); --status-closed-foreground: oklch(0.9 0.005 250);
  --status-reopened: oklch(0.31 0.06 50); --status-reopened-foreground: oklch(0.86 0.08 60);
  --status-rejected: oklch(0.31 0.07 20); --status-rejected-foreground: oklch(0.86 0.07 20);
  --sla-on-track: oklch(0.3 0.06 150); --sla-on-track-foreground: oklch(0.86 0.1 150);
  --sla-at-risk: oklch(0.31 0.06 70); --sla-at-risk-foreground: oklch(0.88 0.12 85);
  --sla-breached: oklch(0.32 0.09 25); --sla-breached-foreground: oklch(0.87 0.06 25);
  --sla-paused: oklch(0.3 0.02 250); --sla-paused-foreground: oklch(0.88 0.02 250);
}
```

### 2.1 Status and SLA badges (measured contrast)

Every badge is `bg-<token>` + `text-<token>-foreground` + a lucide icon + a text label. Never colour alone, never icon alone.
Ratios are measured (OKLCH → linear sRGB → WCAG relative luminance), text on badge background. AA needs 4.5:1.

| Token | Label (en) | lucide icon | Light | Dark |
|---|---|---|---|---|
| `status-submitted` | Submitted | `Inbox` | 7.94:1 | 9.50:1 |
| `status-assigned` | Assigned | `UserCheck` | 7.66:1 | 8.65:1 |
| `status-in-progress` | In progress | `Wrench` | 7.33:1 | 8.63:1 |
| `status-resolved` | Resolved | `CircleCheck` | 7.08:1 | 9.03:1 |
| `status-closed` | Closed | `Lock` | 8.57:1 | 11.53:1 |
| `status-reopened` | Reopened | `RotateCcw` | 6.70:1 | 8.62:1 |
| `status-rejected` | Rejected | `CircleX` | 6.90:1 | 8.63:1 |
| `sla-on-track` | On track | `Clock` | 7.08:1 | 9.03:1 |
| `sla-at-risk` | At risk | `Hourglass` | 7.16:1 | 9.22:1 |
| `sla-breached` | Overdue | `TriangleAlert` | 6.75:1 | 8.71:1 |
| `sla-paused` | Paused | `CirclePause` | 7.94:1 | 9.50:1 |

- Enum → token: `in_progress` → `status-in-progress`; SLA `on_track` → `sla-on-track`, `at_risk` → `sla-at-risk`, `breached` → `sla-breached`.
  `sla-paused` is not a status: it shows when `slaPausedAt` is set (on hold, approved by a department head) and replaces the SLA badge.
- `breached` is labelled **Overdue** in the UI (plain English); the enum stays `breached`. `at_risk` starts at 75% of the clock used.
- `resolved` and `on_track` share a green on purpose (both mean "good"); icon and label tell them apart.
- Label keys: `status.issue.<enum>` and `status.sla.<enum>` (e.g. `status.issue.in_progress`, `status.sla.breached`).
- Icons are `aria-hidden="true"`; the label is the accessible name. Badge text 14px weight 500 (12px is too small for Devanagari); icon 14px in badges, 16px elsewhere.

### 2.2 Core pairs (measured) and Tailwind mapping

| Pair | Needs | Light | Dark |
|---|---|---|---|
| `foreground` on `background` | 4.5:1 | 16.56:1 | 16.26:1 |
| `muted-foreground` on `background` | 4.5:1 | 5.72:1 | 7.61:1 |
| `muted-foreground` on `card` | 4.5:1 | 5.97:1 | 7.16:1 |
| `muted-foreground` on `muted` | 4.5:1 | 5.25:1 | 6.27:1 |
| `primary-foreground` on `primary` | 4.5:1 | 6.35:1 | 9.37:1 |
| `primary` on `background` | 4.5:1 | 6.35:1 | 9.08:1 |
| `primary` on `card` | 4.5:1 | 6.62:1 | 8.55:1 |
| `secondary-foreground` on `secondary` | 4.5:1 | 13.61:1 | 12.26:1 |
| `accent-foreground` on `accent` | 4.5:1 | 11.35:1 | 10.73:1 |
| `destructive-foreground` on `destructive` | 4.5:1 | 5.83:1 | 7.31:1 |
| `destructive` on `background` | 4.5:1 | 5.83:1 | 7.08:1 |
| `destructive` on `card` | 4.5:1 | 6.08:1 | 6.67:1 |
| `sidebar-accent-foreground` on `sidebar-accent` | 4.5:1 | 12.61:1 | 12.55:1 |
| `sidebar-foreground` on `sidebar` | 4.5:1 | 15.86:1 | 15.65:1 |
| `primary` on `sidebar-accent` | 4.5:1 | 5.42:1 | 7.00:1 |
| `input` on `background` | 3:1 | 3.48:1 | 3.43:1 |
| `input` on `card` | 3:1 | 3.63:1 | 3.23:1 |
| `ring` on `background` | 3:1 | 6.35:1 | 9.08:1 |
| `ring` on `card` | 3:1 | 6.62:1 | 8.55:1 |

Lowest text pair: `muted-foreground` on `muted` (light) at 5.25:1. `input` and `ring` are non-text (WCAG 1.4.11, 3:1).
`border` is decorative only (dividers); anything a user must find to operate (inputs, checkboxes, toggles) uses `input`.

```css
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  /* ...same pattern for card, popover, primary, secondary, muted, accent, destructive,
     border, input, ring, chart-1..5 and every sidebar-* token, exactly as shadcn generates... */
  --color-status-submitted: var(--status-submitted);
  --color-status-submitted-foreground: var(--status-submitted-foreground);
  /* ...one pair per status-* and sla-* token above... */
  --font-display: "Anek Devanagari Variable", "Mukta", system-ui, sans-serif;
  --font-sans: "Mukta", system-ui, sans-serif;
  --radius-sm: calc(var(--radius) - 4px); --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius); --radius-xl: calc(var(--radius) + 4px);
}
```

Dark mode: class strategy (`.dark` on `<html>`). Default follows `prefers-color-scheme`; a toggle in Settings saves the choice in `localStorage`.

## 3. Shape, space, depth, layers

**Radius** (`--radius: 0.625rem` = 10px). Hierarchy, not one radius for everything:
`sm` 6px: badges, pincode boxes, chips. `md` 8px: buttons, inputs, selects. `lg` 10px: cards, dialogs. `xl` 14px: sheet top corners, chat panel. `full`: avatars and the chat bubble only.

**Spacing**: 4px base, use Tailwind's scale only (`1` = 4px). Allowed steps: 1, 2, 3, 4, 6, 8, 12, 16 (4 to 64px).
Card padding `p-4` mobile, `p-6` desktop. Gap between form fields `gap-4`; between page sections `gap-8` (mobile) / `gap-12` (desktop). No arbitrary values like `p-[13px]`.

**Shadows** (ink-tinted, three levels only; dark mode relies on surface lightness, shadows drop to near zero):

```css
@theme {
  --shadow-sm: 0 1px 2px oklch(0.22 0.02 235 / 0.06);                                    /* inputs, pressed chips */
  --shadow-md: 0 2px 6px oklch(0.22 0.02 235 / 0.08), 0 1px 2px oklch(0.22 0.02 235 / 0.06); /* bottom bar, popover, chat bubble */
  --shadow-lg: 0 12px 32px oklch(0.22 0.02 235 / 0.14);                                   /* dialog, sheet */
}
```
Cards have a 1px `border` and **no shadow**. Shadow means "this floats above the page", nothing else.

**Z-index layers** (only these; never a raw `z-[999]`):

| Layer | Token / class | Value | Used by |
|---|---|---|---|
| base | `z-0` | 0 | page content, the map (map container gets `isolation: isolate` so Leaflet's internal 400-1000 z-indexes stay inside it) |
| sticky | `z-sticky` | 20 | sticky page header, table header, wizard step bar |
| bottom bar | `z-bottombar` | 30 | mobile bottom action bar, wizard footer |
| chat bubble | `z-chat` | 40 | chat launcher and open chat panel |
| sheet | `z-sheet` | 50 | Sheet, Drawer (Vaul) + their overlays |
| dialog | `z-dialog` | 60 | Dialog, AlertDialog + overlay |
| toast | `z-toast` | 70 | sonner `<Toaster />` |

Define as `--z-sticky: 20` etc. in `@theme` and edit the generated shadcn `sheet.jsx`/`dialog.jsx` (both ship with `z-50`) to use them.

## 4. Motion

Motion explains a change the user caused. Nothing moves on its own except the skeleton shimmer and the toast.

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | hover/press colour, focus ring, checkbox, toast exit |
| `--duration-base` | 200ms | page transition, list enter, popover, toast enter, dialog |
| `--duration-slow` | 320ms | sheet slide, chat panel open, wizard step change |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | anything that moves and stays on screen |
| `--ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | things arriving (sheet in, toast in, list items) |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | things leaving; exits use `fast` or `base`, never `slow` |

| Animates | How |
|---|---|
| Page transition | content fades in + rises 8px, `base`, `enter`. No exit animation (the old page just goes). |
| List enter | first load only: items fade + rise 4px, 30ms stagger, max 8 items staggered, rest appear together. Refetches do not animate. |
| Sheet / Dialog | sheet slides from its edge `slow`; dialog fades + scales 0.97→1 `base`; overlay fades `base`. Use the tw-animate-css classes shadcn ships, with our durations. |
| Toast | sonner default slide, tuned to `base` in / `fast` out. |
| Skeleton shimmer | a 1.6s linear gradient sweep on `bg-muted`; stops as soon as data arrives, and after 5s becomes a static block (WCAG 2.2.2). |
| Wizard step | the new step slides 16px from the direction of travel, `slow`, `standard`. |

**Never animates:** map pan/zoom (Leaflet `zoomAnimation` stays on for gestures, but programmatic `fitBounds` uses `animate: false`),
status badge colour changes, numbers/counters/SLA countdowns (they just update; the one exception is dashboard KPI tiles via NumberFlow, §6.1), layout reflow when data changes, scroll position, anything on page load that
the user did not ask for, autoplaying carousels, parallax.

**Scroll (added 24 Nov 2026):** native scrolling only: no smooth-scroll libraries (Lenis etc.) and no scroll-jacking.
Sections may reveal once as they scroll into view (motion `whileInView`, `once: true`): opacity plus a rise of 8px at most,
`base` duration, 30ms stagger, and the status timeline draws its connector in `slow`. Under reduced motion everything
is already visible. Shared variants live in `client/src/lib/motion.js`; never write raw durations in components.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .skeleton { background-image: none; }            /* static muted block, no shimmer */
  [data-slot="sheet-content"], [data-slot="drawer-content"], [data-slot="dialog-content"] { transform: none !important; } /* appear, don't slide */
}
```
In JS, read `window.matchMedia('(prefers-reduced-motion: reduce)')` once in a `useReducedMotion()` hook: pass `animate: false` to Leaflet `flyTo`/`setView`
and skip the wizard slide. Opacity fades at 0.01ms are fine; meaning must never depend on motion.

## 5. Layout

- **Mobile-first.** Write base styles for 360px wide, then add `sm:`/`md:`/`lg:`. Test at 360, 768, 1024, 1440.
- Breakpoints (Tailwind defaults): `sm` 640, `md` 768, `lg` 1024 (navigation switch), `xl` 1280.
- **Below 1024px:** top app bar (logo, city, account) + **bottom action bar**, 64px tall + `env(safe-area-inset-bottom)`, max 4 items:
  Home, My issues, **Report** (centre, primary filled), Community. Staff get Queue in place of Report. Page content gets matching bottom padding.
- **At 1024px and up:** shadcn `Sidebar` on the left, 16rem (collapsible to icons, 3rem), bottom bar hidden. "Report an issue" is the first sidebar item and a primary button.
- Max content width: 72rem (1152px) for lists and dashboards; **40rem** for the report wizard, forms and reading (posts, issue detail text). Gutters 16px mobile, 24px tablet, 32px desktop.
- **Touch targets: 44×44px minimum** for anything tappable, including icon buttons, badges that link, and map controls. Use `size-11` or padding; never shrink the hit area below 44px even if the icon is 16px. At least 8px between adjacent targets.
- **Chat bubble:** 56px circle, bottom-right, on every page. Mobile: `right: 16px; bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` so it sits above the bottom bar, never over the Report button.
  Desktop: `right: 24px; bottom: 24px`. Hidden while a Sheet, Drawer or Dialog is open and during wizard step 2 (it would cover the map); the open chat panel is a full-height Drawer on mobile, a 380×560 panel on desktop.
- Staff queue at ≥1024px: data table; below that, one card per issue with status + SLA badges on the first line.

## 6. Components (shadcn/ui)

Generate with the shadcn CLI into `client/src/components/ui/`; feature components are `PascalCase.jsx` elsewhere. Edit generated files only to apply these tokens.

| Component | Rules |
|---|---|
| **Button** | `default` (peacock): the one main action per screen. `secondary`: other actions. `outline`: actions in cards and toolbars. `ghost`: icon buttons, nav. `destructive`: delete/reject, always behind a confirm. `link`: inline text actions only. Sizes `default` (h-11 on touch screens) and `icon` (size-11). Loading = spinner icon + same label ("Submitting…"), button disabled, width unchanged. Labels are verb-first: "Submit report", never "Submit" or "OK". |
| **Card** | Groups one thing (an issue, a post, a step). Border, no shadow, `rounded-lg`. A card that is a link makes the whole card the target and has one focusable element; on hover it rises 2px and its border becomes `input` (still no shadow). Don't nest cards. |
| **Dialog vs Sheet vs Drawer** | **AlertDialog**: confirming destructive or irreversible actions (reject issue, delete post), any screen size. **Dialog**: short focused tasks on desktop (≥1024px), e.g. assign staff. **Drawer** (shadcn Drawer on Vaul, drag to dismiss): the same tasks on mobile as a bottom sheet, plus filters, the chat panel and issue quick view. **Sheet**: side panels on desktop only (issue quick view from the staff queue, filters). Use a `useMediaQuery('(min-width: 1024px)')` switch, not two features. Never stack two overlays. |
| **Form + Zod** | shadcn `Form` with react-hook-form + `zodResolver`. Share the Zod schema with the server where possible. Every input has a visible `FormLabel` (no placeholder-only labels), `FormDescription` for format hints ("6 digits, e.g. 144401"), `FormMessage` for errors. Validate on blur, then on change once an error is shown. |
| **Toast (sonner)** | Feedback after an action: "Report submitted", "Status updated". Max one line + optional action ("Undo", "Retry"). Success 4s; toasts with an action (Undo, Retry) 8s; errors stay until dismissed; all pause on hover and focus. Never the only place an error appears in a form; never for information the user must act on later. `<Toaster position="top-center" />` on mobile (clear of the bottom bar), `bottom-right` offset above the chat bubble on desktop. |
| **Skeleton** | Shape matches the real content (badge-sized block for a badge). Show after 200ms of loading to avoid flicker; never a full-page spinner. |
| **Badge** | Status/SLA only via `<StatusBadge status="in_progress" />` and `<SlaBadge state="at_risk" />`, which read token, icon and label key from one map. Category tags use `outline`. Never invent a new colour for a badge. |
| **Command** | Later (staff search by ticket ID, Ctrl/⌘K). Not in v1. |
| **Other** | `Input`, `Textarea`, `Select`, `RadioGroup` (category picker with icons), `Tabs` (staff views), `Table` (staff queue), `Avatar`, `Tooltip` (desktop hints only, never essential info), `Sidebar`. Ask before adding anything else. |

### 6.1 Extra UI libraries: where each is used and where it is not

Radix (through shadcn/ui) is the only primitive layer. Each library below has one job; using it outside its scope needs Sachin's OK and an ADR 0001 update.

| Library | Use it for | Never use it for |
|---|---|---|
| **Radix** (via shadcn/ui) | Every primitive: dialog, popover, select, tabs, tooltip, radio group | Nothing excluded; this is the default |
| **Base UI** | Only a primitive Radix lacks (likely candidates: combobox, number field, meter), added when a screen needs it and recorded in ADR 0001 | Anything Radix already covers. Never two versions of the same component. Not installed until needed. |
| **Sonner** | Toasts (rules in §6) | Form errors, anything the user must act on later |
| **Vaul** (shadcn `Drawer`) | Mobile bottom sheets below 1024px, behind the same `useMediaQuery` switch as Dialog/Sheet. Uses `z-sheet`, our `slow` duration and the reduced-motion rule in §4 (edit the generated `drawer.jsx`). | Desktop, confirmations (AlertDialog), stacking on another overlay |
| **NumberFlow** (`@number-flow/react`) | Headline numbers on dashboard KPI tiles (open issues, resolved this week, SLA met %), and the stats row on the public Landing page (counts up once when scrolled into view; added 24 Nov 2026). `locales="en-IN"` for Indian grouping, `respectMotionPreference` on, lazy-loaded with the dashboard route. Animates on data change only, `base` duration. | Tables, badges, SLA countdowns, ticket IDs, forms, anything citizens read on slow pages |
| **Magic UI** | Copy-paste accents on the public Home page and the report-success counterfoil only, one component at a time, CSS-only components first, restyled to our tokens and motion durations, fully off under reduced motion. | Forms, the report wizard steps, staff queue, admin, community. Anything that conflicts with §1 (gradients, glass, confetti, particles, marquees) or moves without user action. A component that imports `motion` needs Sachin's OK first. |

## 7. UX patterns

**3-step report wizard** (`/report`, one route, step in the URL: `?step=1..3` so Back works):
1. **Pincode.** Six boxed digit inputs (one `<input inputmode="numeric" autocomplete="postal-code" maxlength="6">` styled as boxes, not six inputs; screen readers hear one field).
   Recent pincodes as chips. On 6 digits, look it up and announce the result (`aria-live="polite"`): city and localities appear, "Next" enables. Never auto-advance to step 2 (WCAG 3.2.2). Unserved → waitlist form inline.
2. **Pin on map.** Map fits the pincode polygon; outside is dimmed; dragging the pin outside snaps it back with an inline message announced via `aria-live`. Pincode outline is a 2px `primary` line (≥3:1 on tiles); the outside mask is `foreground` at 40%. "Use my location" button.
   Below the map: the locality the pin is in. Keyboard users get arrow-key nudge on the focused pin plus a "Locality" select as a non-map alternative.
3. **Photo and details.** Category (radio cards with icons), photo (camera or gallery, preview, compress client-side), description (min 20 chars with live count).
   Review summary, then "Submit report". Success: the counterfoil with the ticket ID, "Copy ticket ID", "Expected by 26 Nov, 5:00 PM" and "Track this issue".
- Step bar at top: "Step 2 of 3: Place the pin" (text, not just dots). Data survives Back and a refresh (sessionStorage draft). Footer: Back (outline) left, Next (default) right.

**Status timeline** (issue page): vertical list, newest at the bottom, each entry = status badge, what happened in one line, who (department, never another citizen's name), IST date-time.
The SLA line ("Expected by …" or "Paused: waiting for the electricity board") sits above the timeline. Reopen/confirm actions appear under the latest entry for the reporter only.

**Empty states teach the next action** (what this is + why empty + one button):
- My issues: "You haven't reported anything yet. Spot a pothole, broken light or garbage pile? Report it in three steps." → "Report an issue" (`issues.mine.emptyTitle`, `issues.mine.emptyBody`, `issues.mine.emptyCta`).
- Staff queue: "No open issues in your queue. New reports for your department will appear here." (no button; no fake celebration).
- Community feed: "No posts in Phagwara yet. Share an update about an issue you reported." → "Write a post".

**Optimistic updates with rollback** (TanStack Query): use for "Me too" (add yourself as a reporter), comments, staff status change, moderation hide.
`onMutate`: cancel queries, snapshot, write the new value; `onError`: restore the snapshot and show an error toast with "Retry"; `onSettled`: invalidate.
Never optimistic for: submitting a report (needs the server's ticket ID), anything that changes the SLA clock (resolve, approve pause).

**Inline validation**: errors appear under the field, in `destructive` text with a `CircleAlert` icon, linked by `aria-describedby`. On submit with errors,
focus the first invalid field and show a summary at the top of the form for long forms. Server 400/422 errors map back to their field.

**Helpful errors: what happened → what to do.** Map server `error.code` to a key in `errors.*`; never show raw codes or stack traces.

| When | Copy (en) | Key |
|---|---|---|
| `OUTSIDE_PINCODE` | "This spot is outside pincode 144401. Move the pin inside the shaded area or change the pincode." | `report.location.outsidePincode` |
| Pincode not served | "We don't cover 144401 yet. Leave your email and we'll tell you when we do." | `report.pincode.notServed` |
| Photo too large | "This photo is over 5 MB. Choose a smaller one or take a new photo." | `report.details.photoTooLarge` |
| Email not verified | Toast "We couldn't confirm your email. Sign in again with Google or an email code." and the sign-in sheet opens | `errors.auth.emailNotVerified` |
| Network / 5xx | "Couldn't reach Nivaran. Check your connection and try again. Your draft is saved." + "Try again" | `errors.common.network` |

## 8. Voice and tone

Plain, specific, calm, like a helpful clerk. The user is often annoyed about a real problem; never be cute about it.

- English first, **Hindi-ready**: every user-facing string goes through `t('area.screen.key')`, including button labels, alt text, aria-labels and toasts. No string literals in JSX.
  Keys use the naming in `CLAUDE.md` (e.g. `report.wizard.title`). Interpolate values (`{pincode}`), never concatenate sentences. Allow 30% text expansion for Hindi.
- Sentence case everywhere ("Report an issue", not "Report An Issue"). No all caps.
- Verb-first buttons; the same verb through the flow: "Submit report" → toast "Report submitted".
- Talk about the user's world, not the system: "pincode", "ticket", "department", not "geo-fence", "entity", "SLA policy". Citizens see "Expected by"; staff may see "SLA".
- **Times in IST** (`Asia/Kolkata`) always, even if the device is elsewhere. Dates `26 Nov 2026`; date-times `26 Nov, 5:00 PM` (add the year only if it isn't the current year);
  under 24h, relative: "2 hours ago". Use `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ... })`; en-IN prints "pm", so upper-case the day period via `formatToParts`. One `formatDate`/`formatDateTime` helper, nowhere else.
- Ticket IDs always in full (`NIV-2026-000123`), never shortened, always with a copy button.
- Errors don't apologise and don't blame. Success is brief, no exclamation marks, no emoji.

| Do | Don't |
|---|---|
| "Report submitted. Your ticket is NIV-2026-000123." | "Woohoo! 🎉 Your awesome report is in!" |
| "Expected by 28 Nov, 5:00 PM" | "SLA deadline: 2026-11-28T11:30:00Z" |
| "Move the pin inside the shaded area." | "Invalid coordinates." |
| "Reject issue?" / "Reject issue" / "Keep issue" | "Are you sure?" / "OK" / "Cancel" |
| "Couldn't load your issues. Try again." | "Oops! Something went wrong." |
| "Assigned to Roads, Phagwara Municipal Corporation" | "Assigned to user 64f2a…" |

## 9. Accessibility checklist (WCAG 2.1 AA)

- [ ] Text contrast ≥ 4.5:1 (large text ≥ 3:1); inputs, focus rings, icons that carry meaning ≥ 3:1. Use only the tokens above (all measured).
- [ ] Status, SLA, errors and required fields are never colour-only: icon + text label always (1.4.1).
- [ ] Every input has a visible label; errors linked with `aria-describedby` and `aria-invalid` (1.3.1, 3.3.1, 3.3.2).
- [ ] Full keyboard use: logical tab order, visible focus: 2px solid `ring` at full opacity with a 2px offset (replace shadcn's default `ring-ring/50`, whose 50% alpha is not guaranteed 3:1), never `outline: none` alone, no traps; Escape closes overlays and returns focus to the trigger (2.1.1, 2.4.3, 2.4.7).
- [ ] "Skip to content" link first in the page; one `<h1>` per page; landmarks: `header`, `nav`, `main`, `aside` (2.4.1, 1.3.1).
- [ ] The map has a non-map alternative (locality select + arrow-key pin nudge) and an `aria-label`; map-only info is also in text (2.1.1).
- [ ] Photos need alt text: staff/user photos get a generated default ("Photo of reported pothole, 26 Nov 2026") the reporter can edit (1.1.1).
- [ ] Touch targets ≥ 44×44px (stricter than AA's 2.5.5 AAA, our rule); works at 200% zoom and 320px width without horizontal scroll (1.4.4, 1.4.10).
- [ ] `<html lang="en">` switches to `lang="hi"` with the language; mixed-language text gets `lang` on its element (3.1.1, 3.1.2).
- [ ] Toasts announced via sonner's live region; async results (lookup done, saved) announced with `aria-live="polite"`; errors `assertive` (4.1.3).
- [ ] SLA countdowns don't announce every tick; give the deadline as text ("Overdue by 3 hours") (2.2.2).
- [ ] `prefers-reduced-motion` honoured (section 4); nothing flashes more than 3 times a second (2.3.1).
- [ ] Icon-only buttons (chat bubble, copy ticket ID, close) have a translated `aria-label`; the chat bubble's is "Open help chat" (4.1.2).
- [ ] Sessions don't time out mid-report without warning; the wizard draft survives re-login (2.2.1).
- [ ] Check every new screen with axe (Playwright `@axe-core/playwright` if approved) and a keyboard-only pass before merge.
