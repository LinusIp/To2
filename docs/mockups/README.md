# Mockups — source of truth for the UI

Live canvas (team): https://claude.ai/artifact/H3mU9qcfDgd76MRFyuTw5k
These `.dc.html` files are the same mockups as plain HTML/SVG with inline styles. **Read them for exact layout, colours, sizes and copy.** They are design references, not app code — rebuild them as React components (Tailwind + motion) following CLAUDE.md.

| File | Screen | Notes |
|---|---|---|
| WebLesson.dc.html | Web lesson, 1440×900 | Scene layers: Scene bg → Board at (532,162,696,435) → Character → UI panels. Speech bubble top, steps right, voice bar bottom. |
| TabletLesson.dc.html | Tablet 1180×820, **interruption state** | Orange note layer on board, "SAVOLINGGA JAVOB" bubble, learner question bubble, paused step, Davom et / Yana tushuntir. |
| Main.dc.html | Mobile lesson 390×844 | Scene cropped around the board (scene 768×480 at left −276), character bottom-left, bubble, answer slots, big mic, tab bar. |
| Onboarding.dc.html | Mobile: choose tutor + grade | Locked tutors = silhouettes with XP cost. |
| Diagnostic.dc.html | Mobile: diagnostic expedition | Bridge = progress, question as blocks, "Bilmayman" button, no timer/penalty. |
| MobileRoadmap.dc.html | Mobile: roadmap world | Biomes = sections; tiles: mastered / current (pulsing, crane, character) / next (dashed) / locked. |
| Rig.dc.html | Character rig spec | Parts, pivots, emotions, mouth shapes, timings. |
| Tokens.dc.html | Design tokens & components | Colours, chalk meaning, type, buttons, step + tile states, motion. |
| Scene.dc.html / Character.dc.html / Board.dc.html | Building blocks | Classroom bg (viewBox 1440×900), voxel character (props who/size/emotion/talking), chalk board (lesson quad/frac, note layer). |

`{{…}}`, `<sc-if>`, `<dc-import>` and the `<script type="text/x-dc">` block are mockup-tool syntax — ignore them, just read the visuals.
