<div align="center">

<img src="apps/desktop/build/icon.png" width="112" alt="Glint icon">

# Glint

**Free, open-source screenshots for macOS, Windows and Linux, on the way to screen recording with share links.**

</div>

Glint lives in your menu bar or system tray. Press a shortcut, drag over what you want, and the capture is on your
clipboard, saved to a folder and waiting in a corner with what to do next. No account, no watermark, nothing uploaded.

## What works today (0.1)

- **Area capture**: the screen freezes while you select (menus and hover states stay put), with a magnifier, pixel
  coordinates and the size of the selection. Enter takes the whole screen, Escape cancels.
- **Full screen, window, previous area** and **timed capture** (3, 5 or 10 seconds).
- **After every capture**: copied to the clipboard, saved as PNG, JPG or WebP (Retina or 1x) with a file name template,
  and shown in a corner card with Copy, Show and drag-into-any-app.
- **History**: every capture, searchable by name and date, to copy, save or remove later.
- **Shortcuts**: all rebindable; clashes with other actions or with the system are caught and explained.
- **Updates** from GitHub Releases.

Coming next, in this order (see [docs/SPEC.md](docs/SPEC.md) §19): annotation, OCR, pin to screen and scrolling capture;
screen recording with a smooth redrawn cursor and auto zoom; the studio editor; export; share links.

|                                | Glint | CleanShot X | Screen Studio | Loom            |
| ------------------------------ | ----- | ----------- | ------------- | --------------- |
| Price                          | Free  | Paid        | $29/month     | $18+/user/month |
| macOS, Windows, Linux          | ✓     | Mac only    | Mac only      | ✓ (recorder)    |
| Screenshots with freeze, loupe | ✓     | ✓           | –             | –               |
| Open source                    | MIT   | –           | –             | –               |

## Install

Download the newest build for your computer from [Releases](https://github.com/blazfxx/glint/releases/latest):
`Glint-<version>-mac.dmg` (Apple silicon and Intel), `Glint-<version>-windows-x64.exe` (or `-arm64`),
`Glint-<version>-linux-x86_64.AppImage` or `.deb`.

- **macOS**: the app is not notarized yet. The first time, right-click Glint in Applications and choose Open. Glint asks
  for Screen Recording permission the first time you capture; Settings › Permissions shows when it is granted.
- **Windows**: the installer is not code-signed yet, so SmartScreen may ask you to confirm (More info › Run anyway).
- **Linux**: on Wayland, your desktop asks which screen to share for each capture (the system's screen-capture portal).

## Build from source

```sh
pnpm install
pnpm --filter @glint/desktop dev      # build and start
pnpm check                            # format, lint, typecheck, unit tests
pnpm e2e                              # end-to-end tests (on Linux: xvfb-run -a pnpm e2e)
pnpm --filter @glint/desktop dist     # installers for this system, in apps/desktop/release
```

Layout: `apps/desktop` (Electron app: tray, overlays, windows), `packages/shortcuts` (accelerators, recording key
presses, clash checks), `packages/capture-core` (selection geometry, device pixels, file names). See
[AGENTS.md](AGENTS.md) for how the pieces fit and [docs/DECISIONS.md](docs/DECISIONS.md) for the choices made.

## License

MIT. Glint is built in the open; issues and pull requests are welcome.
