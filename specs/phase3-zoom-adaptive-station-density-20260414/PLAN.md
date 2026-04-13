# 日本房价地图 Phase 3.1 Zoom Adaptive Station Density Plan

> **For agentic workers:** In Codex, use `superpowers:executing-plans` by default. Use `superpowers:subagent-driven-development` only when independent lanes exist and the user explicitly allows delegation or parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce visual clutter by making station marker density adapt to zoom level instead of rendering the full station set at every zoom.

**Architecture:** Keep the current DOM-marker approach, but add a visibility policy layer driven by map zoom and station importance. Recompute marker visibility on initial render and on zoom changes.

**Tech Stack:** React, TypeScript, MapLibre GL JS, Vite

---

### Task 1: Define station visibility policy

**Files:**
- Create: `/home/ubuntu/codex/日本房价地图/src/lib/stationVisibility.ts`
- Create: `/home/ubuntu/codex/日本房价地图/src/lib/stationVisibility.test.ts`

- [ ] Step 1: Classify stations into display priority bands.
- [ ] Step 2: Map zoom ranges to visible bands.
- [ ] Step 3: Preserve always-visible rules for major stations and price-covered stations.

### Task 2: Apply zoom-driven visibility in the map

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/TokyoMap.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/styles.css`

- [ ] Step 1: Track marker entries instead of a bare marker array.
- [ ] Step 2: Recompute marker visibility and marker content on zoom changes.
- [ ] Step 3: Keep selected stations visible even if they would normally be hidden.

### Task 3: Verify and close out

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/README.md`

- [ ] Step 1: Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Step 2: Restart Tailnet preview and verify the live URL.
- [ ] Step 3: Update README, commit, and push.
