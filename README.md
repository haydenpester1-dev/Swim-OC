# OC Freeway Rush

A 3D freeway driving game set on Orange County's freeway network. You're on the clock: weave through traffic, get into the right lane for each interchange, and take the correct exit before time runs out.

Runs in Safari or Chrome on any Mac, and on most desktop browsers. There's nothing to install and it works offline.

## Play

1. Download the repo (**Code → Download ZIP**) and unzip it.
2. Double-click **`index.html`**, or **`Play OC Freeway Rush.command`** to open it in Chrome. If macOS blocks the `.command` file, right-click it, choose **Open**, then **Open** again.
3. Pick a commute, **Random Commute**, or **Free Drive**.

## Controls

| Key | Action |
|---|---|
| W / ↑ | Gas |
| S / ↓ / Space | Brake |
| A D / ← → | Steer (change lanes) |
| Shift | NOS (near misses refill it) |
| C | Camera: chase, high chase, hood |
| M / Tab | Full map with your route |
| H | Horn |
| N | Sound on/off |
| R | Recenter in your lane |
| Esc / P | Pause |

On touch screens, on-screen buttons appear.

## The network

All eleven routes are modeled from their real alignments. Waypoints are latitude/longitude points at each interchange and major exit, and the game smooths a curve through them.

| Route | Name | Lanes |
|---|---|---|
| I-5 | Santa Ana / San Diego Fwy (San Clemente to Buena Park) | 5 |
| I-405 | San Diego Fwy (El Toro Y to Seal Beach) | 5 |
| SR-55 | Costa Mesa Fwy (Newport Beach to SR-91) | 4 |
| SR-57 | Orange Fwy (Orange Crush to Brea) | 4 |
| SR-22 | Garden Grove Fwy | 4 |
| SR-91 | Riverside Fwy | 5 |
| SR-73 | San Joaquin Hills Toll Rd | 3 |
| SR-133 | Laguna Fwy / Laguna Canyon Rd | 2 |
| SR-241 | Foothill Toll Rd | 3 |
| SR-261 | Eastern Toll Rd | 2 |
| SR-1 | Pacific Coast Hwy (Seal Beach to Dana Point) | 2 |

- Interchanges are generated wherever two routes cross or one ends at another: the Orange Crush (5/22/57), the El Toro Y (5/405), 405/55, 55/73, 57/91 and others. Each one gets connector ramps, flyovers and bridges.
- Distances are compressed 2.5× so a commute takes a few minutes. Speeds are real.
- Landmarks include the Big A at Angel Stadium, the Matterhorn, the Honda Center, the Irvine Spectrum wheel, the Great Park balloon, the Huntington Beach Pier and the Santa Ana Mountains.

## How interchanges work

- Overhead signs and the GPS panel tell you which lane to use.
- **Right-side connectors and exits:** a yellow-striped **EXIT ONLY** lane opens on the right. Be in it when it splits off.
- **Left-side connectors:** a lane opens on the left, next to the median (for example, I-5 north to I-405 north at the El Toro Y).
- **Where a freeway ends** (SR-55 at SR-91, SR-57 at the Orange Crush, and so on), your lane decides which way you go. The GPS lane diagram shows which lanes to use.
- If you miss a turn, the GPS reroutes you. A wrong surface-street exit loops you back onto the freeway, which costs time.
- At a county line or the end of a toll road, you're turned around.

## Scoring

- The par time depends on route length and the traffic setting.
- Near misses at speed score points and refill NOS. Chaining them builds a combo.
- Crashes cost time and damage. At 100% damage the car is totaled.
- Parked CHP cruisers ticket you if you pass at over 95 mph (−15 s).
- At the finish, time left, near misses and a clean-run bonus count toward your score. Best scores are saved in the browser.

Options: time of day (day / sunset / night), traffic (light / normal / rush hour) and graphics (high / low). Use **Low** on older Macs.

## Tech

- Plain JavaScript with [three.js](https://threejs.org) r158, bundled in `lib/` (MIT license). No build step.
- `js/data.js`: freeway waypoints, exits, missions and landmarks. Edit this file to add routes or exits.
- `js/network.js`: builds directional paths, finds interchanges, places exit-only lanes, builds connector geometry and the routing graph (Dijkstra) used by the GPS.
- `js/world.js`: road meshes, bridges, sound walls, neighborhoods, palms, coastline and mountains, all generated in code.
- `js/game.js`: driving physics, traffic AI (car-following with lane changes), signs, HUD, minimap, audio and menus.
