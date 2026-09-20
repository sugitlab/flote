#!/usr/bin/env bash
# Cloud Agent bootstrap for Flote (pnpm monorepo: Tauri desktop + Expo mobile).
# Idempotent: safe to run repeatedly and against cached/partial state.
set -euo pipefail

echo "==> Flote install: system dependencies"

# System libraries required to build/run the Tauri v2 desktop app on Linux
# (webkit2gtk 4.1, GTK3, appindicator, rsvg) plus Xvfb so the GUI can run
# headlessly for automated/manual testing.
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libgtk-3-dev \
  librsvg2-dev \
  libayatana-appindicator3-dev \
  libglib2.0-dev \
  libssl-dev \
  build-essential \
  pkg-config \
  patchelf \
  file \
  xvfb

echo "==> Flote install: Rust toolchain"
# The desktop app's Cargo.lock pins crates that require the edition2024 Cargo
# feature (Rust >= 1.85). Ensure a recent stable toolchain is the default.
if command -v rustup >/dev/null 2>&1; then
  rustup toolchain install stable --profile minimal
  rustup default stable
else
  echo "rustup not found; skipping Rust toolchain setup" >&2
fi

echo "==> Flote install: Node dependencies"
corepack enable
corepack prepare pnpm@9.4.0 --activate
pnpm install --frozen-lockfile

echo "==> Flote install: complete"
