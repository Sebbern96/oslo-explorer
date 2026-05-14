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
| `hooks/useAuth.ts` | Supabase auth — signIn/signUp/signOut, cloud progress fetch/upload |
| `utils/supabase.ts` | Supabase client with AsyncStorage session persistence |
| `components/AuthModal.tsx` | Sign in / sign up modal |
| `components/ProfileModal.tsx` | Slide-up profile sheet with stats, category breakdown, account row |
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

### Stage 7 — Authentication & cloud sync ✅
- [x] Supabase project set up (`bfdtuxibqynjcxbxyglp.supabase.co`)
- [x] `utils/supabase.ts` — client with AsyncStorage session persistence
- [x] `hooks/useAuth.ts` — signIn, signUp, signOut, fetchCloudProgress, uploadProgress
- [x] `components/AuthModal.tsx` — email/password modal, sign in / sign up toggle, Norwegian UI
- [x] `components/ProfileModal.tsx` — shows email + "Logg ut" when signed in, hint when not
- [x] Auth button (🔑/☁️) in top-right alongside profile button
- [x] Progress merge on login: union of tile keys/POI IDs, max XP
- [ ] **Auto-upload on discovery** — call `uploadProgress` after each tile/POI save (currently only on sign-in)
- [ ] **Supabase table** — create `user_progress` table in Supabase dashboard if not done

### Stage 8 — Map & gameplay polish ⬜
- [ ] **Hide undiscovered markers under fog** — only show `?` markers in already-revealed tiles; fixes clutter and preserves mystery
- [ ] **Smaller reveal radius** — reduce from `TILE_SIZE * 0.5` to `TILE_SIZE * 0.35` for tighter reveals
- [ ] **Zoom level** — increase default map zoom 15 → 16 for street-level feel
- [x] **POI tap sheet** — tap any marker to see name, category, discovered status
- [x] **UI details** — safe-area insets
- [ ] **Haptic feedback** — vibrate on POI discovery (`expo-haptics`) — low priority

### Stage 9 — Social & progression ⬜
- [ ] **Global leaderboard** — query `user_progress` ordered by XP desc; needs `username` column in Supabase; show in `LeaderboardModal`
- [ ] **Achievements** — milestone unlocks (first discovery, 10 tiles, all museums, all bydeler etc.); store unlocked IDs in Supabase; show in profile modal
- [ ] **Friends** — follow by username or invite link; `friendships` table; friends leaderboard filter — build after global leaderboard

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
- [x] Sign in / sign up (Supabase)
- [x] Cloud progress sync on login

---

## Progress

**~80% complete** — core gameplay, UI, bydel system, profile, auth, and POI tapping done. Next: map polish, leaderboard, achievements, friends.

---

## Next actions

1. **Hide undiscovered markers under fog** — in `mapHtml.ts`, on marker creation check if the POI's tile key is in `visitedKeys`; if not, set `visible: false`. On `state` and `tile` messages, show/hide markers as tiles are revealed.
2. **Radius + zoom** — in `mapHtml.ts` change `TILE_SIZE * 0.5` → `TILE_SIZE * 0.35` and default zoom `15` → `16`
3. **Global leaderboard** — add `username` text column to `user_progress` in Supabase; collect username on sign-up; build `LeaderboardModal` querying top 20 by XP
4. **Achievements** — define milestone list in code; check on each XP/tile/POI update; persist unlocked IDs to Supabase; show in profile modal
5. **Friends** — `friendships` table (user_id, friend_id); add/remove friends by username; filter leaderboard by friends

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
