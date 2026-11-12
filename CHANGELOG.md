# Changelog

All notable changes to this site are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/): MAJOR for a redesign, MINOR for new
sections or features, PATCH for content updates and fixes. Each release is an
annotated git tag `vX.Y.Z`; the visitor-facing label shows `V<MAJOR>.<MINOR>`.

## [Unreleased]

### Changed
- Content synced to the Software Engineer CV rebrand: ABOUT.ME now leads with back-end C#, .NET,
  SQL Server and X++ and LLM tooling for AI coding agents; the Deloitte and INTERMEDIA disks are
  updated to match the new CV (role line, mentoring count, team-shape note, tree-structured item
  attribute hierarchy, INTERMEDIA coverage figure).
- PROJECTS split from one PERSONAL folder into theme folders: AI AGENTS, LLM EVALS, DEV TOOLS and
  APPS, with ACADEMIC kept unchanged and moved last.

### Added
- Animated label scenes for the LEARNVIZ disk (an open book feeding a knowledge graph) and the
  METEO disk (sun and cloud turning to rain, then a crescent moon, then day again).
- Five new project disks: LONG-MEM and RULE-DRIVEN (AI AGENTS), JUDGE-CAL (LLM EVALS), LEARNVIZ
  and METEO-SCORE (APPS); existing project disks gained their measured results (linter and server
  extension for AI-MEMORY, fresh-bug benchmark and Agent Skill for LLM-EVAL, recall threshold for
  AI-D365, resumable night runner and run tracing for INFRA-TOOLS).

## [1.0.2] - 2026-10-21

### Changed
- The CV is published as `HaralambosVarsamis_CV.pdf` (was `cv.pdf`). Published file names
  carry no version; the CV's own version is noted in the commit that updates it.

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

[1.0.2]: https://github.com/Tu7uru/portfolio/releases/tag/v1.0.2
[1.0.1]: https://github.com/Tu7uru/portfolio/releases/tag/v1.0.1
[1.0.0]: https://github.com/Tu7uru/portfolio/releases/tag/v1.0.0
