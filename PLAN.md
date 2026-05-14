# Oslo Explorer — Project Plan

> **Instructions for Claude:** At the end of every session, update this file — tick completed items, update the progress %, and revise "Next actions". Always read this file at the start of a new session before doing anything else.

---

## General overview

A React Native fog-of-war exploration game for Oslo. The player physically walks around the city, revealing the map and discovering POIs. Pokémon Go aesthetic. No Expo Go — development build only (`npx expo run:ios`).

**Stack:** React Native + TypeScript + Expo SDK 54, react-native-webview (Google Maps JS API), expo-location, expo-file-system/legacy  
**Branch:** `google-maps-webview`  
**Run:** `npx expo run:ios`  
**Data refresh:** `node scripts/fetchPOIs.js`

---

## Architecture snapshot

| File | Responsibility |
|---|---|
| `App.tsx` | UI shell — WebView, HUD, notification toast, profile button |
| `hooks/useGameLoop.ts` | GPS tracking, tile/POI detection, XP, persistence, bydel detection |
| `utils/mapHtml.ts` | Builds the full Google Maps JS HTML string |
| `utils/geo.ts` | Point-in-polygon + nearest-centroid fallback for bydel detection |
| `components/ProfileModal.tsx` | Slide-up profile sheet with stats and category breakdown |
| `data/locations.json` | 743 POIs with id, name, category, lat, lng, bydelId |
| `data/bydeler_runtime.json` | 17 Oslo bydeler with simplified polygons for runtime PIP |
| `data/bydeler.json` | Full-resolution bydel polygons (script use only, not bundled in app) |
| `scripts/fetchPOIs.js` | Fetches POIs + bydel boundaries from OSM Overpass API |

---

## Implementation stages

### Stage 1 — Core engine ✅
- [x] Google Maps JS inside WebView (replaced react-native-maps)
- [x] Fog-of-war: Norway bounding polygon with circular tile holes
- [x] GPS tracking with `watchPositionAsync`
- [x] Tile detection and fog reveal
- [x] WebView ↔ RN bridge with `mapReadyRef` timing guard
- [x] Persistence: visitedTiles, discoveredPOIs, xp via expo-file-system/legacy

### Stage 2 — POI system ✅
- [x] 743 POIs from OpenStreetMap (via `scripts/fetchPOIs.js`)
- [x] Undiscovered: dark marker with category-colored border + `?`
- [x] Discovered: full category color fill + first letter
- [x] Category colors: landemerke 🟠, museum 🔵, park 🟢, kultur 🟣, mat_drikke 🟡, restaurant 🔴, bar 🩷

### Stage 3 — XP & progression ✅
- [x] XP: 10/tile, 50/POI
- [x] Levels 1–10 with thresholds `[100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]`
- [x] `computeLevel` + `xpProgress` helper functions

### Stage 4 — UI polish ✅
- [x] HUD: level badge, XP progress bar, bydel name, local Oppdaget/Gjenstår
- [x] Discovery toast: gold-bordered card with fade animation
- [x] Player marker: CSS-animated pulsing ring via `OverlayView` (floatPane)
- [x] Profile modal: level badge, XP bar, 4-stat grid, per-category progress bars
- [x] Profile button: 👤 floating button top-right
- [x] Dark map style (custom Google Maps styling)

### Stage 5 — Bydel system ✅
- [x] `scripts/fetchPOIs.js` fetches 17 Oslo bydeler from OSM with full geometry
- [x] Point-in-polygon assignment of each POI to a bydel (+ centroid fallback)
- [x] `utils/geo.ts` for runtime bydel detection
- [x] HUD shows current bydel name + local stats
- [x] Profile modal shows global totals

### Stage 6 — Refactor ✅
- [x] Game loop extracted to `hooks/useGameLoop.ts`
- [x] `App.tsx` is ~160 lines of pure UI

### Stage 7 — Remaining features ⬜
- [ ] **Haptic feedback** — vibrate on POI discovery (`expo-haptics`)
- [ ] **Sharing** — share screenshot of explored map or summary card
- [ ] **Leaderboard** — compare progress with friends (needs backend or third-party)
- [ ] **Profile improvements** — per-bydel completion breakdown in profile modal
- [ ] **UI details** — safe-area insets (replace hardcoded `top: 60`, `bottom: 44`)

---

## Checklist

- [x] App runs on iOS simulator
- [x] Fog of war works and reveals on movement
- [x] POIs discoverable and persist across restarts
- [x] XP and levels update correctly
- [x] Profile modal opens and shows correct data
- [x] Bydel changes as player moves
- [x] Discovery toast animates in/out
- [x] Custom location testing works in simulator
- [ ] Haptic on POI discovery
- [ ] Sharing flow

---

## Progress

**~85% complete** — core gameplay loop, UI, bydel system, and profile all done. Remaining items are enhancements (haptics, sharing).

---

## Next actions

1. **Haptic feedback** — `npx expo install expo-haptics`, call `Haptics.notificationAsync(NotificationFeedbackType.Success)` inside `showNotification` in `App.tsx`
2. **Safe-area insets** — replace `top: 60` and `bottom: 44` with `useSafeAreaInsets()` from `react-native-safe-area-context` (already a transitive dependency via Expo)
3. **Per-bydel breakdown in profile** — group discovered POIs by bydelId, show completion per bydel in a scrollable list

---

## Known gotchas

- **No Expo Go** — `react-native-webview` requires a dev build. Always `npx expo run:ios`.
- **Fog polygon outer ring** — must NOT use ±180 lng (antimeridian collapses to zero distance). Use Norway bbox `[{lat:73,lng:2}…{lat:55,lng:2}]`.
- **mapReadyRef** — gates all `send()` calls. Reset on `onLoadStart`, set on `{type:'ready'}` from WebView.
- **expo-file-system/legacy** — not AsyncStorage v2 (incompatible).
- **OverlayView in floatPane** — player marker must be in `floatPane` to render above fog polygon.
- **Bydel polygon stitching** — OSM outer ring members aren't guaranteed head-to-tail, causing ~10% PIP misses. Centroid fallback covers these cases.
- **Overpass API mirrors** — `overpass.kumi.systems` sometimes returns HTML errors; script falls back to `overpass-api.de` and `lz4.overpass-api.de`.

---

## Simulator test coordinates

| Location | Lat, Lng | Triggers |
|---|---|---|
| Operaen cluster | `59.9065, 10.7529` | Operaen, Munch-museet, Deichmanske bibliotek |
| Karl Johans gate | `59.9133, 10.7389` | Karl Johans gate, Stortinget, Paleet |
| Grünerløkka | `59.9220, 10.7550` | Mathallen, Vulkan, Blå |
| Rådhuset | `59.9113, 10.7334` | Rådhuset only |
