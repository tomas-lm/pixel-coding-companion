<p align="center">
  <img src="docs/assets/readme-title.png" alt="Pixel Companion" width="720">
</p>

<p align="center">
  <strong>A gamified command center for AI coding terminals, token-saving workflows, and Markdown vaults.</strong>
</p>

<p align="center">
  <a href="https://github.com/tomas-lm/pixel-coding-companion/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/tomas-lm/pixel-coding-companion?style=social">
  </a>
  <a href="https://github.com/tomas-lm/pixel-coding-companion/issues">
    <img alt="GitHub issues" src="https://img.shields.io/github/issues/tomas-lm/pixel-coding-companion">
  </a>
  <a href="LICENSE">
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue">
  </a>
  <img alt="macOS first" src="https://img.shields.io/badge/platform-macOS%20first-111827">
</p>

---

Pixel Companion is a local desktop app for developers who work with AI coding agents all
day. It gives you one second-screen workspace for:

- managing several project terminals and AI agents;
- keeping agent status updates visible without hunting through terminal windows;
- reducing wasted context with token-saving command output workflows;
- keeping Markdown notes, plans, and agent artifacts in Pixel Vaults;
- turning long coding sessions into a lightweight gamified companion loop.

The product idea is simple: the AI coding ecosystem changes constantly. Pixel tests the
useful parts, filters out the noise, and turns the pieces that actually help into a
practical local workflow.

Pixel is currently macOS-first and optimized for Codex, but it can run other
terminal-based agents such as Claude Code, Cursor CLI, Roo Code, or custom commands.

## Install Status

Public release downloads are being prepared. Until a `.dmg`, `.AppImage`, `.deb`, or
Windows installer is attached to GitHub Releases, build Pixel locally from source.

Important:

- `git clone` downloads source code only.
- The compiled app is generated locally into `dist/`.
- `pnpm dev` is only for people changing Pixel's source code.
- macOS is the primary supported platform today.
- Linux and Windows targets exist, but should be treated as experimental until they are
  tested on release machines.

## Choose Your Platform

Use the path for your operating system. All paths require Node.js 22 or newer and pnpm.

### macOS Path

This is the recommended path today.

Step 1: Install prerequisites with Homebrew:

```bash
brew install git node pnpm
```

Step 2: Confirm the tools:

```bash
git --version
node --version
pnpm --version
```

Step 3: Clone Pixel:

```bash
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/tomas-lm/pixel-coding-companion.git
cd pixel-coding-companion
```

Step 4: Install dependencies:

```bash
pnpm install
```

Step 5: Build the stable macOS app:

```bash
pnpm build:unpack
```

Step 6: Open the app:

```bash
pnpm open:stable
```

The generated app lives here:

```text
dist/mac-arm64/Pixel Companion.app
```

If macOS blocks the app because it is not notarized, right-click `Pixel Companion.app`,
choose `Open`, then confirm. Local builds can trigger Gatekeeper warnings.

To create a distributable `.dmg` instead of only an unpacked app:

```bash
pnpm build:mac
```

The `.dmg` appears in `dist/`.

### Linux Path

Linux builds are experimental.

Step 1: Install prerequisites. On Ubuntu or Debian:

```bash
sudo apt update
sudo apt install -y git curl build-essential python3
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
```

For Fedora, Arch, or another distro, install Git, Node.js 22+, pnpm, Python 3, and build
tools using your distro package manager.

Step 2: Confirm the tools:

```bash
git --version
node --version
pnpm --version
```

Step 3: Clone Pixel:

```bash
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/tomas-lm/pixel-coding-companion.git
cd pixel-coding-companion
```

Step 4: Install dependencies:

```bash
pnpm install
```

Step 5: Build Linux artifacts:

```bash
pnpm build:linux
```

Electron Builder writes Linux artifacts into `dist/`, including AppImage, `.deb`, and
snap targets when the local system supports them.

Step 6: Run the AppImage:

```bash
chmod +x dist/*.AppImage
./dist/*.AppImage
```

If AppImage complains about FUSE, install your distro's FUSE compatibility package, then
run the AppImage again.

### Windows Path

Windows builds are experimental.

Step 1: Install:

- Git for Windows: <https://git-scm.com/download/win>
- Node.js 22 or newer: <https://nodejs.org/>

Step 2: Open PowerShell and enable pnpm:

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

