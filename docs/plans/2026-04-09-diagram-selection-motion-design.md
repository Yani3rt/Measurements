# Diagram Selection Motion Design

## Goal

Improve measurement selection usability on the technical diagram without breaking the editorial, fashion-book tone of The Atelier.

## Approved Direction

Use a "whispered editorial" motion system:

- Draw the active measurement path in softly and quickly.
- Let the anchor point breathe once with a restrained gold pulse.
- Lift the selected callout chip slightly so the selected state feels composed, not abrupt.
- Sync the ruler badge transition so the plate and ruler feel like one response.

## Constraints

- Motion should remain subtle and refined rather than instructional.
- State changes should stay under roughly 350ms.
- Respect `prefers-reduced-motion` by collapsing the sequence to near-instant updates.
- Favor `opacity`, `transform`, and SVG attribute animation over layout-heavy changes.

## Implementation Notes

- Use `motion/react` for path drawing, chip settling, and badge content transitions.
- Keep easing on the refined side with decisive ease-out curves and soft springs.
- Avoid decorative looping animation; only animate on selection change.

## Success Criteria

- Selecting a measurement feels acknowledged immediately.
- Users can more easily track which callout, anchor, and ruler value belong together.
- The interaction feels couture and quiet instead of tutorial-like.
