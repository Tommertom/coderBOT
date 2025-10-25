# CoderBOT Docker Runner Script

## Overview

The `run-coderbot-docker.sh` script provides a fully automated way to deploy coderBOT in a minimal Docker container with all necessary dependencies including GitHub CLI and GitHub Copilot CLI.

## Features

✅ **Automated Setup** - Creates all necessary files and configurations automatically  
✅ **Minimal Docker Image** - Uses `node:20-slim` as base for smaller footprint  
✅ **GitHub Integration** - Installs and configures GitHub CLI and Copilot CLI  
✅ **Security** - Works in `/tmp` directory with isolated environments  
✅ **Easy Management** - Includes docker-compose for simple container management  
✅ **Production Ready** - Includes restart policies and proper logging  

## Prerequisites

- Docker installed and running
- Docker Compose installed
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID
- GitHub Personal Access Token (PAT) with Copilot access

### Getting a GitHub PAT

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "CoderBOT Copilot")
4. Select scopes: `read:user`, `user:email`, and ensure Copilot access
5. Click "Generate token" and copy it immediately

## Usage

### Basic Usage

```bash
./scripts/run-coderbot-docker.sh <BOT_TOKEN> <USER_ID> <GITHUB_PAT>
```

### Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token(s) from @BotFather - comma-separated for multiple | `123456789:ABCdefGHIjkl...` or `123:ABC...,456:DEF...` |
| `USER_ID` | Your Telegram user ID(s) for access control - comma-separated for multiple | `987654321` or `111,222,333` |
| `GITHUB_PAT` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx...` |

### Example

```bash
./scripts/run-coderbot-docker.sh \
  "123456789:ABCdefGHIjklMNOpqrsTUVwxyz" \
  "987654321" \
  "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456"
```

## What It Does

The script performs the following steps:

1. **Creates Working Directory**
   - Generates unique directory in `users/coderbot-instance-<pid>`
   - Located in the project root for persistence
   - Changes to this directory for all operations

2. **Generates `.env` File**
   - Creates configuration from provided arguments
   - Sets up bot token and user access control
   - Configures default settings for terminal, media, and auto-refresh

3. **Creates Custom Dockerfile**
   - Minimal Linux setup based on `node:20-slim`
   - Installs bash, git, and essential tools
   - Installs GitHub CLI
   - Includes all Puppeteer dependencies for terminal screenshots
   - Sets up GitHub authentication and Copilot CLI installation
   - Configures automatic startup with `npx @tommertom/coderbot@latest`

4. **Generates docker-compose.yml**
   - Simplifies container management
   - Configures volumes for logs and media
   - Sets up environment variables
   - Enables auto-restart policy

5. **Creates Helper Scripts**
   - `run-docker.sh` - Quick start script
   - `README.md` - Documentation for the instance

6. **Optional Automatic Start**
   - Prompts to build and start container immediately
   - Or allows manual start later

## Generated Files

After running, the working directory contains:

```
users/coderbot-instance-<pid>/
├── .env                   # Bot configuration (SENSITIVE!)
├── Dockerfile             # Custom minimal Docker image
├── docker-compose.yml     # Docker Compose configuration
├── run-docker.sh          # Quick start script
├── README.md              # Instance documentation
└── logs/                  # Created at runtime
```

## Managing the Container

### Start the Container

```bash
cd users/coderbot-instance-<pid>
./run-docker.sh
```

Or manually:

```bash
docker-compose up -d
```

### View Logs

```bash
docker-compose logs -f
```

### Stop the Container

```bash
docker-compose down
```

### Restart the Container

```bash
docker-compose restart
```

### Access Container Shell

```bash
docker-compose exec coderbot bash
```

### Test GitHub Copilot CLI

```bash
docker-compose exec coderbot bash
gh copilot suggest "how to list files in linux"
```

## Docker Image Details

The generated Dockerfile creates a minimal image with:

- **Base**: `node:20-slim` (Debian-based)
- **Size**: ~500MB (much smaller than the full development image)
- **Includes**:
  - Node.js 20 (LTS)
  - Bash shell
  - Git
  - GitHub CLI (`gh`)
  - GitHub Copilot CLI extension
  - Puppeteer dependencies (for terminal screenshots)
  - Essential Linux utilities

### Startup Process

When the container starts:

1. Authenticates with GitHub using the provided PAT
2. Installs GitHub Copilot CLI extension
3. Verifies installation
4. Runs `npx @tommertom/coderbot@latest`

## Security Considerations

⚠️ **Important Security Notes:**

1. **Sensitive Data**: The `.env` file contains your bot token and GitHub PAT
2. **Working Directory**: Located in `/tmp` for automatic cleanup on reboot
3. **Access Control**: Only specified Telegram user ID can use the bot
4. **Auto-Kill**: Enabled by default - bot shuts down on unauthorized access
5. **Token Isolation**: Each run creates a separate isolated environment

### Best Practices

- Never commit the generated `.env` file to version control
- Rotate your GitHub PAT regularly
- Use a dedicated bot token (not shared across projects)
- Monitor container logs for unauthorized access attempts
- Delete the working directory when no longer needed

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Verify Docker is running
docker info

# Check .env configuration
cat .env
```

