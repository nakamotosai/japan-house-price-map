# 日本房价地图 Phase 3 Official Station Master Plan

> **For agentic workers:** In Codex, use `superpowers:executing-plans` by default. Use `superpowers:subagent-driven-development` only when independent lanes exist and the user explicitly allows delegation or parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-curated station coordinates with an official Tokyo station master generated from MLIT datasets, while keeping the current map usable even when some metrics are still missing.

**Architecture:** Treat official station geometry and ridership as the new base layer. Keep the current curated station file only as a small override layer for already-written price/land/hazard copy. Generate the actual frontend `stations.json` from `official master + curated overrides`.

**Tech Stack:** React, TypeScript, Vite, Python standard library

---

### Task 1: Introduce generated station data flow

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/scripts/build_tokyo_station_master.py`
- Create: `/home/ubuntu/codex/日本房价地图/public/data/tokyo/stations.seed.json`
- Modify: `/home/ubuntu/codex/日本房价地图/public/data/tokyo/stations.json`

- [ ] Step 1: Move the current hand-written stations into a durable seed override file.
- [ ] Step 2: Download and parse `N02-24` and `S12-24`.
- [ ] Step 3: Build a Tokyo-core official station master and generate the frontend station payload.

### Task 2: Make the frontend tolerate partial metric coverage

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/src/types.ts`
- Modify: `/home/ubuntu/codex/日本房价地图/src/lib/mapLayers.ts`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/TokyoMap.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/StationPanel.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/IntroOverlay.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/styles.css`

- [ ] Step 1: Add metric coverage flags to station data.
- [ ] Step 2: Render missing price/land/hazard data as neutral placeholders instead of fake values.
- [ ] Step 3: Update copy so users can understand which layers are official and which are still pending.

### Task 3: Update app data naming and tests

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/src/App.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/hooks/useTokyoSeedData.ts`
- Modify: `/home/ubuntu/codex/日本房价地图/src/lib/search.ts`
- Modify: `/home/ubuntu/codex/日本房价地图/src/lib/search.test.ts`

- [ ] Step 1: Rename data usage away from “seed only” wording where the app now uses official station data.
- [ ] Step 2: Keep search and station selection stable with the larger dataset.
- [ ] Step 3: Adjust tests to match the new station shape.

### Task 4: Verify and publish

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/README.md`

- [ ] Step 1: Run the builder and inspect generated station counts and coverage.
- [ ] Step 2: Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Step 3: Restart the Tailnet preview and verify the live URL.
- [ ] Step 4: Update README, commit, and push.
