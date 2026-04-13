# 日本房价地图 Phase 2 Implementation Plan

> **For agentic workers:** In Codex, use `superpowers:executing-plans` by default. Use `superpowers:subagent-driven-development` only when independent lanes exist and the user explicitly allows delegation or parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Tokyo seed data into runtime JSON assets and publish a stable Tailnet-only preview URL for Windows access.

**Architecture:** Keep the current single-page map shell intact, but replace hardcoded in-bundle seed data with JSON files under `public/data/tokyo/` plus a runtime loader hook. Add one persistent preview process and one Tailnet HTTPS serve mapping so the app can be opened from other devices without relying on a local terminal session.

**Tech Stack:** React, TypeScript, Vite, MapLibre GL JS, Vitest, PM2, Tailscale Serve

---

### Task 1: Externalize seed data into runtime JSON assets

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/public/data/tokyo/stations.json`
- Create: `/home/ubuntu/codex/日本房价地图/public/data/tokyo/schools.json`
- Create: `/home/ubuntu/codex/日本房价地图/public/data/tokyo/hazards.json`
- Modify: `/home/ubuntu/codex/日本房价地图/src/types.ts`

- [ ] Step 1: Move current station, school, and hazard seed data into JSON files.
- [ ] Step 2: Adjust shared types only if needed so runtime JSON maps cleanly to the existing UI.

### Task 2: Add runtime data loading and loading/error states

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/src/lib/dataLoader.ts`
- Create: `/home/ubuntu/codex/日本房价地图/src/hooks/useTokyoSeedData.ts`
- Modify: `/home/ubuntu/codex/日本房价地图/src/App.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/StationPanel.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/lib/mapLayers.ts`
- Test: `/home/ubuntu/codex/日本房价地图/src/lib/dataLoader.test.ts`

- [ ] Step 1: Add tested JSON loading helpers.
- [ ] Step 2: Create one hook that loads the Tokyo seed bundle.
- [ ] Step 3: Switch the app from static imports to runtime data.
- [ ] Step 4: Show a minimal loading or error state instead of crashing.

### Task 3: Add a stable Tailnet preview path

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/package.json`
- Create: `/home/ubuntu/codex/日本房价地图/scripts/start_tailnet_preview.sh`
- Create: `/home/ubuntu/codex/日本房价地图/scripts/stop_tailnet_preview.sh`
- Modify: `/home/ubuntu/codex/日本房价地图/README.md`

- [ ] Step 1: Add a stable preview script that binds to a predictable local port.
- [ ] Step 2: Add helper scripts for PM2 preview startup and cleanup.
- [ ] Step 3: Wire Tailscale Serve to an HTTPS tailnet-only port.
- [ ] Step 4: Document the resulting URL and operator commands.

### Task 4: Verify, publish, and close

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/README.md`

- [ ] Step 1: Run tests, lint, and build.
- [ ] Step 2: Start the preview service.
- [ ] Step 3: Verify local HTTP and Tailnet HTTPS responses.
- [ ] Step 4: Commit and push the round.
