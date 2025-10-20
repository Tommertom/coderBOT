# Docker Sandbox Guide for CoderBOT

## Overview

This guide provides recommendations for running CoderBOT in a Docker container with a secure bash sandbox environment. Running the bot in Docker isolates terminal sessions, protects your host system, and provides a clean, reproducible environment.

## Why Use Docker for CoderBOT?

### Security Benefits
- **Isolation**: Terminal commands executed through the bot run in an isolated container, not on your host system
- **Limited Access**: Container filesystem is separate from host, preventing accidental damage to important files
- **Resource Control**: Set CPU, memory, and storage limits to prevent resource exhaustion
- **Clean State**: Easy to reset the environment by recreating the container

### Operational Benefits
- **Reproducibility**: Same environment across different machines
- **Version Control**: Dockerfile serves as infrastructure-as-code
- **Easy Updates**: Rebuild and redeploy without affecting host configuration
- **Multi-instance**: Run multiple bot instances with different configurations

## Architecture Considerations

### Two Container Approaches

#### Approach 1: Single Container (Simpler)
The bot and terminal sessions run in the same container.

**Pros:**
- Simpler setup and maintenance
- Lower resource overhead
- Easier debugging
- Direct PTY access

**Cons:**
- Terminal sessions share container with bot process
- Less isolation between bot logic and user commands
- Potential security concerns if bot is compromised

**Best For:** Personal use, development, testing

#### Approach 2: Dual Container (More Secure)
The bot runs in one container, spawns terminal sessions in separate containers.

**Pros:**
- Maximum isolation between bot and user commands
- Can use different base images for bot vs sandbox
- Better security posture
- Independent resource limits per session

**Cons:**
- More complex setup
- Requires Docker socket access or Docker API
- Higher resource overhead
- More difficult to implement

**Best For:** Production, multi-user scenarios, untrusted environments

## Recommended Dockerfile (Single Container Approach)

```dockerfile
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
    # Puppeteer dependencies for screenshots
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

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

# Expose any ports if needed (optional)
# EXPOSE 3000

# Set environment variables (override with docker-compose or -e flags)
ENV NODE_ENV=production
ENV XTERM_SHELL_PATH=/bin/bash

# Start the bot
CMD ["node", "dist/src/app.js"]
```

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  coderbot:
    build: .
    container_name: coderbot
    restart: unless-stopped
    
    # Environment variables from .env file
    env_file:
      - .env
    
    # Volume mounts
    volumes:
      # Persist logs
      - ./logs:/app/logs
      # Media folder for file watching
      - ./media:/media/bot_generated
      # Optional: Persist terminal history
      - terminal_history:/home/botuser
    
    # Resource limits (adjust based on your needs)
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    
    # Security options
    security_opt:
      - no-new-privileges:true
    
    # Read-only root filesystem (except for necessary writable paths)
    # read_only: true
    # tmpfs:
    #   - /tmp
    #   - /app/logs
    
    # Network isolation (optional)
    # network_mode: "bridge"

volumes:
  terminal_history:
```

## Security Hardening

### 1. Resource Limits
Always set resource limits to prevent DoS scenarios:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'          # Max 2 CPU cores
      memory: 2G            # Max 2GB RAM
      pids: 512             # Max 512 processes
```

### 2. Filesystem Restrictions

**Read-only Root Filesystem:**
```yaml
read_only: true
tmpfs:
  - /tmp:size=100M,mode=1777
  - /app/logs:size=100M
  - /home/botuser:size=500M
```

### 3. Network Isolation

Limit network access if the bot doesn't need external connectivity:
```yaml
networks:
  internal:
    internal: true  # No external access
```

### 4. Capabilities Dropping

Drop unnecessary Linux capabilities:
```yaml
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - SETUID
  - SETGID
```

### 5. User Namespace Remapping

Enable user namespace remapping in Docker daemon for additional isolation:
```json
{
  "userns-remap": "default"
}
```

