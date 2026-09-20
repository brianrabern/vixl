---
title: Appearance
---

# Appearance

Theme and display live in Settings > General. They write personal `settings.json` only (`appearance.theme`, `appearance.transparency`, `appearance.transparencyHue`, `appearance.transparencyIntensity`). Projects do not override appearance.

## Theme

Three icon buttons: Light, Dark, System. Default is System.

The title-bar toggle switches Light and Dark (not System) and writes the same `appearance.theme` key.

## Transparency

**Enabled** switch (`appearance.transparency`, default on).

When on, two sliders. Hue runs 0 to 360 (default 265). Intensity runs 0 to 100 (default 0).

Changes persist after a 300ms debounce. Live preview updates while you drag.

## Shortcuts and updates on General

General is the same section as appearance. A keyboard icon opens the shortcuts dialog (Command palette, New Agent, left sidebar, right workbench, Esc to leave Settings). Full list: [Keyboard shortcuts](/reference/keyboard-shortcuts). Updates show the current version, a check button, and **Download and restart** when an update exists. The updater endpoint is GitHub Releases. See [Installation](/getting-started/installation).

Next: [Permission settings](/customize/permission-settings).
