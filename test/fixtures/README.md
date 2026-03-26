## Purpose

This directory is intentionally kept in the repo as a pool of additional
Slidev sample decks for future stress tests and broader regression sweeps.

Current expectations:

- day-to-day smoke and browser regression checks should usually use
  `src/lib/slidev/fixtures/base.md`
- in most cases, `base.md` is enough for routine testing; only reach for the
  larger `.txt` samples when you need broader corpus coverage or stress testing
- broader corpus sweeps now load every `.md` / `.txt` file under
  `src/lib/slidev/fixtures`, including this README as a plain one-page sample
- do not delete or treat this folder as accidental unused data without
  confirming first

Why this note exists:

- the default smoke path should stay centered on `base.md`
- without an explicit note, future cleanups could mistake them for dead assets
