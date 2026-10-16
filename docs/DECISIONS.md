# Decisions

Choices made where the spec left room, or where it could not be followed yet. Newest last.

### D1. One React app for every window

Settings, History, the overlays, the corner card, the window picker and the countdown are routes of one Vite build
(`#settings`, `#overlay?display=…`). One bundle, one design system, one preload. Every window is sandboxed with
context isolation, no Node, a strict CSP and a typed preload; every request is validated with Zod in the main process
(`shared/ipc.ts`).

### D2. Screenshots use Electron's capturer until the native module exists

The spec puts native capture (Rust, napi-rs) in phase 4, for recording. Screenshots need one still frame, which
`desktopCapturer` gives at full device resolution on all three systems (ScreenCaptureKit on macOS, the portal on
Wayland). Displays of different pixel sizes are captured separately so none is scaled. When the native module lands,
`electron/screens.ts` is the one place to switch.

### D3. The screen always freezes for an area capture

The spec offers freezing as an option. Glint captures first and lets you select on the frozen image, which is also what
makes the overlay instant and the result exact (the cut is from the original pixels, never from what the overlay
shows). A live (unfrozen) selection is not offered.

### D4. Window capture is picked from a list

Hover-to-highlight needs window positions, which Electron does not expose. Until the native module (phase 4) provides
them, Capture Window opens a list of windows with thumbnails. The optional window shadow and background arrive with
the background presets of phase 3.

### D5. Default shortcuts avoid the system's

macOS keeps ⌘⇧3 to ⌘⇧6 for its screenshots and ⌥⇧ with a letter types characters, so the defaults are ⌘⇧1 (area),
⌘⇧2 (full screen), ⌘⇧7 (window), ⌘⇧8 (previous area), ⌘⇧9 (history), Ctrl+Shift on Windows and Linux.

### D6. No signing certificates yet

There is no Apple Developer ID or Windows code-signing certificate. Mac builds are ad-hoc signed (needed to run on Apple
silicon) and not notarized; Windows installers are unsigned. Because macOS will not install an update into an unsigned
app, the Mac build announces new versions and opens the download page; Windows and the Linux AppImage update
themselves through electron-updater. When certificates exist, `electron-builder.yml` gets the identity and the Mac
updater installs too.

### D7. Every capture is kept in the history

Whatever the save settings, each capture is stored as a PNG in Glint's own folder, so it can be copied again from
History. Settings › Screenshots › History limits how many are kept (500 by default).

### D8. WebP is encoded by Chromium

Electron's images write PNG and JPEG only, so WebP is encoded in a hidden page with `OffscreenCanvas.convertToBlob`.
The page opens on the first WebP save and closes after a minute without work.

### D9. Electron 44's clipboard

Electron 44 replaced the synchronous clipboard functions with the asynchronous `clipboard.write([ClipboardItem])`;
captures are written as `image/png`.
