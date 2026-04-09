# Design System Specification: The Bespoke Editorial

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Atelier."** 

This system transcends standard utility apps by adopting the visual language of high-end tailoring and editorial fashion journals. We move away from the "app-as-a-tool" aesthetic toward "app-as-a-service." To break the generic grid, we utilize intentional asymmetrical layouts, generous whitespace (le chic breathability), and high-contrast typographic scales. The goal is a digital experience that feels as precise and intentional as a hand-stitched garment.

---

## 2. Colors & Tonal Architecture
The palette is rooted in a "Boutique Neutral" philosophy. We use soft creams and architectural grays to create a canvas where the user's data—and our refined accents—can shine.

### The Palette
*   **Primary (Deep Navy):** `#03192e` — Used for high-authority elements and primary CTAs.
*   **Secondary (Muted Gold):** `#735b24` — Reserved for "Tailor's Notes," success states, or premium highlights.
*   **Background:** `#fafaf5` — A warm, "parchment" cream that feels more premium than pure white.
*   **Surface Tiers:** 
    *   `surface_container_lowest`: `#ffffff` (Pure white for floating cards)
    *   `surface_container_low`: `#f4f4ef` (Subtle depth)
    *   `surface_container_high`: `#e8e8e3` (Defined zones)

### Creative Direction
*   **The "No-Line" Rule:** We do not use 1px solid borders to section content. Boundaries must be defined through background color shifts. A measurement input group should sit on `surface_container_low` against the `surface` background.
*   **Surface Hierarchy:** Treat the UI as layers of fine paper. Nesting `surface_container_lowest` cards inside a `surface_container` section creates a natural lift that conveys importance without visual clutter.
*   **The Glass & Gradient Rule:** For "Floating Action Buttons" or navigation bars, use **Glassmorphism**. Apply `surface` at 80% opacity with a `20px` backdrop blur. For main CTAs, use a subtle linear gradient from `primary` (`#03192e`) to `primary_container` (`#1a2e44`) at a 135-degree angle to add "soul" and depth.

---

## 3. Typography
The typography is a dialogue between tradition and modernity.

*   **Display & Headlines (Noto Serif):** This is our "Editorial" voice. Use `display-lg` and `headline-md` for page titles and section headers. The serif high-contrast strokes evoke the feeling of a fashion lookbook.
*   **Body & Labels (Manrope):** This is our "Precision" voice. Manrope’s geometric clarity is used for all measurement data and instructional text.
*   **The Hierarchy Strategy:** Large Serif headers should often be center-aligned or dramatically left-aligned with significant top-padding (at least `64px`) to create an editorial "Cover Page" feel for each section.

---

## 4. Elevation & Depth
In "The Digital Atelier," depth is felt, not seen.

*   **Tonal Layering:** Avoid shadows for static elements. Use the `surface-container` scale to create hierarchy. A card on the `surface` background should use `surface_container_low` to define its bounds.
*   **Ambient Shadows:** For floating elements (Modals, Dropdowns), use an "Extra-Diffused" shadow:
    *   `box-shadow: 0 12px 32px -4px rgba(26, 28, 25, 0.06);` (Using the `on-surface` color at 6%).
*   **The "Ghost Border" Fallback:** If a divider is required for accessibility, use the `outline_variant` token at **15% opacity**. This creates a "watermark" effect rather than a hard line.

---

## 5. Components

### Input Fields (The Measurement Core)
Inputs must feel surgical and clean.
*   **Style:** No background fill; only a bottom "Ghost Border" using `outline_variant` (20%).
*   **Focus State:** The border transitions to `primary` (`#03192e`) with a `2px` thickness. 
*   **Labels:** Use `label-md` in `on_surface_variant`. As the user types, the label should shift with a slight vertical offset.

### Buttons
*   **Primary:** Solid `primary` background. `0.25rem` (sm) roundedness. Use `on_primary` (white) for text.
*   **Secondary:** Solid `secondary_container` (`#fddc98`) with `on_secondary_container` (`#785f28`) text. Use for "Add New" or "Edit" actions.
*   **Ghost:** No background, `primary` text. Used for "Cancel" or low-priority actions.

### Measurement Chips
*   **Visual:** For "Neck," "Bust," "Waist" tags.
*   **Style:** `surface_container_highest` background with `on_surface` text. Shape should be `full` (pill-shaped) to contrast against the sharp angles of the typography.

### Progress & Detail Cards
*   Forbid the use of divider lines. Separate "Arm Length" from "Shoulder Width" using `24px` of vertical white space or by placing them in alternating `surface_container_low` and `surface_container_lowest` blocks.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins. For example, give the right side of a text block more breathing room than the left to mimic a magazine layout.
*   **Do** use the `secondary` gold color sparingly—only for "Success" or "Verified" measurement states to imply a "Gold Standard."
*   **Do** lean into the `notoSerif` for numbers in a large display format when showing a final measurement (e.g., a large `32.5"` in `display-md`).

### Don't
*   **Don't** use 100% black. Always use `on_background` (`#1a1c19`) to keep the "Boutique" softness.
*   **Don't** use standard "Drop Shadows." They feel "techy" and cheap. Use tonal layering or ambient blurs.
*   **Don't** cram information. If a screen feels full, it is wrong. Add a scroll or a step-by-step wizard to maintain the "helpful, organized" vibe.
*   **Don't** use the `error` red for anything other than critical failures. For "Warning" or "Incomplete," use a muted version of the `secondary` gold.