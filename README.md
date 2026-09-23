# Agent Town — Player Workshop

The first building block of a retro, Dwarf Fortress-inspired world: a reproducible player object with **head, hat, and body**, rendered from the front, back, left, and right.

## Run

Requires Node.js 20 or later. No dependencies or package install.

```sh
npm start       # http://127.0.0.1:4173
npm test        # deterministic rendering and export checks
npm run build   # dist/player-workshop.html — open directly in a browser
```

The standalone build works offline. The development page optionally loads Google Fonts; system fonts are the fallback.

## The generator

This is a procedural generator, with no image service, AI model, or API key. It creates a small voxel model with parametric anatomy, facial hair, garments, headwear, and accessories. Four orthographic camera projections turn that **one model** into 48 × 48 pixel sprites. A feature is generated once in character space, so the feather, face, satchel, and rear hair remain on the correct side. An opaque palette and one-pixel silhouette keep every exported pixel sharp.

The current visual vocabulary is intentionally compact: 4 facial-hair styles, 5 headwear styles (including none), 4 outfits, 5 clothing palettes, 5 skin tones, 6 hair colors, plus geometry/detail variations. This is the initial player asset system; world simulation and gameplay are not included.

Use seeds for repeatable starting characters, select styles and palettes, reroll a single part, or lock parts when generating another player. Locks protect random generation; deliberate style/palette edits still apply. Clothing colors stay fixed during generation when hat or body is locked. Skin tone is shared by head and body and stays fixed when either is locked. Save a JSON recipe to preserve all edits: the original seed alone only reproduces the original generated character. Imports validate values before rendering and do not change lock settings.

## Asset contract

Export produces a ZIP with these files:

| Path | Content |
| --- | --- |
| `player.png` | Transparent 192 × 48 sheet: front, back, left, right |
| `parts/head.png`, `parts/hat.png`, `parts/body.png` | Complete isolated parts in the same frame registration |
| `layers/head.png`, `layers/hat.png`, `layers/body.png` | Visible pixels of each part, including its outline, reconstructing this exact player |
| `player.json` | Versioned editable recipe and frame metadata |
| `README.txt` | Import and compositing notes |

Every frame has a 48 × 48 registration box and a foot anchor at `(24, 43)`. Scale with nearest-neighbor filtering. The visible layers reconstruct the exported player pixel for pixel. When swapping parts, rerender the shared model: isolated complete parts can occlude each other differently in each direction, so a fixed 2D layer order cannot replace depth testing.

## Use in a game

```js
import { createPlayer, renderPlayer, generatePart } from './src/generator.js';

const player = createPlayer('COPPER-005');
player.parts.hat = generatePart('hat', 'MY-NEW-HAT');
const frame = renderPlayer(player, 'left');
ctx.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
```

`generator.js` is independent of the DOM and canvas. Cache generated frames in the game; there is no need to rerender every tick. The generator also accepts a four-phase pose index for future walking integration; the current workshop and exports use a standing pose.

## Verification

The test suite checks reproducibility, recipe validation, independent parts, every combination of the current style families (320 directional renders) for clipping and binary alpha, lossless PNG decoding with Node's zlib, ZIP checksums, manifest paths, and exact reconstruction from visible layers. Browser checks cover style selection, directions, palette selection, locks, reroll, seed generation, responsive layout, and export actions.

The sprite art, geometry rules, PNG writer, and ZIP writer are generated locally from this repository's code. Nothing is uploaded by the workshop.
