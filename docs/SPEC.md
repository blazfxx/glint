# Glint — Master Build Prompt

Oct 15, 2026 · @Muhammad

## 1. Mission and operating rules

You are a principal engineer and product designer building **Glint** (working name, rename freely): a free, open-source, cross-platform capture app that replaces three paid tools in one:

- **Screen Studio** ($29/month, Mac only): polished demo videos with automatic zoom, smooth cursor and pretty backgrounds.
- **CleanShot X** (paid, Mac only): screenshots, annotation, scrolling capture, OCR, quick GIFs.
- **Loom** ($18 to $24 per user per month): record, get an instant share link, viewers watch and comment in the browser.

How to use this document: give all of it to your coding AI as the spec, then let it work phase by phase (section 19).

Operating rules:

- Save this document in the repo as `/docs/SPEC.md` and re-read the relevant section before each phase.
- Build in the order of section 19, one phase at a time. Finish, test and demo a phase before starting the next.
- Before each phase print your plan, the files you will touch and the risks. After it print what works, what is missing and what is next.
- No placeholders: no TODO stubs, no mock data, no `any`, no dead buttons. If a feature belongs to a later phase, do not render its UI.
- Strict TypeScript. Handle every state: empty, loading, error, offline, permission denied.
- **Never lose a recording.** Write raw capture to disk continuously in crash-safe chunks. A crash, a full disk or a killed process must leave a recoverable file.
- Every editor change is a typed command on a project document (section 5), so undo, redo, autosave and the AI assistant all work through one path.
- Where this spec is ambiguous, choose the stated default, log it in `/docs/DECISIONS.md` and keep going. Ask the user only when a choice is irreversible.
- Commit small and often. Keep a `CHANGELOG.md`.

## 2. Vision, promises and non-goals

One app that sits in the menu bar or system tray. Press a shortcut, grab a screenshot or record your screen, get a beautiful result and a link to share, in seconds, on Mac, Windows and Linux.

The four promises:

1. **Free and open source, for real.** Recording, screenshots, the studio editor and local export are free forever with no watermark and no time limit. MIT license.
2. **Pretty by default.** Every recording comes out of the box with auto zoom on clicks, a smoothed cursor, padding, rounded corners, a shadow and a background. No editing required to look professional.
3. **Share in one click.** Stop recording and a link is already on your clipboard while the upload finishes in the background. Viewers need no account.
4. **Everywhere.** Same features and same look on macOS, Windows and Linux.

Users: indie hackers and devs recording product demos, people writing docs and support replies, teams replacing Loom for async updates, creators making tutorials, students.

Principles: speed over settings; the default is the good choice; the shortcut is the product; local first, cloud optional; never lose a frame.

