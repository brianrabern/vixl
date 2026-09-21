---
title: Installation
description: Install the Vixl desktop app from GitHub Releases for macOS arm64, Linux x64, and Windows, or build from source.
---

# Installation

Prebuilt installers come from [GitHub Releases](https://github.com/vixl-ai/vixl/releases). The [Release](https://github.com/vixl-ai/vixl/blob/main/.github/workflows/release.yml) workflow publishes:

- macOS arm64: `.dmg` and `.app.tar.gz`
- Linux x64: AppImage, `.deb`, and `.rpm`
- Windows: NSIS installer

The desktop shell is [Tauri](https://tauri.app/). After install, the app can check `https://github.com/vixl-ai/vixl/releases/latest/download/latest.json` for updates (Settings, General).

## Install a release

1. Download the installer for your platform from [GitHub Releases](https://github.com/vixl-ai/vixl/releases).
2. Download `SHA256SUMS.txt` from the same release tag (`SHA512SUMS.txt` is attached too).
3. Verify the files in the download directory.

On macOS:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

On Linux:

```bash
sha256sum -c SHA256SUMS.txt
```

Only trust checksum files from that GitHub Release tag.

4. Install the bundle.
5. Open Vixl.

First launch lands on the home [chat input](/getting-started/your-first-chat).

## Build from source

Vixl is easy to hack on. Use the [Node.js](https://nodejs.org/) version in [`.nvmrc`](https://github.com/vixl-ai/vixl/blob/main/.nvmrc) (currently 26.7.0), install modules, and boot the desktop app. It should never be harder than that.

1. Clone the repo.

```bash
git clone https://github.com/vixl-ai/vixl.git
cd vixl
```

2. Use the Node version in `.nvmrc`.
3. Install the [Rust](https://www.rust-lang.org/) toolchain from [rustup.rs](https://rustup.rs/).
4. Install modules with `npm ci`.
5. Boot the desktop app with `npm run tauri -- dev`.

`npm run dev` starts the [Vite](https://vite.dev/) frontend only. Use the Tauri command for the desktop app.

Dev setup and how maintainers cut a release are in [CONTRIBUTING.md](https://github.com/vixl-ai/vixl/blob/main/CONTRIBUTING.md).

Next: [set up providers and models](/getting-started/set-up-providers-and-models).
