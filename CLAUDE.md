# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.6.201 npx expo start   # LAN dev server
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.6.201 npx expo start --ios  # iOS simulator
```

Always use `npx expo install <package>` — never `npm install` — when adding dependencies.

## Architecture

All logic lives in [App.tsx](App.tsx) (single-file until it approaches ~200 lines, then split into `components/` and `utils/`). POI data is in [data/locations.json](data/locations.json).

**Fog of war** — Fog tiles are generated dynamically around the player at runtime using `getUnvisitedTiles()`. Tile size is `0.005` degrees. Only tiles within `RENDER_RADIUS = 0.05` degrees of the player are rendered, so the fog works anywhere in the world (not Oslo-specific). Tile keys are integer-based: `"${iLat}_${iLng}"` where `iLat = Math.floor(lat / TILE_SIZE)`.

**Camera** — Locked to player position at all times (`scrollEnabled={false}`). Uses controlled `region` prop with fixed `CAMERA_DELTA = 0.015`. Player cannot pan away from their location.

**Location tracking** — `watchPositionAsync` runs on mount with `BestForNavigation` accuracy. Each new position reveals the current tile and checks for POI discoveries. Subscription cleaned up on unmount.

**Persistence** — Visited tile keys and discovered POI IDs are saved to `expo-file-system` (not AsyncStorage — v2 is incompatible with Expo Go). Files: `visitedTiles.json` and `discoveredPOIs.json` in `documentDirectory`. Loaded on startup before the position watcher starts.

**POI discovery** — A POI is discovered when the user comes within `0.0025` degrees (~200m) of it. Undiscovered POIs render as custom dark `?` markers (visible through fog to entice exploration). Discovered POIs render as standard markers with name and category.

**POI data schema** (`data/locations.json`):
```json
{ "id": 1, "name": "Operaen", "category": "kultur", "latitude": 59.9075, "longitude": 10.7530 }
```
Categories in use: `kultur`, `park`, `landemerke`, `museum`, `mat_drikke`, `restaurant`, `bar`

**HUD** — Bottom bar shows: tiles revealed / POIs discovered / POIs remaining.

## Constraints

- **Apple Maps only** — Google Maps is incompatible with Expo SDK 54 + New Architecture (`newArchEnabled: true`). Do not suggest switching.
- **No polygon holes** — Unstable on Apple Maps. The dynamic tile grid exists specifically to avoid this.
- **`customMapStyle` is unreliable on Apple Maps** — do not add it.
- **`@react-native-async-storage/async-storage` v2 breaks Expo Go** — use `expo-file-system/legacy` for persistence.
- New Architecture is enabled (`newArchEnabled: true` in app.json) — verify any new library is compatible.

## Simulator testing

Set custom GPS in simulator: **Features → Location → Custom Location**

Good test coordinates (central Oslo, near POI clusters):
- Karl Johans gate: `59.9133, 10.7389`
- Near Operaen + Munch: `59.9065, 10.7529`

## Planned features (not yet built)

- **XP system** — earn XP for discovering POIs and revealing tiles. Show XP and level in HUD.
- **Discovery notification** — popup/toast when a new POI is found, showing its name and category
- **Haptic feedback** — vibrate on POI discovery
- **POI category styling** — different marker colors/icons per category (`kultur`, `park`, `landemerke`, etc.)
- **Profile/stats screen** — total XP, level, tiles revealed, POIs found, progress toward completion
- **Leaderboard / sharing** — compare progress with friends or share a screenshot of your explored map
- **UI polish** — the app should feel like a game (Pokémon Go aesthetic), not a utility map

## Conventions

- Code in English, git commits in Norwegian.
- Claude is the coder, I am the pilot only.
