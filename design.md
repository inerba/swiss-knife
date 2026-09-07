---
name: Swiss Knife
description: Estensione Chrome con un pannello laterale di piccoli strumenti per la pagina che stai visitando.
version: 1.0.0
framework: WXT, React, TypeScript e CSS
theme: Apple HIG + Tailwind CSS tokens, solo tema chiaro
---

# Swiss Knife Design System

## Principles
- **Apple HIG + Utility First:** macOS/iOS native aesthetics (frosted glass, large radii) combined with Tailwind CSS token naming.
- **High Density:** Optimized for narrow browser extension environments (360px - 420px width). 
- **Tabular Precision:** Mandatory use of `tabular-nums` for counters, metrics, and timers to prevent layout shifting.
- **Pill-First UI:** Extensive use of fully rounded borders (`999px`) for secondary controls, badges, and tabs.

## Tokens

### Typography
- **Font Stack (UI):** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif`
- **Font Stack (Mono):** `ui-monospace, "SF Mono", Monaco, "Cascadia Code", Menlo, Consolas, monospace`
- **Global Settings:**
  - `letter-spacing`: `-0.01em`
  - `font-variant-numeric`: `tabular-nums`
  - `-webkit-font-smoothing`: `antialiased`

### Colors
**Brand & Accent:**
- `accent-primary`: `#6366f1` (Tailwind Indigo-500)
- `accent-hover`: `#4f46e5` (Tailwind Indigo-600)
- `accent-soft`: `rgba(99, 102, 241, 0.10)`

**Neutrals (Apple Zinc):**
- `neutral-50`: `#f9f9f9`
- `neutral-100`: `#f2f2f7`
- `neutral-200`: `#e5e5ea`
- `neutral-300`: `#d1d1d6`
- `neutral-800`: `#3a3a3c`
- `neutral-900`: `#2c2c2e`
- `neutral-950`: `#1c1c1e`

**Semantic States:**
- `success`: `#34c759`
- `warning`: `#f59e0b`
- `danger`: `#ef4444` (Apple: `#ff3b30`)

**Surfaces:**
- `bg-base`: `#ffffff`
- `bg-card`: `#ffffff`
- `border-muted`: `rgba(0, 0, 0, 0.06)`
- `border-base`: `rgba(0, 0, 0, 0.10)`

### Radii
- `radius-card`: `16px`
- `radius-pill`: `999px`
- `radius-badge`: `10px`
- `radius-input`: `7px`

### Shadows & Elevation
- `shadow-sm`: `0 1px 2px rgba(0, 0, 0, 0.04)`
- `shadow-md`: `0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 20px rgba(0, 0, 0, 0.08)`
- `shadow-modal`: `0 8px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)`
- `shadow-glow`: `0 0 0 3px rgba(99, 102, 241, 0.25)`
- `shadow-inner`: `inset 0 0 0 1px rgba(0, 0, 0, 0.08)`

### Motion & Effects
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (Apple standard fluid)
- **Duration:** `0.15s` for interactions (`hover`, `active`)
- **Active State:** `transform: scale(0.97)`
- **Glassmorphism:** `backdrop-filter: saturate(180%) blur(20px)` (Used on headers and bottom navs)

## Components

### Buttons
- **Primary Pill:** 
  - Height: `30px`, Padding: `0 14px`, Radius: `999px`
  - Background: `accent-primary`, Text: `#ffffff`
  - Font: `12px`, `font-weight: 600`
- **Secondary Ghost:**
  - Background: `#ffffff`, Border: `border-base`
  - Text: `neutral-700`
  - Hover: Background `accent-soft`, Text `accent-hover`, Border `rgba(99, 102, 241, 0.25)`

### Cards
- **Base Container:** 
  - Background: `bg-card`, Radius: `radius-card`
  - Border: `1px solid border-base`
  - Shadow: `shadow-sm`
- **Interaction:** Hover changes border to `accent-glow` and elevates shadow to `shadow-md`.

### Segmented Controls (Tabs)
- **Container:** Background `rgba(0, 0, 0, 0.05)`, Border `rgba(0, 0, 0, 0.06)`, Radius `999px`, Padding `3px`, Gap `2px`.
- **Tab Item:** Height `28px`, Radius `999px`, Text `neutral-600`.
- **Active State:** Background `#ffffff`, Text `neutral-900`, Shadow `0 1px 3px rgba(0, 0, 0, 0.12)`.

### Form Controls (Inspector Inputs)
- **Inputs:** Background `rgba(118, 118, 128, 0.10)`, Radius `7px`, Height `28px`.
- **Focus State:** Background `rgba(118, 118, 128, 0.16)`, Ring `shadow-glow`.
- **Values:** Font Mono, `12px`, Right-aligned for numerics.

### iOS Toggle Switch
- **Track:** `42px` x `26px`, Radius `26px`. Background `rgba(120, 120, 128, 0.16)`.
- **Thumb:** `22px` x `22px`, offset `2px`. Shadow `0 1px 3px rgba(0, 0, 0, 0.15)`.
- **Checked State:** Background `success`, Thumb translates `16px`.

## Layout

### Shell Architecture
- **Header:** Fixed top, Glassmorphism applied. Contains title and global actions.
- **Content Area:** Flex `1`, vertical scroll, `16px` padding.
- **Bottom Nav:** Fixed bottom, Glassmorphism applied. Icons are `40x28px`, text `10px`. Active icon takes `accent-soft` background.

## Patterns

- **Multi-action Pills:** When multiple buttons are grouped, they share a single white pill container (`999px` radius, `shadow-md`) separated by a `1px` inner divider (`rgba(0,0,0,0.10)`).
- **Reduced Motion:** Provide `@media (prefers-reduced-motion: reduce)` to disable animations and `transition-duration` for accessibility.
