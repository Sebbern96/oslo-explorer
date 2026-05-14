# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.6.201 npx expo start --reset-cache --ios
```

Always use `npx expo install <package>` — never `npm install` — when adding dependencies.

## Architecture

**App.tsx** — React Native shell. Handles GPS tracking, persistence, state, and renders a WebView + HUD overlay.

**utils/mapHtml.ts** — Exports `buildMapHtml(apiKey, poisJson)` which returns the full HTML string for the WebView. Contains all Google Maps JS logic.

**data/locations.json** — POI data.

**Map rendering** — Google Maps JavaScript API inside a `react-native-webview` WebView. This approach was chosen because Apple Maps (react-native-maps) renders its annotation layer above polygon overlays, making it impossible to hide map labels with fog. The WebView + Google Maps JS approach renders fog polygons above all map content.

**Fog of war** — Single world-covering Google Maps Polygon with holes cut out for visited tiles. Holes = revealed areas. Much more efficient than individual tile polygons. The entire world is dark by default; visited tiles become transparent holes.

**Tile keys** — Integer-based: `"${iLat}_${iLng}"` where `iLat = Math.floor(lat / 0.005)`.

**Location tracking** — `watchPositionAsync` with `BestForNavigation` accuracy. Sends incremental messages to WebView: `{type:'position'}`, `{type:'tile', key}`, `{type:'poi', poiId}`. On WebView ready, sends full `{type:'state'}`.

**WebView ↔ React Native bridge**:
- RN → WebView: `webViewRef.injectJavaScript('window.handleMessage({...}); true;')`
- WebView → RN: `window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}))` on map init

**Persistence** — `expo-file-system/legacy` (NOT AsyncStorage v2 — incompatible with Expo Go). Files: `visitedTiles.json`, `discoveredPOIs.json` in `documentDirectory`.

**POI discovery** — Within `0.0025` degrees (~200m). Undiscovered = dark `?` circle marker. Discovered = blue circle with first letter of name.

**HUD** — React Native View overlay (not inside WebView) showing Ruter / Oppdaget / Gjenstår.

## Current issue (pick up here)

The Google Maps WebView is showing the Google Maps Platform marketing site instead of the map. Root cause: `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is likely coming through as empty, causing the Maps JS API to redirect. A red debug bar was added to `mapHtml.ts` to show whether the key is populated — check if it says `KEY: EMPTY` or `KEY: AIzaSyB6...`. If empty, the env var pipeline is broken. Fix options:
1. Try `npx expo start --clear` instead of `--reset-cache`
2. Or read the key directly from a gitignored `secrets.ts` file as a fallback

## API Key

Stored in `.env` (gitignored) as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The `EXPO_PUBLIC_` prefix causes Metro to inline it at bundle time. No billing restrictions needed during Expo Go development — add iOS bundle ID restriction when building standalone app.

## Constraints

- **No react-native-maps** — replaced by WebView + Google Maps JS
- **No AsyncStorage v2** — use `expo-file-system/legacy`
- **New Architecture enabled** (`newArchEnabled: true` in app.json) — verify new libraries are compatible
- `react-native-webview` is compatible with Expo Go + New Architecture ✓

## Simulator testing

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.6.201 npx expo start --reset-cache --ios
```

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
