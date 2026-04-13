# 日本房价地图 Phase 1 Implementation Plan

> **For agentic workers:** In Codex, use `superpowers:executing-plans` by default. Use `superpowers:subagent-driven-development` only when independent lanes exist and the user explicitly allows delegation or parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable single-page Tokyo map tool with an open-source map stack, station anchors, a Google-Maps-inspired layout, and five switchable data modes.

**Architecture:** Use a Vite React TypeScript app with MapLibre GL JS and a raster base map from Japan's GSI tiles. Keep the UI as one page and isolate future growth behind a station index, a mode registry, and reusable layer data definitions so later datasets can be attached without rewriting the page shell.

**Tech Stack:** React, TypeScript, Vite, MapLibre GL JS, Vitest

---

### Task 1: Initialize the frontend project baseline

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/package.json`
- Create: `/home/ubuntu/codex/日本房价地图/tsconfig.json`
- Create: `/home/ubuntu/codex/日本房价地图/tsconfig.app.json`
- Create: `/home/ubuntu/codex/日本房价地图/tsconfig.node.json`
- Create: `/home/ubuntu/codex/日本房价地图/vite.config.ts`
- Create: `/home/ubuntu/codex/日本房价地图/index.html`
- Create: `/home/ubuntu/codex/日本房价地图/.gitignore`
- Create: `/home/ubuntu/codex/日本房价地图/src/main.tsx`

- [ ] Step 1: Scaffold a Vite React TypeScript app in the project directory.
- [ ] Step 2: Install runtime dependencies and dev dependencies, including `maplibre-gl` and `vitest`.
- [ ] Step 3: Verify the base app builds before custom map logic is added.

### Task 2: Define the core domain model for stations and modes

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/src/types.ts`
- Create: `/home/ubuntu/codex/日本房价地图/src/data/stations.ts`
- Create: `/home/ubuntu/codex/日本房价地图/src/data/modes.ts`
- Create: `/home/ubuntu/codex/日本房价地图/src/lib/search.ts`
- Test: `/home/ubuntu/codex/日本房价地图/src/lib/search.test.ts`

- [ ] Step 1: Write a failing test for station search behavior.
- [ ] Step 2: Implement typed station data and mode metadata.
- [ ] Step 3: Implement station search helpers and run tests until passing.

### Task 3: Build the single-page shell

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/src/App.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/components/TopSearchBar.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/components/LeftRail.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/components/ModeChips.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/components/StationPanel.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/components/LegendCard.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/components/IntroOverlay.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/styles.css`

- [ ] Step 1: Build the static Google-Maps-inspired shell with edge-aligned controls.
- [ ] Step 2: Wire search, mode selection, intro overlay, and station panel state.
- [ ] Step 3: Keep the UI text and information architecture aligned with the project positioning.

### Task 4: Integrate MapLibre and layer switching

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/src/components/TokyoMap.tsx`
- Create: `/home/ubuntu/codex/日本房价地图/src/lib/mapLayers.ts`

- [ ] Step 1: Initialize MapLibre with the Tokyo viewport and a GSI raster source.
- [ ] Step 2: Render station markers and support click-to-select behavior.
- [ ] Step 3: Add switchable overlays for station-based modes, school points, and hazard polygons.
- [ ] Step 4: Connect map layer visibility to the mode registry.

### Task 5: Verify, document, and close the first round

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/README.md`

- [ ] Step 1: Run unit tests with `vitest`.
- [ ] Step 2: Run `npm run build`.
- [ ] Step 3: Update README with the implemented status and any current limits.
- [ ] Step 4: Commit and push the initial project if GitHub remote creation succeeds.
