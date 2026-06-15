---
name: NimAgent
description: AI‑powered Nimiq payment platform
colors:
  nimiq-gold: "#F5A623"
  commerce-blue: "#2B6BD6"
  deep-space: "#0A0C17"
  tinted-slate: "#10121F"
  bright-gold: "#FBBF4D"
  dim-gold: "#C9881A"
  bright-blue: "#5B8FE6"
  dim-blue: "#1F4FA0"
  brand-navy: "#1F1C3E"
  success: "#34D399"
  error: "#F87171"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
  mono:
    fontFamily: "Space Mono, monospace"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-gold:
    backgroundColor: "{colors.nimiq-gold}"
    textColor: "{colors.deep-space}"
    padding: "12px 24px"
  button-blue:
    backgroundColor: "{colors.commerce-blue}"
    textColor: "#ffffff"
    padding: "12px 24px"
---

# Design System: NimAgent

## 1. Overview

**Creative North Star: "The Conversation Hub"**

NimAgent's design prioritizes conversational, human‑centered interactions first. It feels secure, simple, and friendly—warm, approachable, and confident. The system avoids crypto jargon and visual clutter, focusing on clarity and trust.

This system explicitly rejects generic crypto‑exchange clutter, skeuomorphic payment‑app flashiness, and minimalist‑but‑unusable interfaces that trade clarity for aesthetics.

**Key Characteristics:**
- Conversational UI at the core
- Strict dark‑mode‑only design
- Dual accent palette (Nimiq Gold for crypto, Commerce Blue for services)
- Generous spacing, no cramped layouts
- Reduced‑motion support built in

## 2. Colors

A two‑accent dark‑mode palette, split by functional intent rather than brand whim.

### Primary Accents
- **Nimiq Gold** (#F5A623): For crypto‑native actions—send, receive, QR codes, swaps, balance displays
- **Bright Gold** (#FBBF4D): Hover/active state for gold‑accented elements
- **Dim Gold** (#C9881A): Subtle gold accents

### Secondary Accents
- **Commerce Blue** (#2B6BD6): For services and AI—gift cards, airtime, bills, agent interactions
- **Bright Blue** (#5B8FE6): Hover/active state for blue‑accented elements
- **Dim Blue** (#1F4FA0): Subtle blue accents
- **Brand Navy** (#1F1C3E): Elevated dark surfaces (backdrop blur included)

### Neutrals
- **Deep Space** (#0A0C17): Primary background
- **Tinted Slate** (#10121F): Secondary background/surfaces

### Status
- **Success** (#34D399): Positive outcomes
- **Error** (#F87171): Errors

### Named Rules
**The Split Accent Rule.** Gold is only for crypto; blue is only for commerce/AI. Never mix them decoratively.
**The No Flat Grays Rule.** All dark surfaces are tinted toward the brand hues, never pure black/gray.

## 3. Typography

**Body Font:** Inter (with system‑ui fallback)
**Mono/Label Font:** Space Mono (with monospace fallback)

**Character:** Clean, legible sans for text, technical monospace for crypto values (addresses, hashes, balances) to signal precision.

### Hierarchy
- **Body** (400, 1rem, 1.5): Default text, max line length 65–75ch
- **Label** (500, 0.875rem): Buttons, form labels, statuses

### Named Rules
**The Mono for Crypto Rule.** All wallet addresses, transaction hashes, NIM/BTC values use Space Mono.

## 4. Elevation

Hybrid tonal layering + soft shadows. Depth comes from tinted surface colors first, subtle shadows second—no harsh or distracting drops.

### Shadow Vocabulary
- **Soft ambient glow** (`0 0 0 0 rgba(245, 166, 35, 0.35)` to `0 0 0 8px rgba(245, 166, 35, 0)`): Used for gold accent pulse state

### Named Rules
**The Tonal First Rule.** Surfaces get depth from color tint first; shadows are only used for interactive feedback.

## 5. Components

### Buttons
- **Shape:** Gently rounded (8px radius)
- **Gold Button:** Nimiq Gold background, Deep Space text, 12px vertical / 24px horizontal padding; hover to Bright Gold
- **Blue Button:** Commerce Blue background, white text, 12px vertical / 24px horizontal padding; hover to Bright Blue
- **States:** Focus visible with subtle ring; reduced‑motion variants available

### Cards / Containers
- **Corner Style:** Gentle rounding (12px)
- **Background:** Tinted Slate or Brand Navy (with optional backdrop blur)
- **Border:** No borders—use color contrast for separation
- **Internal Padding:** Generous (24px)

### Inputs / Fields
- **Style:** Soft corners (8px), Tinted Slate background
- **Focus:** Subtle border shift to Bright Gold/Bright Blue depending on context
- **Error:** Accented with Error color

### Navigation
- **Style:** Bottom‑nav for mobile (primary), clean tabbed for desktop
- **States:** Active state uses the appropriate accent color (gold/blue per section)

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

