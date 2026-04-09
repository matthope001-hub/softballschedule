# ⚾ Hamilton Classic Co-Ed Softball League
### Schedule & Standings Manager — 2026 Season

A fully self-contained single-file web app for managing the Hamilton Classic Co-Ed Softball League. No server, no database, no installation — just open `index.html` in any browser.

**Live App → [matthope001-hub.github.io/softballschedule](https://matthope001-hub.github.io/softballschedule)**

---

## Features

### 📅 Schedule
- Auto-generates a full season schedule across all configured diamonds
- Enforces all diamond rules (D9 CrossOver only, D12 doubleheader, D5/D13/D14 single games)
- Guarantees every team faces every opponent exactly the configured number of times
- Unique game numbers in `#YYXXX` format (e.g. `#26001`)
- Filter schedule by team
- Export to **CSV/Excel**, **Print/PDF**, or **iCal (.ics)**

### 🏆 Standings
- Live standings update as scores are entered
- Full **Rule 10.0** tiebreaker logic:
  - a) Head-to-head points among tied teams
  - b) Winner of last regular-season matchup (walks back through results)
  - c) Coin toss
- Columns: Record · Win% · GB · Home · Away · RF · RA · Diff · Last 10 · Streak
- **TB** badge shown when a tiebreaker was applied

### 📊 Scores
- Enter final scores per game
- 🌧 **Weather cancellation button** — auto-applies 7–7 tie per Rule 8.0
- Run differential capped at +7 per game for standings

### 📈 Stats
- Games per team table
- Diamond usage (overall + per team)
- Head-to-head matrix with full team names (vertical headers, no side-scroll)
- CrossOver games column

### 📖 Rules
- Full **HCCSL Rules & By-Laws** built into the app
- Covers all 35+ rules including game rules, eligibility, standings, playoffs, ejections, equipment

### ⚙️ Settings
- Manage teams (up to 10)
- Manage diamonds (add, rename, toggle lights)
- Season dates, game nights, game times
- Times Faced setting (1× to 5×)
- Live Schedule Calculator shows required nights and games per team
- **All settings auto-save** — persist across browser sessions

---

## Teams

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
| CrossOver *(guest team — excluded from standings)* |

---

## Diamond Configuration

| Diamond | Lights | Type |
|---------|--------|------|
| Diamond 9 | 💡 Yes | CrossOver only (D9 runs every night) |
| Diamond 12 | 💡 Yes | Doubleheader — 6:30 + 8:15 H/A swap |
| Diamond 5 | 🌙 No | Single game — 6:30 PM only |
| Diamond 13 | 🌙 No | Single game — 6:30 PM only |
| Diamond 14 | 🌙 No | Single game — 6:30 PM only |

---

## Schedule Rules

- **D9** — CrossOver HOME vs league team AWAY at 6:30, same team HOME vs CrossOver AWAY at 8:15
- **D12** — Two league teams play at 6:30, then swap H/A at 8:15
- **D5 / D13 / D14** — One league game at 6:30 only (no lights = no 8:15)
- Every league team plays exactly **4 games per night** (1 CO + 1 DH + 2 appearances elsewhere)
- Default season: **May 19 – Sep 15, 2026 · Tuesdays · 2× faced = 18 nights · 22 games/team**

---

## Data Persistence

All data is saved automatically to `localStorage` — your schedule, scores, teams, diamonds, and season settings survive page reloads and browser restarts. Use the **🗑 Clear All Data** button in Settings to reset for a new season.

> **Note:** Data is stored in the browser on your device. It does not sync between devices. Use the CSV export to back up your scores.

---

## Tech Stack

- Pure **HTML + CSS + JavaScript** — zero dependencies, zero frameworks
- Single file (`index.html`) — works offline from `file://` or hosted on any static server
- `localStorage` for persistence
- Mobile-friendly responsive design

---

## League Info

**Turner Park, Hamilton · Tuesday Nights · 2026 Season**

Governed by the Hamilton Classic Co-Ed Softball League Rules & By-Laws (May 2025).
SPN rules apply except where HCCSL-specific rules override.

---

*Built for the Hamilton Classic Co-Ed Softball League. Wu-Tang ain't forever, but the schedule is.*
