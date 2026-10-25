# <img src="../assets/icons/skull.svg" width="28" height="28" alt=""> IMmortal

**Live:** https://immortal-fluffycrunch.netlify.app

> *a love story with diminishing returns*

Orans cannot die. When he falls, he rises again. But every time he rises, a little less of him comes back.

Tonight, they took Mantis. Fight your way through the outskirts, the market, the bridge and the tower to save her. There are no checkpoints, only the way forward. Along the way, people keep trying to warn him about her.

## The twist on dying

You're immortal, so death never sends you back to the start. You get back up right where you fell, and the enemies you've already hurt stay hurt. But every death costs you:

| Death | Max HP | Damage |
| --- | --- | --- |
| Start | 100 | 10.0 |
| I | 85 | 8.5 |
| II | 73 | 7.2 |
| III | 62 | 6.1 |
| ... | keeps shrinking, down to 40 | keeps shrinking, down to 5.0 |

Your HP bar always shows your original 100, so the max HP you've lost stays crossed out and visible. The more you die, the more the enemies notice: *"Weren't you taller last time?"*

## The name

**IM**m**o**rtal reads as *immortal*, and also as **I'M MORTAL**.

The highlighted **m** and **o** are the two characters: **M**antis and **O**rans. Put their names together and you get the praying mantis, the insect where the female kills the male.

## The story

Between fights, the game cuts to manga-style cutscenes: animated close-ups, extreme eye shots, focus lines, split panels and impact frames.

- **The henchman:** a dying enemy in a cracked mask tells Orans that Mantis is not what he thinks she is.
- **The old woman:** a blind fortune teller in the market once read Mantis' palm, and saw three husbands before him.
- **The stranger:** a gaunt man chained to the bridge says he was her last husband, and he couldn't die either.
- **The tower:** Orans finally reaches her.

What Mantis says at the end depends on how many times you died, and she quotes your real final stats back at you.

## How to play

| Desktop | Touch | Action |
| --- | --- | --- |
| <kbd>A</kbd> <kbd>D</kbd> or <kbd>←</kbd> <kbd>→</kbd> | Left / right buttons | Move |
| <kbd>Space</kbd> or <kbd>↑</kbd> | Jump button | Jump (also clears knives and shockwaves) |
| Left click | HIT | Attack; click fast for a punch-punch-kick combo |
| Right click | HVY | Heavy attack: slow, but staggers anything and breaks shields |
| Ctrl | ROLL | Dodge roll; roll right as a hit lands for a **perfect dodge** |
| P or Esc | II | Pause |
| M | | Sound on or off |

Cutscenes play by themselves and ignore every key and click, so you can't skip one by accident. To skip, **hold Esc for 5 seconds** (on touch, hold the II button).

## It's hard on purpose

- Enemies **surround you**, and up to three can attack at once.
- An enemy that **glows** with a **!** above it is about to strike. Watch for it.
- **Perfect dodge:** roll just as an attack lands to slow time and stun the attacker.
- You can knock thrown knives out of the air with a strike.
- Stuck? Die. You'll come back weaker, but the enemies won't heal, and getting back up knocks everyone near you away.

## Enemies

- **Grunts:** quick, masked, and sometimes follow up with a second punch
- **Throwers:** hooded, keep their distance and sometimes throw two knives in a row
- **Guards:** carry a shield that blocks light hits from the front. Hit them with a heavy strike or the combo's final kick, or get behind them.
- **Brutes:** big and slow, and their slam sends shockwaves along the ground. Jump or roll over them.
- **The Warden:** keeper of the tower, with slams, dashes and three-hit combos. At half health he gets angry, speeds up and calls in backup.

## How it's made

- One HTML file with no images or audio files. Everything is drawn on a `<canvas>` and every sound is made with the Web Audio API.
- The fighters are full-bodied silhouettes built from tapered limbs on a jointed skeleton, so every animation is generated in code. Each figure is drawn twice: once in light and nudged toward the moon, then in black on top, which leaves a thin rim of moonlight along its edge.
- The cutscene faces are drawn in code too, in a manga style: screentone shading, expressive eyes with highlights, and mouths that move while a character is talking.
- The noir look comes from a strict black-and-white palette, parallax layers, rain, film grain and a vignette.

## Run it locally

From inside `immortal`:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Hosted on Netlify. From the repo root:

```bash
netlify deploy --prod --dir immortal --site 43e58b2f-cb73-4570-b960-cc611d14afd5
```
