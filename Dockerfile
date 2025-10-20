# Use Node.js LTS with a full OS for terminal functionality
FROM node:20-bookworm

# Install essential tools for a functional bash environment
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    wget \
    git \
    vim \
    nano \
    less \
    sudo \
    build-essential \
    python3 \
    python3-pip \
    gpg \
    software-properties-common \
    # Puppeteer dependencies for screenshots
    ca-certificates \
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

# Install GitHub CLI (required for Copilot CLI)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Install GitHub Copilot CLI extension
# Note: This requires authentication which must be done at runtime
# Users need to run: gh auth login && gh extension install github/gh-copilot
RUN mkdir -p /usr/local/share/gh-copilot-setup && \
    echo '#!/bin/bash\necho "To setup GitHub Copilot CLI, run:"\necho "  gh auth login"\necho "  gh extension install github/gh-copilot"\necho "Then you can use: gh copilot suggest or gh copilot explain"' > /usr/local/bin/setup-copilot && \
    chmod +x /usr/local/bin/setup-copilot

# Install Claude CLI (community version via npm)
# Note: Official Claude CLI doesn't exist, but we can use mcp-cli or claude-cli npm packages
RUN npm install -g @modelcontextprotocol/cli || echo "MCP CLI not available, skipping"

# Note about Cursor CLI:
# Cursor CLI is part of the Cursor editor and requires the full editor installation
# It's not available as a standalone package. Users can:
# 1. Install Cursor editor manually in the container, or
# 2. Use VSCode with Continue.dev extension as an alternative
# 3. Use the Cursor API directly if available

# Create info script for CLI tools
RUN echo '#!/bin/bash\n\
echo "=== Available AI CLI Tools ==="\n\
echo ""\n\
echo "GitHub Copilot CLI:"\n\
echo "  Status: Installed (requires authentication)"\n\
echo "  Setup: Run '\''setup-copilot'\'' for instructions"\n\
echo "  Usage: gh copilot suggest \"your question\""\n\
echo "         gh copilot explain \"your code\""\n\
echo ""\n\
echo "Claude CLI:"\n\
echo "  Status: No official CLI available"\n\
echo "  Alternative: Use curl with Anthropic API"\n\
echo "  Example: curl https://api.anthropic.com/v1/messages ..."\n\
echo ""\n\
echo "Cursor CLI:"\n\
echo "  Status: Not available (requires Cursor editor)"\n\
echo "  Alternative: Use GitHub Copilot CLI or other AI tools"\n\
echo ""\n\
echo "GitHub CLI: $(gh --version | head -1)"\n\
echo "Node.js: $(node --version)"\n\
echo "npm: $(npm --version)"\n\
' > /usr/local/bin/ai-tools-info && \
    chmod +x /usr/local/bin/ai-tools-info

# Create a non-root user for running terminal sessions
RUN useradd -m -s /bin/bash botuser && \
    echo "botuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/botuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p /app/logs /media/bot_generated && \
    chown -R node:node /app /media/bot_generated

# Switch to node user for running the bot
USER node

# Set environment variables (override with docker-compose or -e flags)
ENV NODE_ENV=production
ENV XTERM_SHELL_PATH=/bin/bash
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Start the bot
CMD ["node", "dist/src/app.js"]
