# Multi-Process Bot Architecture

## Overview

CoderBot now uses a multi-process architecture where each bot instance runs in its own isolated child process. This provides better stability, fault isolation, and resource management.

## Architecture

### Parent Process (`app.ts`)
- **Responsibilities:**
  - Load configuration from `.env`
  - Spawn one child process per bot token
  - Monitor child process health
  - Restart failed workers automatically
  - Coordinate graceful shutdown

### Child Processes (`bot-worker.ts`)
- **Responsibilities:**
  - Initialize single bot instance
  - Create dedicated service container (XtermService, CoderService, etc.)
  - Run dedicated MediaWatcherService for bot-specific directory
  - Handle all bot interactions independently
  - Respond to shutdown signals from parent

## Directory Structure

Each bot worker has its own media directory for complete isolation:

```
{MEDIA_TMP_LOCATION}/
├── bot-0/              # First bot's media directory
│   ├── sent/           # Sent media files
│   └── received/       # Received media files
├── bot-1/              # Second bot's media directory
│   ├── sent/
│   └── received/
└── bot-N/              # Nth bot's media directory
    ├── sent/
    └── received/
```

### Configuration

Bot indices are assigned sequentially (0, 1, 2, ...) based on the order of tokens in the configuration.

**Example `.env`:**
```bash
TELEGRAM_BOT_TOKEN=token1,token2,token3
MEDIA_TMP_LOCATION=/tmp/coderBOT_media
CLEAN_UP_MEDIADIR=false  # Set to true for fresh start on each worker initialization
```

This will create:
- Worker 0 → `bot-0` directory
- Worker 1 → `bot-1` directory  
- Worker 2 → `bot-2` directory

## Process Communication

### Environment Variables
Each child process receives:
- `BOT_TOKEN` - The specific bot token to use
- `BOT_INDEX` - Sequential index (0, 1, 2, ...)
- All other `.env` variables (inherited)

### IPC Messages
Minimal inter-process communication:
- **Child → Parent:** `{ type: 'READY', botId }` when initialization complete
- **Parent → Child:** `SIGTERM` signal for graceful shutdown

## Benefits

### 1. Fault Isolation
- If one bot crashes, others continue running
- Parent automatically restarts failed workers
- Each bot has independent memory space

### 2. Resource Management
- Per-process memory limits can be set
- CPU usage isolated per bot
- Easier to identify resource-heavy bots

### 3. Simplified Media Handling
- No IPC for media transfer
- Each bot watches its own directory
- No coordination needed between bots

### 4. Easier Debugging
- Issues scoped to specific bot workers
- Clear log prefixes: `[Parent]`, `[Worker bot-0]`, etc.
- Independent process inspection

### 5. Better Scalability
- Add/remove bots by changing config
- Each bot is truly independent
- No shared state between bots

## Lifecycle

### Startup Sequence
1. Parent loads configuration
2. Parent spawns child for each token (sequential, 1s delay)
3. Each child:
   - Creates bot instance
   - **Optionally cleans up media directory** (if `CLEAN_UP_MEDIADIR=true`)
   - Initializes services
   - Creates media directories
   - Starts media watcher
   - Registers handlers
   - Starts polling
   - Sends READY message to parent
4. Parent reports all workers ready

### Shutdown Sequence
1. Parent receives `SIGINT` or `SIGTERM`
2. Parent sends `SIGTERM` to all children
3. Each child:
   - Stops media watcher
   - Cleans up services (closes terminals, Puppeteer, etc.)
   - Stops bot polling
   - Exits gracefully
4. Parent waits for all children (10s timeout)
5. Parent force-kills any remaining children
6. Parent exits

### Auto-Restart
- If a child exits unexpectedly (code ≠ 0)
- Parent waits 5 seconds
- Parent spawns replacement worker
- Only happens when not shutting down

## Security

### Access Control
- Each worker validates users independently
- No cross-bot user notification (simplified)
- Auto-kill terminates only the affected worker

