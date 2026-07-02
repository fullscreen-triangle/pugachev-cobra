# MEE Effects Reference — Leave Before You Arrive

Paste any of these `at` or `every` blocks into the DSL editor in the playground.
The player updates live as you type. All times are in seconds.

---

## How to "execute" the code — see effects live

There is **no run button**. The playground is a live IDE:

1. Open **http://localhost:3000/playground** (run `npx next dev` from the `web/` folder if it isn't running)
2. The DSL editor is on the left. The Remotion player is on the right.
3. **Edit anything in the editor → the player updates automatically** after a short debounce (~600ms).
4. Hit **play** in the player to watch the composition. Scrub the timeline bar to jump to any frame.
5. To try an effect, add an `at` line in the editor — e.g. `at 5s-8s: bw()` — and pause typing. The player will show it within a second.

The green **ok** indicator at the top of the editor means the DSL compiled without errors. A red indicator shows parse/check errors inline.

---

## How the DSL works

```
at 0s-43s:  bw()              ← apply to a time range
at 1s-5s:   text("hello")     ← text overlay for that window
every 5s for 0.8s: glitch()   ← repeat every N seconds
```

Effects inside a range are layered — you can stack as many as you like:

```
at 10s-14s: bw(), glitch(intensity: 0.3)
```

---

## Black & white

```
at 0s-43s: bw()
```

Remove it to let colour through on any segment:

```
at 0s-16s: bw()
at 20s-43s: bw()
```
(leaves 16s–20s in colour)

---

## Glitch

```
at 43s-50s: glitch(intensity: 0.6)
```

`intensity` 0.0–1.0. Higher = more chromatic shift and horizontal tear.

```
at 45s-46s: glitch(intensity: 0.9)
```

Pulse glitch every few seconds across the whole piece:

```
every 8s for 0.5s: glitch(intensity: 0.4)
```

---

## Text overlays

```
at 1s-5s:   text("do you happen to not be interested in a lot", color: "#ffffff")
at 17s-21s: text("is now the only thirst that should be quenched", color: "#ffffff")
at 26s-30s: text("is it necessary to make an entrance", color: "#ffffff")
at 46s-49s: text("leave before you arrive", color: "#ffffff")
at 48s-50s: text("the only solution is to arrive before you leave", color: "#ffffff")
```

Colour examples:

```
color: "#ffffff"    ← white
color: "#ff0000"    ← red
color: "#aaaaaa"    ← grey
```

---

## Scanlines

CRT-style horizontal scanlines over a time window:

```
at 10s-14s: scanlines()
at 43s-50s: scanlines()
```

Parameters (all optional):

```
at 10s-14s: scanlines(lineCount: 240, intensity: 0.5)
```

- `lineCount` — number of scan lines across the frame (default 480; lower = thicker lines)
- `intensity` — how dark the dark bands are, 0.0–1.0 (default 0.3)

Heavy CRT look:

```
at 43s-50s: scanlines(lineCount: 120, intensity: 0.6)
```

---

## Object detection — detect(person) + boxes()

Draws tracking bounding boxes around detected people for a time range:

```
at 4s-7s:  detect(person), boxes()
```

Use both on the same line — `detect(person)` marks the target, `boxes()` draws the UI:

```
at 20s-24s: detect(person), boxes()
at 30s-34s: detect(person), boxes()
```

The preview shows an animated placeholder box (green corners, confidence readout).
For the final render the detection pipeline runs frame-accurate inference.

---

## Combining effects on the same segment

```
at 43s-50s: glitch(intensity: 0.5), text("leave before you arrive", color: "#ffffff")
```

---

## Full working script (current version)

