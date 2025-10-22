# CoderBot

[![npm version](https://badge.fury.io/js/@tommertom%2Fcoderbot.svg)](https://www.npmjs.com/package/@tommertom/coderbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Telegram bot that provides interactive terminal sessions with support for AI coding assistants (GitHub Copilot, Claude, Cursor, or any CLI-based AI tool). Run it instantly with `npx` or install it globally.

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

**Windows Users: Please use Docker**
- See [DOCKER_README.md](DOCKER_README.md) for setup instructions
- Docker provides full compatibility without build tool requirements


## Features

- 🖥️ **Interactive Terminal**: Full xterm terminal access via Telegram with PTY support
- 🤖 **AI Coding Assistant Support**: Works with GitHub Copilot CLI, Claude CLI, Cursor CLI, or any command-line AI tool
- 🔐 **Robust Access Control**: Environment-based user authentication with optional auto-kill on unauthorized access
- 📸 **Terminal Screenshots**: Real-time visual feedback with terminal screen captures using Puppeteer
- 📁 **Media File Watcher**: Automatically send generated files (images, videos, documents) to users
- ⌨️ **Full Keyboard Control**: Send any key combination including all control characters (Ctrl+A through Ctrl+Z, special keys)
- 🔄 **Session Management**: Multiple concurrent sessions with automatic timeout handling
- 🎯 **Interactive Menu Support**: Number key support for navigating CLI tool menus
- 🔗 **URL Tracking**: Automatically detects and stores all URLs from terminal output
- ⚡ **Quick Commands**: Dot prefix (`.command`) for faster command entry

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
# Refresh interval in milliseconds (default: 5000 = 5 seconds)
SCREEN_REFRESH_INTERVAL=5000

# Maximum number of automatic refreshes (default: 5)
# Total auto-refresh duration = SCREEN_REFRESH_INTERVAL * SCREEN_REFRESH_MAX_COUNT
SCREEN_REFRESH_MAX_COUNT=5

# Bot Token Monitoring (Optional)
# Monitor .env file for changes to bot tokens and dynamically spawn/kill workers
# Check interval in milliseconds (default: 300000 = 5 minutes)
# Set to 0 to disable monitoring
BOT_TOKEN_MONITOR_INTERVAL=300000
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
2. User starts `/claude` on Bot 2 → Opens Claude session on Bot 2
3. Both sessions run independently without interference
4. If Bot 1 crashes, Bot 2 continues running and Bot 1 auto-restarts

## Getting Started

### Installation Methods

**Method 1: NPX (Recommended - No installation needed)**

```bash
# Run directly without installation
npx @tommertom/coderbot@latest

# On first run, it creates .env file
# Edit .env with your configuration
# Run again to start the bot
npx @tommertom/coderbot@latest
```

**Method 2: Global Installation**

```bash
# Install globally
npm install -g @tommertom/coderbot

# Run from anywhere
coderbot
```

**Method 3: Docker (Isolated Environment)**

```bash
# Create docker-compose.yml and .env files
# (See DOCKER_README.md for examples)

# Create and configure .env
nano .env  # Edit with your configuration

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

See [DOCKER_README.md](DOCKER_README.md) for detailed Docker setup instructions including example docker-compose.yml.

### Configuration

After installation, edit the `.env` file in your current directory:

```bash
# The .env file is created automatically on first run
# Edit it with your favorite text editor
nano .env
# or
vim .env
# or
code .env
```

**Required configuration:**
- `TELEGRAM_BOT_TOKENS` - Your bot token(s) from [@BotFather](https://t.me/botfather)
- `ALLOWED_USER_IDS` - Your Telegram user ID(s)

**Finding your Telegram User ID:**
1. Start the bot (even without proper configuration)
2. Send any message to your bot
3. The bot will display your user ID in the response
4. Add your ID to `ALLOWED_USER_IDS` in `.env`
5. Restart the bot

### Running the Bot

**With npx:**
```bash
npx @tommertom/coderbot@latest
```

**With global installation:**
```bash
coderbot
```

**Production with PM2** (if installed globally):\n```bash\n# Using PM2 to manage the coderbot process\npm2 start coderbot --name coderbot\npm2 logs coderbot       # View logs\npm2 restart coderbot    # Restart\npm2 stop coderbot       # Stop\npm2 status              # Check status\n```

**Monitoring Logs:**

All logs include prefixes for easy identification:
- `[Parent]` - Parent process managing workers
- `[Worker bot-0]` - First bot worker
- `[Worker bot-1]` - Second bot worker
- `[bot-0]` - Bot-specific service logs (media watcher, etc.)

Example log output:
```
[Parent] Starting CoderBot parent process...
[Parent] Spawning bot worker 0...
[Worker bot-0] Starting initialization...
[Worker bot-0] Configuration loaded successfully
[bot-0] Media watcher initialized: /tmp/coderBOT_media/bot-0
[Worker bot-0] ✅ Bot started successfully
```

### Prerequisites: Authenticating AI Coding Tools

**Important:** Before you can use the AI coding assistants (`/copilot`, `/claude`, `/cursor`), you must first authenticate these tools on the server where the bot is running.

**Required Authentication Steps:**

1. **Run each AI tool manually in a terminal** on the server to complete their authentication flow:
   ```bash
   # GitHub Copilot CLI
   github-copilot-cli auth
   
   # Claude CLI (Anthropic)
   claude auth
   
   # Cursor CLI
   cursor auth
   ```

2. **Authenticate Git and GitHub CLI** (required by most AI tools):
   ```bash
   # GitHub CLI authentication
   gh auth login
   
   # Git configuration
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

3. **Verify authentication** by running each tool:
   ```bash
   github-copilot-cli --version
   claude --version
   cursor --version
   gh auth status
   ```

**Why This Is Needed:**
- AI coding tools require API keys or OAuth authentication
- Authentication tokens are stored in your system's configuration
- The bot runs these tools as the system user, so they must be pre-authenticated
- Each tool has its own authentication mechanism (GitHub account, API keys, etc.)

**Note:** Authentication only needs to be done once per server. The credentials persist across bot restarts.

## Commands

### Session Management
- `/start` - Show quick start guide
- `/copilot [directory]` - Start session with GitHub Copilot CLI
- `/claude [directory]` - Start session with Claude CLI
- `/cursor [directory]` - Start session with Cursor CLI
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
- `/urls` - Show all URLs discovered in terminal output
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

### URL Tracking
The bot automatically captures all URLs from terminal output:
```
You: .npm run dev
Bot: [Terminal shows: Server running at http://localhost:3000]

You: /urls
Bot: 🔗 Discovered URLs (1)
     `http://localhost:3000`
```
URLs persist throughout the session and can be retrieved anytime with `/urls`.

## How to Use

### Starting a Session with an AI Assistant

Use one of the AI assistant commands to start a session:

```
You: /copilot
Bot: 🖥️ Terminal Session Started
     
     Bash session is now active.
     [List of available commands]
     
     [Screenshot of terminal]
```

The bot automatically starts the specified AI CLI tool (`copilot`, `claude`, or `cursor`) and displays the terminal.

**Optional Directory Argument:**

You can specify a directory to change into before starting the AI assistant:

```
You: /copilot /home/user/myproject
Bot: 🖥️ Terminal Session Started
     [Terminal starts in /home/user/myproject with Copilot ready]
```

This is useful when you want to work on a specific project without having to manually navigate to it.

### Interacting with the AI Assistant

Simply send your questions or commands as regular text messages:

```
You: create a React component for a todo list
Bot: ✅ Sent - Use /screen to view the output or refresh any existing screen.

You: /screen
Bot: 🖥️ Terminal Screenshot
     [Screenshot showing the AI's response]
```

### Navigating AI Menus

When the AI presents numbered options, use the number commands:

```
AI shows:
  1. Accept changes
  2. Reject changes
  3. Edit manually

You: /1
Bot: ✅ Sent: 1
```

### Working with Generated Files

When the AI generates files you want to receive:

```
You: create a diagram and copy it to [media]
Bot: [AI generates diagram.png]
     ✅ Sent - Use /screen to view the output

# The [media] placeholder is replaced with the actual media directory path
# Any file copied there is automatically sent to you
Bot: 📁 [Sends diagram.png to you]
```

### Using Raw Terminal Mode

For direct bash access without an AI assistant:

```
You: /xterm
Bot: 🖥️ Terminal Session Started
     [Terminal with bash prompt]

You: ls -la
Bot: ✅ Sent - Use /screen to view the output

You: /screen
Bot: [Screenshot showing directory listing]
```

### Sending Special Keys

Control your terminal with special key commands:

```
# Stop a running process
You: /ctrlc

# Clear the terminal screen
You: /ctrl l

# Navigate command history
You: /ctrl r
You: git push
```

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

### Incident Response

If you suspect unauthorized access:

1. **Immediate**: Use `/killbot` to shut down the bot
2. **Investigate**: Check logs (PM2: `pm2 logs coderbot`, Docker: `docker-compose logs -f`, or console output)
3. **Rotate**: Change your `TELEGRAM_BOT_TOKEN` via @BotFather
4. **Review**: Audit `ALLOWED_USER_IDS` list
5. **Enable**: Set `AUTO_KILL=true` if not already enabled
6. **Restart**: Restart the bot with updated configuration

## Architecture

CoderBot uses a **multi-process architecture** where each bot instance runs in its own isolated child process. This provides better stability, fault isolation, and resource management.

### Multi-Process Design

**Parent Process (`app.ts`):**
- Loads configuration from `.env`
- Spawns one child process per bot token
- Monitors child process health
- Automatically restarts failed workers
- Coordinates graceful shutdown

**Child Processes (`bot-worker.ts`):**
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

### Core Components

- **app.ts**: Parent process manager, spawns and monitors bot workers
- **bot-worker.ts**: Child process that runs a single bot instance
- **CoderBot**: Handles AI assistant sessions (Copilot, Claude, Cursor) and user commands
- **XtermBot**: Manages raw terminal sessions and special key commands
- **XtermService**: PTY session management using node-pty
- **XtermRendererService**: Renders terminal output to images using Puppeteer
- **MediaWatcherService**: Monitors bot-specific directory and automatically sends files to users
- **AccessControlMiddleware**: User authentication and authorization

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

### Service Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Telegram API                       │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│                  Grammy Bot                          │
│           (Telegram Bot Framework)                   │
└─────┬─────────────────────────────────────────┬─────┘
      │                                         │
┌─────▼─────────────┐               ┌──────────▼──────┐
│ AccessControl     │               │ Message Router  │
│ Middleware        │               │                 │
└─────┬─────────────┘               └─────────┬───────┘
      │                                       │
      │         ┌─────────────────────────────┼─────────┐
      │         │                             │         │
┌─────▼─────────▼───┐         ┌──────────────▼───┐  ┌─▼──────────┐
│   CoderBot         │         │   XtermBot       │  │ Media      │
│ (AI Assistants)    │         │ (Raw Terminal)   │  │ Watcher    │
└─────┬──────────────┘         └────────┬─────────┘  └─┬──────────┘
      │                                 │               │
      └────────────┬────────────────────┘               │
                   │                                    │
         ┌─────────▼─────────┐              ┌──────────▼─────────┐
         │  XtermService     │              │  File System       │
         │  (PTY Sessions)   │              │  Monitoring        │
         └─────────┬─────────┘              └────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ XtermRenderer      │
         │ Service (Puppeteer)│
         └────────────────────┘
```

### Session Flow

1. User sends command (e.g., `/copilot`)
2. AccessControl middleware verifies user
3. CoderBot/XtermBot handles command
4. XtermService creates PTY session
5. User interacts via text messages
6. Commands sent to PTY process
7. Output buffered and rendered on demand
8. Screenshot generated via Puppeteer
9. Image sent back to user via Telegram

### File Watching Flow

1. MediaWatcherService monitors directory
2. File detected (via chokidar)
3. File sent to all allowed users
4. File moved to 'sent' subfolder
5. Ready for next file

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

### Usage Examples

**Manual file copy:**
```bash
cp /path/to/file.jpg /tmp/coderBOT_media/
# Bot automatically sends it and moves to sent/
```

**Using [media] placeholder in AI commands:**
```
You: generate a chart and save it to [media]/chart.png
# The AI saves the file to the media directory
# Bot automatically detects and sends it
```

**From within the terminal session:**
```bash
You: /keys wget https://example.com/image.png -O [media]/image.png
You: /enter
# File downloads to media directory
# Bot automatically sends it
```



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
1. Start a session first: `/copilot`, `/claude`, `/cursor`, or `/xterm`
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
1. Ensure you're using the latest version: `npx @tommertom/coderbot@latest@latest`
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

**Issue**: `/copilot`, `/claude`, or `/cursor` command doesn't start the AI

**Solutions**:
1. Ensure the CLI tool is installed on the system:
   - GitHub Copilot: `copilot --version`
   - Claude: `claude --version`
   - Cursor: `cursor --version`
2. Check if CLI tool is in PATH
3. Verify CLI tool authentication is configured
4. Try `/xterm` then manually start the tool to see error messages
5. Check terminal output for authentication or configuration errors

## Common Use Cases

### Use Case 1: Code Review with AI

```
You: /copilot
You: review this file: src/app.ts
AI: [Provides code review]
You: /2  # Select option 2 from AI menu
```

### Use Case 2: Generate and Receive Diagram

```
You: /claude
You: create a system architecture diagram and save to [media]/architecture.png
AI: [Generates diagram]
Bot: 📁 [Automatically sends architecture.png]
```

### Use Case 3: Debug Running Process

```
You: /xterm
You: node index.js
# Process starts...
You: /ctrlc  # Stop the process
You: /screen  # View output
```

### Use Case 4: Batch File Processing

```
You: /xterm
You: for f in *.jpg; do convert $f -resize 50% [media]/$f; done
# Bot automatically sends each resized image
```

## Contributing

This project is maintained as a published npm package. To contribute:

1. **Report Issues**: [GitHub Issues](https://github.com/Tommertom/coderBOT/issues)
2. **Feature Requests**: Open an issue with your suggestion
3. **Bug Reports**: Include steps to reproduce and your environment details

## Support

For issues and questions:
- **GitHub Issues**: [Report bugs or request features](https://github.com/Tommertom/coderBOT/issues)
- **Troubleshooting**: See the Troubleshooting section above
- **NPM Package**: [@tommertom/coderbot](https://www.npmjs.com/package/@tommertom/coderbot)

## Links

- **NPM Package**: [@tommertom/coderbot](https://www.npmjs.com/package/@tommertom/coderbot)
- **GitHub Repository**: [Tommertom/coderBOT](https://github.com/Tommertom/coderBOT)
- **Documentation**: [Multi-Process Architecture](docs/multi-process-architecture.md)

---

**⚠️ Security Reminder**: This bot provides terminal access. Only grant access to completely trusted users and follow the security best practices outlined above.
