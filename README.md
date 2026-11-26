# krakatau-ring-run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/mrjopi/krakatau-ring-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/mrjopi/krakatau-ring-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Krakatau Ring Run** — fly the KR-7 bush plane around a living volcano in the Sunda Strait, 1883. Thread twelve glowing rings on a clockwise course around the island, stretch your fuel, and grease a touch-and-go on the beach runway. Fast, low and smooth wins — the mountain does not forgive.

A complete 3D browser flight game (Three.js, no build step, no network):

- **Fly**: bank and steer with arrows or mouse, climb/dive, W/S throttle; chase, cockpit and tracking cameras (C)
- **Course**: 12 glowing rings around Krakatau — each is +100 pts, +6 s and fuel; finish all twelve for a +500 bonus
- **Survive**: fuel drains with throttle, 3 lives, crash on terrain or sea; land on the beach runway for +250 and a refuel
- **Instruments**: airspeed, altitude, heading, compass strip, artificial horizon, minimap, throttle/fuel gauges, 150 s sortie timer, best score saved locally
- **World**: procedural volcano island — crater, lava, smoke, beach, palms, fishing village, lighthouse, clouds, sea — with procedural WebAudio engine, wind and ring chimes (M to mute, P to pause)

## Run it

```sh
npx serve game        # then open http://localhost:3000
# or: python3 -m http.server 8000 --directory game
```

`main.ts` is the make.fun hand-in program: `node main.ts` copies `game/` and `screenshots/` into `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fmfbn67x&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