```
scene leave_before_you_arrive {

  audio("leave-before-you-arrive/face-off-clip.mp3")

  clip("leave-before-you-arrive/sequence/01_gibbon-01.mp4",        at=0s,  for=4s)
  clip("leave-before-you-arrive/sequence/02_beamon-01.mp4",        at=4s,  for=3s)
  clip("leave-before-you-arrive/sequence/03_powell-01.mp4",        at=7s,  for=3s)
  clip("leave-before-you-arrive/sequence/04_zoom-climb-01.mp4",    at=10s, for=4s)
  clip("leave-before-you-arrive/sequence/05_powell-last1s.mp4",    at=14s, for=1s)
  clip("leave-before-you-arrive/sequence/06_beamon-01-last1s.mp4", at=15s, for=1s)
  clip("leave-before-you-arrive/sequence/07_lufthansa-jump-02.mp4",at=16s, for=4s)
  clip("leave-before-you-arrive/sequence/08_beamon-02.mp4",        at=20s, for=4s)
  clip("leave-before-you-arrive/sequence/09_lufthansa-jump.mp4",   at=24s, for=6s)
  clip("leave-before-you-arrive/sequence/10_powell-01-full.mp4",   at=30s, for=4s)
  clip("leave-before-you-arrive/sequence/11_longjump-4to7.mp4",    at=34s, for=3s)
  clip("leave-before-you-arrive/sequence/12_beamon-02-full.mp4",   at=37s, for=6s)
  clip("leave-before-you-arrive/sequence/13_zoom-climb-02.mp4",    at=43s, for=7s)

  at 0s-43s:  bw()

  // object detection — beamon and powell sequences
  at 4s-7s:   detect(person), boxes()
  at 7s-10s:  detect(person), boxes()
  at 14s-15s: detect(person), boxes()
  at 15s-16s: detect(person), boxes()
  at 20s-24s: detect(person), boxes()
  at 30s-34s: detect(person), boxes()
  at 37s-43s: detect(person), boxes()

  // scanlines — zoom-climb segments
  at 10s-14s: scanlines()
  at 43s-50s: scanlines()

  at 1s-5s:   text("do you happen to not be interested in a lot", color: "#ffffff")
  at 17s-21s: text("is now the only thirst that should be quenched", color: "#ffffff")
  at 26s-30s: text("is it necessary to make an entrance", color: "#ffffff")
  at 45s-46s: glitch(intensity: 0.6)
  at 46s-49s: text("leave before you arrive", color: "#ffffff")
  at 48s-50s: text("the only solution is to arrive before you leave", color: "#ffffff")

}
```

---

## Clip reference

| # | Timeline | Label in player | Source file |
|---|----------|-----------------|-------------|
| 01 | 0–4s | gibbon — rooftop run | gibbon-01.mp4 first 4s |
| 02 | 4–7s | beamon — approach | beamon-01.mp4 first 3s |
| 03 | 7–10s | powell — stride | powell-01.mp4 first 3s |
| 04 | 10–14s | climb — ascent | zoom-climb-01.mp4 |
| 05 | 14–15s | powell — last step | powell-01.mp4 last 1s |
| 06 | 15–16s | beamon — last step | beamon-01.mp4 last 1s |
| 07 | 16–20s | lufthansa — leap | lufthansa-jump-02.mp4 |
| 08 | 20–24s | beamon — flight | beamon-02.mp4 first 4s |
| 09 | 24–30s | lufthansa — hang | lufthansa-jump.mp4 first 6s |
| 10 | 30–34s | powell — full run | powell-01.mp4 full |
| 11 | 34–37s | longjump — peak | longjump.mp4 4s–7s |
| 12 | 37–43s | beamon — landing | beamon-02.mp4 full |
| 13 | 43–50s | climb — cobra | zoom-climb-02.mp4 |

---

## Rendering to MP4

1. Open the playground at **http://localhost:3000/playground**
2. The scene compiles automatically — check the green "ok" in the editor header
3. Click **render mp4** in the bottom of the preview panel
4. Wait — rendering takes roughly 1–2× the video duration
5. When done, a **↓ download mp4** link appears — click it to save the file

The output lands in `renders/` at the project root.
