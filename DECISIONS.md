# Decisions

## Gut Run

- **Canvas and HTML.** Canvas draws the scrolling tunnel, obstacles, and player in a 360 × 640 coordinate system with a 720 × 1280 backing buffer. HTML keeps the tutorial, mute, replay, and clickouts as browser controls. The art scales uniformly to the visible viewport, and on taller phones its colors and tap area extend to the screen edges.
- **Collision.** Alpha masks follow the visible artwork. The player's mask is scaled to 70% of the sprite, and the tunnel edges allow a slightly larger graze. The debug view draws these same masks in their collision positions.
- **Course.** Each run places every obstacle once. The shuffle balances bacteria with text, limits consecutive words to two, and leaves more horizontal space between obstacles that require a change in height. The first pair leaves room to get used to the jump, while the scroll speed ramps from 65 to 110 design pixels per second.
- **Playback and replay.** Physics advances in fixed steps. Tab visibility and ad visibility suspend the game and audio. The first tap unlocks one Web Audio context, and the fail cue can play independently of the crash clip. Replay clears the previous run and shows the new course before starting. Endcard buttons appear after 850 ms and accept taps that begin on a visible button.

## Fireplace

- **Backgrounds.** I chose the pre-cut exports because they preserve the product placement and keep the rock inside the top banner, as shown in `layout.png`. At each join, two 44 px strips sample adjacent parts of the same moss image. The 16 px nearest each edge are fully shared, with a fade into the panel's own crop. The preview places the creatives flush to show the continuous texture.
- **Separate creatives and timing.** The banner runs at 1032 × 250 CSS px and each skyscraper at 320 × 975 CSS px. The preview scales the three iframes as one layout. It sends a shared start time with `postMessage` after the frames load, while each creative starts independently when opened directly.
- **Motion.** The intro takes about 4.5 seconds. Overlapping CSS masks reveal the supplied headline one line at a time and feather its baked shadow. The product packs stay fixed in the background exports. After the intro, a shared light sweep crosses both joins and the CTAs pulse. Both effects end at 29.5 seconds. Reduced motion shows the final layout immediately.

## Asset weight

- Gut Run is about **1.45 MB**. The shipped images and audio retain their supplied encodings, including the manually corrected tap cue. Unused exports are excluded.
- Fireplace is about **1.99 MB**, including its 331 kB debug reference. The creative assets retain their supplied encodings. The layout mockup was encoded as WebP at its original dimensions to keep the reference small, and the preview fetches it only in debug mode.
