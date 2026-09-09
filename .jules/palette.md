## 2024-05-24 - Accessibility for Custom Game UI Controls
**Learning:** Custom UI control bars (like game speed selectors) are often built with standard divs and buttons. Without proper ARIA roles, screen readers don't understand that these buttons are a related set of mutually exclusive options.
**Action:** Always wrap custom control sets in a container with `role="group"` and `aria-label`, and use `aria-pressed` on the individual buttons to clearly communicate their state to screen reader users, along with adding `focus-visible` states for keyboard users.
