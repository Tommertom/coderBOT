# Docker Quick Start

Run CoderBot in Docker using the published npm package.

## Prerequisites

- Docker and Docker Compose installed
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- Your Telegram user ID

## Quick Start

1. **Create docker-compose.yml**:
See [DOCKER_GUIDE.md](DOCKER_GUIDE.md) for the complete docker-compose.yml example.

2. **Create and configure .env**:
```bash
# Create .env file with your configuration
nano .env  # Add your bot token and user ID
```

3. **Start the bot**:
```bash
docker-compose up -d
```

4. **View logs**:
```bash
docker-compose logs -f
```

5. **Stop the bot**:
```bash
docker-compose down
```

## What's Running

The docker-compose.yml uses `npx @tommertom/coderbot` to run the latest published version. This means:

- ✅ No local build required
- ✅ Always get the latest version on restart
- ✅ Minimal setup
- ✅ Automatic dependency installation

## Configuration

Edit `.env` file to configure:
- `TELEGRAM_BOT_TOKENS` - Your bot token(s)
- `ALLOWED_USER_IDS` - Telegram user IDs allowed to use the bot
- Other settings (see dot-env.template for all options)

## Volumes

Data is persisted in:
- `./logs` - Bot logs
- `./media` - Media files for each bot worker
- Docker volumes for terminal history and GitHub auth

## Full Documentation

See [DOCKER_GUIDE.md](DOCKER_GUIDE.md) for:
- Advanced configuration
- Installing AI tools (GitHub Copilot, etc.)
- Security settings
- Troubleshooting
- Production deployment

## Support

- **Issues**: [GitHub Issues](https://github.com/Tommertom/coderBOT/issues)
- **Main README**: [README.md](README.md)
- **Docker Guide**: [DOCKER_GUIDE.md](DOCKER_GUIDE.md)
