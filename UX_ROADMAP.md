# HCCSL UX Enhancement Roadmap

**Document Purpose:** Strategic plan for improving user experience across the Hamilton Classic Co-Ed Softball League scheduler.

**Current State:** 8-tab application (Schedule, Standings, Playoffs, Champions, Stats, Park Map, Rules, Admin) with iOS-inspired design. Cloud-synced via JSONBin.

---

## Executive Summary

### Pain Points Identified

| Area | Issue | Impact | Priority |
|------|-------|--------|----------|
| **Loading** | No skeleton screens; blank/empty states on initial load | Users think app is broken | P0 |
| **Feedback** | Silent cloud saves; no visual confirmation | Users unsure if actions worked | P0 |
| **Mobile** | Tables overflow; small touch targets on phones | Frustrating mobile experience | P1 |
| **Navigation** | No way to jump to specific dates/weeks | Inefficient for large schedules | P1 |
| **Errors** | Alert() dialogs block interaction; no graceful recovery | Jarring error experience | P1 |
| **Empty States** | Generic "Generate a schedule" messages; no guidance | Lost first-time users | P0 |
| **Accessibility** | No ARIA labels; low contrast in places; no keyboard nav | Excludes some users | P2 |

---

## Phase 1: Critical UX (Week 1-2)

### 1.1 Loading States & Skeleton Screens

**Current Behavior:**
- App shows empty divs while data loads from JSONBin
- No visual indication that loading is in progress
- Users see "Add teams and generate a schedule" even when data is loading

**Proposed Solution:**
```javascript
// Add to persistence.js
function showLoadingState(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div class="skeleton-container">
      <div class="skeleton-header"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>
  `;
}

