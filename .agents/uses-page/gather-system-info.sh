#!/usr/bin/env bash
# Gather system information to seed a /uses page.
# Works on macOS and Linux. Outputs a structured summary.

set -euo pipefail

echo "=== System Information ==="
echo ""

# OS
echo "## Operating System"
if [[ "$OSTYPE" == "darwin"* ]]; then
  sw_vers 2>/dev/null || echo "macOS (version unknown)"
  echo ""
  echo "## Hardware"
  sysctl -n machdep.cpu.brand_string 2>/dev/null || true
  system_profiler SPHardwareDataType 2>/dev/null | grep -E "Model Name|Model Identifier|Chip|Memory|Serial" || true
  echo ""
  echo "## Display"
  system_profiler SPDisplaysDataType 2>/dev/null | grep -E "Display Type|Resolution|Retina|Main Display|Mirror|Vendor" || true
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  cat /etc/os-release 2>/dev/null | head -5 || echo "Linux"
  echo ""
  echo "## Hardware"
  lscpu 2>/dev/null | grep -E "Model name|CPU\(s\)|Thread" || true
  free -h 2>/dev/null | head -2 || true
  echo ""
  echo "## Display"
  xrandr 2>/dev/null | grep " connected" || echo "(no display info available)"
else
  echo "OS: $OSTYPE"
fi

echo ""
echo "## Shell"
echo "Shell: $SHELL"
echo "Terminal: ${TERM_PROGRAM:-unknown}"

echo ""
echo "## Developer Tools Detected"

# Editors
for editor in code cursor nvim vim zed emacs subl webstorm idea; do
  if command -v "$editor" &>/dev/null; then
    version=$("$editor" --version 2>/dev/null | head -1 || echo "installed")
    echo "- $editor: $version"
  fi
done

# Languages & runtimes
for tool in node deno bun python3 python ruby go rustc java swift dotnet php; do
  if command -v "$tool" &>/dev/null; then
    version=$("$tool" --version 2>/dev/null | head -1 || echo "installed")
    echo "- $tool: $version"
  fi
done

# Package managers
for pm in npm pnpm yarn bun pip cargo gem brew; do
  if command -v "$pm" &>/dev/null; then
    version=$("$pm" --version 2>/dev/null | head -1 || echo "installed")
    echo "- $pm: $version"
  fi
done

# Containers & infra
for infra in docker podman kubectl terraform; do
  if command -v "$infra" &>/dev/null; then
    version=$("$infra" --version 2>/dev/null | head -1 || echo "installed")
    echo "- $infra: $version"
  fi
done

# Git
if command -v git &>/dev/null; then
  echo "- git: $(git --version 2>/dev/null)"
fi

echo ""
echo "=== End of System Information ==="
