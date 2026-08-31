## 2023-10-24 - Interactive Element Accessibility
**Learning:** When building custom game UIs with lots of icon-only or color-coded buttons (like speed controls and line selectors), they often lack screen reader support and keyboard focus indicators, making the game unplayable for keyboard and screen-reader users.
**Action:** Always include `aria-label` on icon-only/color-coded buttons and `focus-visible` utility classes to ensure keyboard navigation is clear and accessible without impacting mouse users.
