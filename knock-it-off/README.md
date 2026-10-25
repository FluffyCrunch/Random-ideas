# <img src="../assets/icons/cat.svg" width="28" height="28" alt=""> Knock It Off!

A 3D game about gravity. You're **Mr. Biscuit**, a ginger cat home alone with a living room full of breakable things, right up until your human wanders in. Knock mugs, vases, cakes and a fishbowl off the shelves for chaos points before time runs out, without getting caught.

This one is a proper game-dev project, not a single HTML file: **Three.js** for 3D rendering, **cannon-es** for rigid-body physics, **Vite** for the dev server and build, and separate ES modules for each part of the game.

## How to play

**Goal:** cause **$2,500** of damage in **2:30**. Get caught three times and you're grounded.

| Control | Action |
| --- | --- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Move (relative to the camera) |
| <kbd>Shift</kbd> | Sprint |
| <kbd>Space</kbd> | Jump; press again in mid-air for a double jump |
| Left click or <kbd>F</kbd> | Swat whatever is in front of you |
| <kbd>C</kbd> (hold) | Sit and look innocent |
| <kbd>Q</kbd> | Meow, to lure your human over |
| Move the mouse | Look around: the camera follows your mouse |
| Mouse wheel | Zoom the camera in and out |
| <kbd>Esc</kbd> / <kbd>M</kbd> | Pause and free your mouse / sound on and off |

The game captures your mouse when a round starts, so there's nothing to hold down. Press <kbd>Esc</kbd> to get your cursor back (this also pauses), and click **Back to the crime** to jump back in. If your browser won't capture the mouse, holding the right mouse button and dragging, or the arrow keys, still turn the camera.

**Tips**
- Things break when they hit something hard enough. Light items like mugs shatter from a short fall; plants and laptops need a longer drop.
- Chain breaks within 3 seconds for a combo multiplier, up to x3.
- Your human has a vision cone and **furniture blocks their view**. Hide behind the sofa or the kitchen island.
- Every crash makes you look guiltier (the cyan bar). Sit still to cool down. A guilty cat in plain view is a caught cat.
- Meow to pull your human across the room, then sprint to the other side and cause trouble. Be sure you look innocent when they arrive.
- Getting caught costs 10% of your damage and sends you back to the sofa.

## How it works

| File | What it does |
| --- | --- |
| `src/game.js` | The game itself: rules, scoring, combos, breakage, camera, the main loop |
| `src/world.js` | The living room: furniture with physics colliders, lights, floor and rug textures, the owner's walkway graph |
| `src/props.js` | Everything breakable: models, physics shapes, damage value, break threshold |
| `src/cat.js` | Mr. Biscuit: physics body, camera-relative movement, double jump, sitting, procedural animation |
| `src/owner.js` | The owner's AI: patrol, hearing, vision cone with line-of-sight, chase, catch, being lured |
| `src/effects.js` | Shards, splashes and puddles, drawn with a single instanced mesh |
| `src/audio.js` | Every sound and the music, synthesised with the Web Audio API (no audio files needed), plus the cat's voice and the owner's shouts |
| `src/ui.js`, `src/style.css` | HUD, popups, speech bubbles and overlays |

A few details worth knowing:
- **Physics:** cannon-es runs at a fixed 60 Hz step. Props are rigid bodies that fall asleep when still and wake on contact. A prop breaks when its impact speed along the contact normal passes its threshold.
- **The owner's eyes:** a cone check plus a raycast against the furniture. Their suspicion rises while they can see a guilty cat and drains when they can't.
- **Pathing:** a small hand-built graph of walkable points with breadth-first search, laid out so no straight edge crosses furniture.
- **Models:** every character and object is built in code from primitive shapes, so there are no model or texture files.

## Sound

- **Meows** come in four kinds (a classic meow, a kitten mew, a rolling "mrrow" and a long yowl). Each is a buzzy voice pushed through vowel-like resonances that glide from "ee" to "ah" to "oo", with vibrato and a little breath. Press <kbd>Q</kbd> to hear one.
- **Purring** is built the way a real purr works: about 25 rough pulses a second that swell and fade with each breath. The cat purrs on its own when it sits looking innocent, and while it's being petted.
- **The owner yells** when something breaks ("Ack!", "Whoa!", "Oh no!", and "GERALD!" if the fishbowl goes). He uses your browser's built-in text-to-speech voice, so what you hear depends on the voices installed on your computer. If there isn't one, he makes a synthesised grunt instead. The same word also pops up over his head.

### Using real cat recordings

The cat sounds are synthesised, not recorded. If you'd rather use real ones, put your own `.mp3`, `.ogg` or `.wav` files in `public/sounds/` and list them in `public/sounds/manifest.json`:

```json
{
  "meow": ["meow1.mp3", "meow2.mp3"],
  "purr": ["purr.mp3"]
}
```

The game picks a random meow each time (with a slight pitch variation) and loops the purr recording for as long as it needs. Leave the lists empty to keep the synthesised sounds. Make sure you have the right to use any recordings you add, especially in a public repo.

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints (http://localhost:5173 by default).

## Build for production

```bash
npm run build
```

This writes the finished game to `dist/`, which is what gets deployed. `npm run preview` serves that build locally.