### GitHub Copilot Not Working

```bash
# Check extension installation
docker-compose exec coderbot gh extension list

# Verify authentication
docker-compose exec coderbot gh auth status

# Test Copilot
docker-compose exec coderbot gh copilot suggest "test"
```

### Bot Not Responding

1. Check if container is running: `docker-compose ps`
2. View logs: `docker-compose logs -f`
3. Verify bot token is correct in `.env`
4. Ensure your user ID is in `ALLOWED_USER_IDS`
5. Try sending `/start` to the bot

### Permission Issues

```bash
# Ensure script is executable
chmod +x run-coderbot-docker.sh

# Check Docker permissions
docker ps

# If needed, add user to docker group
sudo usermod -aG docker $USER
```

## Advanced Configuration

### Customizing the .env File

After running the script, you can edit the `.env` file to customize:

```bash
### Edit Configuration
```bash
cd users/coderbot-instance-<pid>
nano .env
docker-compose restart
```

### Adding Multiple Users

Edit `.env` and add multiple user IDs:

```env
ALLOWED_USER_IDS=123456789,987654321,555555555
```

### Running Multiple Bot Instances

Run the script multiple times with different bot tokens:

```bash
# Bot 1
./scripts/run-coderbot-docker.sh "$BOT_TOKEN_1" "$USER_ID" "$GITHUB_PAT"

# Bot 2
./scripts/run-coderbot-docker.sh "$BOT_TOKEN_2" "$USER_ID" "$GITHUB_PAT"
```

Each instance will have its own isolated directory and container.

### Persistent Storage

To keep the working directory across reboots, use a different location:

Edit the script and change:
```bash
WORK_DIR="/home/user/coderbot-instances/instance-$$"
```

## Cleanup

### Remove a Single Instance

```bash
cd users/coderbot-instance-<pid>
docker-compose down -v  # Remove containers and volumes
cd ../..
rm -rf users/coderbot-instance-<pid>
```

### Remove All CoderBOT Containers

```bash
docker ps -a | grep coderbot | awk '{print $1}' | xargs docker rm -f
docker images | grep coderbot | awk '{print $3}' | xargs docker rmi -f
```

## Integration with CI/CD

You can use this script in automated deployments:

```bash
#!/bin/bash
# deploy-coderbot.sh

export BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
export USER_ID="${TELEGRAM_USER_ID}"
export GITHUB_PAT="${GH_COPILOT_PAT}"

./scripts/run-coderbot-docker.sh "$BOT_TOKEN" "$USER_ID" "$GITHUB_PAT"
```

## Comparison with Main Dockerfile

| Feature | Main Dockerfile | Docker Runner Script |
|---------|----------------|---------------------|
| Base Image | `node:20-bookworm` (full) | `node:20-slim` (minimal) |
| Size | ~1.5GB | ~500MB |
| Tools | Many dev tools | Essential only |
| Use Case | Development | Production deployment |
| Flexibility | Highly configurable | Quick deployment |
| Setup | Manual configuration | Fully automated |

## Support

For issues or questions:

1. Check the logs: `docker-compose logs -f`
2. Review the generated README in the working directory
3. Verify all prerequisites are met
4. Check the main coderBOT documentation

## License

This script is part of the coderBOT project and follows the same MIT license.
