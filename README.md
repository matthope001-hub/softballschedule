# ⚾ Hamilton Classic Co-Ed Softball League
### Schedule & Standings Manager — 2026 Season

A full-featured web app for managing the Hamilton Classic Co-Ed Softball League. No server required — hosted on GitHub Pages with cloud sync via JSONBin so every device sees the same live data.

**Live App → [matthope001-hub.github.io/softballschedule](https://matthope001-hub.github.io/softballschedule)**

---

## Features

### 📅 Schedule
- Auto-generates a full season schedule across all configured diamonds
- Enforces all diamond rules (D9 CrossOver only, D12 doubleheader lit, D5/D13/D14 single 6:30 only)
- Guarantees every team faces every opponent exactly the configured number of times (default 2×)
- Unique game numbers in `#YYXXX` format (e.g. `#26001`)
- Filter schedule by team via chip buttons
- Export to **CSV/Excel**, **Print/PDF**, or **iCal (.ics)**
- ⚠ **Sunset safety warnings** — amber/red badges on nights where no-lights diamonds (D13/D14) may be unsafe to finish a 6:30 PM game

### 📋 Scores
- Enter final scores per game
- 🌧 **Weather cancellation** — auto-applies 7–7 tie per Rule 8.0
- Run differential capped at +7 per game for standings purposes
- Scores auto-save to the cloud instantly

### 🏆 Standings
- Live standings update as scores are entered
- Full **Rule 10.0** tiebreaker logic:
  - a) Head-to-head points among tied teams
  - b) Winner of last regular-season matchup (walks back through results)
  - c) Stable coin toss (consistent within a session)
- Columns: # · Team · Record · Win% · GB · Home · Away · RF · RA · Diff · Last 10 · Streak
- **TB** badge shown when a tiebreaker was applied to determine a position
- CrossOver excluded from standings (guest team)

### 🏆 Playoffs
- Seeded automatically from final regular season standings
- **POD A (Top 5):** Round Robin (10 games) → 5th eliminated → Semi-Finals (1v4, 2v3) → Final
- **POD B (Bottom 4):** Round Robin (6 games) → Semi-Finals (1v4, 2v3) → Final
- Live pod standings update as playoff scores are entered
- Semi-Finals and Final unlock automatically as rounds complete
- 🏆 Champion banner on completion
- **📅 Schedule playoff games** — assign date, time, and diamond to any playoff game; scheduled games appear in Schedule and Scores tabs tagged with a 🏆 badge
- Playoff scores excluded from regular season standings

### ✏️ Edit Games
- Shows all 20 season weeks — scheduled games and open slots side by side
- Edit home/away team, diamond, and time on any scheduled game
- 🗑 Delete any game (admin PIN + confirmation) — slot remains available
- Open slots show team dropdowns + **+ Add** button to fill them in
- Month accordion headers show **OPEN** count in amber when unscheduled slots exist
- Sunset safety warnings shown on relevant dates

### 📈 Stats
- **Games Played / Games Left** at a glance
- ⚡ Season Highlights: Most Runs Scored, Best Defense, Most Wins, Most Losses, Avg Runs/Game, Shutouts, Total Runs, Biggest Win, Highest Scoring Game
- Games per team table (total, home, away, doubleheader nights)
- Diamond usage (overall + per team matrix)
- Head-to-head matchup matrix

### 📖 Rules
- Full **HCCSL Rules & By-Laws** built into the app
- Covers all 35+ rules: game rules, eligibility, standings, playoffs, ejections, equipment

### ⚙️ Settings
- Manage teams (up to 10)
- Manage diamonds — toggle lights on/off where infrastructure exists; D13/D14 permanently locked (no lights infrastructure)
- Season start/end dates, game nights, game times
- Times Faced setting (1× to 5×)
- Live Schedule Calculator
- Generate Schedule and Clear All Data buttons (admin PIN required)

---

## Teams — 2026

| Team |
|------|
| Kibosh |
| Alcoballics |
| Foul Poles |
| JAFT |
| Landon Longballers |
| One Hit Wonders |
| Steel City Sluggers |
| Pitch Don't Kill My Vibe |
| Wayco |
| CrossOver *(guest — excluded from standings)* |

