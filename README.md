[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/ibnuyau/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/ibnuyau/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Palmera Bay — Streets of the Sun

An open-world crime game in the spirit of GTA 6, built for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.
Everything in it is original: the city of Palmera Bay, its people, its
cars and bikes, its story and its sounds — nothing from any commercial game.

## The story

Milo Reyes came back to Palmera Bay with an empty wallet and a debt to
the wrong people. Carmen Solis, the fixer who runs the marina bars, has
six jobs for him: steal a car, run a sunset delivery, collect stashed
cash, shake off the police, pull one last score at the marina — and then
win Tio Ray's sunset street race across the whole city. The whole city
is open — its avenues, its beach, its traffic, its traffic lights, and
its police. How Milo gets through it is up to you.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and play in desktop Chrome. No network needed —
the game runs entirely from its own files.

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Mouse drag | Look around (camera follows behind while driving) |
| E | Steal / enter a car or bike, exit a vehicle |
| Q | Draw / holster pistol |
| Left click | Shoot (when armed) |
| F | Punch |
| Shift | Sprint |
| Space | Handbrake |
| G | Open Tio Ray's garage (near the orange awning) |
| M | Toggle minimap zoom |
| Esc / P | Pause (progress saves automatically) |

Progress — money, mission, position, health and garage upgrades — saves
to localStorage automatically and can be continued from the start screen.

## Features

- **Open city**: a sun-soaked coastal city on an avenue grid — downtown towers, a central park with benches and a pond, a market, a marina with docks, and a beach with palms and umbrellas. The sun travels a full day/night cycle: mornings are bright, sunsets go orange, and nights turn the streetlights on.
- **On foot, by car, and by bike**: walk the sidewalks or steal any parked or traffic car — or one of the street bikes by the beach avenue, faster and twitchier than any car — with arcade handling, handbrake and off-road slowdown.
- **Traffic and pedestrians**: 12 traffic cars and 2 traffic bikes looping the avenues, stopping at red lights at the five big intersections and turning at crossings, plus 24 pedestrians strolling the sidewalks who run when you scare them — and fresh faces wander in when the crowd thins out.
- **Wanted system**: 1–5 stars for theft, assault, shootings and hit-and-runs. Police cruisers chase and ram you; foot officers chase and arrest you on foot. At 3 stars and up the department sets roadblocks ahead of you — two cruisers across the road with a spike strip between them. Drive over the strip and your tires are shredded until you crawl clear. Stay hidden and quiet and the heat fades.
- **Busted and wasted**: arrested and you pay a fine; knocked out and you wake up at the Beachside Cafe, lighter in the wallet.
- **Six chained story missions** from Carmen Solis, with a yellow beacon, objective text and distance on the HUD, a timed delivery, cash-bag pickups, a lose-the-cops escape, a final marina score — and a sunset street race: five checkpoints across town against one clock.
- **Tio Ray's garage**: spend mission money on real upgrades — engine tunes for top speed, armor plating that cuts all damage, and run-flat tires that halve spike-strip slowdowns. Upgrades stay with Milo and apply to any vehicle he drives.
- **Combat**: punch up close, or draw the pistol and shoot.
- **HUD and minimap**: money, health bar, wanted stars, live minimap with roads, traffic, police, roadblocks, traffic-light states and the mission marker, speedometer with vehicle type and upgrade level while driving, and a zoomed-in map mode (M). Race checkpoints show live progress and the clock.
- **Start screen, pause, garage shop and save/load**, plus synthesized sound: engine hum (bikes whine higher than cars), police sirens, gunshots, race checkpoint beeps, spike-strip rips, the garage cash register, pickups, mission jingles and a laid-back bass loop — all WebAudio, no audio files.

## Tech

- three.js (vendored minified build under `game/vendor/`) for 3D, plain ES modules, no build step.
- Game code is split by job: `world.js` (city, traffic lights, day/night props), `vehicles.js` (cars, bikes and traffic), `pedestrians.js`, `player.js` (walk/drive/combat, upgrades), `police.js` (wanted system, roadblocks, spike strips), `missions.js` (story, race checkpoints), `hud.js` (HUD and zoomable minimap), `audio.js` (synth sound), `input.js`, `main.js` (loop, camera, day/night, garage shop, save).
- `main.ts` (Node 22, standard library only) validates the entry point and screenshots, copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library.
- `cdp.mjs` drives headless Chrome for Testing over CDP to take screenshots and run interaction tests (steal car/bike, garage purchase, roadblock and spike strip, full street race, save/load, pause).

## Screenshots

1. `1-start.jpg` — start screen over the city.
2. `2-play.jpg` — driving through Palmera Bay with HUD and minimap.
3. `3-mission.jpg` — the Sunset Grand Prix: Milo on a bike at the first race checkpoint.
4. `4-wanted.jpg` — a three-star police chase with a roadblock ahead.

## License

MIT — see `LICENSE`.