## Environment Variables for Docker

Ensure your `.env` file includes:

```env
# Bot Configuration
TELEGRAM_BOT_TOKEN=your_token
ALLOWED_USER_IDS=123456789

# Terminal Configuration for Docker
XTERM_SHELL_PATH=/bin/bash
XTERM_TERMINAL_ROWS=50
XTERM_TERMINAL_COLS=100
XTERM_SESSION_TIMEOUT=1800000

# Media folder (matches volume mount)
MEDIA_FOLDER=/media/bot_generated
MEDIA_WATCH_ENABLED=true

# Security
AUTO_KILL=true
```

## Building and Running

### Build the Image
```bash
docker build -t coderbot:latest .
```

### Run with Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Run with Docker CLI
```bash
docker run -d \
  --name coderbot \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/media:/media/bot_generated \
  --restart unless-stopped \
  --memory="2g" \
  --cpus="2.0" \
  coderbot:latest
```

## Monitoring and Maintenance

### View Logs
```bash
# Docker Compose
docker-compose logs -f

# Docker CLI
docker logs -f coderbot
```

### Access Container Shell (for debugging)
```bash
docker exec -it coderbot /bin/bash
```

### Restart Bot
```bash
# Docker Compose
docker-compose restart

# Docker CLI
docker restart coderbot
```

### Update and Rebuild
```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

## Advanced: Dual Container Setup

For maximum security, implement a dual-container architecture:

### Master Bot Container
- Runs the Telegram bot application
- Has Docker socket access
- Spawns ephemeral sandbox containers for each session

### Sandbox Containers
- Minimal image with bash and basic tools
- Destroyed after session timeout
- No persistent storage
- Network isolation

**Implementation requires:**
1. Docker socket mount: `-v /var/run/docker.sock:/var/run/docker.sock`
2. Modified `xterm.service.ts` to spawn Docker containers instead of PTY
3. Docker SDK for Node.js: `npm install dockerode`

**Example spawn logic:**
```typescript
import Docker from 'dockerode';

const docker = new Docker();
const container = await docker.createContainer({
  Image: 'bash-sandbox:latest',
  Cmd: ['/bin/bash'],
  Tty: true,
  OpenStdin: true,
  AttachStdin: true,
  AttachStdout: true,
  AttachStderr: true,
  HostConfig: {
    Memory: 512 * 1024 * 1024, // 512MB
    CpuQuota: 50000, // 50% CPU
    NetworkMode: 'none', // No network
    ReadonlyRootfs: true,
  }
});
```

## Best Practices

1. **Regular Updates**: Keep base images and dependencies updated
2. **Log Rotation**: Implement log rotation to prevent disk fill-up
3. **Backup .env**: Keep your `.env` file secure and backed up separately
4. **Monitor Resources**: Set up monitoring for container resource usage
5. **Test Locally**: Test configuration changes locally before production
6. **Limit Session Duration**: Use `XTERM_SESSION_TIMEOUT` to prevent abandoned sessions
7. **Review Permissions**: Regularly audit what the bot can access
8. **Network Segmentation**: Consider running on isolated network segments

## Troubleshooting

### Puppeteer Screenshot Issues
If screenshots fail, ensure all Chromium dependencies are installed:
```dockerfile
RUN apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libasound2
```

### Permission Issues
If you encounter permission errors:
```bash
# Ensure correct ownership
chown -R node:node /app /media/bot_generated
```

### Out of Memory
If container runs out of memory:
```yaml
deploy:
  resources:
    limits:
      memory: 4G  # Increase limit
```

### PTY Not Working
Ensure `node-pty` native dependency is built for the container platform:
```dockerfile
RUN npm rebuild node-pty
```

## Conclusion

Using Docker for CoderBOT provides significant security and operational benefits. Start with the single-container approach for simplicity, and consider dual-container architecture if you need maximum isolation or plan to support multiple users.

The key is balancing security, performance, and maintainability based on your specific use case.
