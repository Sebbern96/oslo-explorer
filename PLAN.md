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
- [x] `hooks/useAuth.ts` — signIn, signUp, signOut, fetchCloudProgress, uploadProgress, fetchLeaderboard
- [x] `components/AuthModal.tsx` — email/password/username modal, sign in / sign up toggle
- [x] `components/ProfileModal.tsx` — shows email + "Logg ut" when signed in
- [x] Mandatory auth gate on startup — no key button, app blocked until signed in
- [x] Progress merge on login: union of tile keys/POI IDs, max XP
- [x] Auto-upload on every tile/POI discovery via `onProgressChange` callback
- [x] `user_progress` table created with RLS (own write, all authenticated read for leaderboard)
- [x] `username` column added to `user_progress`

### Stage 8 — Map & gameplay polish ✅
- [x] **Hide undiscovered markers under fog** — only show `?` markers in already-revealed tiles
- [x] **Smaller reveal radius** — reduced from `TILE_SIZE * 0.5` to `TILE_SIZE * 0.35`
- [x] **Zoom level** — increased default map zoom 15 → 16
- [x] **POI tap sheet** — tap any marker to see name, category, discovered status
- [x] **UI details** — safe-area insets, transit markers hidden, road number shields hidden
- [ ] **Haptic feedback** — vibrate on POI discovery (`expo-haptics`) — low priority

### Stage 9 — Social & progression 🔄
- [x] **Global leaderboard** — `LeaderboardModal` with top 20 by XP, medals for top 3, highlights current user
- [x] **Username on sign-up** — collected in AuthModal, stored in Supabase via uploadProgress
- [x] **Achievements** — 13 milestone unlocks across tiles, discoveries, visits and levels; green toast on unlock; shown in Prestasjoner tab in profile; synced to Supabase
- [x] **Friends** — follow by username or invite link; `friendships` table; friends leaderboard filter

### Stage 10 — POI engagement 💡
- [x] **"Vært her" — visited vs. discovered** — Two separate states per POI: auto-discovered by proximity (current), and manually marked as visited by tapping "Jeg var her" in the POI detail sheet. Extra XP for visited. Stored as separate column in Supabase (`visited_poi_ids`). Marker styling differs (e.g. solid fill = visited, ring only = discovered).
- [x] **POI comments** — Logged-in users can leave a short text comment (max 200 chars) on any discovered POI. `poi_comments` table with RLS. Comments load on sheet open, refresh after post. Sheet is scrollable with KeyboardAvoidingView.
- [ ] **POI photos** — Take or pick a photo of a POI from the detail sheet using `expo-image-picker` (camera). Upload to Supabase Storage. Show thumbnail(s) in the POI detail sheet. Requires `npx expo install expo-image-picker` (verify New Architecture compatibility).
- [ ] **Friends feed** — Chronological activity feed showing what friends have done: discovered a POI, visited a place, left a comment, uploaded a photo. `feed_events` table (user_id, type, poi_id, created_at). Shown in a new Feed modal/screen accessible from the HUD.

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

**~93% complete** — core gameplay, UI, bydel system, auth, leaderboard, visited state, achievements, redesigned profile, friends system, and Space Grotesk styling done. Next: Stage 10 (comments, photos, friends feed).

---

## Next actions

1. **POI photos** — `expo-image-picker` camera; Supabase Storage upload; thumbnails in POI detail sheet (requires `npx expo run:ios` rebuild)
2. **Haptic feedback** — `npx expo install expo-haptics`, vibrate on POI discovery (batch with photos rebuild)
3. **Friends feed** — `feed_events` table; new Feed screen showing friend activity
4. **Real-device testing** — connect iPhone via USB, run `npx expo run:ios --device`

---

## ✅ Fixed bug — Comment username shows as "Anonym"

**Root cause:** `user_progress` lacked SELECT/INSERT/UPDATE grants for the `authenticated` role, so all DB reads/writes silently failed. Users who signed in (not signed up) on a device had no `user_progress` row and no cached username anywhere.

**Fix:** Added `GRANT SELECT, INSERT, UPDATE ON public.user_progress TO authenticated` in Supabase. `postComment` now resolves username via a chain: state → DB → AsyncStorage → `Alert.prompt` (creates the row on first use).

---

## ✅ Fixed bug — Dark map on first login

**Root cause:** `injectJavaScript` silently fails on WKWebView cold launch, so state sent via `onMapReady` never reached the WebView's JS context.

**Fix:** State is now embedded directly in the WebView HTML source (`buildMapHtml` accepts `InitialMapState`). The WebView only renders after disk + cloud data is merged (cloud has a 3s timeout), so `initMap` runs with the correct `visitedKeys`/`discoveredPOIs`/`visitedPOIs` already set — no `injectJavaScript` needed for initial state. `onMapReady` still sends a full state resync as a safety net for mid-session WebView reloads.

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
