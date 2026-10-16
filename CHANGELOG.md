# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [0.1.0] — 2026-10-16

Phases 1 (foundation) and 2 (screenshots) of the spec.

### Added

- Tray app for macOS, Windows and Linux with a capture menu, Settings and History windows.
- Global shortcuts for every capture, rebindable in Settings; clashes with other actions, with the system's own
  shortcuts and with other apps are reported. Shortcuts pause while a new one is being recorded.
- Area capture over a frozen screen with a magnifier, pixel coordinates and size readout; full screen, window, previous
  area and timed capture (3, 5, 10 s).
- Clipboard, save to folder (PNG, JPG, WebP; Retina or 1x; file name template), a corner card after each capture with
  Copy, Show and drag out, and a searchable history.
- macOS Screen Recording permission page that turns green when granted.
- Updates from GitHub Releases (installed automatically on Windows and Linux AppImage; announced on macOS).
- CI on macOS, Windows and Linux: lint, typecheck, unit and property tests, end-to-end tests on Linux and Windows,
  installers for each system.
