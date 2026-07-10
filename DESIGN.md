---
name: NimAgent
description: AI‑powered Nimiq payment platform
colors:
  # Official Nimiq Brand Palette (@nimiq/style)
  nimiq-blue: "#1F2348"
  nimiq-gold: "#E9B213"
  nimiq-light-blue: "#0582CA"
  nimiq-light-blue-bright: "#0CA6FE"
  nimiq-green: "#21BCA5"
  nimiq-orange: "#FC8702"
  nimiq-red: "#D94432"
  nimiq-red-bright: "#FF5C48"
  
  # Light mode surfaces
  light-gray: "#FAFAFA"
  near-white: "#FFFFFF"
  
  # Status colors (Nimiq standard)
  success: "#21BCA5"
  error: "#D94432"
  warning: "#E9B213"
  info: "#0582CA"
  
typography:
  body:
    fontFamily: "Inter, Muli, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: "1.6"
  mono:
    fontFamily: "Fira Mono, 'Courier New', monospace"
    fontSize: "14px"
    lineHeight: "1.5"
  scale:
    h1: "3rem"      # 24px on 8px grid
    h2: "2.5rem"    # 20px
    h3: "2rem"      # 16px
    body: "2rem"    # 16px
    small: "1.75rem" # 14px
    tiny: "1.5rem"  # 12px
rounded:
  input: "4px"     # Nimiq input radius
  card: "10px"     # Nimiq card radius
  button: "13.5px" # Nimiq button radius
  pill: "500px"    # Nimiq pill radius
spacing:
  # Nimiq 8px grid system (1rem = 8px)
  1: "8px"
  2: "16px"
  3: "24px"
  4: "32px"
  5: "40px"
  6: "48px"
  7: "56px"
  8: "64px"
easing:
  nimiq: "cubic-bezier(0.25, 0, 0, 1)"
duration:
  fast: "150ms"
  normal: "200ms"
  slow: "300ms"
components:
  button-gold:
    backgroundColor: "{colors.nimiq-gold}"
    textColor: "{colors.nimiq-blue}"
    padding: "12px 24px"
    fontWeight: "700"
    borderRadius: "{rounded.button}"
    transition: "all {duration.normal} {easing.nimiq}"
    hoverBackground: "{colors.nimiq-orange}"
  button-blue:
    backgroundColor: "{colors.nimiq-light-blue}"
    textColor: "#FFFFFF"
    padding: "12px 24px"
    fontWeight: "700"
    borderRadius: "{rounded.button}"
    transition: "all {duration.normal} {easing.nimiq}"
    hoverBackground: "{colors.nimiq-light-blue-bright}"
  glass-surface:
    background: "rgba(255, 255, 255, 0.92)"
    backdropFilter: "blur(20px)"
    border: "1px solid rgba(31, 35, 72, 0.08)"
    darkBackground: "rgba(31, 35, 72, 0.55)"
    darkBorder: "1px solid rgba(255, 255, 255, 0.08)"
---

# Design System: NimAgent

## 1. Overview

**Creative North Star: "The Conversation Hub"**

NimAgent's design prioritizes conversational, human‑centered interactions first. It feels secure, simple, and friendly—warm, approachable, and confident. The system avoids crypto jargon and visual clutter, focusing on clarity and trust.

This system explicitly rejects generic crypto‑exchange clutter, skeuomorphic payment‑app flashiness, and minimalist‑but‑unusable interfaces that trade clarity for aesthetics.

**Key Characteristics:**
- Conversational UI at the core
- dark‑mode and light-mode design
- Dual accent palette (Nimiq Gold for crypto, Commerce Blue for services)
- Generous spacing, no cramped layouts
- Reduced‑motion support built in

## 2. Colors

Official Nimiq brand palette from `@nimiq/style`, used consistently across Nimiq ecosystem.

