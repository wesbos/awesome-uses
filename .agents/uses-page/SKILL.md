# /uses Page Generator

Generate a comprehensive /uses page for a developer by gathering information about their hardware, software, desk setup, and workflow through an interactive interview process.

## Overview

A /uses page documents a developer's current setup — the tools, hardware, software, and configurations they rely on daily. This skill guides the user through creating one by asking targeted questions, optionally running system detection, and exporting the result in their preferred format.

## Process

### Step 1: System Detection (Optional)

Ask the user if they'd like to auto-detect their system info. If yes, run the helper script:

```bash
bash .agents/uses-page/gather-system-info.sh
```

This will output hardware model, OS, display info, and installed developer tools. Use this as a starting point for the interview.

### Step 2: Interview — Hardware

Ask about each section. Don't ask all at once — go section by section, confirming and expanding on each answer before moving to the next.

**Computer**
- What computer(s) do you use? (e.g. MacBook Pro 16" M4 Max, custom PC build, ThinkPad X1 Carbon)
- CPU, RAM, storage specs if they know them
- Do you use a laptop, desktop, or both?

**Peripherals & Desk**
- Monitor(s): brand, size, resolution (e.g. LG 27" 4K, Apple Studio Display)
- Keyboard: brand and model (e.g. Keychron Q1, HHKB, Apple Magic Keyboard)
- Mouse/trackpad: brand and model
- Webcam, microphone, headphones/speakers
- Desk: standing desk? Brand? (e.g. Uplift, IKEA Bekant)
- Chair: brand and model (e.g. Herman Miller Aeron, Steelcase Leap)
- Any other desk accessories (monitor arm, desk mat, cable management, lighting)

**Phone & Tablet**
- Phone: model (e.g. iPhone 16 Pro, Pixel 9)
- Tablet: if used for development or note-taking

### Step 3: Interview — Software & Development Environment

**Editor & Terminal**
- Primary code editor (e.g. VS Code, Neovim, Cursor, Zed, WebStorm)
- Editor theme and key extensions/plugins
- Terminal emulator (e.g. iTerm2, Warp, Ghostty, Kitty, Alacritty, Windows Terminal)
- Shell (e.g. zsh, fish, bash, nushell) and framework (e.g. oh-my-zsh, starship prompt)
- Font for coding (e.g. Fira Code, JetBrains Mono, MonoLisa, Dank Mono)

**Browser & DevTools**
- Primary browser for development
- Key browser extensions

**Design & Creative Tools**
- Design tools (e.g. Figma, Sketch, Adobe CC, Affinity)
- Image/video editing

**Productivity & Workflow**
- Note-taking (e.g. Obsidian, Notion, Apple Notes, Bear)
- Task management (e.g. Linear, Todoist, Things, ClickUp)
- Communication (e.g. Slack, Discord)
- Password manager (e.g. 1Password, Bitwarden)
- Cloud storage
- Music/focus app (e.g. Spotify, Apple Music)
- Window management (e.g. Raycast, Rectangle, yabai)
- Launcher (e.g. Raycast, Alfred, Spotlight)

**Development Stack**
- Primary languages and frameworks
- Package managers (npm, pnpm, yarn, bun)
- Version control workflow
- Hosting/deployment (e.g. Vercel, Cloudflare, AWS, Netlify)
- Database preferences
- API tools (e.g. Postman, Insomnia, httpie)
- Docker/containers?

### Step 4: Review & Follow-up

After gathering initial answers:

1. Summarize what you have so far in a draft format
2. Ask follow-up questions about anything that seems incomplete:
   - "You mentioned VS Code — do you have a specific theme or must-have extensions?"
   - "Any dotfiles or config repos you'd like to link?"
   - "Anything unusual or unique about your setup that people would find interesting?"
3. Ask if there are sections they want to add:
   - Gaming setup
   - Home office lighting/ambiance
   - Self-hosting / homelab
   - Podcasting/streaming gear
   - Photography/videography equipment

### Step 5: Export

Ask the user their preferred format, then generate the page:

**Markdown** (most common for /uses pages):
```markdown
# Uses

> Last updated: March 2026

## Hardware

### Computer
- MacBook Pro 16" M4 Max (64GB RAM, 1TB SSD)

### Desk Setup
- Monitor: LG 27UK850 4K
- Keyboard: Keychron Q1 with Gateron Brown switches
...

## Software

### Editor
- VS Code with the Vitesse theme
- Key extensions: ESLint, Prettier, GitHub Copilot
...
```

**HTML** — A styled, standalone HTML page with sections and anchors.

**JSX/React** — A React component with semantic markup, ready to drop into a Next.js/Remix/Astro site.

**Rich Text** — Formatted text suitable for pasting into a CMS or Google Doc.

## Tips for a Great /uses Page

- Be specific: "MacBook Pro 16" M4 Max" is better than "MacBook"
- Include why you chose things when interesting: "I switched to Neovim for the modal editing speed"
- Link to products/tools where possible
- Update it periodically — setups change!
- Add a personal touch: what makes YOUR setup unique?
- Photos of your desk setup are a huge plus (mention this to the user)

## Common Sections from Existing /uses Pages

Based on analysis of hundreds of developer /uses pages, the most common sections are:

1. **Computer/Laptop** — nearly universal
2. **Code Editor** — VS Code dominates, but Neovim, Cursor, and Zed are rising
3. **Terminal** — iTerm2, Warp, Ghostty, Kitty are popular
4. **Browser** — Chrome, Firefox, Arc, Brave
5. **Keyboard** — mechanical keyboards are very popular in the community
6. **Monitor** — ultrawide and 4K are common
7. **Desk & Chair** — standing desks and ergonomic chairs
8. **Headphones** — Sony WH-1000XM series, AirPods Pro, Audio-Technica
9. **Hosting** — Vercel, Cloudflare, Netlify, AWS
10. **Frameworks** — React, Next.js, Svelte, Vue, Astro
11. **Fonts** — Fira Code, JetBrains Mono, MonoLisa
12. **Themes** — One Dark Pro, Dracula, Catppuccin, Vitesse
