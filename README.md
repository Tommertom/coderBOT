# CoderBot

<p align="center">
  <img src="docs/assets/coderbot-logo.png" alt="CoderBot Logo" width="200"/>
</p>

[![npm version](https://badge.fury.io/js/@tommertom%2Fcoderbot.svg)](https://www.npmjs.com/package/@tommertom/coderbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Telegram bot that provides interactive terminal sessions with support for AI coding assistants (GitHub Copilot CLI, OpenCode, Google Gemini, or any CLI-based AI tool). Run it instantly with `npx` or install it globally.

**Powered by the best AI coding assistants:**
- 🤖 **GitHub Copilot CLI** - GitHub's AI pair programmer
- 🚀 **OpenCode** - Open-source AI coding assistant
- ✨ **Google Gemini** - Google's multimodal AI model
- 🔧 **Any CLI tool** - Works with any command-line AI assistant

## Quick Start

**Run instantly with npx (recommended):**

```bash
npx @tommertom/coderbot@latest
```

On first run, it will create a `.env` file that you need to configure with your bot tokens and user IDs. Edit the file and run the command again.

**Or install globally:**

```bash
npm install -g @tommertom/coderbot
coderbot
```

## Platform Compatibility

### Linux / macOS
✅ Fully supported - works out of the box

### Windows
❌ **Not Supported** - CoderBOT uses `node-pty` which requires native compilation.

## Features

- 🖥️ **Interactive Terminal**: Full xterm terminal access via Telegram with PTY support
- 🤖 **AI Coding Assistant Support**: Native integration with GitHub Copilot CLI, OpenCode, Google Gemini, or any command-line AI tool
- 🔐 **Robust Access Control**: Environment-based user authentication with optional auto-kill on unauthorized access
- 📸 **Terminal Screenshots**: Real-time visual feedback with terminal screen captures using Puppeteer
- 🔄 **Auto-Refresh**: Configurable automatic screen refreshes after commands with per-user on/off control
- 📁 **Media File Watcher**: Automatically send generated files (images, videos, documents) to users
- ⌨️ **Full Keyboard Control**: Send any key combination including all control characters (Ctrl+A through Ctrl+Z, special keys)
- 🔄 **Session Management**: Multiple concurrent sessions with automatic timeout handling
- 🎯 **Interactive Menu Support**: Number key support for navigating CLI tool menus
- ⚡ **Quick Commands**: Dot prefix (`.command`) for faster command entry
- 🎮 **ControlBOT**: Administrative bot for managing worker processes (start/stop bots, add/remove tokens, monitor health)

## Configuration

CoderBot uses environment variables for configuration. When you run it for the first time with `npx @tommertom/coderbot@latest`, it will automatically create a `.env` file in your current directory.

### Required Variables

Edit the `.env` file and configure these required variables:

```env
# Telegram Bot Configuration (Required)
# Single bot: provide one token
# Multiple bots: provide comma-separated tokens (each bot runs independently with isolated sessions)
# Example single: TELEGRAM_BOT_TOKENS=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
# Example multi: TELEGRAM_BOT_TOKENS=1234567890:ABCdefGHI,0987654321:XYZabcDEF
TELEGRAM_BOT_TOKENS=your_telegram_bot_token_here

# Access Control (Required)
# Comma-separated list of Telegram User IDs allowed to use the bot
# Example: ALLOWED_USER_IDS=123456789,987654321
ALLOWED_USER_IDS=your_telegram_user_id

# Security (Optional)
# Auto-kill bot on unauthorized access attempt (default: false)
# When enabled, bot shuts down if an unknown user tries to access it
# All allowed users are notified before shutdown
AUTO_KILL=true

# Terminal Configuration (Optional)
# Maximum output lines to keep in buffer (default: 1000)
XTERM_MAX_OUTPUT_LINES=1000

# Session timeout in milliseconds (default: 1800000 = 30 minutes)
# Set to 315360000000 (10 years) to effectively disable timeout
XTERM_SESSION_TIMEOUT=1800000

# Terminal dimensions (defaults: 50 rows, 100 columns)
XTERM_TERMINAL_ROWS=50
XTERM_TERMINAL_COLS=100

# Shell path for PTY sessions (default: /bin/bash)
XTERM_SHELL_PATH=/bin/bash

# Media Folder (Optional)
# Directory to watch for files to send to users
# Files are automatically sent and moved to 'sent' subfolder
# In multi-process mode, each bot gets its own subdirectory: {MEDIA_TMP_LOCATION}/bot-N/
MEDIA_TMP_LOCATION=/tmp/coderBOT_media

# Clean up media directory on worker startup (default: false)
# When true, each bot worker deletes its media directory on startup for a fresh start
# Useful for development/testing, but typically disabled in production
# WARNING: This deletes all files including sent/ folder history
CLEAN_UP_MEDIADIR=false

# Message Management (Optional)
# Time in milliseconds before auto-deleting confirmation messages (default: 10000 = 10 seconds)
# Set to 0 to disable auto-deletion
MESSAGE_DELETE_TIMEOUT=10000

# Auto-refresh Configuration (Optional)
# Automatically refresh the last shown terminal screenshot after sending commands
# Enable/disable auto-refresh globally (default: true)
# Users can override this per-session with the /refresh command
SCREEN_REFRESH_ENABLED=true

# The first refresh happens immediately, then subsequent refreshes at the interval
# Refresh interval in milliseconds (default: 5000 = 5 seconds)
SCREEN_REFRESH_INTERVAL=5000

# Maximum number of automatic refreshes (default: 5)
# Note: First refresh is immediate, then (MAX_COUNT - 1) more at intervals
# Total auto-refresh duration ≈ SCREEN_REFRESH_INTERVAL * (SCREEN_REFRESH_MAX_COUNT - 1)
SCREEN_REFRESH_MAX_COUNT=5

# Bot Token Monitoring (Optional)
# Monitor .env file for changes to bot tokens and dynamically spawn/kill workers
# Check interval in milliseconds (default: 300000 = 5 minutes)
# Set to 0 to disable monitoring
BOT_TOKEN_MONITOR_INTERVAL=300000

# ControlBOT Configuration (Optional)
# Administrative bot for managing worker bot processes
CONTROL_BOT_TOKEN=your_control_bot_token
CONTROL_BOT_ADMIN_IDS=your_telegram_user_id

# Verbose Logging (Optional)
# When enabled, the ControlBOT parent process will forward all console output
# (stdout/stderr) from child bot processes to its own console (default: true)
# Set to false to reduce console noise and only keep logs internally
VERBOSE_LOGGING=true

# Message Placeholders (Optional)
# Define text replacements for [m0] through [m9] placeholders in messages
# When you send a message containing [m0], it will be replaced with the configured value
# Empty values are ignored and placeholders remain unchanged
# Example usage:
#   M0=npm run build
#   M1=git status
#   M2=docker-compose up -d
# Then send: [m0] → expands to: npm run build
M0=
M1=
M2=
M3=
M4=
M5=
M6=
M7=
M8=
M9=
```

**Finding Your Telegram User ID:**
1. Message the bot (even without access)
2. The bot will display your User ID in the response
3. Add your User ID to `ALLOWED_USER_IDS` in `.env`
4. Restart the bot

### Running Multiple Bot Instances

CoderBOT supports running multiple bot instances simultaneously. Each bot runs in **its own isolated child process** for maximum stability and fault isolation.

**Use Cases:**
- Run separate bots for different teams or projects
- Provide development and production bot instances
- Create specialized bots with different configurations

**Configuration:**
Simply provide multiple bot tokens separated by commas in `TELEGRAM_BOT_TOKENS`:

```env
TELEGRAM_BOT_TOKENS=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz,0987654321:XYZabcDEFghiJKLmnoPQRst
```

**Process Isolation:**
- Each bot runs in a separate child process
- If one bot crashes, others continue running
- Parent process automatically restarts failed bot workers
- Each bot has isolated memory and resources
- Independent media directories per bot

**Session Isolation:**
- Each bot maintains completely independent terminal sessions
- The same user can run separate sessions on different bots simultaneously
- Sessions are keyed by bot ID and user ID, preventing any cross-contamination
- All commands, file uploads, and screenshots are bot-specific

**Example Workflow:**
1. User starts `/copilot` on Bot 1 → Opens Copilot session on Bot 1
2. User starts `/opencode` on Bot 2 → Opens OpenCode session on Bot 2
3. Both sessions run independently without interference
4. If Bot 1 crashes, Bot 2 continues running and Bot 1 auto-restarts

## Getting Started

### Installation Methods

**Docker Installation**

1. **Configure the bot** by creating a `.env` file in the project root (see Configuration section above for all available options):

```env
# Required: Your Telegram bot token(s)
TELEGRAM_BOT_TOKENS=your_telegram_bot_token_here

# Required: Comma-separated list of allowed user IDs
ALLOWED_USER_IDS=your_telegram_user_id

# Optional: Other configuration options (see Configuration section)
XTERM_SESSION_TIMEOUT=1800000
MEDIA_TMP_LOCATION=/tmp/coderBOT_media
```

2. **Run the bot** with Docker Compose:

```bash
docker compose up -d
```

3. **View logs** to verify the bot started correctly:

```bash
docker compose logs -f
```

4. **Stop the bot** when needed:

```bash
docker compose down
```

**Note:** The Docker container includes Node.js and npm but does not include AI coding tools (GitHub Copilot CLI, OpenCode, Gemini, etc.). You'll need to install and authenticate these tools inside the container after it's running, or customize the Dockerfile to include them.

## Commands

### Session Management
- `/start` - Show quick start guide
- `/copilot` - Start session with GitHub Copilot CLI
- `/opencode` - Start session with OpenCode
- `/gemini` - Start session with Gemini CLI
  - **Optional**: Provide a directory path to cd into before starting the AI assistant
  - Example: `/copilot /home/user/myproject`
- `/xterm` - Start raw bash terminal session (no AI assistant)
- `/close` - Close the active terminal session
- `/help` - Show complete command reference

### Sending Text to Terminal
- **Regular text messages** - Sent directly to terminal with Enter
- **`.command`** - Quick command (dot prefix removed, Enter added automatically)
- `/send <text>` - Send text to terminal with Enter
- `/keys <text>` - Send text without pressing Enter
- **Tip:** Use `[media]` in your commands - it's replaced with the media directory path
- **Message Placeholders:** Use `[m0]` through `[m9]` in your messages - they're replaced with configured values from your `.env` file (see Message Placeholders section below)

### Special Keys
- `/tab` - Send Tab character
- `/enter` - Send Enter key
- `/space` - Send Space character
- `/delete` - Send Delete key
- `/esc` - Send Escape key
- `/ctrl <char>` - Send any Ctrl+character combination (e.g., `/ctrl c` for Ctrl+C)
- `/ctrlc` - Send Ctrl+C (interrupt) - shortcut
- `/ctrlx` - Send Ctrl+X - shortcut

### Control Characters
The `/ctrl` command supports all 33 ASCII control characters:
- **Letters**: `/ctrl a` through `/ctrl z` (Ctrl+A through Ctrl+Z)
- **Special**: `/ctrl @` `/ctrl [` `/ctrl \` `/ctrl ]` `/ctrl ^` `/ctrl _` `/ctrl ?`

Common examples:
- `/ctrl c` - Interrupt process (SIGINT)
- `/ctrl d` - Send EOF / logout
- `/ctrl z` - Suspend process (SIGTSTP)
- `/ctrl l` - Clear screen
- `/ctrl r` - Reverse search in bash history
- `/ctrl a` - Move to beginning of line
- `/ctrl e` - Move to end of line
- `/ctrl k` - Delete to end of line
- `/ctrl u` - Delete entire line
- `/ctrl w` - Delete word backward

### Menu Navigation
- `/1` `/2` `/3` `/4` `/5` - Send number keys (for AI assistant menu selections)

### Viewing Output
- `/screen` - Capture and view terminal screenshot
- `/refresh` - Show auto-refresh status and configuration
- `/refresh on` - Enable automatic screen refreshes after commands
- `/refresh off` - Disable automatic screen refreshes
- `/md` - Show 5 most recently updated markdown files with clickable menu
- `/macros` - Show all configured message placeholders (m0-m9) and their values
- Click **🔄 Refresh** button on screenshots to update the view

### Administrative
- `/killbot` - Shutdown the bot (emergency stop)

## Quick Reference

### Dot Command Prefix
Send commands quickly by prefixing with a dot:
```
.ls -la          → sends: ls -la + Enter
.git status      → sends: git status + Enter  
.npm start       → sends: npm start + Enter
```
The dot is removed and Enter is automatically pressed. This is faster than typing `/send` every time.

### Message Placeholders
Create shortcuts for frequently used commands by configuring `M0` through `M9` in your `.env` file:

**Configuration Example:**
```env
M0=copy the generated file(s) to /tmp/coderBOT_media/bot-2
M1=git status
M2=docker-compose up -d
M3=npm test
M4=git pull origin main
```

**Usage:**
```
You: [m0]
Bot: ✅ Sent
     (executes: copy the generated file(s) to /tmp/coderBOT_media/bot-2)

You: First let me check: [m1]
Bot: ✅ Sent
     (executes: First let me check: git status)

You: [m0] && [m3]
Bot: ✅ Sent
     (executes: copy the generated file(s) to /tmp/coderBOT_media/bot-2 && npm test)
```

**View Configured Macros:**
```
You: /macros
Bot: ⚙️ Message Placeholders

     [m0] → `copy the generated file(s) to /tmp/coderBOT_media/bot-2`
     [m1] → `git status`
     [m2] → `docker-compose up -d`
     [m3] → `npm test`
     [m4] → `git pull origin main`
     [m5] → undefined
     [m6] → undefined
     [m7] → undefined
     [m8] → undefined
     [m9] → undefined
```

**Features:**
- Placeholders are replaced **before** any other processing
- Multiple placeholders can be used in a single message
- Same placeholder can appear multiple times in one message
- Empty or unconfigured placeholders remain unchanged
- Works with all text messages, including dot commands
- Replacement happens before `/tmp/coderBOT_media/bot-2` file placeholder replacement
- Use `/macros` command to view all configured placeholders
- Requires an active terminal session

## ControlBOT - Administrative Bot

ControlBOT is an optional administrative bot that runs in the parent process and provides powerful management capabilities for all worker bot processes.

### Setup

1. Create a new bot with [@BotFather](https://t.me/BotFather)
2. Add to your `.env`:
   ```env
   CONTROL_BOT_TOKEN=your_control_bot_token
   CONTROL_BOT_ADMIN_IDS=your_telegram_user_id
   ```
3. Restart the application

### Commands

**Process Management:**
- `/status` - Show status of all worker bots
- `/start <bot-id>` - Start a specific bot
- `/stop <bot-id>` - Stop a specific bot
- `/restart <bot-id>` - Restart a specific bot
- `/stopall` - Stop all running bots
- `/startall` - Start all stopped bots
- `/restartall` - Restart all bots

**Bot Configuration:**
- `/listbots` - List all configured bots
- `/addbot <token>` - Add and start a new bot
- `/removebot <bot-id>` - Remove a bot
- `/reload` - Reload .env configuration

**Monitoring:**
- `/logs <bot-id> [lines]` - Show bot logs
- `/health` - Health check for all bots
- `/uptime` - Show uptime for all bots

**Administrative:**
- `/shutdown` - Shutdown entire system

## Security Measures

### Access Control

The bot implements multiple layers of security to protect against unauthorized access:

#### 1. User ID Whitelist

Only Telegram users whose IDs are in the `ALLOWED_USER_IDS` environment variable can use the bot.

```env
# Single user
ALLOWED_USER_IDS=123456789

# Multiple users
ALLOWED_USER_IDS=123456789,987654321,555666777
```

**First user is designated as admin** and receives notifications about unauthorized access attempts.

#### 2. Auto-Kill on Unauthorized Access

When `AUTO_KILL=true` is set, the bot will:
1. Immediately shut down if an unknown user attempts access
2. Send notification to the unauthorized user explaining the shutdown
3. Notify all allowed users with details of the unauthorized attempt
4. Terminate the process to prevent any potential security breach

```env
AUTO_KILL=true  # Enable auto-kill (recommended for production)
```

**When to use AUTO_KILL:**
- ✅ Production environments
- ✅ Bots with access to sensitive systems
- ✅ Environments where you want zero-tolerance for unauthorized access
- ❌ Testing/development (can be annoying during setup)

#### 3. Session Isolation

Each user gets their own isolated terminal session with:
- Separate PTY process
- Independent command history
- Isolated environment variables (within the same system user context)
- Automatic session timeout (configurable via `XTERM_SESSION_TIMEOUT`)

#### 4. Bot Management

**Emergency shutdown:**
```
/killbot
```
This immediately terminates the bot process. Useful if:
- You suspect unauthorized access
- You need to perform maintenance
- You want to force all sessions to close

### Security Best Practices

⚠️ **Critical Security Considerations:**

1. **Terminal Access Risk**
   - The terminal has full access to the bot's environment and file system
   - Users can execute any command the bot's system user can run
   - **Only grant access to completely trusted users**

2. **Sensitive Data Protection**
   - Never expose credentials or secrets through terminal output
   - Be cautious with commands that may display sensitive information
   - Consider running the bot in a restricted environment or container

3. **Environment Isolation**
   - Run the bot in a separate, isolated environment (Docker, VM, or restricted user)
   - Use a dedicated system user with minimal permissions
   - Limit file system access using chroot or containers

4. **Token Security**
   - Keep your `TELEGRAM_BOT_TOKEN` secret
   - Never commit `.env` file to version control
   - Rotate tokens periodically

5. **Network Security**
   - Bot requires internet access to communicate with Telegram
   - Consider firewall rules to limit outbound connections
   - Monitor network traffic for unusual activity

6. **Audit and Monitoring**
   - Review terminal activity regularly (check logs with `pm2 logs coderbot` if using PM2)
   - Monitor for unauthorized access attempts (admin receives notifications)
   - Keep track of which users have access

7. **Session Management**
   - Set reasonable session timeouts (`XTERM_SESSION_TIMEOUT`)
   - Close sessions when not in use (`/close` command)
   - Use `/killbot` to force-close all sessions if needed

8. **Update Dependencies**
   - Regularly update npm packages: `npm audit` and `npm update`
   - Review security advisories for dependencies
   - Keep Node.js version up to date

### Recommended Deployment Architecture (to be considered)

For maximum security, consider this architecture:

```
┌─────────────────────────────────────────┐
│ Isolated Environment (Docker/VM)        │
│ ┌─────────────────────────────────────┐ │
│ │ Limited User (non-root)              │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Coder Bot                        │ │ │
│ │ │ - No sudo access                 │ │ │
│ │ │ - Restricted file system         │ │ │
│ │ │ - AUTO_KILL=true                 │ │ │
│ │ │ - Firewall rules                 │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         ↕ (Telegram API only)
    🌐 Internet
```

## Architecture

CoderBot uses a **multi-process architecture** where each bot instance runs in its own isolated child process. This provides better stability, fault isolation, and resource management.

### Multi-Process Design

**Parent Process:**
- Loads configuration from `.env`
- Spawns one child process per bot token
- Monitors child process health
- Automatically restarts failed workers
- Coordinates graceful shutdown

**Child Processes:**
- Initialize single bot instance
- Create dedicated service container (XtermService, CoderService, etc.)
- Run dedicated MediaWatcherService for bot-specific directory
- Handle all bot interactions independently
- Respond to shutdown signals from parent

**Benefits:**
- ✅ **Fault Isolation**: One bot crash doesn't affect others
- ✅ **Auto-Restart**: Failed workers automatically restart after 5 seconds
- ✅ **Resource Isolation**: Memory leaks and CPU usage isolated per bot
- ✅ **Simplified Media**: Each bot watches its own directory (no IPC needed)
- ✅ **Easy Debugging**: Clear log prefixes, scoped issues

### Per-Bot Media Directories

Each bot worker has its own isolated media directory:

```
{MEDIA_TMP_LOCATION}/
├── bot-0/              # First bot's media directory
│   ├── sent/           # Sent media files
│   └── received/       # Received media files
├── bot-1/              # Second bot's media directory
│   ├── sent/
│   └── received/
└── bot-N/              # Nth bot's media directory
    ├── sent/
    └── received/
```

**Clean Start Option:**

Set `CLEAN_UP_MEDIADIR=true` in `.env` to delete each bot's media directory on startup:

```env
CLEAN_UP_MEDIADIR=true   # Delete media directory on startup (useful for development)
CLEAN_UP_MEDIADIR=false  # Preserve existing media directory (default, recommended for production)
```

This ensures a fresh start by removing all files including the `sent/` folder archive. Useful for development/testing but typically disabled in production.

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Bot Framework**: Grammy (Telegram Bot API)
- **Terminal**: node-pty (PTY/pseudo-terminal)
- **Rendering**: Puppeteer (terminal screenshots)
- **File Watching**: chokidar (file system monitoring)
- **Process Management**: PM2 (optional, for production)

### Data Storage

- **No database required**: All configuration via environment variables
- **Session state**: In-memory (non-persistent across restarts)
- **File storage**: Media files temporarily stored on filesystem

## Media File Watcher

The bot includes an automatic media file watcher that monitors a specified directory for new files.

### How It Works

1. **File Detection**: Bot monitors the media directory (`MEDIA_TMP_LOCATION`)
2. **Automatic Sending**: New files are sent to all allowed users
3. **File Management**: After successful sending, files are moved to `sent` subfolder
4. **Multiple Formats**: Supports images, videos, audio, and documents

### Supported File Types

- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`
- **Videos**: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.flv`
- **Audio**: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, `.aac`
- **Documents**: All other file types

### Configuration

Set the `MEDIA_TMP_LOCATION` environment variable (defaults to `/tmp/coderBOT_media`).

The directories are automatically created on bot startup if they don't exist.

## Troubleshooting

### Bot Not Responding

**Issue**: Bot doesn't respond to commands

**Solutions**:
1. Verify bot is running: `pm2 status` or check process list
2. Check your User ID is in `ALLOWED_USER_IDS`
3. Verify `TELEGRAM_BOT_TOKEN` is correct
4. Check logs: `pm2 logs coderbot` or console output
5. Restart the bot: `pm2 restart coderbot` or restart process

### Session Issues

**Issue**: Commands not working or "No active session" error

**Solutions**:
1. Start a session first: `/copilot`, `/opencode`, `/gemini`, or `/xterm`
2. Check if session timed out (see `XTERM_SESSION_TIMEOUT`)
3. Close and restart session: `/close` then start new session
4. Check logs for session errors

### Screenshot Not Updating

**Issue**: `/screen` shows old or blank output

**Solutions**:
1. Wait a moment after sending commands (terminal needs time to respond)
2. Click the 🔄 Refresh button on the screenshot
3. Check if terminal process is still running
4. Puppeteer may need more resources - check system memory
5. Try closing and reopening the session

### Media Files Not Sending

**Issue**: Files in media directory not automatically sent

**Solutions**:
1. Verify `MEDIA_TMP_LOCATION` directory exists and is writable
2. Check file permissions (bot needs read access)
3. Test file watching manually by placing a file in the media directory
4. Check logs for media watcher errors
5. Verify file is completely written (not being copied)

### Control Characters Not Working

**Issue**: Ctrl+C or other control keys don't work

**Solutions**:
1. Ensure you have an active session
2. Try the dedicated shortcuts: `/ctrlc` instead of `/ctrl c`
3. Check terminal is responsive with `/screen`
4. Session may be frozen - try `/ctrlc` then `/screen`
5. Close and restart session if terminal is unresponsive

### Unauthorized Access Errors

**Issue**: Auto-kill triggered or access denied messages

**Solutions**:
1. Verify your Telegram User ID is in `ALLOWED_USER_IDS`
2. No spaces in the comma-separated list: `123,456,789` not `123, 456, 789`
3. Restart bot after changing `.env` file
4. Check if `AUTO_KILL=true` is causing unnecessary shutdowns during testing
5. Admin receives notifications - check them for details

### Build or Start Errors

**Issue**: Bot fails to start

**Solutions**:
1. Ensure you're using the latest version: `npx @tommertom/coderbot@latest`
2. Check Node.js version is compatible (v18+ required)
3. Verify `.env` file has correct syntax
4. Check for specific error messages in the output
5. Try clearing npm cache: `npm cache clean --force`

### High Memory Usage

**Issue**: Bot consuming too much memory

**Solutions**:
1. Reduce `XTERM_MAX_OUTPUT_LINES` (default: 1000)
2. Reduce `XTERM_TERMINAL_ROWS` (default: 50)
3. Close unused sessions: `/close`
4. Reduce session timeout to close inactive sessions sooner
5. Restart bot periodically to clear memory
6. Monitor with: `pm2 monit`

### AI Assistant Not Starting

**Issue**: `/copilot`, `/opencode`, or `/gemini` command doesn't start the AI

**Solutions**:
1. Ensure the CLI tool is installed on the system:
   - GitHub Copilot: `gh copilot --version` or `copilot --version`
   - OpenCode: `opencode --version` or check your installation method
   - Google Gemini: `gemini --version` or check your installation method
2. Check if CLI tool is in PATH
3. Verify CLI tool authentication is configured:
   - Copilot: `gh auth status`
   - OpenCode: Check API key configuration in environment or config
   - Gemini: Check Google AI API key configuration
4. Try `/xterm` then manually start the tool to see error messages
5. Check terminal output for authentication or configuration errors

---

**⚠️ Security Reminder**: This bot provides terminal access. Only grant access to completely trusted users and follow the security best practices outlined above.
