# <img src="../assets/icons/gamepad-2.svg" width="28" height="28" alt=""> Hand Pong

**Live:** https://hand-pong-fluffycrunch.netlify.app

Classic Pong, but your hand is the controller. Hold your hand up to the webcam and move it up and down to move your paddle. Beat the CPU to 7 points. No camera? You can play with the mouse or a finger on a touchscreen instead.

## How to play

1. Open the live link (Chrome works best).
2. Pick <img src="../assets/icons/hand.svg" width="16" height="16" alt=""> **Play with my hand** (allow camera access) or <img src="../assets/icons/mouse.svg" width="16" height="16" alt=""> **Use the mouse**.
3. Your paddle is the blue one on the right. Move your hand (or the mouse) up and down to block the ball.
4. First to 7 wins.

## Controls

| Control | What it does |
| --- | --- |
| Hand / mouse up & down | Move your paddle |
| <kbd>P</kbd> / <kbd>Esc</kbd> / <img src="../assets/icons/pause.svg" width="16" height="16" alt="pause button"> | Pause and resume |
| <kbd>M</kbd> / <img src="../assets/icons/volume-2.svg" width="16" height="16" alt="sound button"> | Sound on or off |

## Game feel

- **Aim with your paddle:** hitting the ball near the edge of your paddle sends it off at a steep angle, while hitting it in the middle sends it straight back.
- **Rallies speed up:** the ball gets a little faster with every hit, and the screen shakes harder the longer the rally lasts.
- **The CPU gets better:** the more points you score, the faster the CPU paddle moves. It isn't perfect, so it sometimes misjudges the ball.
- **Comic-style hit effects:** POW!, BAM! and ZAP! pop up on hits, along with particle bursts, a ball trail and squash-and-stretch on the ball and paddles.
- **No sound files:** every beep is made in the browser with the Web Audio API.

## Tips

- Keep your whole hand in view with decent lighting.
- You don't need to reach the very top or bottom of the camera. The middle 80% of the frame covers the whole court.
- The game pauses on its own when you switch tabs.

## How it works

- A single `<canvas>` draws everything, with your mirrored camera dimmed in the background so you can see your hand.
- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) tracks the centre of your palm each frame. The paddle eases toward that height so it feels smooth rather than jittery.
- The ball moves in small sub-steps each frame, so even at top speed it can't slip through a paddle.
- Everything runs in your browser; no video ever leaves your device.

## Run it locally

The camera only works over `https` or `localhost`. From inside `hand-pong`:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Hosted on Netlify. From the repo root:

```bash
netlify deploy --prod --dir hand-pong --site f771d0d9-0d4b-4d58-8bef-6189f48cafdc
```
