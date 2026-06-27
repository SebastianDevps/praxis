---
name: apple-hig
description: Use when designing for iOS, iPadOS, macOS, visionOS, watchOS, or building native-feeling mobile UI — applies Apple Human Interface Guidelines on touch targets, safe areas, and native components.
kind: skill
od:
  surface: mobile
  platform: mobile
  category: design-systems
  triggers:
    - apple hig
    - ios design
    - mobile design
    - visionos
    - human interface
---

## Core Principles

- **Platform conventions first.** Users expect native patterns. Deviate only when the deviation serves a clear user need.
- **Clarity.** Content is primary. UI chrome recedes. Text is legible at every size.
- **Deference.** The UI supports, not competes with, the content.
- **Depth.** Translucency and layering communicate hierarchy — use them intentionally.

## Touch Targets

- Minimum 44×44 pt for all interactive elements.
- Spacing between adjacent targets: at least 8 pt to prevent mis-taps.
- Extend tap area beyond visual bounds using padding, not by enlarging the visual element.

## Safe Areas & Layout

- Respect `safeAreaInsets` — never clip content under notches, Dynamic Island, or home indicator.
- Use `UILayoutGuide` / SwiftUI `safeAreaPadding` — do not hardcode pixel offsets.
- Content should scroll under translucent bars, not stop at them.

## Native Components Over Custom

Prefer system components when functionality matches:

| Need | Use |
|---|---|
| Navigation | `UINavigationController` / `NavigationStack` |
| Tab switching | `UITabBarController` / `TabView` |
| Lists | `UITableView` / `List` |
| Modals | `UISheetPresentationController` / `.sheet` |
| Alerts | `UIAlertController` / `Alert` |
| Text input | `UITextField`, `UITextView` / `TextField`, `TextEditor` |

Custom controls are justified when the system component cannot meet the UX requirement — document why.

## SF Symbols

- Use SF Symbols before any custom icon. Symbol names are stable across OS versions.
- Match symbol weight to the surrounding text weight.
- Use `hierarchical`, `palette`, or `multicolor` rendering where appropriate.
- Do not modify symbol proportions.

## Typography — Dynamic Type

- Use semantic text styles (`body`, `headline`, `caption1`, etc.) — do not hardcode point sizes.
- Test at the largest Dynamic Type size (Accessibility → XL5) — layout must not break.
- Minimum body text: `body` style (17pt default). Do not go below `caption2` (11pt) for readable content.

## Platform-Specific Conventions

| Platform | Key convention |
|---|---|
| iOS | Bottom sheet for contextual actions; swipe-back navigation; pull-to-refresh |
| iPadOS | Sidebar + split view for primary navigation; pointer/hover support |
| macOS | Menu bar commands mirror in-window actions; keyboard shortcuts for all primary actions |
| visionOS | Windows float in space; ornaments for auxiliary controls; spatial audio for feedback |
| watchOS | Complications are primary entry points; Digital Crown for scrolling; glanceable content only |

## When to Deviate

Acceptable deviations: brand-defining visual identity, cross-platform consistency for core UX flows, feature unavailable in system components.

Unacceptable deviations: hiding system navigation patterns, ignoring accessibility APIs, breaking expected gestures.
