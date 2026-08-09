# Design QA — CartoKob mobile

- Source visual truth: `/Users/wilfriedkoba/.codex/generated_images/019fe672-d7aa-72b1-9c07-cec6f888a191/exec-d8bb123c-61c4-4700-a545-08b376952f8b.png`
- Implementation screenshot: `implementation-cartokob-result-final.png`
- Combined evidence: `design-qa-cartokob-comparison-final.png`
- Viewport: 390 × 844 CSS px, device scale factor 1
- Source pixels: 852 × 1840, normalized with cover crop to 390 × 844
- Implementation pixels: 390 × 844
- State: mobile, safety message accepted, point selected, analysis completed, favorable result

**Findings**

- No remaining P0/P1/P2 finding. The implementation retains the selected map-first hierarchy, compact globe + CartoKob wordmark, navy result treatment, score, azimuth, safety reminder and bottom-sheet interaction.
- Fonts and typography: Marianne is close in character and weight to the source; hierarchy and small-label legibility are preserved.
- Spacing and layout rhythm: the national map remains the dominant surface. The sheet was reduced after the first comparison so it no longer consumes most of the mobile viewport.
- Colors and tokens: navy, white and semantic green/orange/red match the source intent with sufficient contrast.
- Image and asset fidelity: the live OpenStreetMap basemap and generated national relief raster replace the Val-d'Oise-only mock content intentionally. UI icons come from Phosphor; the circular score comes from the progress component rather than handcrafted art.
- Copy and content: the event date, 20:19 maximum, viewing bearing, percentage, horizon, weather and safety language are present. Geographic wording is updated to metropolitan France.

**Comparison history**

- Iteration 1: P1 — the first result sheet occupied roughly 58% of the viewport and pushed the map out of the center.
- Fix: reduced the mobile sheet to 48–51dvh, kept the score summary at its top, and left detailed content scrollable.
- Post-fix evidence: `design-qa-cartokob-comparison-final.png` shows the map occupying the majority of the usable screen while the result stays readable and reachable.

**Primary interactions tested**

- Opening safety dialog and acknowledgement.
- National map loading and responsive fit.
- Map click, visible loading state, completed score, bearing and horizon result.
- Console error check: none.

**Follow-up polish**

- P3: a future custom domain can replace the `pages.dev` address without changing the app.

final result: passed
