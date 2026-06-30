# Changelog

All notable changes to CWChops are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-06-30

### Added

- Shift+Enter logs the current QSO directly from any entry box, skipping ESM's
  send-the-exchange step — a quick "just log it" when the exchange is already
  done.

### Fixed

- "New Session…" did nothing: it relied on `window.prompt`, which Electron
  doesn't support (returns null silently). Replaced with an in-app modal so you
  can name and start a fresh log for the next contest (e.g. switching from the
  1300Z to the 1900Z CWT).

## [0.2.0] - 2026-06-16

### Added

- Live countdown to the next CWT session in the Scoreboard, computed from the
  fixed weekly UTC schedule (Wed 1300Z, Wed 1900Z, Thu 0300Z). Shows
  time-to-start, or time-remaining while a session is live.
- Tab / Shift+Tab cycle through the Call → Name → Nr entry boxes (wrapping),
  selecting the field text so values can be corrected without Enter logging the
  QSO.

### Changed

- S&P mode: pressing Enter with the Call box empty now keys the F2 exchange
  macro (previously did nothing). A Call already entered is unchanged.

### Fixed

- CW speed control against RHR TCI: `CW_MACROS_SPEED` now includes the trx
  index, which RHR requires — the previous single-arg form was silently
  ignored, so WPM changes never reached the rig. Dropped the unused
  `cw_keyer_speed` command (RHR has no handler for it).
- macOS no longer prompts for the login keychain password on every launch
  (Chromium Safe Storage is opted out via `--use-mock-keychain`).

## [0.1.0] - 2026-06-07

### Added

- Initial release: CWops CWT contest logger with TCI (RemoteHamRadio) rig
  control, dupe/mult scoring, CWops member roster lookup, ESM (Enter Sends
  Message) automation, and Cabrillo / ADIF export.

[Unreleased]: https://github.com/WW2DX/CWChops/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/WW2DX/CWChops/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/WW2DX/CWChops/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/WW2DX/CWChops/releases/tag/v0.1.0
