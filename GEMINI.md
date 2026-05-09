# Project Overview

**Maratona** is a professional-grade running calculator designed for performance-driven athletes. It provides high-precision tools for calculating training zones, pace, time, distance, and unit conversions. The application emphasizes a "Calculator done right" philosophy, featuring a premium 3D flip-card interface that toggles between standard form inputs and interactive fine-tuning sliders.

### Core User Flow
1. **Mode Selection**: User selects calculation type (Quick DTP Input, Zones, Pace, Time, Distance, or Converter).
2. **Input Interaction**: User enters data via standard keyboard inputs or switches to the **Fine-tuning (Back face)** for tactile slider adjustments.
3. **Real-time Results**: Calculations update dynamically, providing detailed race predictions, split tables, and metabolic zones.
4. **Action Items**: Users can copy results to the clipboard or reset for a new session.

---

# Technical Stack

| Area | Technology | Usage |
| :--- | :--- | :--- |
| **Frontend** | HTML5 | Semantically structured markup. |
| **Styling** | Vanilla CSS | Custom design system using CSS Variables and 3D Transforms. |
| **Logic** | Vanilla JavaScript | ES Modules (ESM) with functional decomposition. |
| **Icons** | Bootstrap Icons | SVG-based iconography via CDN. |
| **Typography**| Google Fonts | 'Inter' (Sans-serif) and 'Roboto Mono' (Monospaced). |
| **Deployment**| Static Hosting | Optimized for lightning-fast delivery (e.g., GitHub Pages). |

> [!NOTE]
> This is a **Zero-Dependency** project. No frameworks (React/Vue/Tailwind) are used to ensure maximum performance and maintainability.

---

# Workflow & Rules

### Running the Project
*   **Local Development**: Since the project uses ES Modules, it requires a local server. Use `npx live-server` or the VS Code "Live Server" extension.
*   **Production**: Simply serve the root directory. No build step required.

### Coding Standards
*   **HTML**: Use semantic tags (`<aside>`, `<main>`, `<section>`). Interactive elements must have descriptive `id` and `aria-label` attributes.
*   **CSS**:
    *   Follow the modular structure in `assets/css/`.
    *   **NEVER** hardcode colors or spacing. Always use tokens from `variables.css`.
    *   Responsive design is handled via `mobile.css` and `layout.css`.
*   **JavaScript**:
    *   Keep logic modular: `calculators.js` for math, `ui-controller.js` for DOM manipulation.
    *   Use `const` and `let` exclusively; avoid `var`.
    *   Maintain strict separation between mathematical logic and UI updates.

### Commits & Documentation
*   **Commits**: Use descriptive, imperative messages (e.g., `feat: add marathon split presets`, `fix: slider snapping logic`).
*   **JSdoc**: Document complex mathematical functions in `calculators.js` using standard JSdoc comments.

---

# Design System & UI

### Typography
*   **Primary (San-serif)**: `Inter` (used for UI elements, labels, and body text).
*   **Data (Monospaced)**: `Roboto Mono` (used for calculated values and split tables).

### Colors (Design Tokens)
*   **Primary Action**: `--btn-primary-bg: #D9383A` (The Track Red).
*   **Dark Mode**: Support is implemented via both `@media (prefers-color-scheme: dark)` and `[data-color-mode="dark"]` for manual toggles.

### Components
*   **Inputs**: Custom styled `input-field` with focus states using `--input-focus-border`.
*   **Sliders**: High-precision custom range inputs with dynamic boundary expansion.
*   **Cards**: Minimalist `metric-card` for result display.

---

# Architecture

```text
RunTools/
├── index.html          # Entry point and application structure
├── assets/
│   ├── css/
│   │   ├── variables.css   # Global design tokens and themes
│   │   ├── base.css        # Resets and base element styles
│   │   ├── layout.css      # Grid and flexbox structure (Sidebar vs Main)
│   │   ├── components.css  # UI components (buttons, inputs, sliders)
│   │   ├── results.css     # Result-specific styling and metrics grid
│   │   └── mobile.css      # Tablet and mobile optimizations
│   └── js/
│       ├── main.js         # Entry module and initialization
│       ├── calculators.js  # Core mathematical logic (business logic)
│       ├── ui-controller.js# DOM interactions and event listeners
│       ├── sliders.js      # Interactive slider system logic
│       └── utils.js        # Formatting and helper utilities
└── README.md           # User-facing project documentation
```

---

# Lessons Learned

*   **Slider Precision**: Use a "Relative Anchor" system for sliders to prevent rounding errors during bidirectional updates between distance, time, and pace.
*   **3D Flip Performance**: Ensure `backface-visibility: hidden` is applied to avoid flickering in Safari.
*   **Mobile Grid**: On small screens, the horizontal split grid should collapse to a single column to maintain readability of split times.
