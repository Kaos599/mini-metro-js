## 2024-05-24 - Form Label Association and Icon Button Accessibility
**Learning:** Found that custom settings menus (like the seed input) often lack proper form associations (`htmlFor`/`id`) and ARIA labels for icon-only buttons (like the dice icon), making them difficult to use with screen readers and keyboard navigation.
**Action:** Always ensure that form inputs have explicitly associated labels and that any icon-only interactive elements have clear, descriptive `aria-label`s and `title` attributes. Add `focus-visible` styles to ensure keyboard focus is evident.
