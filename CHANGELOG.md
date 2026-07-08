# Changelog

All notable changes to tuiper are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-08

First public release — tuiper is a faithful terminal port of
[frank_type](https://github.com/akitaonrails/frank_type) by Fabio Akita, with
byte-identical metrics.

### Added

- Complete typing-trainer engine ported from frank_type: metrics (WPM/accuracy),
  session state, speed bands, race progress, deletion handling, digraph summary,
  and text normalization — all golden-tested against the original.
- OpenTUI terminal shell: sources screen, typing session, help overlay, full
  keymap, and a width-adaptive footer hint bar.
- Terminal-capability guards: a "terminal too small" notice below 80×24,
  truecolor with a 256-color fallback, and a clear exit on non-TTY start.
- Local-first history and preferences stored as JSON — no server, no accounts,
  no network.
- Self-contained `bun build --compile` binaries for Linux (x64), macOS (arm64),
  and Windows (x64), distributed via GitHub Releases.

### Distribution

- Releases are cut by pushing a `v*` tag; CI attaches the three platform
  binaries to the GitHub Release. No runtime is required to run them.

[1.0.0]: https://github.com/marcelocg/tuiper/releases/tag/v1.0.0
