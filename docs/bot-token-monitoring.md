# Bot Token Monitoring

## Overview

The bot token monitoring feature allows CoderBot to automatically detect changes to the `TELEGRAM_BOT_TOKENS` environment variable and dynamically spawn or kill bot workers without requiring a full application restart.

## How It Works

The parent process periodically checks the `.env` file for changes to bot tokens:

1. **Every N minutes** (configurable), the parent process reloads the `.env` file
2. **Compares** the current bot tokens with the newly loaded tokens
3. **Removes workers** for tokens that were removed from the configuration
4. **Spawns new workers** for tokens that were added to the configuration
5. **Skips tokens** that already have running workers (prevents duplicates)

## Configuration

Add this to your `.env` file:

```env
# Bot Token Monitoring
# Monitor .env file for changes to bot tokens and dynamically spawn/kill workers
# Check interval in milliseconds (default: 300000 = 5 minutes)
# Set to 0 to disable monitoring
BOT_TOKEN_MONITOR_INTERVAL=300000
```

### Configuration Options

- **Default**: `300000` (5 minutes)
- **Minimum**: `60000` (1 minute) - recommended minimum to avoid excessive file reads
- **Disable**: Set to `0` to turn off monitoring completely

### Examples

**Check every 5 minutes (default):**
```env
BOT_TOKEN_MONITOR_INTERVAL=300000
```

**Check every 10 minutes:**
```env
BOT_TOKEN_MONITOR_INTERVAL=600000
```

**Check every 1 minute (not recommended for production):**
```env
BOT_TOKEN_MONITOR_INTERVAL=60000
```

**Disable monitoring:**
```env
BOT_TOKEN_MONITOR_INTERVAL=0
```

## Use Cases

### Adding a New Bot

1. Edit your `.env` file
2. Add the new bot token to `TELEGRAM_BOT_TOKENS`:
   ```env
   TELEGRAM_BOT_TOKENS=token1,token2,token3
   ```
3. Wait for the next monitoring check (or restart the app)
4. The parent process will automatically spawn a new worker

### Removing a Bot

1. Edit your `.env` file
2. Remove the bot token from `TELEGRAM_BOT_TOKENS`
3. Wait for the next monitoring check (or restart the app)
4. The parent process will gracefully kill the worker for that token

### Example Workflow

**Initial state:**
```env
TELEGRAM_BOT_TOKENS=123:ABC,456:DEF
```
- Workers: Bot 0 (123:ABC), Bot 1 (456:DEF)

**Add a third bot:**
```env
TELEGRAM_BOT_TOKENS=123:ABC,456:DEF,789:GHI
```
- After monitoring check: Bot 2 (789:GHI) is spawned
- Workers: Bot 0, Bot 1, Bot 2

**Remove the second bot:**
```env
TELEGRAM_BOT_TOKENS=123:ABC,789:GHI
```
- After monitoring check: Bot 1 (456:DEF) is killed
- Workers: Bot 0, Bot 2

## Console Output

When monitoring is active, you'll see logs like:

```
[Parent] Starting bot token monitoring (interval: 300000ms)
[Parent] Checking for bot token changes...
[Parent] No bot token changes detected
```

When changes are detected:

```
[Parent] Checking for bot token changes...
[Parent] Token changes detected: 1 added, 0 removed
[Parent] Spawning new bot worker for added token (index 2)
[Parent] ✅ Bot workers updated: 3 total worker(s)
```

Or when removing:

```
[Parent] Checking for bot token changes...
[Parent] Token changes detected: 0 added, 1 removed
[Parent] Killing bot worker 1 (token removed)
[Parent] ✅ Bot workers updated: 2 total worker(s)
```

## Safety Features

### Duplicate Prevention
The monitoring system checks if a token already has a running worker before spawning a new one, preventing accidental duplicates.

### Graceful Shutdown
When tokens are removed, workers are sent `SIGTERM` for graceful cleanup:
- Active sessions are terminated properly
- Resources are released
- Cleanup handlers are executed

### Error Handling
If an error occurs during monitoring:
- The error is logged
- The application continues running
- Monitoring will retry on the next interval

### Restart Protection
During graceful shutdown, monitoring is stopped to prevent:
- Spawning new workers during shutdown
- Interfering with the shutdown process

## Limitations

### Index Reuse
When a bot is removed and another is added, indices may not be sequential:
- If you have bots 0, 1, 2 and remove bot 1
- The next added bot will get index 2 (not 1)
- This is by design to avoid confusion with process IDs

### Manual Restart Still Recommended
For major configuration changes (beyond just tokens), a full restart is recommended:
- Changing `ALLOWED_USER_IDS`
- Changing terminal dimensions
- Changing shell paths
- Changing other core settings

### Token Order Matters
If you reorder tokens in the `.env` file without adding/removing:
- The system may not detect changes
- Workers will continue running with their original tokens
- Restart the app if you need to reorder

## Best Practices

1. **Use reasonable intervals**: 5-10 minutes is appropriate for most use cases
2. **Test in development**: Verify your token changes work before production
3. **Monitor logs**: Check console output after making changes
4. **Keep backups**: Save a copy of your `.env` before making changes
5. **Avoid rapid changes**: Make changes one at a time and verify

## Disabling Monitoring

If you prefer manual control over bot workers:

```env
BOT_TOKEN_MONITOR_INTERVAL=0
```

With monitoring disabled, you must restart the application to apply token changes.

## Troubleshooting

### Monitoring Not Working

**Check configuration:**
```bash
grep BOT_TOKEN_MONITOR_INTERVAL .env
```

**Verify the value is greater than 0**

### Worker Not Spawning

**Check logs for errors:**
- Look for "Error checking bot token changes"
- Verify the token format is correct
- Ensure tokens are comma-separated

### Worker Not Stopping

**Check if the token was fully removed:**
```bash
grep TELEGRAM_BOT_TOKENS .env
```

**Verify no extra spaces or commas**

### Unexpected Behavior

**Force a fresh start:**
1. Set `BOT_TOKEN_MONITOR_INTERVAL=0`
2. Restart the application
3. Make your token changes
4. Restart again
5. Re-enable monitoring if desired
