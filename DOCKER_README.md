# Docker Setup Guide

Run CoderBot in Docker using the published npm package. This is the **recommended method for Windows users**.

## Prerequisites

- Docker and Docker Compose installed
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- Your Telegram user ID

## Quick Start

### 1. Create docker-compose.yml

Create a `docker-compose.yml` file with the following content:

```yaml
version: "3.8"

services:
  coderbot:
    image: node:20-bookworm
    container_name: coderbot
    restart: unless-stopped

    # Quick start command using npx (no build required)
    command: >
      bash -c "
      apt-get update && apt-get install -y curl git bash &&
      apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 xdg-utils &&
      rm -rf /var/lib/apt/lists/* &&
      if [ ! -f /app/.env ]; then
        echo '⚠️  No .env file found. Please create /app/.env with your configuration.';
        exit 1;
      fi &&
      npm install -g @github/copilot &&
      npm install -g @anthropic-ai/claude-code &&
      cd /app &&
      npx -y @tommertom/coderbot
      "

    working_dir: /app

    environment:
      - NODE_ENV=production
      - XTERM_SHELL_PATH=/bin/bash

    volumes:
      # REQUIRED: Mount your .env file
      - ./.env:/app/.env:ro

      # Persist logs
      - ./logs:/app/logs

      # Media folders for each bot worker
      - ./media:/tmp/coderBOT_media

      # Persist terminal history
      - terminal_history:/home/node

      # Mount a working directory for file operations
      - bot_workspace:/workspace

      # Persist GitHub CLI authentication (for Copilot CLI)
      - gh_config:/home/node/.config/gh

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
        reservations:
          cpus: "0.5"
          memory: 512M

    # Security options
    security_opt:
      - no-new-privileges:true

    network_mode: "bridge"

    # Health check
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  terminal_history:
    driver: local
  bot_workspace:
    driver: local
  gh_config:
    driver: local
```

### 2. Create .env File

Create a `.env` file in the same directory:

```env
# Telegram Bot Configuration (Required)
TELEGRAM_BOT_TOKENS=your_bot_token_here

# Access Control (Required)
ALLOWED_USER_IDS=your_telegram_user_id

# Security (Optional)
AUTO_KILL=true

# Terminal Configuration (Optional)
XTERM_MAX_OUTPUT_LINES=1000
XTERM_SESSION_TIMEOUT=1800000
XTERM_TERMINAL_ROWS=50
XTERM_TERMINAL_COLS=100
XTERM_SHELL_PATH=/bin/bash

# Media Folder (Optional)
MEDIA_TMP_LOCATION=/tmp/coderBOT_media
CLEAN_UP_MEDIADIR=false

# Message Management (Optional)
MESSAGE_DELETE_TIMEOUT=10000
```

**Finding Your Telegram User ID:**
1. Start the bot (even without proper config)
2. Send any message to your bot
3. The bot will display your user ID
4. Add it to `ALLOWED_USER_IDS` in `.env`
5. Restart the bot

### 3. Start the Bot

```bash
docker-compose up -d
```

### 4. View Logs

```bash
docker-compose logs -f
```

### 5. Stop the Bot

```bash
docker-compose down
```

## What's Running

The docker-compose.yml uses `npx @tommertom/coderbot` to run the latest published version:

- ✅ No local build required
- ✅ Always get the latest version on restart
- ✅ Minimal setup
- ✅ Automatic dependency installation
- ✅ Pre-installs GitHub Copilot CLI, Claude AI, and other AI tools

**Supported AI Assistants:**
- GitHub Copilot CLI (via `@github/copilot`)
- Claude AI (via `@anthropic-ai/claude-code`)
- Google Gemini (configure API key)
- Cursor and other CLI-based AI tools

## Configuration

### Required Variables