Step 3: Confirm the tools:

```powershell
git --version
node --version
pnpm --version
```

Step 4: Clone Pixel:

```powershell
mkdir $HOME\dev
cd $HOME\dev
git clone https://github.com/tomas-lm/pixel-coding-companion.git
cd pixel-coding-companion
```

Step 5: Install dependencies:

```powershell
pnpm install
```

Step 6: Build the Windows installer:

```powershell
pnpm build:win
```

The installer appears in `dist/` with a name like:

```text
pixel-coding-companion-1.0.0-setup.exe
```

Step 7: Run the installer from `dist/`.

## First App Setup

After Pixel opens, the setup flow is the same on every platform.

### Step 1: Complete The First Setup

When Pixel opens for the first time:

1. Choose your agent command. Pick `Codex` for the strongest integration today.
2. Add optional command parameters if you normally use them, such as `--full-auto`.
3. Choose the workspace folder where the command should run.
4. Give the workspace a name and color.
5. Review the setup.
6. Click `Finish setup`.

Pixel creates your first project and one configured terminal.

### Step 2: Start Your Project

After setup:

1. Select your project in the left rail.
2. Click `Start Project`.
3. Keep `Start with Pixel` enabled for supported AI terminals.
4. Let the terminal open and start the agent.

With `Start with Pixel` enabled, Pixel can launch supported AI terminals through its
local launcher so the companion can follow session lifecycle events and surface useful
status updates.

### Step 3: Add A Vault

Vaults keep Markdown notes near your agent work.

1. Open the `Vaults` section in the left activity bar.
2. Add a vault folder or choose an existing notes folder.
3. Open Markdown files from the vault tree.
4. Keep plans, prompts, research notes, and agent-written reports beside your terminals.

Pixel Vaults are intentionally lightweight. They are built for reading, writing, and
keeping project context close while coding.

### Step 4: Update Pixel Later

To update your local app after new commits land on GitHub, pull the latest source and
rerun the build command for your platform.

macOS:

```bash
cd ~/dev/pixel-coding-companion
git pull
pnpm install
pnpm build:unpack
pnpm open:stable
```

Linux:

```bash
cd ~/dev/pixel-coding-companion
git pull
pnpm install
pnpm build:linux
```

Windows:

```powershell
cd $HOME\dev\pixel-coding-companion
git pull
pnpm install
pnpm build:win
```

## Daily Workflow

A typical Pixel session looks like this:

1. Open Pixel Companion.
2. Start the project stack for the work you are doing.
3. Run Codex or another agent in a project terminal.
4. Watch Ghou, the built-in companion, report when agents start, finish, fail, or need
   input.
5. Use change roots to inspect the repositories that matter for that project.
6. Keep planning notes and generated reports in Vaults.
7. Open real code changes in your editor when it is time to inspect or refine them.

Your editor still does the deep code editing. Pixel owns the second-screen workflow:
agent terminals, status, vault context, prompt surfaces, and practical AI workflow
experiments that survived real use.

## Core Features

### Project Terminal Management

Create projects with named terminals, folders, commands, colors, and launch presets.
Start one terminal or a full project stack without rebuilding the same terminal layout
every day.

### AI Agent Coordination

Pixel groups AI agents, test runners, dev servers, and shell sessions by project. This
keeps multi-agent work easier to scan than a pile of unrelated terminal windows.

### Token-Saving Workflows

Pixel includes compact command-output tooling for noisy commands such as broad Git diffs
or test output. The goal is to keep useful signal visible while avoiding unnecessary
context bloat in agent sessions.

### Pixel Vaults

Open Markdown notes, plans, and project artifacts directly inside Pixel. Vaults work well
with Obsidian-style folders and agent-generated planning docs.

### Gamified Companion Loop

Ghou reports meaningful coding events and gains local XP as sessions progress. The
gamification is deliberately lightweight: it should make long AI-assisted work feel more
alive without turning into the main task.

### AI Workflow Curation

Pixel is meant to absorb useful ideas from the fast-moving AI coding ecosystem. When a
pattern actually improves local agent work, Pixel can make it part of the product instead
of leaving it as another scattered tip or script.

## Development Mode

Use development mode only when editing Pixel Companion itself:

```bash
cd ~/dev/pixel-coding-companion
pnpm install
pnpm dev
```

