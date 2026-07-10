# Nimiq Spinner Types Implementation

## Overview
Implemented two distinct spinner types based on Nimiq UI Kit specifications to differentiate between heavy operations and quick actions.

Reference: https://nimiqtoolbox.github.io/nimiq-ui-kit/#vc-feedback

## Spinner Types

### 1. Loading Spinner (Dot-based) - `type="loading"`
**Use for large/heavy operations:**
- Page loads
- Initial data fetching
- Major state transitions
- Authentication checks
- Large file operations

**Design:**
- Three animated dots that pulse in sequence
- Staggered animation (0s, 0.2s, 0.4s delays)
- 1.4s animation duration
- Nimiq easing: `cubic-bezier(0.25, 0, 0, 1)`

**Example:**
```tsx
<LoadingSpinner size="lg" type="loading" />
```

### 2. Circular Spinner (Ring-based) - `type="circular"`
**Use for quick operations:**
- Refresh actions
- Small updates
- Button actions
- Delete operations
- Session loading
- Quick fetches

**Design:**
- Rotating circular ring (3/4 circle)
- SVG-based with stroke
- 0.8s rotation duration
- Nimiq easing: `cubic-bezier(0.25, 0, 0, 1)`

**Example:**
```tsx
<LoadingSpinner size="sm" type="circular" />
```

## API Reference

### LoadingSpinner Component

```tsx
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  type?: 'loading' | 'circular';
  color?: 'gold' | 'blue' | 'white' | 'current';
  className?: string;
}
```

**Props:**
- `size`: Size variant (sm=16px, md=24px, lg=40px)
- `type`: Spinner type ('loading' for dots, 'circular' for ring)
- `color`: Color variant (gold=default, blue, white, current)
- `className`: Additional CSS classes

**Defaults:**
- `size`: 'md'
- `type`: 'circular' (backwards compatible)
- `color`: 'gold'

### Helper Components

#### InlineSpinner
For use inside buttons or inline content. Uses circular spinner.

```tsx
<InlineSpinner />
// Equivalent to: <LoadingSpinner size="sm" type="circular" color="current" />
```

#### PageLoading
For full-page loading states with message. Uses loading (dot) spinner.

```tsx
<PageLoading message="Loading data..." submessage="Please wait" />
// Uses: <LoadingSpinner size="lg" type="loading" />
```

## Implementation Summary

### Updated Usages

| Location | Context | Type | Reason |
|----------|---------|------|--------|
| `src/app/page.tsx` (LoadingSkeleton) | Initial Nimiq Pay connection | `loading` | Heavy operation |
| `src/app/page.tsx` (auth check) | Checking authentication | `loading` | Heavy operation |
| `src/components/pages/HomePage.tsx` | Referral modal loading | `circular` | Quick fetch |
| `src/components/pages/ChatPage.tsx` | Session list loading | `circular` | Quick fetch |
| `src/components/pages/ChatPage.tsx` | Delete session | `circular` | Quick action |
| `PageLoading` helper | Page-level loading | `loading` | Heavy operation |
| `InlineSpinner` helper | Button/inline actions | `circular` | Quick action |

### Design Specifications

#### Loading Spinner (Dots)
```
Size     Dot Size    Gap
sm       6px (1.5)   4px (gap-1)
md       8px (2)     6px (gap-1.5)
lg       12px (3)    8px (gap-2)
```

**Animation:**
- Duration: 1.4s
- Easing: `cubic-bezier(0.25, 0, 0, 1)`
- Delays: 0s, 0.2s, 0.4s (sequential pulse)

#### Circular Spinner (Ring)
```
Size     Diameter    Stroke Width
sm       16px        3px
md       24px        3px
lg       40px        3px
```

**Animation:**
- Duration: 0.8s
- Easing: `cubic-bezier(0.25, 0, 0, 1)`
- Arc: 3/4 circle (270°)
- Opacity: 0.9 (or 1.0 for 'current' color)

### Color Palette

| Color | Hex | Use Case |
|-------|-----|----------|
| Gold | `#E9B213` | Default, Nimiq brand |
| Blue | `#0582CA` | Alternative, Nimiq Light Blue |
| White | `#FFFFFF` | Dark backgrounds |
| Current | `currentColor` | Inherit text color (buttons) |

## Migration Guide

### Existing Code (Default Circular)
```tsx
// These continue to work unchanged
<LoadingSpinner />
<LoadingSpinner size="sm" />
<LoadingSpinner color="blue" />
```

### New Heavy Operations
```tsx
// Add type="loading" for heavy operations
<LoadingSpinner size="lg" type="loading" />
<PageLoading message="Connecting..." />
```

### Quick Actions
```tsx
// Explicitly use type="circular" (or omit, it's default)
<LoadingSpinner size="sm" type="circular" />
<InlineSpinner />
```

## Visual Hierarchy

### Use Loading Spinner (Dots) When:
- ✅ Initial page load
- ✅ Establishing connections
- ✅ Major data fetches
- ✅ Authentication flows
- ✅ User expects to wait

### Use Circular Spinner (Ring) When:
- ✅ Refresh actions
- ✅ Button clicks
- ✅ Quick API calls
- ✅ Delete/update actions
- ✅ User expects immediate feedback

## Accessibility

Both spinner types include:
- `role="status"` for screen readers
- `aria-label="Loading"` for context
- Proper semantic markup
- Visible focus indicators

## Build Status
✅ **Build passed successfully** (no errors or warnings)

## Files Modified

1. `src/components/LoadingSpinner.tsx` - Added type support and dot spinner
2. `src/app/page.tsx` - Updated to use `type="loading"` for heavy ops
3. `src/components/pages/HomePage.tsx` - Updated to use `type="circular"` for refresh
4. `src/components/pages/ChatPage.tsx` - Updated to use `type="circular"` for quick actions

---

**Completion Date**: 2026-07-10  
**Status**: COMPLETE  
**Reference**: Nimiq UI Kit - https://nimiqtoolbox.github.io/nimiq-ui-kit/#vc-feedback
