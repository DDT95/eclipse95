# Design QA — Où voir l’éclipse ?

- Source visual truth: `/Users/wilfriedkoba/.codex/generated_images/019fe672-d7aa-72b1-9c07-cec6f888a191/exec-515764da-71f8-4eb8-a0a3-f9cbe9250bd6.png`
- Implementation screenshot: `/Volumes/Backup/Atlas du Val d'Oise/01_Sites/eclipse95/implementation-desktop.png`
- Comparison board: `/Volumes/Backup/Atlas du Val d'Oise/01_Sites/eclipse95/design-qa-comparison.png`
- Mobile screenshot: `/Volumes/Backup/Atlas du Val d'Oise/01_Sites/eclipse95/implementation-mobile.png`
- Viewports: desktop 1440 × 1024 CSS px; mobile 390 × 844 CSS px; device scale factor 1.
- Source pixels: 1536 × 1024. Implementation pixels: 1440 × 1024.
- Normalization: both desktop images cover-fitted to 720 × 480 and placed side by side.
- State: Butry-sur-Oise search result, 20:19, all four checks resolved, detail drawer open.

## Evidence

The implementation preserves the source hierarchy: Atlas header, control rail, dominant live map and result drawer. The implementation capture intentionally shows the close operational state rather than the source’s departmental overview: a searched point, zoom level 14, zero score, terrain profile, OSM proximity/obstacle checks and weather result.

Focused review used the original-resolution screenshots for the safety notice, loading/complete states, score cap, direction, horizon, weather, accessibility, ground audit and mobile bottom sheet.

## Required fidelity surfaces

- Fonts and typography: local Marianne Regular/Medium/Bold, Atlas weights and compact label tracking preserved.
- Spacing and layout rhythm: 300 px control rail, flexible map and 350 px drawer remain aligned; mobile uses a scrollable bottom sheet.
- Colors and tokens: institutional blue/deep blue and semantic score colors preserved. Red/green regional circles were removed; color now belongs only to the selected marker.
- Image and asset fidelity: supplied Préfet SVG, local Marianne fonts, live OSM/Leaflet cartography and Phosphor icons are used.
- Copy and content: exact title/date, ISO 12312-2 warning, score evidence, confidence, limitations, sources and Mapillary fallback are present in French.

## Comparison history

### Pass 1 — blocked

- P1: double degree conversion produced invalid solar values. Fixed; the UI now reports 284° and about 8° altitude.
- P1: BAN search incorrectly filtered `postcode=95`. Fixed by filtering returned Val-d’Oise candidates.
- P2: a mobile user could miss the eye-safety warning. Fixed with a warning inside the bottom sheet.

### Pass 2 — blocked

- P1: the demonstration heat circles implied knowledge not supported by the data. Removed entirely.
- P1: terrain-only scoring could produce false green results in valleys. Fixed by requiring weather, elevation, OSM occupation/proximity and obstacle checks before green is allowed.
- P2: clicks did not recenter after search. Fixed with an animated map update to zoom 14.
- P2: stale scores remained visible while a new point was loading. Fixed by clearing prior evidence and showing a neutral ellipsis marker.

### Pass 3 — passed

- Butry-sur-Oise tested: 100/100 data confidence, score 0, building within 5 m and an obstacle in the viewing axis detected.
- Map click tested: coordinates and all calculations update.
- Search tested: Butry-sur-Oise resolves and recenters.
- Conservative fallback tested: incomplete occupation data caps the result below green and names the missing control.
- Desktop and mobile captures reviewed; no map `circle` elements remain.
- Console errors/warnings checked: none.
- Production build and Sites worker tests pass.
- No actionable P0/P1/P2 findings remain.

## Follow-up polish

- P3: add permanent markers only after producing a documented dataset of verified topographic extrema.
- P3: cache Overpass results in a future API/edge layer to reduce repeated public-service latency.

final result: passed

## Pass 8 — explicit partial-result diagnosis

- Source visual truth: user capture at 15:53 showing the generic incomplete-data state.
- Implementation evidence: `implementation-partial-explicit.png`; focused comparison: `design-qa-partial-explicit.png`.
- [P1 fixed] “À confirmer — données incomplètes” incorrectly sounded like an observed blocker. When relief and weather are favorable, the result now states “Aucun blocage détecté dans les données disponibles”.
- The missing service is named precisely: access, nearby buildings and obstacles through OpenStreetMap.
- Accessibility remains “à confirmer” without contaminating the verified terrain and weather findings.
- Build and all 4 Sites packaging tests pass; no actionable P0/P1/P2 finding remains.

