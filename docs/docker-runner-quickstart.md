# 🚀 Quick Start: Docker Runner Script

## In 60 Seconds

### 1. Get Your Credentials (5 min)

**Telegram Bot Token**:
- Message [@BotFather](https://t.me/BotFather)
- Send `/newbot` and follow prompts
- Copy the token (looks like `123456789:ABCdef...`)

**Your Telegram User ID**:
- Message [@userinfobot](https://t.me/userinfobot)
- Copy your ID (looks like `987654321`)

**GitHub PAT**:
- Go to [GitHub Tokens](https://github.com/settings/tokens)
- Generate new token (classic)
- Select scopes: `read:user`
- Ensure Copilot access
- Copy token (starts with `ghp_`)

### 2. Run the Script (1 command)

**Single bot and user:**
```bash
./scripts/run-coderbot-docker.sh \
  "YOUR_BOT_TOKEN" \
  "YOUR_USER_ID" \
  "YOUR_GITHUB_PAT"
```

**Multiple bots and/or users:**
```bash
./scripts/run-coderbot-docker.sh \
  "BOT_TOKEN_1,BOT_TOKEN_2" \
  "USER_ID_1,USER_ID_2,USER_ID_3" \
  "YOUR_GITHUB_PAT"
```

### 3. Use Your Bot (30 seconds)

1. Find your bot on Telegram
2. Send `/start`
3. Send `/xterm`
4. Start coding!

---

## That's It! 🎉

Your bot is now running in Docker with GitHub Copilot CLI ready to use.

## What Just Happened?

- ✅ Created isolated Docker environment
- ✅ Installed GitHub CLI, Copilot CLI, and other AI tools
- ✅ Configured your bot
- ✅ Started the container
- ✅ Bot is ready on Telegram with support for Copilot, Claude, Gemini, and more

## Common Commands

```bash
# Navigate to instance
cd /tmp/coderbot-docker-*

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Access shell
docker-compose exec coderbot bash
```

## Need Help?

- **Quick Reference**: [docs/docker-runner-quick-reference.md](docker-runner-quick-reference.md)
- **Full Guide**: [docs/docker-runner-script.md](docker-runner-script.md)
- **Testing**: [docs/docker-runner-testing-guide.md](docker-runner-testing-guide.md)

## Troubleshooting

**Script permission denied**:
```bash
chmod +x scripts/run-coderbot-docker.sh
```

**Docker not running**:
```bash
docker info
# Start Docker if needed
```

**Bot not responding**:
```bash
cd users/coderbot-instance-*
docker-compose logs -f
# Check for errors
```

---

**Time to bot**: < 5 minutes  
**Difficulty**: Easy  
**Prerequisites**: Docker, 3 credentials  
**Result**: Working bot with Copilot CLI