- `TELEGRAM_BOT_TOKENS` - Your bot token from [@BotFather](https://t.me/botfather)
  - Single bot: `TELEGRAM_BOT_TOKENS=token1`
  - Multiple bots: `TELEGRAM_BOT_TOKENS=token1,token2`
- `ALLOWED_USER_IDS` - Comma-separated Telegram user IDs
  - Example: `ALLOWED_USER_IDS=123456789,987654321`

### Optional Variables

- `AUTO_KILL` - Auto-shutdown on unauthorized access (default: `false`)
- `XTERM_MAX_OUTPUT_LINES` - Terminal buffer size (default: `1000`)
- `XTERM_SESSION_TIMEOUT` - Session timeout in ms (default: `1800000` = 30 min)
- `XTERM_TERMINAL_ROWS` - Terminal rows (default: `50`)
- `XTERM_TERMINAL_COLS` - Terminal columns (default: `100`)
- `XTERM_SHELL_PATH` - Shell to use (default: `/bin/bash`)
- `MEDIA_TMP_LOCATION` - Media directory (default: `/tmp/coderBOT_media`)
- `CLEAN_UP_MEDIADIR` - Delete media on startup (default: `false`)
- `MESSAGE_DELETE_TIMEOUT` - Auto-delete messages in ms (default: `10000`)

## Volumes and Persistence

### Host-Mounted Volumes

- `./logs` - Bot application logs
- `./media` - Media files for each bot worker
- `./.env` - Configuration (read-only)

### Docker Volumes

- `terminal_history` - Persists terminal command history
- `bot_workspace` - Working directory for file operations
- `gh_config` - GitHub CLI authentication (for Copilot)

## Installing AI Tools

The docker-compose.yml automatically installs:
- `@github/copilot` - GitHub Copilot CLI
- `@anthropic-ai/claude-code` - Claude AI CLI

For Google Gemini and other AI tools, you'll need to install them manually or add them to the Docker setup.

### Authenticating AI Tools

You need to authenticate these tools **inside the running container**:

```bash
# Enter the container
docker exec -it coderbot bash

# Authenticate GitHub Copilot
gh copilot auth
# Or if using older version:
github-copilot-cli auth

# Authenticate GitHub CLI (required for Copilot)
gh auth login

# Authenticate Claude (if using)
claude auth

# For Google Gemini, set your API key:
export GOOGLE_AI_API_KEY=your_api_key_here
# Or configure according to Gemini CLI documentation

# Exit the container
exit
```

These authentications persist in the `gh_config` volume.

## Resource Limits

The default configuration limits:
- **CPU**: 2 cores max, 0.5 cores reserved
- **Memory**: 2GB max, 512MB reserved

Adjust in `docker-compose.yml` under `deploy.resources` based on your needs.

## Security

### Built-in Security

- `no-new-privileges:true` - Prevents privilege escalation
- Read-only `.env` mount
- Network isolation via bridge network

### Bot Security Features

- User ID whitelist (`ALLOWED_USER_IDS`)
- Auto-kill on unauthorized access (`AUTO_KILL=true`)
- Session timeouts
- First user designated as admin

### Recommendations

1. Only grant access to trusted users
2. Enable `AUTO_KILL=true` in production
3. Use strong, unique bot tokens
4. Keep `.env` file secure
5. Regularly update the bot: `docker-compose pull && docker-compose up -d`

## Troubleshooting

### Bot Not Starting

**Check logs:**
```bash
docker-compose logs coderbot
```

**Common issues:**
1. Missing `.env` file
2. Invalid bot token
3. Incorrect user ID format (no spaces in comma-separated list)

### Bot Not Responding

1. Verify bot is running: `docker ps`
2. Check logs: `docker-compose logs -f`
3. Verify your user ID is in `ALLOWED_USER_IDS`
4. Restart: `docker-compose restart`

### AI Tools Not Working

**GitHub Copilot:**
```bash
docker exec -it coderbot bash
gh auth status
gh copilot --version
```

**Claude:**
```bash
docker exec -it coderbot bash
claude --version
```

**Google Gemini:**
```bash
docker exec -it coderbot bash
# Check your Gemini installation and API key configuration
```

Re-authenticate if needed.

### High Memory Usage

Reduce these in `.env`:
- `XTERM_MAX_OUTPUT_LINES=500`
- `XTERM_TERMINAL_ROWS=30`

Or increase Docker resources in `docker-compose.yml`.

### Container Keeps Restarting

Check logs for errors:
```bash
docker-compose logs --tail=100 coderbot
```

Common causes:
- Invalid `.env` configuration
- Missing required environment variables
- Port conflicts

## Updating

### Update to Latest Version

```bash
# Stop the bot
docker-compose down

# Pull latest Node.js image
docker-compose pull

# Start with latest npm package
docker-compose up -d

# The bot will automatically use the latest @tommertom/coderbot version
```

### Rollback to Specific Version

Edit `docker-compose.yml` and change the command:
```yaml
npx -y @tommertom/coderbot@0.7.3
```

Then:
```bash
docker-compose up -d
```

## Production Deployment

### 1. Use Environment File

Instead of inline variables:
```yaml
env_file:
  - .env
```

### 2. Set Up Log Rotation

Prevent logs from growing indefinitely:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 3. Enable Auto-Kill

In `.env`:
```env
AUTO_KILL=true
```

### 4. Monitor Health

Use Docker's health check feature (already configured).

### 5. Backup Volumes

Regularly backup:
- `.env` file
- `gh_config` volume (GitHub auth)
- `bot_workspace` volume (if storing important files)

```bash
# Backup gh_config volume
docker run --rm -v coderbot_gh_config:/data -v $(pwd):/backup alpine tar czf /backup/gh_config_backup.tar.gz -C /data .
```

## Advanced Configuration

### Multiple Bot Instances

Run multiple independent bots:

```env
TELEGRAM_BOT_TOKENS=token1,token2,token3
```

Each bot gets:
- Separate child process
- Independent media directory (`/tmp/coderBOT_media/bot-0/`, `bot-1/`, etc.)
- Isolated sessions
- Auto-restart on crash

### Custom Working Directory

Mount your project directory:
```yaml
volumes:
  - /path/to/your/project:/workspace
```

### Custom Shell

In `.env`:
```env
XTERM_SHELL_PATH=/bin/zsh
```

(Ensure the shell is available in the container)

## Support

- **Issues**: [GitHub Issues](https://github.com/Tommertom/shippi-coderBOT/issues)
- **Main README**: [README.md](README.md)
- **NPM Package**: [@tommertom/coderbot](https://www.npmjs.com/package/@tommertom/coderbot)
