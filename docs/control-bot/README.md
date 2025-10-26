# ControlBOT - Quick Start Guide

## Overview

ControlBOT is an administrative bot that runs in the parent process and provides powerful management capabilities for all worker bot processes. It allows you to start, stop, restart bots, add/remove bot tokens dynamically, monitor health, and view logs.

## Quick Setup

### 1. Create Control Bot

1. Go to [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token provided

### 2. Configure Environment

Edit your `.env` file and add:

```env
# Control Bot Configuration
CONTROL_BOT_TOKEN=your_control_bot_token_here

# Control Bot Admin IDs (comma-separated)
CONTROL_BOT_ADMIN_IDS=123456789,987654321

# Verbose Logging (Optional - defaults to true)
# When enabled, child bot console output is forwarded to parent console
# Set to false to reduce console noise
VERBOSE_LOGGING=true
```

**To get your Telegram User ID:**
- Send a message to [@userinfobot](https://t.me/userinfobot)
- It will reply with your user ID

### 3. Start the Bot

```bash
npm run build
npm run pm2:restart
```

Or if running directly:

```bash
npm run build
node dist/app.js
```

### 4. Test Control Bot

1. Open Telegram and find your control bot
2. Send `/controlstart`
3. You should see a welcome message
4. Send `/help` to see all available commands

## Basic Commands

### Check Status
```
/status
```
Shows the status of all worker bots including PID, uptime, and errors.

### Start/Stop Bots
```
/start bot-1
/stop bot-1
/restart bot-1
```

### Manage All Bots
```
/stopall
/startall
/restartall
```

### Add a New Bot
```
/addbot 1234567890:ABCdefGHIjklMNO...
```
This will:
1. Validate the token
2. Add it to `.env`
3. Start the bot immediately

### Remove a Bot
```
/removebot bot-2
```
This will:
1. Stop the bot if running
2. Remove it from `.env`

### View Logs
```
/logs bot-1
/logs bot-1 100
```
Shows the last 50 logs (or specified number).

### Health Check
```
/health
```
Performs health checks on all running bots.

### View Uptime
```
/uptime
```
Shows uptime for ControlBOT and all worker bots.

## Common Workflows

### Adding a New Bot

1. Create bot with @BotFather
2. Send `/addbot <token>` to ControlBOT
3. Bot is automatically started
4. Verify with `/status`

### Troubleshooting a Bot

1. Check status: `/status`
2. View logs: `/logs bot-1 100`
3. Try restarting: `/restart bot-1`
4. If still failing, check logs again

### Updating Bot Code

1. Deploy new code to server
2. Build: `npm run build`
3. Restart all bots: `/restartall`
4. Verify: `/status`

### Emergency Shutdown

```
/shutdown
```
This will:
1. Stop all worker bots gracefully
2. Stop ControlBOT
3. Exit the parent process

## Security Notes

- Only users in `CONTROL_BOT_ADMIN_IDS` can use ControlBOT
- Unauthorized access attempts are logged
- Bot tokens are masked in all outputs
- `.env` file is backed up before modifications

## Verbose Logging

The `VERBOSE_LOGGING` environment variable controls whether child bot process console output (stdout/stderr) is forwarded to the parent ControlBOT process console.

**When enabled (default):**
- All console logs from worker bots appear in the parent process console
- Useful for debugging and real-time monitoring
- Each log line is prefixed with `[bot-N]` for identification

**When disabled:**
- Console output from worker bots is not forwarded to parent console
- Logs are still captured internally and accessible via `/logs` command
- Reduces console noise in production environments

**Example:**
```env
VERBOSE_LOGGING=true   # Forward all child bot console output (default)
VERBOSE_LOGGING=false  # Only keep logs internally, don't forward to console
```

You can still access all logs via the `/logs` command regardless of this setting.

## Troubleshooting

### ControlBOT doesn't start

**Check:**
1. Is `CONTROL_BOT_TOKEN` set in `.env`?
2. Is `CONTROL_BOT_ADMIN_IDS` set?
3. Check console logs for errors

### Can't access ControlBOT

**Check:**
1. Is your Telegram User ID in `CONTROL_BOT_ADMIN_IDS`?
2. Restart the bot to reload configuration
3. Check for typos in user ID

### Bot fails to add

**Check:**
1. Is the token valid?
2. Check console logs
3. Try the token manually with a test bot

## Example Session

```
You: /status
Bot: 📊 Worker Bot Status

     🟢 bot-1
        Status: running
        PID: 12345
        Uptime: 2h 15m
     
     🟢 bot-2
        Status: running
        PID: 12346
        Uptime: 2h 15m
     
     Summary: 2/2 bots running

You: /addbot 1234567890:ABCdef...
Bot: ⏳ Validating bot token...
Bot: ⏳ Adding bot to configuration...
Bot: ⏳ Starting new bot...
Bot: ✅ Bot bot-3 added and started successfully!
```
