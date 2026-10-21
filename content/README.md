# content/: the disks

Every folder and file in here becomes part of the archive. Run `npm run build` (or keep `npm run watch` running: it rebuilds about 1 s after each save).

## Layout
```
content/
  WORK/                 a root disk (category). Its folder name is the disk label.
    _folder.md          optional: drive letter + order
    deloitte.md         a disk inside WORK (the file name is its id)
  PROJECTS/
    academic/           a sub-folder disk
      _folder.md        label: ACADEMIC, order: 10
      alpha.md
```
- **Add a disk:** create `name.md` in the folder where it belongs.
- **Remove a disk:** delete the file, or put `draft: true` in it to hide it but keep it.
- **Add a folder disk:** create a sub-folder with a `_folder.md` holding `label:` and `order:`.
- **Add a root disk:** create a folder directly in `content/` with a `_folder.md` holding `drive: F` and `order: 60`. Keep it to about 6 root disks.
- File and folder names must be unique across all of `content/`. Use letters, digits and - _ . only.

## A disk file
```
---
title: Deloitte                      # card + detail title (required)
label: DELOITTE                      # text on the disk (default: file name in CAPS), keep ≤ 13 chars
period: OCT 2023 — PRESENT
role: Software Engineer · D365 F&O (X++)
tags: X++, Dynamics 365 F&O, Data Migration      # comma-separated
link: https://github.com/Tu7uru/x    # or HaralambosVarsamis_CV.pdf; projects show REPO ↗
linkLabel: OPEN                      # contacts: OPEN ↗; "OPEN CV ↗" marks the CV
plain: Software Engineer · Oct 2023 — present    # one-liner for the no-JavaScript list (optional)
order: 10                            # position among its siblings (10, 20, 30 … leaves room)
draft: true                          # hide without deleting (optional)
note: One sentence: the "why"        # optional NOTES line on the detail page
---
One-paragraph summary (shown on the card and as the big line on the detail page).

- Each bullet becomes a line on the VIEW MORE page.
- A bullet can wrap onto the next line;
  indented continuation lines are joined.
```
Only `title` is needed. Without bullets there is no VIEW MORE page.
Icons: known ids (deloitte, army, alpha, …) have their own drawing. A new disk gets its folder's default icon (work = desk figure, projects = gears, education = cap, otherwise a plain disk).
Attachments: put PDFs and other files in `docs/` (next to HaralambosVarsamis_CV.pdf) and use `link: file.pdf`.
