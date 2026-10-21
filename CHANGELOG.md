# Changelog

All notable changes to this site are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/): MAJOR for a redesign, MINOR for new
sections or features, PATCH for content updates and fixes. Each release is an
annotated git tag `vX.Y.Z`; the visitor-facing label shows `V<MAJOR>.<MINOR>`.

## [1.0.1] - 2026-10-21

### Fixed
- Power could get stuck: switching on and off with Space, or a second Space during the
  power-off animation, left the green LED on over a dark screen that no longer reacted.
  Keys are now ignored while the set powers down, Space/Enter on the focused power button
  toggles only once, and switching off during the warm-up no longer blocks the next power-on.

### Added
- QA check i06 for these power sequences.

## [1.0.0] - 2026-10-21

First public release of ARCHIVE.SYS.

### Added
- CRT-monitor archive: each CV section is a floppy disk; folders open as views, items as cards.
- Detail view (VIEW MORE) for work, projects, education and ABOUT.ME.
- DOS prompt (`/` or the `_>` button): `DIR`, `LS`, `CD`, `HELP`, with Tab completion; it steps aside when a detail view opens.
- Content from CV v2.2: Deloitte, INTERMEDIA, military service, certifications (MB-500, NVIDIA), personal and academic projects.
- CV as a PDF (`docs/cv.pdf`, web copy with "Phone on request").
- No-JavaScript fallback listing the whole archive.
- Build pipeline (`src/` + `content/` -> `docs/index.html`), Playwright QA suite, Prettier formatting.

[1.0.1]: https://github.com/Tu7uru/portfolio/releases/tag/v1.0.1
[1.0.0]: https://github.com/Tu7uru/portfolio/releases/tag/v1.0.0