`pnpm dev` opens an Electron development window with hot reload. It is not the install
path for normal users.

If you want to use Pixel for real work while also developing Pixel, run a stable app and
an isolated dev app side by side:

```bash
pnpm build:unpack
pnpm open:stable
pnpm dev:isolated
```

For microphone dictation testing on macOS, use the packaged dev app instead:

```bash
pnpm dev:packaged
```

`pnpm dev:isolated` runs through Electron's generic development app, so macOS may attach
microphone permission prompts to `Electron` instead of Pixel. `pnpm dev:packaged` builds
and opens `dist-dev/mac-arm64/Pixel Companion Dev.app` with Pixel's dev bundle id, which
lets macOS show the correct app in Privacy & Security > Microphone. The packaged dev app
is launched through macOS `open` instead of executing the binary directly, because
LaunchServices is the reliable path for TCC privacy prompts.

The stable app stores normal data here:

```text
~/Library/Application Support/pixel-coding-companion
```

The isolated dev app stores separate data here:

```text
~/Library/Application Support/pixel-coding-companion-dev
```

## Troubleshooting

### `pnpm: command not found`

Install pnpm:

```bash
brew install pnpm
```

Then run `pnpm --version` again.

### Node Is Too Old

Pixel expects Node.js 22 or newer. With Homebrew, update Node:

```bash
brew upgrade node
node --version
```

### The App Still Looks Like Electron

Rebuild the stable app from the latest source:

```bash
git pull
pnpm install
pnpm build:unpack
pnpm open:stable
```

The packaged app should use Pixel's icon from the build assets.

### macOS Says The App Cannot Be Opened

Local builds are not notarized. Right-click `Pixel Companion.app`, choose `Open`, then
confirm. This is expected for local unsigned or ad-hoc signed builds.

### You Want To Reset Local Pixel Data

This deletes local Pixel projects, terminal configs, companion state, and vault
preferences:

```bash
rm -rf "$HOME/Library/Application Support/pixel-coding-companion"
```

Only run that command if you intentionally want a fresh local Pixel setup.

## Advanced Agent Setup

Most users should launch agents from inside the app with `Start with Pixel` enabled. The
manual commands below are useful when testing launcher behavior from a shell.

Expose the local `pixel` command:

```bash
pnpm link
```

Run Codex through Pixel:

```bash
pixel codex
```

Run Claude Code through Pixel:

```bash
pixel claude
```

Pixel also includes a local stdio MCP server:

```bash
pnpm mcp
```

For Codex, add the MCP server to your Codex config file if you want manual bridge
configuration:

```toml
[mcp_servers.pixel-companion]
command = "node"
args = ["/absolute/path/to/pixel-coding-companion/scripts/pixel-companion-mcp.mjs"]

[mcp_servers.pixel-companion.tools.companion_report]
approval_mode = "approve"
```

Replace `/absolute/path/to/pixel-coding-companion` with your local clone path.

## Scripts

```bash
pnpm dev           # run the development app
pnpm dev:isolated  # run an isolated development app profile
pnpm dev:packaged  # run a packaged isolated dev app for macOS permission testing
pnpm typecheck     # typecheck main/preload/renderer code
pnpm lint          # run ESLint
pnpm test:run      # run tests once
pnpm build         # build Electron output
pnpm build:unpack  # build the local unpacked desktop app
pnpm build:mac     # build macOS distributable artifacts
pnpm open:stable   # open dist/mac-arm64/Pixel Companion.app
```

## Project Docs

- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Companion Sprite Strategy](docs/companion-sprites.md)
- [Security](docs/security.md)

## Contributing

Pixel Companion is early. Useful contributions include:

- clearer setup docs for new users;
- bug reports with screenshots, logs, and OS/agent details;
- better support for Claude Code, Cursor CLI, Roo Code, and other terminal agents;
- safer or more useful token-saving workflows;
- companion sprites and progression polish;
- Vault and Markdown workflow improvements.

If you find a confusing setup step, open an issue. Installation friction is a bug.

## Security Notes

Pixel launches local commands and stores local workspace configuration. Treat it as a
local developer tool with real access to your machine:

- only configure terminals you understand;
- only launch agents and scripts you trust;
- review [docs/security.md](docs/security.md) before adding command execution features;
- be careful when resetting local data or deleting vault folders.

## License

MIT
