# Prototypes — the CURRENT design direction (overrides older mockups)

Open these in a browser. They are working HTML (three.js r128 from cdnjs), not app code.

| File | What it is | Use it for |
|---|---|---|
| `mobile-app.html` | Clickable mobile app, 8 screens: Boshlash (splash), Bosh sahifa (home), Dars (lesson), Qahramonlar (8 tutors), Progress, Savol (quiz), A'lo! (success), Sozlamalar (settings) | **Source of truth for the app UI**: light lavender background `#e8edfb`, phone bg `#f3f6fe`, white cards r=22, primary blue `#2f6bff`, subject colours (Algebra blue, Geometriya green `#22b45a`, Funksiyalar orange `#ff8a1f`, Ehtimollar purple `#8a5cf6`), Nunito 700–900, bottom tabs (Bosh sahifa · Darslar · Progress · Sozlamalar). |
| `board-handwriting.html` | Full lesson stage: choose-tutor screen in the classroom + 3D voxel tutor who talks, turns to the board, writes stroke-by-stroke with an IK arm, and handles "Savol berish" interrupts | **Source of truth for the lesson experience** (handwriting engine, tutor turn/walk/IK, interrupt flow, 8-character voxel builder `makeChar(cfg)` + `CHARS` configs). |

Characters: all 8 tutors (Blokbek, Agent Shox, Ziyo, Lola, Sardor, Ravshan, Diyorbek, Shadow) are built by `makeChar(cfg)` in both files. Use the same builder in the app (three.js) to render: live 3D in the lesson, and pre-rendered PNG portraits (offscreen render → cache) for cards, avatars, splash, success. Later the team will replace portraits with Blender renders: load `/characters/<id>_<pose>_<frame>.png` if it exists, else fall back to the three.js render (the prototype already does this via `window.TO2_RENDERS`).
