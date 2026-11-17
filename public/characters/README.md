# Tutor renders (Blender)

Drop PNGs here named `<id>_<pose>_<frame>.png` and run `pnpm build` (it regenerates
`src/config/characterRenders.json`). Any file listed there replaces the in-browser three.js portrait.

- id: blokbek, agent-shox, lola, ziyo, sardor, ravshan, diyorbek, shadow
- pose: idle, wave, point, thumbs, cheer
- frame: full (300×380), half (300×300), face (120×120) — export at 2× (600×760, 600×600, 240×240), transparent background


## Current art (team reference)
`<id>_sig_{full,half,face}.png` are cut out from the team's character reference sheet (the final look).
All `<id>_<pose>_<frame>.png` UI files are copies of the signature art, so every screen shows the exact designed character.
`blender/` holds procedural Blender renders (`tools/blender/to2_characters.py`) — only a fallback; the live 3D lesson tutor is three.js.