function hideLoadingState(containerId, content) {
  const container = document.getElementById(containerId);
  if (container) {
    container.style.opacity = '0';
    container.innerHTML = content;
    container.style.transition = 'opacity 0.2s ease';
    requestAnimationFrame(() => container.style.opacity = '1');
  }
}
```

**CSS Skeleton Styles:**
```css
.skeleton-container { padding: 20px; }
.skeleton-header { 
  height: 24px; 
  background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px; 
  margin-bottom: 16px; 
}
.skeleton-row { 
  height: 48px; 
  background: var(--surface2);
  border-radius: 8px;
  margin-bottom: 8px;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Implementation Tasks:**
- [ ] Add skeleton CSS to `style.css`
- [ ] Create `showLoadingState()` / `hideLoadingState()` utilities
- [ ] Apply to all major containers: `so`, `sto`, `sco`, `edi`, `sta`, `ply`
- [ ] Remove loading state only after `loadData()` completes

### 1.2 Enhanced Empty States

**Current:** Generic text like "Generate a schedule to enter scores"

**Proposed Contextual Empty States:**

| Tab | Current | Enhanced |
|-----|---------|----------|
| Schedule | "Add teams and generate..." | Show illustration + 3-step wizard hint |
| Standings | "// ENTER SCORES TO SEE STANDINGS //" | Show "Season hasn't started" or "First game: [Date]" |
| Scores | "Generate a schedule..." | CTA button: "Go to Admin → Generate Schedule" |
| Stats | "Generate a schedule..." | Mini stat preview with placeholder zeros |
| Playoffs | "Loading playoffs..." / "Seed playoffs..." | Explain playoff structure visually |

**New Empty State Component:**
```html
<div class="empty-state">
  <div class="empty-icon">📅</div>
  <h3>No Schedule Yet</h3>
  <p>Get started in 3 steps:</p>
  <ol class="empty-steps">
    <li>Go to <strong>Admin → Settings</strong></li>
    <li>Add your teams</li>
    <li>Click <strong>Generate Schedule</strong></li>
  </ol>
  <button class="btn btn-primary" onclick="showTab('admin'); unlockAdmin()">
    Open Admin Settings →
  </button>
</div>
```

### 1.3 Global Loading Indicator

**For cloud operations:**
- Add subtle spinner in header during JSONBin save/load
- Show "Syncing..." text that fades to "Saved" on completion
- Red indicator if sync fails

---

## Phase 2: Feedback Systems (Week 2-3)

### 2.1 Toast Notification System

**Current:** `showToast()` exists but is basic; some fallbacks use `alert()`

**Enhanced Toast Design:**
```css
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.toast {
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  animation: toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.toast.success { border-left: 3px solid var(--sys-green); }
.toast.error { border-left: 3px solid var(--sys-red); }
.toast.info { border-left: 3px solid var(--sys-blue); }

@keyframes toastIn {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

**Toast Usage Patterns:**
| Action | Toast Message | Duration |
|--------|--------------|----------|
| Score saved | "✓ Score saved — Kibosh 12, JAFT 8" | 3s |
| Cloud sync | "💾 Synced to cloud" | 2s |
| PIN unlock | "🔓 Admin mode enabled" | 2s |
| Error | "✗ Failed to save — retrying..." | 4s |
| Schedule gen | "✓ 48 games generated for 2026 season" | 4s |

### 2.2 Save State Indicators

**For score inputs:**
```css
.score-saved { border-color: var(--sys-green) !important; }
.score-saving { border-color: var(--sys-blue) !important; }
.score-error { border-color: var(--sys-red) !important; }
```

**Auto-save debounce pattern:**
```javascript
let saveTimeout;
input.addEventListener('input', () => {
  input.classList.add('score-saving');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveScore().then(() => {
      input.classList.remove('score-saving');
      input.classList.add('score-saved');
      setTimeout(() => input.classList.remove('score-saved'), 2000);
    });
  }, 500);
});
```

### 2.3 PIN Entry Enhancements

**Current:** Basic modal; no visual feedback per digit

**Proposed:**
- Add haptic-like visual feedback (button press animation)
- Shake animation on wrong PIN
- Progress dots fill as digits entered
- Auto-submit on 4th digit (already done)
- "Forgot PIN?" hint (show in console or hidden)

---

## Phase 3: Mobile Optimization (Week 3-4)

### 3.1 Responsive Tables

**Current:** Tables overflow on mobile; horizontal scroll

**Solutions:**
1. **Card view for mobile:** Convert table rows to cards under 600px
2. **Sticky columns:** Keep team name sticky; scroll stats
3. **Collapsible rows:** Tap to expand full stats

**Mobile Card Layout:**
```css
@media (max-width: 600px) {
  .st-wrap { display: none; }
  .st-mobile { display: block; }
  
  .team-card {
    background: var(--surface);
    border-radius: var(--r);
    padding: 16px;
    margin-bottom: 10px;
    box-shadow: var(--shadow-sm);
  }
  .team-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .team-card-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    text-align: center;
  }
}
```

### 3.2 Touch Target Improvements

**Current Issues:**
- Score inputs are 54px wide × 36px tall (borderline)
- Filter chips may be too small
- Tab bar requires precise tapping

**Minimum Touch Targets:**
- All interactive elements: 44×44px minimum
- Score inputs: Increase to 48px height
- Expand/collapse accordion headers: Full width tap target

### 3.3 Swipe Gestures (Future)

**Potential additions:**
- Swipe between tabs on mobile
- Swipe to delete games (with undo)
- Pull-to-refresh for cloud sync

---

## Phase 4: Navigation Enhancements (Week 4-5)

### 4.1 Quick Date Jump

**Current:** Scroll through entire schedule

**Proposed:** Add floating "Jump to Date" button on Schedule tab
```javascript
function showDatePicker() {
  // Show native date picker limited to game nights
  // Scroll to that date in accordion
  // Auto-expand that month
}
```

### 4.2 Search/Filter Bar

**Global search for:**
- Teams (jump to their games)
- Game IDs (e.g., "26001")
- Dates

**Keyboard shortcut:** `/` to focus search

### 4.3 Breadcrumb Navigation

**In Admin → Settings sub-tabs:**
```
Admin / Settings / Manage Teams
```

Clicking "Settings" returns to settings main view.

---

## Phase 5: Polish & Accessibility (Week 5-6)

### 5.1 Micro-interactions

| Element | Interaction |
|---------|-------------|
| Buttons | Scale 0.96 + brightness on :active |
| Cards | Subtle lift on hover (translateY -2px) |
| Chips | Background fill transition |
| Scores | Number count-up animation on entry |
| Standings | Row highlight when team mentioned |

### 5.2 Accessibility Improvements

**WCAG 2.1 AA Compliance:**
- [ ] Add `aria-label` to all interactive elements
- [ ] Add `role="tab"`, `aria-selected` to tabs
- [ ] Add `role="dialog"`, `aria-modal` to PIN modal
- [ ] Ensure 4.5:1 contrast ratios (audit current colors)
- [ ] Add `prefers-reduced-motion` support
- [ ] Keyboard navigation: Tab order, Enter/Space activation
- [ ] Focus indicators: Visible focus rings
- [ ] Screen reader announcements for dynamic content

### 5.3 Error Handling

**Replace alert() with:**
```javascript
function showError(message, options = {}) {
  const { 
    recoverable = true, 
    retry = null,
    details = null 
  } = options;
  
  // Show inline error banner instead of alert
  // Provide retry button if recoverable
  // Log details to console
}
```

---

## Implementation Priority Matrix

### P0 (Must Have - Week 1)
1. Skeleton loading screens
2. Enhanced empty states with CTAs
3. Toast notification system
4. Save state indicators on score inputs

### P1 (Should Have - Weeks 2-3)
5. Mobile-responsive standings cards
6. Touch target sizing (44×44px)
7. Date jump picker
8. Improved PIN feedback
9. Global search

### P2 (Nice to Have - Weeks 4-6)
10. Swipe gestures
11. Micro-interactions (count-up, etc.)
12. Full accessibility audit
13. Error boundary handling
14. Breadcrumb navigation

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Time to first meaningful paint | ~3s (cloud load) | <1.5s with skeleton |
| User task completion (enter score) | Unknown | >95% |
| Mobile bounce rate | Unknown | <20% |
| Admin PIN retry rate | Unknown | <10% |
| Support questions about "lost data" | Current rate | 50% reduction |

---

## Technical Notes

### Files to Modify
- `style.css`: Add skeleton, toast, mobile styles
- `persistence.js`: Add loading state utilities
- `data.js`: Add empty state components
- `schedule-render.js`: Add save indicators
- `standings.js`: Add mobile card view
- `index.html`: Add toast container, ARIA attributes

### Backwards Compatibility
- All changes are additive; no breaking changes
- Mobile styles are progressive enhancement
- Toast system falls back to current alerts

### Testing Strategy
1. Desktop Chrome/Firefox/Safari
2. Mobile Safari (iOS 15+)
3. Mobile Chrome (Android 12+)
4. Screen reader testing (VoiceOver, TalkBack)

---

**Next Steps:**
1. Review roadmap with stakeholders
2. Create feature branch for Phase 1
3. Implement skeleton loading first (highest impact)
4. User testing on mobile devices
5. Iterate based on feedback

*Document Version: 1.0*  
*Last Updated: April 22, 2026*