---

## Diamond Configuration

| Diamond | Lights | Infrastructure | Usage |
|---------|--------|----------------|-------|
| Diamond 9 | 💡 ON | ✅ Capable | CrossOver only — DH 6:30 + 8:15 |
| Diamond 12 | 💡 ON | ✅ Capable | League DH — 6:30 + 8:15 H/A swap |
| Diamond 5 | 🌙 OFF | ✅ Capable | Single game — 6:30 PM only |
| Diamond 13 | 🚫 Locked | ❌ No infrastructure | Single game — 6:30 PM only |
| Diamond 14 | 🚫 Locked | ❌ No infrastructure | Single game — 6:30 PM only |

---

## Schedule Rules

- **D9** — CrossOver HOME vs league team AWAY at 6:30, same CO-opponent HOME vs CrossOver AWAY at 8:15
- **D12** — Two league teams at 6:30, then swap H/A at 8:15
- **D5 / D13 / D14** — One league game at 6:30 only (no lights = no 8:15 slot)
- Every league team plays every other team exactly **2× per season** (72 pair-slots total)
- **18 scheduled weeks** (May 19 – Sep 15) + **2 open weeks** (Sep 22, Sep 29) for manual games or makeups
- Season: **Tuesdays, May 19 – Sep 29, 2026**

### Sunset Safety (D13/D14)
No-lights diamonds must finish by 8:00 PM (6:30 start + 1h30m curfew). Warnings appear in Schedule and Edit Games:

| Date | Sunset | Status |
|------|--------|--------|
| Sep 1 and earlier | 7:49 PM+ | ✅ Safe |
| Sep 8 | 7:36 PM | ⚠ Low light (3 min margin) |
| Sep 15 | 7:23 PM | 🌙 Unsafe — dark 10 min before curfew |
| Sep 22 | 7:10 PM | 🌙 Unsafe — dark 23 min before curfew |
| Sep 29 | 6:56 PM | 🌙 Unsafe — dark 37 min before curfew |

---

## Playoffs Format

| POD | Teams | Round Robin | Elimination |
|-----|-------|-------------|-------------|
| POD A | Seeds 1–5 (top 5) | 10 games, each team plays 4 | 5th eliminated → Semi: 1v4, 2v3 → Final |
| POD B | Seeds 6–9 (bottom 4) | 6 games, each team plays 3 | Semi: 1v4, 2v3 → Final |

Seeded from final regular season standings. Playoffs held in October — dates and diamonds TBD.

---

## Data & Cloud Sync

All data syncs automatically to **JSONBin** (cloud) with `localStorage` as a fast local cache:

- Every device that opens the app loads the same live schedule, scores, and standings
- Changes save instantly to the cloud on any admin action
- **Admin PIN** (`2026`) required to: generate schedule, add/remove games, enter scores, seed playoffs
- Non-admins can view Schedule, Standings, Stats, and Rules freely

---

## File Structure

```
softballschedule/
├── index.html        # HTML structure — tabs, sections, layout (316 lines)
├── style.css         # All CSS — variables, components, responsive (311 lines)
├── data.js           # G state, constants, utils, tabs, teams, diamonds (335 lines)
├── persistence.js    # JSONBin save/load, admin PIN, localStorage (168 lines)
├── schedule.js       # Schedule generation, rendering, exports, scores (692 lines)
├── standings.js      # Standings table, tiebreakers, stats tab (406 lines)
├── edit.js           # Edit games tab, add/remove/assign games (193 lines)
└── playoffs.js       # Full playoffs — seeding, bracket, scheduling (361 lines)
```

---

## Tech Stack

- Pure **HTML + CSS + JavaScript** — zero dependencies, zero frameworks
- **JSONBin.io** for cloud persistence (free tier)
- GitHub Pages for hosting
- Mobile-friendly responsive design

---

## League Info

**Turner Park, Hamilton · Tuesday Nights · 2026 Season**

Governed by the Hamilton Classic Co-Ed Softball League Rules & By-Laws.
SPN rules apply except where HCCSL-specific rules override.

---

*Built for the Hamilton Classic Co-Ed Softball League. Wu-Tang ain't forever, but the schedule is.*
