# Upcheck — Design System & Professional UI Standard

> **Mandate:** Upcheck must read as a serious agritech tool that a bank, an exporter, or a feed company would trust — on par with a fintech app, not a hackathon build. This document is the binding visual and interaction standard. **Every screen must pass the Anti-"vibe-coded" checklist (§10) before it ships.**
> **Hard rule:** **No emojis anywhere** — not in UI, not in notifications, not in copy, not in empty states. All symbols come from the icon set in §4.

---

## 1. Brand tone

- **Voice:** plain, direct, respectful. Short sentences. No marketing fluff, no jokes, no exclamation marks in product copy.
- **Feel:** calm, utilitarian, dependable. Generous whitespace, strong alignment, one accent color used sparingly.
- **Language:** the farmer's language first (Telugu/English at launch). Aquaculture shorthand (FCR, DOC, PL, ABW, DO) is retained; everything else is fully translated. Never mix two languages in one label.

---

## 2. Color

Use **only** the semantic tokens already defined in `frontend/src/theme/`. Never hardcode hex in screens. Never invent a new color for a one-off.

| Role | Token | Use |
|---|---|---|
| Primary | `roles.light.primary` | Primary buttons, active tab, key links. One accent — do not over-use. |
| Surface / background | `surface`, `background` | Cards, sheets, page background. |
| Text primary / secondary | `textPrimary`, `textSecondary` | Headings/body vs. captions/labels. |
| Border | `borderDefault` | Dividers, input outlines, card edges. |
| Success | `successText` / `successBorder` | Confirmations, healthy ranges. |
| Warning | `warningText` | Out-of-range but non-critical. |
| Critical/Error | error/critical role | Critical alerts, destructive actions, validation errors. |
| Info | `infoBorder` | Neutral informational accents. |

**Status is never color alone.** Always **icon + color + text label** (e.g. a triangle-alert icon, warning color, and the word "High") — required for color-blind users and outdoor glare.

---

## 3. Typography

Fonts already bundled: **Nunito**, **DM Sans**, **DM Mono**. Use the `theme.typeScale` tokens; do not set ad-hoc font sizes.

| Token | Size (approx) | Use |
|---|---|---|
| `h1` | 24–28 | Screen titles |
| `h2` | 20–22 | Section headers |
| `bodyMedium` | 16 | Default body |
| caption | 13–14 | Labels, helper text |
| metric (numeric) | 24–32, DM Mono/medium | Big numbers (DOC, FCR, biomass, quantities) — numerals must be large and legible |

Rules: body never below 14 sp; primary metrics large and high-contrast; line length comfortable; never truncate a critical number — wrap or scale.

---

## 4. Iconography (the emoji replacement)

- **Two sets, during the redesign migration.** The design canvas names its icons in **Material Symbols Rounded** terms (`edit_note`, `currency_rupee`, `water_drop`), whose names and glyph shapes differ from MaterialCommunityIcons. Translating each one by hand would drift from the drawings, so redesigned screens use `components/ui/Icon.tsx` and screens not yet redesigned keep MaterialCommunityIcons.
  - **Rule:** one set per screen. Mixing them *within* a screen is the thing to avoid; two sets across an app mid-migration is less jarring than half-converting a screen.
  - Material Symbols is a **ligature font** — `Icon` renders the icon's NAME as text, which is why it is a `<Text>`. It inherits colour and sizes with `fontSize`, and sets `allowFontScaling={false}`: a 24 px glyph at 200 % OS text size breaks every row it sits in.
  - `IconName` is a closed union, so a typo fails the build rather than rendering the literal word.
- **No emoji, no image-as-icon**, in either set.
- **Consistency:** pick one weight/style per context; don't mix filled and outline arbitrarily. Standard sizes: 20 (inline), 22 (nav/row), 24 (list/action), 26–28 (FAB/feature tiles).
- **Domain icon vocabulary** (use these consistently so farmers learn them once):

| Concept | Icon | Concept | Icon |
|---|---|---|---|
| Home/Dashboard | `view-dashboard` | Farm | `barn` |
| Pond | `waves` / `water` | Cycle/crop | `sprout` |
| Water quality | `water-percent` | Feed | `corn` |
| Sampling/weight | `scale` | Mortality | `alert-decagram` |
| Treatment | `medical-bag` | Disease | `bacteria` / `book-open-variant` |
| Measurements | `chart-line` | Daily routine | `clipboard-check-outline` |
| Calculators | `calculator-variant` | Engines/insights | `chart-box` |
| Simulations | `chart-timeline-variant` | Inventory | `database` |
| Money/finance | `cash` / `currency-inr` | Reports | `chart-box` |
| Alerts | `bell` | Settings | `cog` |
| Members/people | `account-group` | Help | `help-circle` |

