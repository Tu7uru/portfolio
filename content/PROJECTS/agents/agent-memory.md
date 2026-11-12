---
title: Agent memory platform
label: AI-MEMORY
period: PERSONAL PROJECT
tags: SQLite, Full-Text Search, MCP
plain: Agent memory platform · SQLite full-text search, MCP
order: 10
---
Persistent, searchable memory for AI coding agents.

- Built on SQLite full-text search and exposed to the agents as tools (MCP).
- Typed records with explicit update and retention policies.
- A 15-check consistency linter that blocks unsafe updates.
- In daily use by multiple agents across devices.
- Specified and reference-implemented a server extension for audit history, schema versioning and recall logging, adopted by the platform team; its test suite caught 25 of 26 deliberately broken server variants in mutation testing.
