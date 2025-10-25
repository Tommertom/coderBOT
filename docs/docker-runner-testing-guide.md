# Testing Guide: Docker Runner Script

This guide helps you test the `run-coderbot-docker.sh` script safely.

## Prerequisites

Before testing, ensure you have:

- [ ] Docker installed and running (`docker --version`)
- [ ] Docker Compose installed (`docker-compose --version`)
- [ ] A Telegram bot token from [@BotFather](https://t.me/BotFather)
- [ ] Your Telegram user ID
- [ ] A GitHub Personal Access Token with Copilot access

## Getting Test Credentials

### 1. Create a Test Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Follow prompts to create a bot
4. Save the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your user ID (e.g., `987654321`)

### 3. Create a GitHub PAT

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Name: "CoderBOT Test"
4. Expiration: 7 days (for testing)
5. Scopes: Select `read:user` and ensure you have Copilot access
6. Generate and copy the token (starts with `ghp_`)

## Test Plan

### Test 1: Basic Script Execution

```bash
# Make script executable
chmod +x /home/tom/coderBOT/scripts/run-coderbot-docker.sh

# Run with test credentials
./scripts/run-coderbot-docker.sh \
  "YOUR_BOT_TOKEN" \
  "YOUR_USER_ID" \
  "YOUR_GITHUB_PAT"
```

**Expected Results:**
- ✅ Script creates directory in `/tmp/coderbot-docker-<pid>`
- ✅ Creates all necessary files (.env, Dockerfile, docker-compose.yml, etc.)
- ✅ Prompts whether to build and start container
- ✅ No syntax or runtime errors

### Test 2: Verify Generated Files

```bash
# Navigate to created directory
cd /tmp/coderbot-docker-*

# Check all files exist
ls -la

# Verify .env content
cat .env | grep TELEGRAM_BOT_TOKENS
cat .env | grep ALLOWED_USER_IDS
```

**Expected Files:**
- ✅ `.env`
- ✅ `Dockerfile`
- ✅ `docker-compose.yml`
- ✅ `run-docker.sh` (executable)
- ✅ `README.md`

**Expected .env Content:**
- ✅ Bot token matches your input
- ✅ User ID matches your input
- ✅ All other settings have sensible defaults

### Test 3: Manual Container Build

```bash
# Build the Docker image
docker-compose build

# Check image was created
docker images | grep coderbot
```

**Expected Results:**
- ✅ Build completes without errors
- ✅ Image appears in `docker images` list
- ✅ Image size is reasonable (~500MB for slim version)

### Test 4: Container Startup

```bash
# Start the container
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs
```

**Expected Results:**
- ✅ Container starts successfully
- ✅ Status shows "Up"
- ✅ Logs show GitHub authentication
- ✅ Logs show Copilot CLI installation
- ✅ Logs show "Starting coderBOT..."

### Test 5: GitHub CLI Verification

```bash
# Access container shell
docker-compose exec coderbot bash

# Inside container - check GitHub CLI
gh --version

# Check authentication
gh auth status

# Check Copilot extension
gh extension list | grep copilot

# Test Copilot (may take a moment)
gh copilot suggest "how to list files in linux"

# Exit container
exit
```

**Expected Results:**
- ✅ `gh --version` shows GitHub CLI version
- ✅ `gh auth status` shows "Logged in to github.com"
- ✅ Copilot extension is listed
- ✅ Copilot suggest command works and provides suggestions

### Test 6: Bot Functionality

```bash
# Ensure container is running
docker-compose ps
```

Then on Telegram:
1. Find your test bot
2. Send `/start`
3. Try `/help`
4. Try `/xterm`
5. Send a simple command like `ls`
6. Request screenshot

**Expected Results:**
- ✅ Bot responds to `/start`
- ✅ Help menu displays
- ✅ Terminal session starts
- ✅ Commands execute
- ✅ Screenshot is sent

### Test 7: Container Management

```bash
# View live logs
docker-compose logs -f
# (Press Ctrl+C to exit)

# Restart container
docker-compose restart

# Stop container
docker-compose stop

# Start again
docker-compose start

# Complete shutdown
docker-compose down
```

**Expected Results:**
- ✅ All commands execute without errors
- ✅ Container responds appropriately to each command
- ✅ Bot reconnects after restart

### Test 8: Cleanup

```bash
# Remove everything
docker-compose down -v

# Verify removal
docker-compose ps

# Remove working directory
cd /tmp
rm -rf coderbot-docker-*

# Verify cleanup
ls -la /tmp | grep coderbot
```

**Expected Results:**
- ✅ Container and volumes removed
- ✅ Directory deleted
- ✅ No coderbot files remain in /tmp

## Automated Test Script

Create a test script to run all tests:

```bash
#!/bin/bash
# test-docker-runner.sh

set -e

echo "=== Docker Runner Script Test Suite ==="

# Set test credentials
export TEST_BOT_TOKEN="YOUR_BOT_TOKEN"
export TEST_USER_ID="YOUR_USER_ID"
export TEST_GITHUB_PAT="YOUR_GITHUB_PAT"

# Test 1: Run script
echo "Test 1: Running script..."
echo "n" | ./scripts/run-coderbot-docker.sh "$TEST_BOT_TOKEN" "$TEST_USER_ID" "$TEST_GITHUB_PAT"

# Find created directory
WORK_DIR=$(ls -td /tmp/coderbot-docker-* | head -1)
cd "$WORK_DIR"

# Test 2: Verify files
echo "Test 2: Verifying files..."
test -f .env || exit 1
test -f Dockerfile || exit 1
test -f docker-compose.yml || exit 1
test -f run-docker.sh || exit 1
test -x run-docker.sh || exit 1

# Test 3: Build image
echo "Test 3: Building image..."
docker-compose build

# Test 4: Start container
echo "Test 4: Starting container..."
docker-compose up -d
sleep 10  # Wait for startup

# Test 5: Check container
echo "Test 5: Checking container..."
docker-compose ps | grep "Up" || exit 1

# Test 6: Check logs
echo "Test 6: Checking logs..."
docker-compose logs | grep "Starting coderBOT" || exit 1

# Test 7: Verify GitHub CLI
echo "Test 7: Verifying GitHub CLI..."
docker-compose exec -T coderbot gh --version || exit 1

# Test 8: Cleanup
echo "Test 8: Cleaning up..."
docker-compose down -v
cd /tmp
rm -rf "$WORK_DIR"

echo "=== All Tests Passed! ==="
```

## Common Issues and Solutions

### Issue: Script Permission Denied

```bash
chmod +x /home/tom/coderBOT/scripts/run-coderbot-docker.sh
```

### Issue: Docker Not Running

```bash
sudo systemctl start docker
docker info
```

### Issue: Invalid Bot Token

- Verify token from @BotFather
- Ensure no extra spaces or quotes
- Token format: `123456789:ABCdef...`

### Issue: GitHub Authentication Failed

- Generate new PAT with correct scopes
- Ensure Copilot is enabled on your GitHub account
- Check PAT hasn't expired

### Issue: Container Won't Start

```bash
# Check detailed logs
docker-compose logs

# Check Docker resources
docker system df

# Clean up old containers
docker system prune
```

### Issue: Bot Not Responding on Telegram

- Verify bot token in `.env`
- Check user ID is correct
- Ensure container is running: `docker-compose ps`
- Check logs: `docker-compose logs -f`

## Security Testing

### Test Unauthorized Access

1. Use a different Telegram account (not in ALLOWED_USER_IDS)
2. Message the bot
3. Verify it denies access
4. Check if AUTO_KILL triggers (if enabled)

### Test Token Security

```bash
# Ensure .env is not world-readable
ls -la .env
# Should show -rw-------

# Check for exposed tokens in logs
docker-compose logs | grep -i "token" | grep -v "GITHUB_PAT"
# Should not reveal full tokens
```

## Performance Testing

### Test Container Resource Usage

```bash
# Monitor resources
docker stats coderbot-instance

# Check memory usage
docker-compose exec coderbot free -h

# Check disk usage
docker-compose exec coderbot df -h
```

## Cleanup After Testing

```bash
# Stop all test containers
docker stop $(docker ps -a -q --filter "name=coderbot")

# Remove all test containers
docker rm $(docker ps -a -q --filter "name=coderbot")

# Remove test images
docker rmi $(docker images -q --filter "reference=*coderbot*")

# Clean working directories
rm -rf /tmp/coderbot-docker-*

# Verify cleanup
docker ps -a | grep coderbot
docker images | grep coderbot
ls /tmp | grep coderbot
```

## Test Checklist

Use this checklist when testing:

- [ ] Prerequisites verified
- [ ] Test credentials obtained
- [ ] Script executes without errors
- [ ] All files created correctly
- [ ] .env contains correct values
- [ ] Docker image builds successfully
- [ ] Container starts without issues
- [ ] GitHub CLI works
- [ ] GitHub Copilot extension installed
- [ ] Bot responds on Telegram
- [ ] Terminal commands work
- [ ] Screenshots generate correctly
- [ ] Container can be restarted
- [ ] Logs are accessible
- [ ] Cleanup completes successfully
- [ ] No leftover containers
- [ ] No leftover images (optional)
- [ ] No leftover directories

## Reporting Issues

If you find issues during testing, report them with:

1. **Environment**:
   - OS and version
   - Docker version
   - Docker Compose version

2. **Steps to Reproduce**:
   - Exact command run
   - Input values (sanitized)

3. **Error Output**:
   - Full error message
   - Relevant log excerpts
   - Container status

4. **Expected vs Actual**:
   - What should happen
   - What actually happened

## Success Criteria

The script passes all tests if:

✅ Runs without syntax errors  
✅ Creates all required files  
✅ Builds Docker image successfully  
✅ Container starts and runs  
✅ GitHub CLI is authenticated  
✅ GitHub Copilot CLI works  
✅ Bot responds on Telegram  
✅ Terminal sessions function correctly  
✅ Container can be managed (stop/start/restart)  
✅ Cleanup removes all traces  
