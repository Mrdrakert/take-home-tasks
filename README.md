# Frontend take-home

Two rich-media ads built with plain HTML, CSS, and JavaScript. See [DECISIONS.md](DECISIONS.md) for the implementation and asset choices.

## Run locally

From the repository root, run the following with Python 3 installed.

```sh
python -m http.server 8000
```

On Windows, `run_server.bat` starts the same server from the repository root.

Alternatively, 
```sh
npx http-server . -p 8000
```
can be run with Node.

- [Gut Run](http://localhost:8000/variant-a-game/) is a portrait tap-to-jump game. Tap to start and jump, or use Space or ↑ during play. Clear all 15 obstacles to win. On the fail card, **Nochmal spielen** previews a fresh course and waits for the next tap. The [hitbox view](http://localhost:8000/variant-a-game/?debug=1) highlights the shapes used for collision.
- [Fireplace preview](http://localhost:8000/variant-b-fireplace/preview.html) shows the three creatives together. Refresh to replay the intro. The [design overlay](http://localhost:8000/variant-b-fireplace/preview.html?debug=1) holds the final layout and lets you toggle the reference at 50% opacity. The [top](http://localhost:8000/variant-b-fireplace/top.html), [left](http://localhost:8000/variant-b-fireplace/left.html), and [right](http://localhost:8000/variant-b-fireplace/right.html) creatives also run individually.

## Verification

- **Gut Run** was played on a real phone and checked with Playwright in Chrome at 320 × 568, 360 × 640, and 430 × 932. Browser checks covered both outcomes, replay, audio and visibility changes, clickouts, and reduced motion. A scripted player found a winning route through 500 seeded courses using the game's physics and collision code.
- **Fireplace** was checked with Playwright in Chrome at native and scaled preview sizes. Checks covered the synchronized intro, the light sweep at both moss joins, the 29.5-second cutoff, reduced motion, the design overlay, and clickout from each creative.

## Known differences and shortcuts

- The Fireplace banner uses the supplied headline image, whose wording and line breaks differ from `layout.png`. The difference is visible in the debug overlay.
- The product packs are baked into the side backgrounds, so they stay in place while the logos, text panels, CTAs, and light animate.
- Both variants read `window.clickTag` from the host and fall back to `https://example.com/landing` for local previews.

## With another 2–4 hours

- Repeat the audio, browser-toolbar, and viewport checks on more phones, then check Fireplace in desktop Safari and Firefox.
- Turn the browser checks into a small repeatable smoke suite, including a fixed set of seeds to catch changes in course playability.

## AI note

I used Codex to help build and refine both creatives, inspect the supplied assets, and write Playwright checks for Chrome. I also played Gut Run on my phone and reviewed the Fireplace preview. The first AI-generated Fireplace layout used the full moss image and differed meaningfully from the example. I decided to follow it closely, and we switched to the pre-cut exports with matched moss strips at the joins.
