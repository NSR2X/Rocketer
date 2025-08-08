# Rocketer – Project TODO (Production Readiness)

Use this checklist to drive the next passes. Keep it up to date; check items off as they’re completed.

## 1) Analyze Entire Project
- [x] Inventory files and responsibility per module (`background.js`, `popup.js`, `options.*`, `styles/*`, `manifest.json`)
- [x] Map data flow: provider fetch → storage → popup render → settings
- [x] Verify all feature flags/settings used (e.g., `dataProvider`, `notificationTiming`)
- [x] Confirm removal status of legacy PiP code and artifacts

## 2) Bug Chasing (repro → fix → verify)
- [x] Service worker lifecycle: install/activate/reload without errors
- [x] Countdown stability across time boundaries; no layout shift
- [x] Expand/Collapse: single click, correct arrow, no console errors
- [x] Webcast status: ICS parsing paths; ensure “Official Webcast” URLs surface when present
- [x] Data source switching: SpaceDevs ↔ RocketLaunch.live renders consistently
- [x] Notifications timing: schedule/cancel, no duplicates
- [x] Offline/slow network handling: graceful states (loading/empty/error)

## 3) Dead Code / Useless Files Cleanup
- [x] Re-scan for any PiP/offscreen remnants (imports, selectors, messages)
- [x] Remove unused functions/variables/selectors across JS/CSS
- [x] Remove obsolete content script logic if no longer used
- [x] Delete unused assets (images/icons/css) if any

## 4) Permissions & Manifest Audit
- [x] Minimize `host_permissions` to only APIs actually fetched at runtime
- [x] Validate whether `content_scripts` are still required; remove if unused
- [x] Ensure no optional/broad origins remain
- [x] Confirm required extension permissions: `storage`, `alarms`, `notifications` (activeTab removed)
- [x] Validate CSP compliance (no inline scripts, no eval)

## 5) Comments & Logging (Production)
- [x] Remove noisy/temporary comments; rewrite remaining for clarity (“why”, not “how”)
- [x] Convert remaining logs to concise, user-actionable errors/warnings
- [x] Gate diagnostic logs behind a `debugMode` flag in popup

## 6) Apply best-practices.md
- [x] Update `best-practices.md` to reflect current scope (PiP removed, stream redirects only)
- [ ] Add/attach Privacy Policy page and link from store listing
- [x] Accessibility: ARIA updates for error/empty states (no keyboard work per scope)
- [ ] Testing matrix: providers, timezones, network conditions, notifications
- [ ] Store readiness checklist: icons, screenshots, description

## 7) Verification Pass (Definition of Done)
- [ ] Clean `chrome://extensions` console (no errors/warnings on load/use)
- [x] Lint/style pass green
- [ ] Manual QA on macOS/Windows, latest Chrome
- [x] Final manifest review (permissions, content scripts, host origins)

Notes:
- When removing code, also remove related CSS classes and strings to avoid drift.
- Prefer small, isolated edits and verify after each logical group.