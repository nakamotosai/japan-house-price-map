# 日本房价地图 Phase 2 UX Refinement Plan

> **For agentic workers:** In Codex, use `superpowers:executing-plans` by default. Use `superpowers:subagent-driven-development` only when independent lanes exist and the user explicitly allows delegation or parallel agent work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Tokyo preview less cluttered and more readable by improving station label density, price visibility, legend behavior, and card dismissal.

**Architecture:** Keep the single-page map shell intact and fix behavior at the marker, panel, and legend layers. Use station metadata to decide which labels stay visible by default, and keep the rest of the UI changes local to the current frontend shell.

**Tech Stack:** React, TypeScript, MapLibre GL JS, Vite

---

### Task 1: Reduce default label clutter

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/public/data/tokyo/stations.json`
- Modify: `/home/ubuntu/codex/日本房价地图/src/types.ts`

- [ ] Step 1: Add marker label tiers to station data.
- [ ] Step 2: Ensure major Yamanote stations stay labeled while others become icon-first.

### Task 2: Put price directly on markers in price mode

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/src/lib/mapLayers.ts`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/TokyoMap.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/styles.css`

- [ ] Step 1: Add a compact marker price formatter.
- [ ] Step 2: Render name + price for major stations and icon/price-first markers for minor stations.

### Task 3: Reduce persistent UI obstruction

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/src/App.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/LegendCard.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/components/StationPanel.tsx`
- Modify: `/home/ubuntu/codex/日本房价地图/src/styles.css`

- [ ] Step 1: Stop showing the station card by default.
- [ ] Step 2: Make the legend auto-collapse.
- [ ] Step 3: Make blank-map clicks dismiss the station card.

### Task 4: Verify and publish

**Files:**
- Modify: `/home/ubuntu/codex/日本房价地图/README.md`

- [ ] Step 1: Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Step 2: Restart the Tailnet preview.
- [ ] Step 3: Update README and push the round.