- Status icons: `check-circle` (ok), `alert` (warning), `alert-octagon` (critical), `information` (info), `cloud-off-outline` (offline), `sync` (syncing).

---

## 5. Spacing, radius, elevation

Use `theme.spacing`, `theme.radius`, `theme.shadows`. Base spacing unit 4 dp; standard gaps 8/12/16/24. Cards: `radius.md`, `shadows.md`. Consistent screen padding (16 dp). **No arbitrary margins** — alignment must be pixel-consistent across screens (a top cause of "vibe-coded" feel).

---

## 6. Core components (specs)

- **Buttons:** Primary (filled, full-width, bottom of form, single per screen), Secondary (outline/tonal), Destructive (error color, requires confirm). Min height 48 dp. Disabled state distinct. Loading state shows inline spinner, not a blocked screen.
- **Inputs:** labeled above field; helper/error text below; number fields open numeric keypad; counts use **stepper (− value +)**; enums use **chips**; dates use a calendar (default today). Validation inline, plain-language.
- **Cards / list rows:** consistent padding, one tap target per row, chevron or clear affordance, status as icon+label.
- **Headers:** back affordance + title (localized) + optional `help-circle` linking to the relevant Help topic. No emoji in titles.
- **Banners:** Offline (`cloud-off-outline`, localized "Offline — changes will sync"), Critical alert (error color, top of Home). Dismissible where appropriate.
- **Empty states:** simple line illustration (no emoji) + one-line reason + one primary CTA.
- **Loading:** skeleton placeholders matching the final layout (not bare spinners) on Home and lists.
- **Error:** plain message + Retry; never a blank screen or a raw stack trace.
- **FAB (Quick Log):** center tab, `plus` icon, opens the pond-first log sheet.
- **Tab bar:** icon + label always; active = primary color; 5 slots with center FAB.
- **Badges:** numeric unread counts on Alerts; concise, high-contrast.

---

## 7. Motion

Subtle and fast (target 2 GB devices): 150–250 ms transitions, standard easing. No bouncy/playful animation. Respect reduce-motion. Never animate large lists on low-end hardware.

---

## 8. Accessibility & internationalization

- Contrast ≥ WCAG AA. Touch targets ≥ 48×48 dp.
- Support OS dynamic font scaling; layouts must not break when text grows.
- Every interactive element has an `accessibilityLabel` (localized).
- **No hardcoded user-facing strings** — all via `t()`. Numbers/currency formatted for India (INR, `Asia/Kolkata`, Indian digit grouping where appropriate).
- RTL-ready structure (future Urdu/Arabic) even though launch languages are LTR.

---

## 9. Imagery & data

- Photos (mortality/disease) compressed to ≤ 800 px before upload; shown in consistent rounded thumbnails.
- **No lorem ipsum, no placeholder/sample data, no fake counts in production.** Empty means a real empty state.
- Charts: clean, labeled axes, single accent; only where they aid decisions; never on the worker daily path.

---

## 10. Anti-"vibe-coded" checklist (every screen must pass)

1. **Zero emojis** anywhere on the screen or in its copy.
2. All icons from ONE set on that screen — `components/ui/Icon` (Material Symbols) if it has been redesigned, MaterialCommunityIcons if it has not — at consistent weight and size.
3. All colors from theme tokens — no stray hex.
4. All type from `typeScale` — no ad-hoc sizes; numerals large and legible.
5. Consistent 16 dp screen padding and 4 dp-grid spacing; everything aligned.
6. Exactly one primary action; secondary actions visually subordinate.
7. Real empty / loading (skeleton) / error states — never a blank or a spinner-only screen.
8. Every string localized via `t()`; no English leaking in non-English UI.
9. Status shown as icon + color + label (never color alone).
10. Professional copy: concise, no exclamation marks, no jokes, no placeholder text.
11. Touch targets ≥ 48 dp; works one-handed; readable in sunlight.
12. Role-correct: owner-only controls hidden (not disabled) for lower roles.

> A screen that fails any item is not "done." Reviewers reject on this checklist.
