# 🍽️ Food Diary

A lightweight GitHub Pages app for quick food & drink logging. One-tap buttons for frequent items, synced across devices via GitHub Issues.

## Setup

1. Enable GitHub Pages: **Settings → Pages → Source: main branch, root (`/`)**
2. Visit your site at `https://jimmycalhoun.github.io/food-diary/`
3. On first visit, enter a [Personal Access Token](https://github.com/settings/tokens/new?scopes=repo&description=Food+Diary) with `repo` scope
4. The app auto-creates a `food-diary` labeled issue to store entries

## Features

- **Time-aware quick buttons** — shows relevant items based on time of day
- **Custom entries** — log anything not in your quick buttons
- **Cross-device sync** — entries stored as GitHub Issue comments
- **PWA installable** — add to home screen on mobile for app-like access
- **Export to CSV** — download your full log for analysis
- **Editable buttons** — add/remove/rename quick buttons in settings

## How it works

Each food/drink entry is posted as a comment on a dedicated GitHub Issue in this repo. The comment contains both human-readable text and a JSON payload for programmatic analysis. No server required — everything runs client-side.

## Active Trials

### ☕ No-Coffee Trial (LPR/Reflux)
- **Start date:** 2026-07-22
- **Duration:** 3–4 weeks (end ~2026-08-12 to 2026-08-19)
- **Goal:** Determine if coffee compounds (not caffeine alone) drive LPR symptoms (throat clearing, raspy voice, PND, Tums usage)
- **Rules:** No coffee of any kind (espresso, cold brew, drip). Caffeine via low-acid alternatives only.
- **Tracking:** Log all drinks + any Tums/antacid usage + symptom notes

## Data Analysis

Export your log as CSV and analyze with any tool (Excel, Python/pandas, ChatGPT, etc.) to identify patterns, triggers, or dietary issues.
