# Auto-Refresh Feature

## Overview

The auto-refresh feature automatically updates the last shown terminal screenshot after a user sends a command or text message. This provides real-time feedback without requiring manual refresh button clicks.

## How It Works

When a user sends a command or text message (not callback or file):

1. The command/message is executed
2. An auto-refresh process starts in the background
3. The last shown screenshot is refreshed every **5 seconds**
4. The refresh repeats **5 times** (total duration: ~25 seconds)
5. After 5 refreshes, the auto-refresh stops automatically

## Key Features

### Prevents Parallel Processes
- Only one auto-refresh process runs per user at a time
- If a new command triggers auto-refresh while one is already running, the old process continues
- This prevents resource exhaustion from multiple parallel refresh timers

### Smart Detection
- Only refreshes if a previous screenshot exists
- Stops automatically if:
  - The session is closed
  - The last screenshot message ID changes (user manually refreshed or a new screenshot was created)
  - Maximum refresh count is reached

### No Blocking
- Runs asynchronously in the background
- Does not block user interaction
- Users can continue sending commands during auto-refresh

## Affected Commands

### CoderBot Commands
- Text messages (not starting with `/`)
- `/send <text>` - Send text to terminal

### XtermBot Commands
- `/keys <text>` - Send keys without Enter
- `/tab` - Send Tab character
- `/enter` - Send Enter key
- `/space` - Send Space character
- `/delete` - Send Delete key
- `/ctrl <char>` - Send control character
- `/ctrlc` - Send Ctrl+C
- `/ctrlx` - Send Ctrl+X
- `/esc` - Send Escape key
- `/1` `/2` `/3` `/4` `/5` - Send number keys

## Implementation Details

### Architecture

The feature uses a helper utility class `ScreenRefreshUtils` that:
- Manages the refresh interval lifecycle
- Stores the interval in the user's PTY session
- Cleans up automatically when complete

### Code Structure

```
src/
├── utils/
│   └── screen-refresh.utils.ts    # Helper utility for managing auto-refresh
├── features/
│   ├── coder/
│   │   └── coder.bot.ts           # Triggers auto-refresh on text/commands
│   └── xterm/
│       ├── xterm.bot.ts           # Triggers auto-refresh on xterm commands
│       ├── xterm.service.ts       # Stores/manages refresh intervals
│       └── xterm.types.ts         # PtySession type with refreshInterval property
```

### Session Data

The `PtySession` interface includes:
```typescript
refreshInterval?: NodeJS.Timeout
```

This stores the active refresh timer, ensuring only one runs at a time.

### Methods

**XtermService:**
- `setRefreshInterval(userId, interval)` - Store interval in session
- `getRefreshInterval(userId)` - Get active interval
- `clearRefreshInterval(userId)` - Stop and clear interval

**ScreenRefreshUtils:**
- `startAutoRefresh(userId, chatId, bot, xtermService, xtermRendererService)` - Start auto-refresh
- `stopAutoRefresh(userId, xtermService)` - Manually stop auto-refresh

## Configuration

The auto-refresh behavior can be customized via environment variables in your `.env` file:

```env
# Refresh interval in milliseconds (default: 5000 = 5 seconds)
SCREEN_REFRESH_INTERVAL=5000

# Maximum number of automatic refreshes (default: 5)
SCREEN_REFRESH_MAX_COUNT=5
```

**Examples:**

- For faster updates: `SCREEN_REFRESH_INTERVAL=3000` (3 seconds)
- For more refreshes: `SCREEN_REFRESH_MAX_COUNT=10` (10 times)
- Total duration = `SCREEN_REFRESH_INTERVAL` × `SCREEN_REFRESH_MAX_COUNT`
- Default: 5 seconds × 5 times = ~25 seconds total

These settings are loaded from `ConfigService` and apply to all bot instances.

## Error Handling

- Errors during refresh are logged but do not stop the auto-refresh process
- If the session is closed, auto-refresh stops immediately
- If the screenshot update fails, the interval continues (allowing retry on next cycle)

## Performance Considerations

- Maximum of 1 refresh process per user
- Each refresh renders a new screenshot (uses canvas rendering)
- Total duration: ~25 seconds (5 refreshes × 5 seconds)
- Automatic cleanup prevents memory leaks

## Debugging

Auto-refresh logs are written to console:
- When auto-refresh starts
- Each time a refresh occurs (with count)
- When auto-refresh completes or stops early
- When a parallel process is prevented

Example logs:
```
Started auto-refresh for user 123456789
Auto-refreshed screen for user 123456789 (1/5)
Auto-refreshed screen for user 123456789 (2/5)
Last screenshot changed for user 123456789, stopping auto-refresh
```

## Future Enhancements

Possible improvements:
- Make refresh interval configurable via environment variable
- Make max refresh count configurable
- Add user preference to enable/disable auto-refresh
- Add manual stop command (e.g., `/stoprefresh`)
