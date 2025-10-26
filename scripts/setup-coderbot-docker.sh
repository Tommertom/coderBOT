#!/bin/bash

###############################################################################
# CoderBOT Docker Runner Script
# 
# This script creates a minimal Docker environment to run coderBOT with:
# - GitHub CLI
# - GitHub Copilot CLI
# - Node.js
# - All necessary dependencies
#
# Usage:
#   ./run-coderbot-docker.sh <BOT_TOKEN> <USER_ID>
#
# Arguments:
#   BOT_TOKEN    - Telegram bot token(s) from @BotFather (comma-separated for multiple)
#   USER_ID      - Telegram user ID(s) for access control (comma-separated for multiple)
#
# Examples:
#   Single bot, single user:
#     ./run-coderbot-docker.sh "123456:ABC-DEF..." "987654321"
#   Multiple bots, multiple users:
#     ./run-coderbot-docker.sh "123:ABC...,456:DEF..." "111,222,333"
#
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate arguments
if [ "$#" -ne 2 ]; then
    print_error "Invalid number of arguments"
    echo ""
    echo "Usage: $0 <BOT_TOKEN> <USER_ID>"
    echo ""
    echo "Arguments:"
    echo "  BOT_TOKEN    - Telegram bot token(s) from @BotFather (comma-separated)"
    echo "  USER_ID      - Telegram user ID(s) for access control (comma-separated)"
    echo ""
    echo "Examples:"
    echo "  Single: $0 \"123456:ABC-DEF...\" \"987654321\""
    echo "  Multi:  $0 \"123:ABC...,456:DEF...\" \"111,222,333\""
    exit 1
fi

# Parse arguments
BOT_TOKEN="$1"
USER_ID="$2"

# Get the script's directory to find the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Set working directory to users/ folder in project root
USERS_DIR="$PROJECT_ROOT/users"
mkdir -p "$USERS_DIR"
WORK_DIR="$USERS_DIR/coderbot-instance-$$"
print_info "Creating working directory: $WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Create .env file from template
print_info "Creating .env configuration file from template..."

# Check if template exists
TEMPLATE_FILE="$PROJECT_ROOT/dot-env.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
    print_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi

# Copy template and populate with provided values
cp "$TEMPLATE_FILE" .env

# Replace placeholders in .env file
sed -i "s|^TELEGRAM_BOT_TOKENS=.*|TELEGRAM_BOT_TOKENS=$BOT_TOKEN|" .env
sed -i "s|^ALLOWED_USER_IDS=.*|ALLOWED_USER_IDS=$USER_ID|" .env

print_success ".env file created from template"

# Create Dockerfile
print_info "Creating minimal Dockerfile..."
cat > Dockerfile << 'EOF'
# Minimal Linux setup with Node.js, GitHub CLI, and GitHub Copilot CLI
FROM node:22-slim

# Install essential packages including build tools for node-pty
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    wget \
    git \
    gpg \
    software-properties-common \
    ca-certificates \
    make \
    python3 \
    build-essential \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN (type -p wget >/dev/null || (apt update && apt install wget -y)) \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    && cat $out | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && mkdir -p -m 755 /etc/apt/sources.list.d \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update \
    && apt install gh -y \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @github/copilot@latest
RUN npm install -g npm@latest
RUN npm install -g @google/gemini-cli@latest
RUN npm install -g @anthropic-ai/claude-code@latest

# Create working directory
WORKDIR /app

# Copy .env file
COPY .env /app/.env

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
\n\
# Update Copilot CLI\n\
npm install -g @github/copilot@latest\n\
npm install -g @anthropic-ai/claude-code@latest\n\
npm install -g @google/gemini-cli@latest\n\
\n\

# Run coderBOT using npx -y latest\n\
echo "Starting coderBOT..."\n\
npx -y @tommertom/coderbot@latest\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]
EOF

print_success "Dockerfile created"

# Create docker-compose.yml for easier management
print_info "Creating docker-compose.yml..."
cat > docker-compose.yml << EOF
version: '3.8'

services:
  coderbot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: coderbot-instance
    volumes:
      - ./logs:/app/logs
      - coderbot-media:/tmp/coderBOT_media
    restart: unless-stopped
    tty: true
    stdin_open: true

volumes:
  coderbot-media:
EOF

print_success "docker-compose.yml created"

# Create a standalone run script
print_info "Creating standalone run script..."
cat > run-docker.sh << 'RUNEOF'
#!/bin/bash

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build and run with docker-compose
echo "Building Docker image..."
docker-compose build

echo "Starting coderBOT container..."
docker-compose up -d

echo ""
echo "Container started successfully!"
echo ""
echo "Useful commands:"
echo "  View logs:           docker-compose logs -f"
echo "  Stop container:      docker-compose down"
echo "  Restart container:   docker-compose restart"
echo "  Shell access:        docker-compose exec coderbot bash"
echo ""
RUNEOF
chmod +x run-docker.sh

print_success "Standalone run script created"

# Create a README for the working directory
print_info "Creating README..."
cat > README.md << 'READMEEOF'
# CoderBOT Docker Instance

This directory contains a ready-to-run Docker setup for coderBOT.

## Contents

- `.env` - Environment configuration for the bot
- `Dockerfile` - Docker image definition
- `docker-compose.yml` - Docker Compose configuration
- `run-docker.sh` - Quick start script

## Quick Start

```bash
# Build and run
./run-docker.sh

# Or manually with docker-compose
docker-compose up -d
```

## Viewing Logs

```bash
docker-compose logs -f
```

## Stopping the Bot

```bash
docker-compose down
```

## Accessing Container Shell

```bash
docker-compose exec coderbot bash
```

## Configuration

Edit `.env` to modify bot settings. After changes, restart the container:

```bash
docker-compose restart
```

## GitHub Copilot CLI

The container includes GitHub Copilot CLI. You will need to authenticate it manually after starting the container.

To authenticate and test Copilot CLI inside the container:

```bash
docker-compose exec coderbot bash
gh auth login
gh copilot suggest "how to list files in linux"
```

## Troubleshooting

### Container won't start
- Check logs: `docker-compose logs`
- Verify .env configuration

### Copilot not working
- Authenticate with: `docker-compose exec coderbot gh auth login`
- Verify your account has Copilot access
- Check extension installation: `docker-compose exec coderbot gh extension list`

## Directory Structure

```
.
├── .env                   # Bot configuration
├── Dockerfile             # Container definition
├── docker-compose.yml     # Docker Compose config
├── run-docker.sh          # Quick start script
├── README.md              # This file
└── logs/                  # Bot logs (created at runtime)
```
READMEEOF

print_success "README created"

# Summary
echo ""
print_success "=== Docker Files Created ==="
echo ""
print_info "Working directory: $WORK_DIR"
echo ""
print_info "Configuration:"
echo "  Bot Token: ${BOT_TOKEN:0:20}..."
echo "  User ID: $USER_ID"
echo ""
print_info "Files created:"
echo "  - .env (bot configuration)"
echo "  - Dockerfile (container definition)"
echo "  - docker-compose.yml (compose configuration)"
echo "  - run-docker.sh (startup script)"
echo "  - README.md (documentation)"
echo ""
print_info "To start the container:"
echo "  1. cd $WORK_DIR"
echo "  2. ./run-docker.sh"
echo "  3. View logs: docker-compose logs -f"
echo ""
print_warning "Note: Keep this terminal output for reference!"
print_warning "The working directory contains sensitive credentials (.env file)"
echo ""
