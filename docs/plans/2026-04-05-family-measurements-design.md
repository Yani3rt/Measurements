# Family Measurements App Design

## Product Direction

The app is a household wardrobe reference, not a tailoring studio. One person manages multiple family member profiles and keeps core body measurements available for future clothing purchases.

## Version 1 Scope

- Home screen centered on a family member list
- Quick-add flow with `name`, `sex`, and `height`
- Per-person measurement workspace
- Front and back body views
- Select-first interaction for measurements
- Explicit edit action for touch-friendly updates
- Unit toggle between centimeters and inches
- Local-first persistence with a future-friendly data model

## Information Architecture

### Home

- Family profile list
- Add profile action
- Per-profile completion summary

### Profile Workspace

- Member header
- Front/back body toggle
- Unit toggle
- Body illustration with tappable measurement hotspots
- Selected measurement detail panel
- Edit flow for one measurement at a time

## Data Model

Each profile contains:

- `id`
- `name`
- `sex`
- `heightCm`
- `createdAt`
- `updatedAt`
- `measurements`

Measurement groups:

- Front: `hatSize`, `neck`, `shoulderCircumference`, `bust`, `underBust`, `waist`, `rise`, `thigh`, `hips`, `knee`
- Back: `shoulder`, `sleeveLength`, `back`, `torso`, `outseam`, `inseam`

Canonical values are stored in centimeters and converted for display when the user switches to inches.

## Interaction Model

- New profiles initialize every measurement to `0`
- Tapping a body hotspot selects a measurement
- The selected measurement is highlighted on the figure and in the detail panel
- Editing is triggered by a separate button, not by selection itself
- Saving a value updates only that measurement and preserves the rest of the profile

## Persistence Strategy

- Store profiles in browser `localStorage`
- Keep storage access inside a small helper layer
- Structure records so a future synced backend can replace storage without forcing UI changes

## Implementation Notes

- Remove the current tailor/studio framing in favor of family organization
- Start with a stylized interactive body map built from positioned hotspots
- Keep measurement definitions in a shared config so labels, groupings, and avatar hotspots stay aligned