Non-goals for v1: live streaming, multi-track video editing (that's a different product), mobile apps (a mobile web viewer is in scope), webcam effects beyond background blur, screen recording of DRM-protected content.

## 3. Competitor teardown

Copy each tool's best idea and beat it on its gap.

| Product | Copy this | Beat this |
| --- | --- | --- |
| Screen Studio | Auto zoom that follows clicks, cursor smoothing and scaling, motion blur, backgrounds with padding and shadow, presets for social sizes | $29/month, Mac only, no sharing links, no screenshots |
| CleanShot X | All-in-one capture overlay, annotation tools, scrolling capture, OCR, pin to screen, quick access overlay after capture, cloud links | Mac only, paid, video editing is basic |
| Loom | Instant share link, webcam bubble, viewer comments and reactions, transcript, AI titles and summaries, view analytics | Expensive per seat, free seats removed, no studio polish |
| Cap | Open-source Loom alternative with share links | AI features paid; polish below Screen Studio |
| OpenScreen | Proved Electron + React can do Screen Studio-style editing; huge demand | Archived; author called it not production grade |
| ShareX | Massive feature set for screenshots and uploads | Windows only, cluttered UI |
| Kap | Simple, pretty, open-source recorder | Mac only, minimal editing |

Our edge: the only free app that does all three jobs, on all three operating systems, with Screen Studio-level polish and a Loom-style link. Treat OpenScreen and Kap as references for how to approach problems; do not copy code without checking each license and keeping notices.

## 4. Architecture and stack

pnpm + Turborepo monorepo:

```
apps/
  desktop/        Electron app: tray, overlays, recorder, studio editor
  web/            Next.js: share viewer, dashboard, marketing site, docs
  api/            API (Hono or tRPC) on Vercel/Fly: uploads, links, comments, AI jobs
packages/
  capture-native/ Node-API addon (Rust via napi-rs): per-OS capture backends
  input-events/   global mouse, click and keystroke timeline (uiohook-napi)
  project/        recording project schema, Zod validators, migrations, commands
  zoom-engine/    auto-zoom and cursor smoothing algorithms (pure TS, tested)
  renderer/       WebGL/WebGPU compositor shared by editor preview and export
  encoder/        ffmpeg + WebCodecs pipeline, hardware encoder selection
  annotate/       screenshot annotation canvas
  ocr/            on-device OCR wrappers
  ai/             client for AI jobs through our proxy
  ui/             shared React UI kit and tokens
  testing/        fixtures, golden videos, visual tests
```

Stack defaults:

- Electron (latest stable), React 19, TypeScript strict, Vite, Tailwind for UI chrome, Zustand + Immer for editor state, Zod for validation.
- **Native capture** in Rust through napi-rs so heavy work stays off the JS thread (section 6).
- **Rendering:** one compositor in `packages/renderer` (WebGL2, WebGPU when available) used by the live editor preview and by the final export, so what you see is exactly what you export.
- **Encoding:** hardware encoders first (VideoToolbox on macOS, NVENC/QSV/AMF/Media Foundation on Windows, VA-API on Linux), software x264 fallback. Bundle a static ffmpeg build with license notices.
- **Backend:** Postgres (Supabase or Neon), object storage on Cloudflare R2 (no egress fees) behind a CDN, a transcoding worker (ffmpeg on a queue), Redis for rate limits and queues, Stripe for billing.
- **Auto update:** electron-updater with signed releases.
- **Quality:** Vitest, Playwright (web and Electron), Rust tests, ESLint, Prettier, GitHub Actions CI building on all three operating systems.

## 5. Project data model

A recording is a folder (`*.glint`) holding raw media plus one JSON project file. Raw media is never modified; every edit is non-destructive data in the project.

```ts
interface GlintProject {
  schemaVersion: number;
  id: string;
  createdAt: string;
  source: {
    display?: { id: string; bounds: Rect; scaleFactor: number };
    window?: { title: string; appName: string; bounds: Rect };
    region?: Rect;
    fps: number;
  };
  tracks: {
    screen: MediaTrack;            // chunked segments, e.g. segment-0001.mp4
    camera?: MediaTrack;
    micAudio?: MediaTrack;
    systemAudio?: MediaTrack;
  };
  events: {
    cursor: CursorSample[];        // t, x, y, cursorType (arrow, pointer, text...)
    clicks: ClickEvent[];          // t, x, y, button, isDouble
    keys: KeyEvent[];              // t, key, modifiers (shortcut display only, opt-in)
    windowFocus: FocusEvent[];
  };
  edit: {
    trim: { start: number; end: number };
    cuts: Range[];                 // removed ranges
    speed: SpeedRange[];           // speed up or slow down ranges
    zooms: ZoomSegment[];          // auto-generated or manual, each editable
    cursor: CursorSettings;        // size, smoothing, hide when idle, click effect, motion blur
    layout: LayoutSettings;        // background, padding, radius, shadow, aspect ratio, inset
    camera: CameraSettings;        // bubble shape, size, position per range, hidden ranges
    captions?: CaptionSettings;
    annotations: VideoAnnotation[];// text, arrows, highlights, blur boxes over time
    audio: AudioSettings;          // levels, noise reduction, normalize
  };
  transcript?: Transcript;         // words with timestamps
  share?: { linkId: string; status: 'uploading' | 'ready' | 'failed' };
}
```

Rules: Zod schema plus a `migrate()` pipeline with a snapshot test per version. Every change goes through a typed command with undo/redo. Autosave on every committed change. Event timestamps share one monotonic clock with the media so cursor and video line up to the frame.

## 6. Capture engine per OS

One TypeScript interface, three native backends in `packages/capture-native`. Electron's `desktopCapturer` is the fallback only, because native APIs give better frame pacing, cursor control and system audio.

|  | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Screen and window | ScreenCaptureKit (macOS 12.3+) | Windows Graphics Capture (Win 10 1903+), DXGI Desktop Duplication fallback | PipeWire via xdg-desktop-portal (Wayland), X11 (XShm) fallback |
| Hide real cursor in capture | Yes (SCStreamConfiguration) | Yes (WGC IsCursorCaptureEnabled) | Portal cursor mode = metadata |
| System audio | ScreenCaptureKit audio (macOS 13+) | WASAPI loopback | PipeWire monitor source |
| Exclude our own windows | Yes | SetWindowDisplayAffinity | Best effort |
| Encoder | VideoToolbox | Media Foundation / NVENC / QSV / AMF | VA-API, x264 fallback |

Requirements:

- **Capture targets:** full display, single window (follows the window as it moves), custom region, and a specific browser tab is out of scope.
- **Record the cursor separately.** Capture the screen without the cursor, and log cursor position, cursor type and clicks to the event timeline at 120Hz+. The studio redraws a smooth, scalable cursor later. This is the core trick behind Screen Studio's look.
- **Frame rate:** 30 or 60 fps, variable frame rate on idle screens to save space. Native resolution, Retina/HiDPI aware.
- **Webcam** via getUserMedia in a hidden window, recorded as its own track. **Mic** with device picker, live level meter, and optional noise suppression.
- **Crash-safe writing:** fragmented MP4 segments (every 2 seconds) flushed to disk; a recovery tool rebuilds a project from orphaned segments on next launch.
- **Sync:** stamp every frame, audio buffer and input event with one monotonic clock; correct drift between audio and video on finalize.
- **Multi-monitor and mixed DPI:** correct coordinates when the cursor crosses displays with different scale factors.
- Pause and resume (new segment, no gap in the edit), restart (discard and start over), cancel.
- **Permissions:** guided onboarding for macOS Screen Recording, Microphone, Camera and Accessibility, with deep links to System Settings and a live check that turns green when granted.

## 7. Screenshot tool (the CleanShot X part)

**Capture modes:** area (crosshair with magnifier loupe, pixel coordinates and size readout), window (hover to highlight, optional window shadow and background), full screen, previous area again, timed capture (3, 5, 10 seconds), **scrolling capture** (auto-scroll and stitch long pages; manual scroll fallback), freeze screen while selecting (so menus and hover states can be captured), and **text capture (OCR)** straight to the clipboard.

**Quick access overlay.** After every capture, a small thumbnail floats in a screen corner with actions: copy, save, annotate, upload and copy link, pin to screen, drag and drop into any app, close. It stacks multiple captures and auto-dismisses after a configurable delay.

**Annotation editor** (`packages/annotate`, canvas-based, every object stays editable):

- Arrow (curved and straight), line, rectangle, ellipse, filled highlight, freehand pen, text with background, counter numbers (1, 2, 3 steps), emoji/stickers, spotlight (dim everything outside a shape).
- **Blur and pixelate** for hiding secrets, plus a smart redact that finds emails and keys via OCR and offers to blur them.
- Crop, resize canvas, add a background with padding, rounded corners and shadow (same presets as video), aspect presets for social posts.
- Color presets, stroke width, opacity, undo/redo, keyboard shortcut per tool.

**Pin to screen:** a floating always-on-top window holding the image, with opacity, lock (click through), and resize.

**Output:** PNG, JPG, WebP; retina or 1x; copy to clipboard by default; save to a chosen folder with a filename template; upload for a share link.

**History:** a searchable library of past screenshots and recordings with OCR-searchable text, tags and quick re-copy.

**OCR:** on-device. macOS Vision framework, Windows.Media.Ocr on Windows, Tesseract (WASM or native) on Linux. Never upload images for OCR.

## 8. Recorder UX

- **Menu bar / tray app.** Click the icon or press a global shortcut to open the capture HUD: Screenshot, Record, Record GIF, OCR, Scrolling, History, Settings.
- **Global shortcuts** (all rebindable, conflicts detected): area screenshot (Cmd/Ctrl+Shift+4 style default that doesn't clash with the OS), full screenshot, record, stop, pause, OCR, open history.
- **Record setup bar:** choose display, window or region; mic, camera and system audio toggles with live levels; mode **Studio** (opens the editor after recording) or **Quick share** (uploads straight away, Loom style).
- **Webcam bubble** visible while recording: draggable, resizable, circle or rounded square, hide/show on the fly, mirrored. It's excluded from the screen capture and composited later, so it stays movable in the editor.
- **Countdown** 3-2-1 (skippable), then a minimal floating control: timer, pause, restart, stop, delete, draw on screen. Excluded from the capture.
- **Draw on screen while recording:** quick pen, arrow and highlight that fade after a few seconds, recorded as annotations.
- **Do Not Disturb helper:** optionally hide desktop icons and turn on focus mode while recording, restore after.
- **Stop:** Studio mode opens the editor in under a second. Quick share mode copies the link instantly and shows upload progress in a toast.
- **Limits that protect the user:** warn at low disk space, stop safely before the disk fills, show estimated file size.

## 9. Studio editor (the Screen Studio part)

This is the product's wow moment. A raw recording must look like a polished product demo with zero edits.

**Layout:** large live preview in the center, a timeline at the bottom (video, zoom track, cuts, speed, camera, captions, annotations), and a right panel with tabs: Background, Cursor, Zoom, Camera, Audio, Captions, Export.

**Auto zoom engine** (`packages/zoom-engine`, pure, deterministic, unit tested):

- Generate zoom segments from the click and typing timeline: cluster nearby clicks in time and space into one segment; zoom in shortly before the first click, follow the cursor during the segment, zoom out after idle time.
- Zoom level 1.5x to 3x, chosen by how spread the activity is; never crop the action off screen.
- Follow the cursor with a critically damped spring so the camera never jitters, with a dead zone so small movements don't pan.
- Every generated segment shows on the zoom track: drag to move, stretch to change timing, click to change level, delete, or add a manual zoom at any point (manual can focus on a fixed area instead of following).
- Global controls: auto zoom on/off, intensity (subtle, normal, strong), transition speed.

**Cursor** (redrawn from the event timeline):

- Smoothing slider (removes shaky movement using spline interpolation), size from 1x to 3x, cursor style (system-like set, our own drawn assets, no copied OS artwork), hide when idle, click effect (ring ripple, subtle scale), optional click sound, motion blur on fast moves, loop cursor position for seamless GIFs.

**Background and frame:** wallpaper presets (gradients, blurred images, solid colors, custom upload), padding, corner radius, shadow (size, softness, opacity), inset, aspect ratio presets (16:9, 9:16, 1:1, 4:5, auto) with smart reframing that keeps the action in view for vertical formats, optional window chrome (fake macOS/Windows/browser bar, drawn by us).

**Camera:** position and size per time range (for example big at the start, small corner after), shape, border, shadow, hide during ranges, background blur via on-device segmentation, full-screen camera scenes.

**Timeline editing:** trim, split, cut ranges, speed up ranges (2x to 8x for boring parts), auto-detect long idle stretches and offer to speed them up or cut them, ripple delete, snapping, zoomable timeline, waveform, frame-accurate scrubbing, J/K/L shortcuts.

**Annotations over video:** text callouts, arrows, highlight boxes, blur/pixelate boxes that can follow a region, keyboard shortcut display (shows pressed shortcuts like Cmd+K, opt-in only), each with in and out timing and fade.

**Audio:** volume per track, noise reduction, normalize loudness to -16 LUFS, mute ranges, background music with auto-ducking under speech.

**Presets:** save the whole look (background, cursor, zoom, camera, padding) as a style and apply it to every new recording. Ship 8+ good-looking presets.

The preview must play at real time at 60fps for a 1080p project on a mid-range laptop, using the same compositor the exporter uses.

## 10. Rendering and export

- **One compositor:** export renders frames through the same `packages/renderer` code as the preview (offscreen), then encodes. A golden-frame test compares preview and export frames.
- **Formats:** MP4 (H.264, default), MP4 (HEVC), WebM (VP9/AV1), MOV with ProRes for editors, GIF (palette-optimized, size target, loop), animated WebP, PNG sequence, audio-only MP3/WAV.
- **Settings:** resolution (720p, 1080p, 1440p, 4K, original), fps (24/30/60), quality slider or target file size (for example "under 10 MB for Slack/Discord"), aspect preset.
- **Hardware encoding** with automatic fallback to software when the hardware encoder fails; a benchmark on first run picks the fastest path.
- **Speed target:** export a 2-minute 1080p60 project in under 1x real time on a mid-range laptop with hardware encoding.
- Background export queue with progress, cancel, and a notification when done; the editor stays usable.
- **Destinations:** save to file, copy file to clipboard, upload to a Glint share link, reveal in folder. Later: YouTube and Google Drive.
- No watermark on any plan, ever.

## 11. Share links and web viewer (the Loom part)

**Instant link.** In Quick share mode, upload starts while recording (stream finished segments with resumable multipart uploads to R2). On stop, the link is already on the clipboard; the page shows "processing" for the last seconds, then plays. Screenshots upload and link in under 2 seconds.

**Viewer page** (`apps/web`, server-rendered, fast on mobile):

- Player with adaptive HLS, playback speed (0.5x to 2.5x), keyboard shortcuts, picture-in-picture, fullscreen, captions toggle, chapters, transcript panel where clicking a word seeks there.
- Title, description, AI summary (section 12), creator name and avatar.
- **Comments pinned to timestamps,** emoji reactions on the timeline, replies, @mentions; viewers comment with a name only (no account) or signed in.
- Call-to-action button the creator can add ("Book a call", any URL).
- Download button (creator can turn it off).
- Rich link previews (Open Graph video and thumbnail, animated GIF preview in Slack/Discord/X), oEmbed for Notion and docs tools, an embed snippet.

**Creator controls:** rename, edit (trim in the browser without re-upload), replace video but keep the link, password, expiry date, restrict to email domain or invited emails, disable comments or downloads, delete.

**Analytics:** views, unique viewers, watch-through percentage, drop-off chart, who watched (signed-in viewers), notifications when someone views or comments.

**Custom domains** (`video.yourcompany.com`) and branding on paid plans.

**Processing pipeline:** on upload, a worker transcodes to HLS renditions (360p to 1080p), makes a thumbnail and GIF preview, extracts audio, then queues AI jobs. Originals kept for download.

## 12. AI features

All AI runs through our own AI API proxy (OpenAI-compatible endpoints), so models can be swapped and costs stay low. Every AI call goes through `packages/ai` with a credit check, a timeout, retries and a clear error.

- **Transcription:** word-level timestamps, auto language detection. Option to run Whisper locally (whisper.cpp) for privacy and offline use; cloud by default for speed.
- **Captions:** burned-in styled captions (word-by-word highlight like short-form video, or classic subtitles), editable, exported as SRT/VTT too.
- **Auto title, summary and chapters** on share links and in the editor.
- **Remove filler words and silences** ("um", "uh", long pauses) as suggested cuts the user approves on the timeline.
- **Edit by transcript:** delete words in the transcript to cut the video (early version of the later Descript-style app).
- **Smart zoom suggestions:** use the transcript plus clicks to suggest zooms where the speaker says "here" or "this button".
- **Ask the video:** viewers ask questions about a recording and get answers with timestamp links.
- **Auto-redact:** find emails, API keys, phone numbers via OCR on frames and offer blur boxes.
- **Translate captions** into other languages.
- **Studio voice** (cleanup of noisy audio) as a later paid feature.

Free plan gets a monthly AI allowance (for example 60 minutes of transcription and summaries); paid plans get much more. Show remaining credits in the app. Never send media to AI without the user turning AI on; local-only mode disables every cloud AI call.

## 13. Backend, storage and costs

- **Tables:** users, workspaces, members, videos, video\_renditions, screenshots, share\_links, comments, reactions, views, ai\_jobs, credits\_ledger, api\_keys, subscriptions, audit\_log. Row-level security on everything.
- **Storage:** Cloudflare R2 for originals and HLS renditions, served through a CDN with signed URLs for private links. Lifecycle rules: free-plan videos older than the retention window move to cheaper storage or get deleted after warning emails.
- **Workers:** a queue (Redis/BullMQ or a managed queue) for transcode, thumbnails, GIF previews, AI jobs. Autoscale by queue depth; idempotent jobs with retries.
- **Cost guardrails (free must stay affordable):** cap free plan at, for example, 25 share links and 5 minutes per video in cloud (unlimited local recording and export); compress smartly; track cost per user per month in a dashboard; alert when any user goes far past normal use.
- **Abuse:** rate limits on uploads, malware/CSAM hash scanning on uploads through a provider, report button on every viewer page, takedown tooling, block known bad accounts.
- **Self-hosting:** a Docker Compose setup (app, Postgres, MinIO for S3, worker) so the open-source crowd can run their own share server. This is a big trust and GitHub-star driver.

## 14. Accounts, teams and billing

- **No account needed** to record, screenshot, edit or export locally. Sign in only for share links, sync and AI.
- Sign in with Google, GitHub or email magic link. The desktop app signs in through the browser and a deep link back (`glint://auth`).
- **Workspaces** with roles (owner, admin, member, viewer), shared library, folders, team-wide branding and default presets.
- **Plans (defaults, adjust later):**

| Plan | Price | Includes |
| --- | --- | --- |
| Free | $0 | Unlimited local recording, screenshots, studio, export; limited share links and cloud minutes; monthly AI allowance |
| Pro | \~$6/month | Unlimited share links and cloud length, more AI, custom branding, password and expiry links, analytics |
| Team | \~$8/user/month | Workspaces, shared library, roles, custom domain, SSO later, admin controls |

Undercut Loom and Screen Studio clearly. Stripe Checkout and customer portal, credit top-ups for heavy AI use, enforce limits server-side, friendly upgrade prompts that never block local work.

## 15. Privacy, security and permissions

- **Local first:** recordings live on the user's disk. Nothing uploads unless the user shares. Show a clear cloud indicator on anything that is online.
- **No telemetry by default;** opt-in anonymous crash reports (Sentry) with media and paths stripped.
- **Keystroke logging only for the shortcut display feature,** off by default, stores only modifier combos, never plain text typing, and is clearly labeled.
- Private share links use unguessable IDs and signed media URLs; password links hash the password; expiry enforced server-side.
- **Desktop security:** contextIsolation on, nodeIntegration off, sandboxed renderers, a typed preload IPC bridge with validated messages, strict CSP, no remote code loading, signed and notarized builds (Apple notarization, Windows code signing), signed auto updates.
- Delete account and all data from the app; export all your data as a zip. GDPR/CCPA ready.
- **Accessibility:** full keyboard control, screen reader labels, high-contrast mode, captions on by default for viewers who want them.

## 16. Performance and testing

**Budgets**

- App idle in tray: under 100 MB RAM, \~0% CPU.
- Screenshot hotkey to overlay visible: under 150 ms. Capture to clipboard: under 300 ms.
- Recording 1080p60 with camera and mic: no dropped frames, under 15% CPU with hardware encoding on a mid-range laptop.
- Stop to editor open: under 1 second. Editor preview at 60fps for 1080p.
- Export: faster than real time with hardware encoding. Share link on clipboard: instant; playable within 10 seconds of stop for a 2-minute video.

**Tests**

- Unit (Vitest): zoom engine (golden zoom plans for recorded click timelines), cursor smoothing, project migrations, commands, undo/redo invariants, timeline math.
- Property-based (fast-check): random edit sequences never produce invalid projects; undo restores exactly.
- Rust tests for each capture backend, plus a CI job per OS that records a scripted test pattern and checks frame count, timing and audio sync.
- Golden-frame tests: preview frame equals export frame within tolerance.
- E2E (Playwright for Electron and web): screenshot, annotate, copy; record, edit, export; quick share, open link, comment.
- Crash recovery test: kill the process mid-recording and verify recovery.
- Load tests on the upload and transcode pipeline.

## 17. Design language

- **Feel:** native and calm. On macOS use vibrancy/translucent panels, on Windows Mica/Acrylic, on Linux a clean solid theme. Dark and light themes following the system.
- One accent color, neutral grays, Inter (or the system font) at 12 to 13px, 8px spacing grid, 8 to 12px radius, subtle shadows only on floating windows. All colors as tokens.
- **Overlays must feel instant:** crosshair, loupe and selection drawn at the display's refresh rate; no flicker when the overlay appears.
- Smooth, short animations (120 to 200ms); the editor previews must look like the final export.
- Own icon set and cursor artwork (drawn for the project), own wallpapers (generated gradients or properly licensed images). Never copy Apple, Microsoft, Screen Studio, CleanShot or Loom assets.
- **Onboarding in under 60 seconds:** permissions, pick shortcuts, take a first screenshot, make a first recording that already looks great.
- Settings window: General, Shortcuts, Screenshots, Recording, Studio defaults, Cloud and account, AI, Advanced.

## 18. Open source and launch

- **License:** MIT for the desktop app and self-host server. The hosted cloud (share links, AI) is the paid service.
- **Repo polish:** README with a 20-second demo GIF made in Glint, feature table vs Screen Studio / CleanShot X / Loom, one-line install, download buttons for all three operating systems, CONTRIBUTING.md, AGENTS.md for AI contributors, issue templates, a public roadmap.
- **Distribution:** GitHub Releases (DMG universal, Windows installer + winget, Linux AppImage, .deb, Flatpak), Homebrew cask, a landing page with download detection.
- **Launch:** ship only when screenshots, recording, studio, export and share links all work on all three operating systems. Then post "Show HN: Glint – free, open-source Screen Studio + CleanShot + Loom for Mac, Windows and Linux", Product Hunt the same week, short demo clips on X/Reddit (r/macapps, r/opensource, r/selfhosted), and a Discord for community.
- Every share link viewer page has a small "Made with Glint, free" link (removable on paid plans). This is the viral loop.
- **Later siblings** reuse this codebase: a Descript-style transcript editor, then dictation and grammar. Shared login and credit wallet.

## 19. Build phases and acceptance criteria

Build strictly in order. A phase is done only when its acceptance checks pass on macOS, Windows and Linux.

1. **Foundation.** Monorepo, CI on three operating systems, Electron shell, tray app, settings, global shortcuts, secure IPC, auto updater, signed builds. *Accept:* signed installers launch on all three; shortcuts work and are rebindable.
2. **Screenshots.** Area/window/full capture, loupe, freeze, quick access overlay, clipboard and save, history. *Accept:* hotkey to clipboard in under 300 ms; HiDPI correct on mixed-DPI setups.
3. **Annotation, OCR, pin, scrolling capture.** *Accept:* every annotation stays editable; OCR copies text accurately on all three; scrolling capture stitches a long web page cleanly.
4. **Recording engine.** Native capture backends, cursor-free screen capture, event timeline, mic, camera, system audio, crash-safe segments, recovery. *Accept:* 10-minute 1080p60 recording with camera has no dropped frames and stays in sync; kill test recovers.
5. **Studio editor.** Compositor, background and frame, cursor redraw and smoothing, auto zoom engine, timeline editing, camera layouts, annotations, audio, presets. *Accept:* a raw recording looks polished with zero edits; preview runs at 60fps.
6. **Export.** All formats, hardware encoders, GIF optimizer, queue. *Accept:* golden-frame parity; export faster than real time.
7. **Cloud and share links.** Auth, uploads during recording, transcode pipeline, viewer page, comments, reactions, analytics, link controls. *Accept:* link on clipboard at stop; playable within 10 seconds for a 2-minute video.
8. **AI.** Transcription, captions, titles, summaries, chapters, filler removal, smart zoom suggestions, ask the video, auto redact, through the proxy with credits. *Accept:* each feature works on a test set and respects local-only mode.
9. **Teams and billing.** Workspaces, roles, Stripe, limits, custom domains. *Accept:* plan limits enforced server-side; upgrade and downgrade work.
10. **Self-host and launch.** Docker Compose server, docs, README, landing page, store listings, launch checklist.

After each phase print what works, known gaps and the next phase plan. Update `CHANGELOG.md` and `/docs`.

Fastest viral path: phases 1 to 7 are the launchable product (roughly the "auto-zoom recording, screenshots and share links" MVP). Launch there, then ship AI and teams as updates.

## 20. Definition of done

Glint is ready to launch when all of these are true:

- A new user installs it, grants permissions and makes a polished, auto-zoomed demo video and a shareable link in under 2 minutes, on Mac, Windows and Linux.
- Screenshots with annotation and OCR feel as fast as CleanShot X.
- No watermark, no time limit, and no account needed for local work.
- No recording is ever lost, including crashes and full disks.
- Share links play instantly on phones and desktops, with comments, transcript and analytics.
- No TODOs, stubs, `any`, mock data or dead UI anywhere in the repo.
- Tests, golden-frame parity, per-OS capture checks and performance budgets all pass in CI.
- Docs exist for users, self-hosters and contributors.

**Start now:** output the monorepo structure, the project schema and the command catalog, then begin Phase 1.