final result: passed

## Pass 7 — deterministic red verdict and loading feedback

- Source visual truth: user captures at 15:41 and 15:45.
- Implementation evidence: `implementation-red-verdict.png` and `implementation-loading.png`, viewport 1440 × 1024.
- [P1 fixed] A terrain-blocked location could be labelled “À confirmer” when secondary controls failed. Relief blockage now takes precedence and returns “Défavorable — Soleil masqué”, with the angular obstruction stated.
- The selected-time horizon and the fixed 20:19 maximum horizon are fetched separately, so the fixed map layer and the time slider receive distinct, explicit verdicts.
- [P1 fixed] The initial Vétheuil/Rue Ampère placeholder and stale address during loading were removed. No point data is fetched before a real selection.
- [P2 fixed] Loading now exposes `aria-busy`, an animated spinner, moving progress track, pulsing map marker and explicit status copy.
- The Eclipse header no longer contains an Atlas return link; its brand is no longer clickable.
- Build and all 4 Sites packaging tests pass; no actionable P0/P1/P2 finding remains.

final result: passed

## Pass 6 — enlarged horizon profile

Source visual truth: the user capture `Capture d’écran 2026-08-09 à 15.35.02.png`.
Implementation evidence: `implementation-horizon-large.png`; focused comparison: `design-qa-horizon-comparison.png`.

- [P1 fixed] Negative terrain angles were clipped at 0°, making the relief profile incomplete. The vertical domain now includes the real minimum and maximum values.
- [P2 fixed] The 145 px graph was too compressed. It is now 230 px high with a tighter dynamic angular scale.
- [P2 fixed] Static 0/5/10/15° ticks wasted most of the chart. Tick spacing now adapts to the observed profile and solar altitude.
- The chart reserves larger axis margins, labels 0–10 km clearly and can render an OSM obstacle at its mapped distance and angle in orange.
- Build and all 4 Sites packaging tests pass; no actionable P0/P1/P2 findings remain.

final result: passed

## Pass 4 — immediate territorial reading

- Compared against the continuous visibility layer on eclipsemap.xyz.
- The map now opens on the whole Val-d’Oise, without an arbitrary result drawer or marker.
- A continuous green / orange / red terrain surface is visible immediately and clipped to the departmental boundary.
- The legend explicitly distinguishes clear, marginal and terrain-blocked sightlines at 20:19 toward 284°.
- The layer toggle was browser-tested: zero image overlays when disabled, one when enabled.
- “Relief uniquement” separates this initial reading from the detailed weather, access and obstacle checks run after a click.
- Only a user-selected point receives a marker, viewing axis and result drawer.
- Incomplete open-data checks display “À confirmer — données incomplètes” instead of a misleading percentage.
- Build passed and all 4 Sites packaging tests passed; no actionable P0/P1/P2 findings remain.

## Pass 5 — Atlas interaction and safety revision

Source visual truth: `atlas-ref-2.png` and `atlas-ref-3.png`, captured from the published ZAN and Domicile–Travail Atlas pages.
Implementation evidence: `implementation-safety.png`, `implementation-desktop.png`, `implementation-detail.png`, and `implementation-mobile.png` at 1440 × 1024 and 390 × 844 CSS viewports.

- [P1 fixed] The former three-column layout reduced the map when results opened. The result is now a 410 px floating drawer inside the rounded map card, matching the Atlas interaction model.
- [P1 fixed] The department appeared undersized. The map now fits the actual GeoJSON bounds with controlled padding, matching the territorial scale of the reference pages.
- [P1 fixed] Private access was treated as an exclusion despite ambiguous OSM proximity. It is now a non-blocking contextual warning and never zeroes or caps the score.
- [P1 fixed] Eye safety could be missed. A blocking informational dialog is shown at every page opening, with ISO 12312-2 guidance and an official link.
- [P2 fixed] The horizon graph was too compressed. It now includes a 0–15° scale, 0–10 km distance, named Sun line, relief key and increased height.
- [P2 fixed] Mobile direction guidance stretched vertically after the Atlas layout overrides. Its mobile positioning is now explicitly bounded; no horizontal overflow remains.
- Full-view comparison confirms the 111 px Atlas header, 16 px workspace gutter, rounded shadowed control card, rounded map card, departmental fit and floating result drawer.
- Focused result comparison confirms the drawer close control, score hierarchy and readable horizon profile.
- Production build and all 4 Sites packaging tests pass. No actionable P0/P1/P2 findings remain.

final result: passed
