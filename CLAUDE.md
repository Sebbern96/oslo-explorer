# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo run:ios
```

Always use `npx expo install <package>` — never `npm install` — when adding dependencies.

## Architecture

**App.tsx** — React Native shell. Handles GPS tracking, persistence, state, and renders a WebView + HUD overlay.

**utils/mapHtml.ts** — Exports `buildMapHtml(apiKey, poisJson)` which returns the full HTML string for the WebView. Contains all Google Maps JS logic.

**data/locations.json** — POI data.

**Map rendering** — Google Maps JavaScript API inside a `react-native-webview` WebView. This approach was chosen because Apple Maps (react-native-maps) renders its annotation layer above polygon overlays, making it impossible to hide map labels with fog. The WebView + Google Maps JS approach renders fog polygons above all map content.

**Fog of war** — Google Maps Polygon covering Norway (lat 55–73, lng 2–33) with circular holes cut out for visited tiles. Holes = revealed areas. Circles use 32 points, radius `TILE_SIZE * 0.5`, longitude-corrected for Mercator so circles look round on screen. **Do not use a world-spanning outer ring (lat ±85, lng ±180) — Google Maps treats lng -180→180 as zero distance (antimeridian), making the polygon degenerate.**

**Tile keys** — Integer-based: `"${iLat}_${iLng}"` where `iLat = Math.floor(lat / 0.005)`.

**Location tracking** — `watchPositionAsync` with `BestForNavigation` accuracy. Sends incremental messages to WebView: `{type:'position'}`, `{type:'tile', key}`, `{type:'poi', poiId}`. On WebView ready, sends full `{type:'state'}`.

**WebView ↔ React Native bridge**:
- RN → WebView: `webViewRef.injectJavaScript('window.handleMessage({...}); true;')`
- WebView → RN: `window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}))` on map init
- **Timing guard** — `mapReadyRef` in App.tsx gates all `send()` calls. Reset on `onLoadStart`, set on `onMapReady`. Prevents "handleMessage is not a function" errors from location events firing before the WebView page loads.

**Persistence** — `expo-file-system/legacy` (NOT AsyncStorage v2 — incompatible with Expo Go). Files: `visitedTiles.json`, `discoveredPOIs.json` in `documentDirectory`.

**POI discovery** — Within `0.0025` degrees (~200m). Undiscovered = dark `?` circle marker. Discovered = blue circle with first letter of name.

**HUD** — React Native View overlay (not inside WebView) showing Ruter / Oppdaget / Gjenstår.

## API Key

Stored in `.env` (gitignored) as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The `EXPO_PUBLIC_` prefix causes Metro to inline it at bundle time. Add iOS bundle ID restriction when building a standalone app.

## Constraints

- **No react-native-maps** — replaced by WebView + Google Maps JS
- **No AsyncStorage v2** — use `expo-file-system/legacy`
- **New Architecture enabled** (`newArchEnabled: true` in app.json) — verify new libraries are compatible
- **No Expo Go** — `react-native-webview` requires a development build. Use `npx expo run:ios`.

## Simulator testing

Custom GPS: **Features → Location → Custom Location**
- Karl Johans gate: `59.9133, 10.7389`
- Near Operaen + Munch: `59.9065, 10.7529`

## Planned features (not yet built)

- **XP system** — earn XP for discovering POIs and revealing tiles. Show XP and level in HUD.
- **Discovery notification** — popup/toast when a new POI is found, showing name and category
- **Haptic feedback** — vibrate on POI discovery
- **POI category styling** — different marker colors/icons per category
- **Profile/stats screen** — total XP, level, tiles revealed, POIs found, progress
- **Leaderboard / sharing** — compare with friends or share explored map screenshot
- **UI polish** — Pokémon Go aesthetic throughout

## Conventions

- Code in English, git commits in Norwegian.
