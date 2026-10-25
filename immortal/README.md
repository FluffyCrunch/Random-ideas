# IMmortal

**Live:** https://immortal-fluffycrunch.netlify.app

> *a love story with diminishing returns*

Oranus cannot die. When he falls, he rises again. But every time he rises, a little less of him comes back.

Tonight, they took Mantis. Fight your way through the outskirts, the market, the bridge and the tower to save her. There are no checkpoints, only the way forward.

## The twist on dying

You're immortal, so death never sends you back to the start. You get back up right where you fell, and the enemies you've already hurt stay hurt. But every death costs you:

| Death | Max HP | Damage |
| --- | --- | --- |
| Start | 100 | 10.0 |
| I | 85 | 8.5 |
| II | 73 | 7.2 |
| III | 62 | 6.1 |
| ... | keeps shrinking | keeps shrinking |

Your HP bar always shows your original 100, so the max HP you've lost stays crossed out and visible. The more you die, the more the enemies notice: *"Weren't you taller last time?"*

## The name

**IM**m**o**rtal reads as *immortal*, and also as **I'M MORTAL**.

The highlighted **m** and **o** are the two characters: **M**antis and **O**ranus. Put their names together and you get the praying mantis, the insect where the female kills the male. 🦗

## How to play

| Keyboard | Touch | Action |
| --- | --- | --- |
| ← → or A D | ◀ ▶ | Move |
| ↑, W or Space | ▲ | Jump (also clears thrown knives) |
| J or Z | HIT | Strike; tap repeatedly for a punch-punch-kick combo |
| K or X | HVY | Heavy strike: slow, but staggers anything |
| L or Shift | ROLL | Dodge roll through attacks |
| P or Esc | II | Pause |
| M | | Sound on or off |

**Tips**
- An enemy that **glows** with a **!** above it is about to strike. Roll or back off.
- Brutes and the Warden shrug off light hits; use your heavy strike or the combo's final kick to stagger them.
- You can knock thrown knives out of the air with a strike.
- Stuck? Die. You'll come back weaker, but the enemies won't heal.

## Enemies

- **Grunts:** quick, masked, and they come in groups
- **Throwers:** hooded, keep their distance and throw knives
- **Brutes:** big, slow, and they hit hard
- **The Warden:** keeper of the tower, with a crushing slam and a charging dash

## How it's made

- One HTML file with no images or audio files. Everything is drawn on a `<canvas>` and every sound is made with the Web Audio API.
- The characters are stick-figure rigs posed with joint angles, so every animation (walking, punching, the dodge roll, Mantis' reveal) is generated in code.
- The noir look comes from a strict black-and-white palette, parallax layers, rain, film grain and a vignette.
- The ending dialogue changes based on how many times you died, and quotes your actual final stats back at you.

## Run it locally

From inside `immortal`:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Hosted on Netlify. From the repo root:

```bash
netlify deploy --prod --dir immortal --site immortal-fluffycrunch
```
