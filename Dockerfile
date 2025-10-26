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

# Create working directory
WORKDIR /app

# Copy .env file (if building with local context)
# COPY .env /app/.env

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Update Copilot CLI\n\
npm install -g @github/copilot@latest\n\
\n\
# Run coderBOT using npx -y latest\n\
echo "Starting coderBOT..."\n\
npx -y @tommertom/coderbot@latest\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]

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

# Create necessary directories
RUN mkdir -p /app/logs /app/.env-default && \
    chown -R node:node /app

# Switch to node user for running the bot
USER node

# Set environment variables
ENV NODE_ENV=production
ENV XTERM_SHELL_PATH=/bin/bash
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install coderbot globally via npm
# This way we always get the latest published version
RUN npm install -g @tommertom/coderbot

# The .env file should be mounted via volume or passed as environment variables
# Create a startup script that handles .env creation if needed
RUN echo '#!/bin/bash\n\
# Check if .env exists in mounted volume or current directory\n\
if [ ! -f /app/.env ]; then\n\
    echo "⚠️  No .env file found at /app/.env"\n\
    echo "Please mount your .env file as a volume:"\n\
    echo "  docker run -v $(pwd)/.env:/app/.env ..."\n\
    echo ""\n\
    echo "Or set environment variables directly:"\n\
    echo "  -e TELEGRAM_BOT_TOKENS=your_token"\n\
    echo "  -e ALLOWED_USER_IDS=your_user_id"\n\
    exit 1\n\
fi\n\
\n\
# Run coderbot from the app directory where .env is mounted\n\
cd /app\n\
exec coderbot\n\
' > /home/node/start-coderbot.sh && chmod +x /home/node/start-coderbot.sh

# Start the bot using the startup script
CMD ["/home/node/start-coderbot.sh"]
