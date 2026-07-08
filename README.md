# tuiper

A terminal (TUI) typing trainer — a faithful clone of
[frank_type](https://github.com/akitaonrails/frank_type) (Fabio Akita's Rails
typing app), reproducing its behavior with byte-identical metrics and a native
terminal presentation. Built in TypeScript on [Bun](https://bun.com) using
[OpenTUI](https://github.com/sst/opentui). Local-first — no server, no accounts,
no network; history and preferences live in local JSON.

## Requirements

- An interactive terminal (a raw-mode TTY) at least **80×24**. Below that size
  tuiper shows a "terminal too small" notice and pauses until you resize; a
  piped/redirected (non-TTY) start exits with a clear message.
- Truecolor is preferred for the heat map and themes, with a **256-color
  fallback** when the terminal doesn't advertise 24-bit color.

## Install & run

Download the self-contained binary for your OS from the
[latest release](https://github.com/marcelocg/tuiper/releases/latest) — no
runtime needed on the target machine:

| Platform            | File                        |
| ------------------- | --------------------------- |
| Linux (x64)         | `tuiper-linux-x64`          |
| macOS (Apple, arm64) | `tuiper-darwin-arm64`      |
| Windows (x64)       | `tuiper-windows-x64.exe`    |

Then make it executable and run it:

```bash
# Linux / macOS
chmod +x tuiper-linux-x64   # (or tuiper-darwin-arm64)
./tuiper-linux-x64
```

```powershell
# Windows
.\tuiper-windows-x64.exe
```

> macOS may quarantine an unsigned download; clear it with
> `xattr -d com.apple.quarantine tuiper-darwin-arm64` before the first run.

## From source (development)

Needs [Bun](https://bun.com) 1.3+:

```bash
bun install
bun run index.ts   # or: bun start
```

Compile the standalone binaries yourself:

```bash
bun run build:linux   # dist/tuiper-linux-x64
bun run build:mac     # dist/tuiper-darwin-arm64
bun run build:win     # dist/tuiper-windows-x64.exe
bun run build:all     # all three
```

> `bun build --compile` warns about un-installed other-OS native OpenTUI deps —
> harmless; the correct platform package loads at runtime.

## Development

```bash
bun test          # full suite
bun run typecheck # tsc --noEmit
```

CI (GitHub Actions) runs the test suite and typecheck, then compiles the Linux,
macOS, and Windows binaries on every push and pull request. Pushing a `v*` tag
additionally publishes a GitHub Release with those three binaries attached.

## Credits & license

tuiper is a terminal port of **[frank_type](https://github.com/akitaonrails/frank_type)**
by **Fabio Akita** — all typing-trainer behavior, metric formulas, and the prose
corpus originate there. Please star the original project.

Licensed under the [MIT License](LICENSE). The MIT license and Fabio Akita's
original copyright are retained; tuiper's port is copyright Marcelo Gonçalves.