### Process Isolation
- Workers cannot interfere with each other
- Memory leaks isolated per process
- Crashes don't affect siblings

## Media Directory Management

### Clean Start Option
The `CLEAN_UP_MEDIADIR` environment variable allows each bot worker to start with a clean media directory:

**Configuration:**
```bash
CLEAN_UP_MEDIADIR=true   # Delete media directory on startup
CLEAN_UP_MEDIADIR=false  # Preserve existing media directory (default)
```

**Behavior:**
- When set to `true`, each worker deletes its entire media directory (`{MEDIA_TMP_LOCATION}/bot-N/`) during initialization
- This includes all subdirectories (`sent/`, `received/`, and any other files)
- Fresh `sent/` and `received/` directories are recreated immediately after cleanup
- Useful for development, testing, or ensuring no leftover files from previous runs

**Use Cases:**
- **Development:** Fresh start on each restart
- **Testing:** Clean state for test runs
- **Production:** Typically set to `false` to preserve sent file history
- **Debugging:** Remove problematic files by restarting with cleanup enabled

**Logs:**
```
[Worker bot-0] Cleaning up media directory: /tmp/coderBOT_media/bot-0
[Worker bot-0] ✅ Media directory cleaned
```

**Warning:** Setting this to `true` in production will delete all media history on each restart, including the `sent/` folder archive.

## Monitoring

### Logs
All logs are prefixed for easy identification:
- `[Parent]` - Parent process logs
- `[Worker bot-0]` - First bot worker
- `[Worker bot-1]` - Second bot worker
- `[bot-0]` - Bot-specific service logs

### PM2 Integration
The architecture works seamlessly with PM2:

```bash
pm2 start coderbot   # Start parent process
pm2 logs coderbot    # View all logs (parent + workers)
pm2 restart coderbot # Restart parent (will restart all workers)
pm2 stop coderbot    # Stop parent (will stop all workers)
```

## Migration Notes

### What Changed
1. **MediaWatcherService** - Now accepts `botId`, watches bot-specific directory
2. **CoderService** - Accepts `botId`, uses bot-specific paths
3. **AccessControlMiddleware** - Removed `setBotInstances()`, simplified notifications
4. **app.ts** - Transformed from bot runner to process manager
5. **bot-worker.ts** - New file containing bot initialization logic

### What Stayed the Same
- All bot handlers and commands
- Service container pattern
- Configuration system
- Access control logic
- Terminal and rendering services

## Troubleshooting

### Worker Fails to Start
- Check logs for specific error
- Verify bot token is valid
- Ensure media directory is writable
- Check for Telegram API conflicts (409 errors)

### Worker Crashes Repeatedly
- Parent will restart up to indefinitely (with 5s delay)
- Check if configuration issue
- Review worker-specific logs
- May need to fix issue in `bot-worker.ts`

### Media Not Appearing
- Verify file is in correct bot directory (`/tmp/coderBOT_media/bot-N/`)
- Check file permissions
- Review MediaWatcherService logs for that bot
- Ensure user is in allowed users list

### Graceful Shutdown Hangs
- Parent waits 10s for children to exit
- After timeout, force kills workers
- Check for hung resources (terminals, Puppeteer)
- May need to adjust timeout in `app.ts`

## Performance

### Memory Usage
- **Before:** Single process with N bots
- **After:** 1 parent + N child processes
- **Impact:** Higher total memory (N × Puppeteer instances)
- **Benefit:** Predictable, isolated memory per bot

### CPU Usage
- Similar to single-process (same work distributed)
- Better scheduling by OS across cores
- More consistent performance

### Startup Time
- Slightly slower (sequential spawning with 1s delays)
- ~2-3 seconds per bot worker
- N bots = ~N × 2 seconds startup

## Future Enhancements

Potential improvements:
- Health check pings from workers to parent
- Dynamic worker spawning (add bots at runtime)
- Shared Redis for cross-bot state if needed
- Process metrics and monitoring
- Load balancing for high-traffic scenarios