### Brand Colors
- **Nimiq Blue** (#1F2348): Primary brand color, dark mode background
- **Nimiq Gold** (#E9B213): Primary accent for crypto actions (send, receive, balance)
- **Nimiq Light Blue** (#0582CA): Secondary accent for commerce/AI features
- **Nimiq Green** (#21BCA5): Success states, positive feedback
- **Nimiq Red** (#D94432): Error states, warnings
- **Nimiq Orange** (#FC8702): Hover states for gold elements

### Light Mode
- **Light Gray** (#FAFAFA): Primary background
- **White** (#FFFFFF): Card surfaces, elevated elements

### Dark Mode
- **Nimiq Blue** (#1F2348): Primary background
- **White** (#FFFFFF): Primary text
- Glass surfaces with `rgba(31, 35, 72, 0.55)` + 20px blur

### Status Colors (Semantic)
- **Success** (#21BCA5 / Nimiq Green): Confirmations, completed actions
- **Error** (#D94432 / Nimiq Red): Errors, failed transactions
- **Warning** (#E9B213 / Nimiq Gold): Cautions, important notices
- **Info** (#0582CA / Nimiq Light Blue): Informational messages

### Color Usage Rules
**Functional Color Split:** Gold for crypto-native actions (send NIM, show balance, QR codes). Light Blue for commerce/services (gift cards, airtime, bills, AI chat). Never swap them.

**Contrast Requirements:** All text must meet WCAG 2.1 AA standards—4.5:1 for body text, 3:1 for large text (≥18px or bold ≥14px).

**Tinted Surfaces:** All neutral surfaces are subtly tinted toward Nimiq Blue (chroma 0.005–0.015) to avoid flat gray.

## 3. Typography

Nimiq's official type stack: **Inter + Muli** for UI, **Fira Mono** for technical content.

### Font Stack
- **Primary:** Inter, Muli, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- **Monospace:** Fira Mono, 'Courier New', monospace

### Type Scale (Fixed, not fluid—product UI standard)
Based on Nimiq's 8px grid (1rem = 8px):
- **h1:** 3rem (24px) / 700 weight / -0.02em letter-spacing
- **h2:** 2.5rem (20px) / 700 weight / -0.02em letter-spacing
- **h3:** 2rem (16px) / 700 weight / -0.02em letter-spacing
- **Body:** 2rem (16px) / 400 weight / 1.6 line-height
- **Small:** 1.75rem (14px) / 500 weight / labels, secondary text
- **Tiny:** 1.5rem (12px) / 600 weight / captions, metadata

### Scale Ratio
1.125 between steps (tighter than brand surfaces—product UI standard). Keeps visual hierarchy without excessive contrast noise.

### Line Length
- **Prose content:** 65–75 characters maximum
- **UI labels/buttons:** No limit (compact by nature)
- **Data tables:** 120+ characters acceptable

### Usage Rules
**Monospace for Precision:** All wallet addresses, transaction hashes, NIM amounts, timestamps use Fira Mono. This signals "exact value, don't round mentally."

**Weights:** 400 (body), 500 (labels), 600 (small caps/metadata), 700 (headings, buttons). Never 300 or 800—keeps the range disciplined.

## 4. Elevation & Surfaces

Nimiq uses **glass surfaces** (backdrop blur + subtle transparency) for depth, not heavy shadows.

### Glass Effect
Light mode: `rgba(255, 255, 255, 0.92)` + `blur(20px)` + `border: 1px solid rgba(31, 35, 72, 0.08)`
Dark mode: `rgba(31, 35, 72, 0.55)` + `blur(20px)` + `border: 1px solid rgba(255, 255, 255, 0.08)`

### Shadow Vocabulary
- **Card shadow:** `0 1px 3px rgba(31, 35, 72, 0.04), 0 4px 12px rgba(31, 35, 72, 0.02)`
- **Card hover:** `0 2px 4px rgba(31, 35, 72, 0.06), 0 8px 24px rgba(31, 35, 72, 0.04)`
- **Button focus:** `0 0 0 3px rgba(233, 178, 19, 0.25)` (gold) or `rgba(5, 130, 202, 0.25)` (blue)

### Z-index Scale (Semantic)
- **Base:** 0 (default content)
- **Sticky nav:** 10
- **Dropdown:** 20
- **Modal backdrop:** 30
- **Modal:** 40
- **Toast:** 50
- **Tooltip:** 60

Never arbitrary values like 999 or 9999.

### Surface Rules
**Tonal First:** Depth comes from surface color variation (light → slightly darker) before shadows. Shadows only for interactive feedback (hover, focus) or floating elements (modals, dropdowns).

## 5. Components

Every component has **all interaction states:** default, hover, focus, active, disabled, loading, error. Non-negotiable.

### Buttons
**Radius:** 13.5px (Nimiq standard button radius)
**Padding:** 12px vertical / 24px horizontal (3rem horizontal on 8px grid)
**Font:** 700 weight, 16px
**Transition:** `200ms cubic-bezier(0.25, 0, 0, 1)` (Nimiq easing)

**Gold Button (crypto actions):**
- Default: `#E9B213` background, `#1F2348` text
- Hover: `#FC8702` background, `translateY(-1px)`
- Focus: 3px gold ring `rgba(233, 178, 19, 0.25)`
- Active: `translateY(0)`
- Disabled: 50% opacity, `cursor: not-allowed`

**Blue Button (commerce/AI):**
- Default: `#0582CA` background, white text
- Hover: `#0CA6FE` background, `translateY(-1px)`
- Focus: 3px blue ring `rgba(5, 130, 202, 0.25)`
- Active: `translateY(0)`
- Disabled: 50% opacity, `cursor: not-allowed`

### Cards
**Radius:** 10px (Nimiq card radius)
**Padding:** 24px (3rem on 8px grid)
**Background:** Glass surface (see Elevation section)
**Border:** 1px subtle (see glass effect colors)
**Hover:** `translateY(-1px)` + deeper shadow (interactive cards only)

### Input Fields
**Radius:** 4px (Nimiq input radius)
**Padding:** 12px horizontal, 10px vertical
**Background:** Light: `rgba(31, 35, 72, 0.04)` / Dark: `rgba(255, 255, 255, 0.06)`
**Border:** 1px solid, transparent default
**Focus:** Border shifts to accent color (gold or blue per context), 3px ring
**Error:** Red border + error message below

### Icons
**System:** Line-stroke icons (Feather/Lucide style), 1.9px stroke width
**Size:** 20px default, scale up/down by context (16px small, 24px large)
**Color:** `currentColor` (inherits from parent text color)
**Nimiq Icons:** When available, use official Nimiq icon sprite from `@nimiq/style`

### Loading States
**Skeletons** for content placeholders (not spinners mid-screen)
**Shimmer animation:** `1.8s cubic-bezier(0.25, 0, 0, 1)` with gold accent gradient
**Reduced motion:** Instant opacity fade, no shimmer

### Empty States
**Never:** "No data" or "Nothing here"
**Always:** Teach the interface—"Send your first NIM transaction" with action button

### Navigation
**Bottom nav (mobile primary):** Glass surface, rounded top corners, active state with gold/blue accent
**Top nav (desktop):** Glass surface with logo, wallet address badge, settings
**Tab switching:** 200ms transition, active indicator slides with Nimiq easing

## 6. Do's and Don'ts

### Do:
- **Do** use Space Mono for crypto values, addresses, and transaction hashes
- **Do** use Nimiq Gold only for crypto actions and Commerce Blue only for services/AI
- **Do** use generous spacing (gap‑4/6, space‑y‑6)
- **Do** provide reduced‑motion alternatives for all animations
- **Do** ensure color contrast meets WCAG 2.1 AA

### Don't:
- **Don't** make it look like a generic crypto exchange
- **Don't** use skeuomorphic or overly flashy payment‑app patterns
- **Don't** use pure flat grays—tint surfaces toward brand hues
- **Don't** cram elements together; prioritize breathing room
- **Don't** convey information by color alone

