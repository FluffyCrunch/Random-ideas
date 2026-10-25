# <img src="../assets/icons/cloud-fog.svg" width="28" height="28" alt=""> Fog Mirror

**Live:** https://fog-mirror-fluffycrunch.netlify.app

Your camera turns into a fogged-up bathroom mirror. Wave your hand in front of the camera and the fog wipes away wherever it goes, then slowly creeps back. Water drips run down from the edges of your wipes.

## How to use

1. Open the live link (Chrome works best) and click **Breathe on it!**
2. Allow camera access.
3. Wave your hand at the camera to wipe the fog, or drag with your mouse or finger.

## Controls

| Control | What it does |
| --- | --- |
| **Wipe with** | Whole hand, all fingers, or just one finger |
| **Brush size** | How wide each wipe is |
| **Fog comeback** | How quickly the fog returns (0 = never) |
| <img src="../assets/icons/wind.svg" width="16" height="16" alt=""> **Fog it!** / <kbd>R</kbd> | Fog the whole mirror again |
| <img src="../assets/icons/camera.svg" width="16" height="16" alt=""> **Snap!** | Save a picture of the mirror |
| <img src="../assets/icons/eye.svg" width="16" height="16" alt=""> **Hide** / <kbd>H</kbd> | Fold the menu away |

## Tips

- Good lighting and your whole hand in view make tracking much more reliable.
- Sit about an arm's length from the camera.
- Everything runs in your browser; no video ever leaves your device.

## How it works

- The camera feed is drawn mirrored onto a canvas, with a blurred, brightened copy on top as the fog.
- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) finds your hands each frame. The palm and fingertips paint into a mask that cuts holes in the fog.
- The mask fades a little every frame, so the fog comes back on its own.

## Run it locally

The camera only works over `https` or `localhost`, so serve this folder rather than opening the file directly. From inside `fog-mirror`:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Hosted on Netlify. From the repo root:

```bash
netlify deploy --prod --dir fog-mirror --site f4a0d6a6-e8b3-4107-809a-ead75ea9442b
```
