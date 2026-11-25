# Phase 1c: UI redesign for Nivaran

Use the frontend-design skill (frontend-design plugin) for every step. Use the design plugin skills named below
for the review steps. Use `graphify query` before opening files. Follow Ponytail: minimal diffs, reuse first.

## The brief
- Product: Nivaran lets a resident report a civic problem (pothole, garbage, streetlight) for their own 6-digit
  pincode, drop a pin inside that area, and then track a ticket until it is fixed.
- People: ordinary residents, mostly on mid-range phones, often outdoors, sometimes on weak data. Mobile first.
- The one job of the product: get a report filed in under a minute and make the ticket status trustworthy.
- Content that is real in this domain: the 6-box PIN printed on Indian postal envelopes, ticket IDs, wards,
  departments, "fix expected by" dates, status updates. Build the visual identity from these, not from a generic
  SaaS kit.

## Ground rules
- Spend boldness in ONE place: the pincode entry on Home is the memorable element. Everything else is quiet.
- The current look (near-black background, one teal accent, identical rounded cards, big-number stat tiles) is
  a generic default. Do not keep it by inertia. My hypothesis, which you must challenge in Step 1: default to a
  light theme, because residents use phones in daylight, with dark as an option.
- Avoid: an ALL-CAPS eyebrow above every heading, accenting one word of a headline, numbered markers for content
  that is not a real sequence, gradient washes, the same shadow and radius on everything, fade-and-slide-up on every
  section, a hover effect on every card.
- Motion: only for what a person does (sheet opens, step changes, ticket status changes) plus ONE orchestrated
  moment: after a valid pincode, the area is revealed (for example its outline draws). Respect reduced motion
  everywhere: wrap CSS animation in the `prefers-reduced-motion: no-preference` query and, if the Motion
  library (`motion`, imported from "motion/react") is approved, set `<MotionConfig reducedMotion="user">`.
  Reduced motion means fewer or shorter animations, never lost information.
- Libraries: do not add one without telling me the name, size and reason, and wait for my yes. Copy-paste component
  kits such as Magic UI or React Bits assume Tailwind and shadcn/ui and are aimed at marketing pages, so use them only
  if Tailwind and shadcn are already in this project, and never for form or dashboard screens.
- Copy: plain verbs, sentence case, active voice. A button names what it does ("Check my pincode", "Send report").
  Errors say what happened and how to fix it, without apologising. Empty states point to the next action.
  Remove the fake "Sample numbers" stats unless they come from real data; show an honest empty state instead.
- Quality floor: works at 375px, visible keyboard focus, 4.5:1 contrast for text, touch targets of at least 44px,
  no layout jump while auth loads.

## Step 1: Design plan (no code). Wait for my approval.
Produce two candidate directions, then recommend one. For each give:
- Color: 4 to 6 named hex values (background, surface, ink, muted ink, one accent, one alert).
- Type: one or two families with roles, and a type scale. Lines under 80 characters.
- Layout: an ASCII wireframe for Home on mobile and on desktop, the Report flow, My issues, and Ticket detail.
- Principles: what makes it look like Nivaran and not like another app.
Then review your own plan against the generic defaults listed above. Say what you changed and why. Stop and wait.

## Step 2: Foundation
Design tokens as CSS variables, the type scale, spacing, focus ring, the app shell (sidebar on desktop, bottom
navigation on mobile), reduced-motion handling, and shared Loading, Empty and Error components with a Retry action.
Replace one-off styles with the tokens. Show a short before/after summary.

## Step 3: Auth states in the header and sign-in sheet
Every auth state must render something: loading skeleton with no flicker, signed-out with a Sign in button,
signed-in with an avatar menu (account, Sign out), and a /api/me failure state with a message, Retry and Sign out.
Add a development-only banner when the Auth0 environment values are missing, naming the keys. Polish the sign-in sheet:
two choices (Google, email code), focus trap, Esc to close, focus returns to the button.

## Step 4: Home
Hero with the pincode entry as the memorable element (6 PIN-style boxes, paste support, inline validation, a clear
result state). Build the one orchestrated "area reveal" moment, wired to a service function so Phase 2's API can plug
in. "How it works" is a real three-step sequence, so numbering is allowed there. Do the copy pass.

## Step 5: Report flow shell
A stepper: pincode, pin on the map, photo and details. At most 5 fields per step. Validate before moving on and
show errors next to the field. Offer photo-first reporting, since it can speed reports up. On the map step show the
address or coordinates under the crosshair, with a search box. Keep the draft in sessionStorage. End with a success
screen showing ticket ID, department and the expected-by date. Put the API calls behind a service interface with a
clearly named mock for development only; nothing fake may ship in production paths.

## Step 6: My issues and ticket detail
List with status chips and filters. Ticket detail with a status timeline (reported, received, in progress, fixed)
and the expected-by date. Empty and error states. After a ticket is marked fixed, ask the reporter "Is it fixed?",
with a one-tap answer.

## Step 7: Quality pass
Run the design plugin's accessibility-review and design-critique skills on Home, Report and My issues. Check Lighthouse
mobile, keyboard-only use, 375px, reduced motion (macOS: System Settings, Accessibility, Display, Reduce motion), and
the bundle size against the Step 2 inventory. Fix high and medium findings, then run /ponytail-review.

Every step: plan first if more than 3 files change and wait for my approval, run only the affected tests, run
`graphify update .`, do not commit or push, and report in under 15 lines.
