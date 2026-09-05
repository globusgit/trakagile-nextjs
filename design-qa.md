# Live Tracking Map Design QA

- Source visual truth: user-provided production screenshot in the conversation (employee T5678, light map, selected-employee panel).
- Implementation screenshot: unavailable because no controllable in-app browser is connected to this workspace session.
- Intended viewport: desktop, approximately 1920 × 1080 device pixels.
- Source pixels: 1920 × 1080.
- Implementation pixels/CSS size/density: not captured; normalization unavailable.
- State: authenticated Live Tracking page with employee T5678 selected.

## Full-view comparison evidence

The source screenshot shows an oversized fixed accuracy circle and a pen-like triangular route produced by GPS drift. Code changes now separate route vertices from trigger overlays, filter low-quality and implausible movement, use rounded route strokes, and hide the accuracy circle until requested. A rendered after-state could not be captured for visual comparison.

## Focused region comparison evidence

Blocked: the map route/marker region cannot be compared side-by-side without a browser-rendered implementation capture.

## Findings

- P1 verification blocker: the corrected authenticated production state could not be rendered and captured in the available browser tooling.
- P3 expected limitation: this implementation filters noisy GPS geometry but does not perform external road-network map matching; that requires a routing/map-matching service and should not be simulated visually.

## Comparison history

- Initial evidence: triangular/double-back line, fixed 90 m accuracy circle, overlapping live/trigger markers.
- Fixes made: server-side quality filtering and distance recalculation; stationary heartbeat suppression; separate event markers; optional real-accuracy circle; independent trigger numbering; rounded, lighter route stroke.
- Post-fix visual evidence: blocked because no browser is available.

## Implementation checklist

- [x] Filter inaccurate, stationary-drift, and physically implausible points.
- [x] Calculate displayed distance from the cleaned route.
- [x] Keep trigger markers out of polyline geometry.
- [x] Number triggers independently from Mark In.
- [x] Make the actual GPS accuracy circle optional.
- [x] Verify tests, lint, TypeScript, production build, and Flutter analysis.
- [ ] Capture the authenticated after-state and compare it with the source screenshot.

final result: blocked
