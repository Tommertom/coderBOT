# Quick Reference: Docker Runner Script

## One-Line Command

```bash
./scripts/run-coderbot-docker.sh <BOT_TOKEN> <USER_ID> <GITHUB_PAT>
```

## Arguments

| # | Name | Description | Where to Get It |
|---|------|-------------|-----------------|
| 1 | `BOT_TOKEN` | Telegram bot token | [@BotFather](https://t.me/BotFather) on Telegram |
| 2 | `USER_ID` | Your Telegram user ID | Message any bot, it shows in error |
| 3 | `GITHUB_PAT` | GitHub Personal Access Token | [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) |

## Complete Example

```bash
./scripts/run-coderbot-docker.sh \
  "123456789:ABCdefGHIjklMNOpqrsTUVwxyz" \
  "987654321" \
  "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456"
```

## After Running

The script creates a working directory: `/tmp/coderbot-docker-<pid>`

```bash
cd /tmp/coderbot-docker-<pid>

# View logs
docker-compose logs -f

# Stop bot
docker-compose down

# Restart bot
docker-compose restart

# Access shell
docker-compose exec coderbot bash
```

## Common Tasks

### View Real-Time Logs
```bash
docker-compose logs -f
```

### Check Container Status
```bash
docker-compose ps
```

### Test GitHub Copilot
```bash
docker-compose exec coderbot bash
gh copilot suggest "how to list files"
```

### Edit Configuration
```bash
nano .env
docker-compose restart
```

### Complete Cleanup
```bash
docker-compose down -v
cd ..
rm -rf /tmp/coderbot-docker-*
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container won't start | Check logs: `docker-compose logs` |
| Bot not responding | Verify token in `.env` file |
| Copilot not working | Check PAT: `docker-compose exec coderbot gh auth status` |
| Permission denied | Make script executable: `chmod +x scripts/run-coderbot-docker.sh` |

## Full Documentation

See [Docker Runner Script Documentation](docker-runner-script.md) for complete details.
