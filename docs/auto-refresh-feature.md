# Auto-Refresh Feature Documentation

## Overview

The auto-refresh feature automatically refreshes terminal screenshots after you send commands, keeping you updated on terminal output changes without manual intervention. This feature is fully configurable both globally (via `.env`) and per-user (via `/refresh` command).

## How It Works

When you send a command to the terminal (via text message, `/send`, `/keys`, etc.), the bot:

1. **Immediately** refreshes the terminal screenshot (first refresh)
2. Waits for the configured interval (default: 5 seconds)
3. Checks if the terminal output has changed
4. If changed, updates the screenshot
5. Repeats steps 2-4 for the configured maximum number of times (default: 5 refreshes)
6. Stops automatically after the maximum refresh count

### Smart Refresh Logic

- **Change Detection**: Only updates the screenshot if terminal output actually changed
- **Session Validation**: Automatically stops if the terminal session is closed
- **Message Tracking**: Stops if you manually request a new screenshot (via `/screen` or refresh button)
- **No Duplicates**: Won't start a new refresh cycle if one is already running

## Configuration

### Global Default (`.env` file)

```env
# Enable/disable auto-refresh globally (default: true)
SCREEN_REFRESH_ENABLED=true

# Refresh interval in milliseconds (default: 5000 = 5 seconds)
SCREEN_REFRESH_INTERVAL=5000

# Maximum number of automatic refreshes (default: 5)
SCREEN_REFRESH_MAX_COUNT=5
```

**Important**: Changes to `.env` require restarting the bot to take effect.

### Per-User Override (Runtime)

Users can override the global setting without modifying `.env`:

```
/refresh on   - Enable auto-refresh for your session
/refresh off  - Disable auto-refresh for your session
/refresh      - Show current status and settings
```

**User preferences persist** across commands but are **reset when the bot restarts**.

## Usage Examples

### Example 1: Check Current Status

```
User: /refresh

Bot: 🔄 Auto-Refresh Status

Current state: ON ✅
(Using global default)
Interval: 5 seconds
Max refreshes: 5 times
Total duration: 25 seconds

Usage:
• /refresh on - Enable auto-refresh
• /refresh off - Disable auto-refresh
• /refresh - Show current status
```

### Example 2: Disable Auto-Refresh

```
User: /refresh off

Bot: ❌ Auto-refresh disabled

Screens will no longer auto-refresh. Use /screen to manually refresh.
```

After disabling:
- Terminal screenshots will NOT automatically update after commands
- The refresh button (🔄) on screenshots still works manually
- You can still use `/screen` to manually capture a screenshot

### Example 3: Enable Auto-Refresh

```
User: /refresh on

Bot: ✅ Auto-refresh enabled

Screens will auto-refresh 5 times at 5s intervals after you send commands.
```

Now when you send a command:
```
User: ls -la
Bot: ✅ Sent
[Screenshot updates immediately]
[Screenshot updates after 5 seconds if output changed]
[Screenshot updates after 10 seconds if output changed]
[... up to 5 total refreshes ...]
```

## Timing Calculation

**Total auto-refresh duration** = `SCREEN_REFRESH_INTERVAL × (SCREEN_REFRESH_MAX_COUNT - 1)`

With defaults:
- Interval: 5 seconds
- Max count: 5 refreshes
- **Total duration**: 5 × (5 - 1) = **20 seconds**

The first refresh is immediate, then 4 more refreshes at 5-second intervals.

## Use Cases

### When to Enable Auto-Refresh

✅ Running commands with gradual output:
- `npm install` - Package installation progress
- `git clone` - Repository cloning progress  
- `docker build` - Build step progression
- Long-running scripts with periodic updates
- AI assistant responses (Copilot, Claude, Gemini)

✅ Monitoring real-time processes:
- `tail -f log.txt` - Log file monitoring
- Watch commands
- Progress bars and status updates

### When to Disable Auto-Refresh

❌ Quick commands that complete instantly:
- `ls`, `pwd`, `cd`, etc.
- One-time queries
- Commands you know will finish in < 1 second

❌ Privacy/bandwidth concerns:
- When sharing screen in a meeting
- Limited mobile data
- Telegram rate limiting concerns

❌ Terminal is idle:
- Just viewing a static prompt
- Not actively working

## Best Practices

### Recommended Settings

**For Development Work:**
```env
SCREEN_REFRESH_ENABLED=true
SCREEN_REFRESH_INTERVAL=3000  # 3 seconds - faster updates
SCREEN_REFRESH_MAX_COUNT=7    # More refreshes for longer builds
```

**For CI/CD Monitoring:**
```env
SCREEN_REFRESH_ENABLED=true
SCREEN_REFRESH_INTERVAL=10000  # 10 seconds - less frequent
SCREEN_REFRESH_MAX_COUNT=10    # Monitor for ~90 seconds
```

**For Quick Commands:**
```env
SCREEN_REFRESH_ENABLED=false   # Disable globally
# Users can still enable with /refresh on when needed
```

**For AI Assistant Sessions:**
```env
SCREEN_REFRESH_ENABLED=true
SCREEN_REFRESH_INTERVAL=5000   # 5 seconds - balanced
SCREEN_REFRESH_MAX_COUNT=5     # ~20 seconds total
```

## Technical Details

### Architecture

The refresh feature consists of three layers:

1. **ConfigService** (`config.service.ts`)
   - Reads `SCREEN_REFRESH_ENABLED` from `.env`
   - Provides global default settings
   - Immutable after initialization

2. **RefreshStateService** (`refresh-state.service.ts`)
   - Manages per-user preferences in memory
   - Allows runtime on/off toggling
   - Falls back to global default if no user preference

3. **ScreenRefreshUtils** (`screen-refresh.utils.ts`)
   - Implements the refresh logic
   - Checks if refresh is enabled before starting
   - Handles timing, change detection, and cleanup

### State Persistence

- **Global settings** (`.env`): Persistent across restarts
- **User preferences** (`/refresh on/off`): **Lost on bot restart**

This design prevents runtime changes from being accidentally saved to `.env`.

### Performance Considerations

- **Change Detection**: Uses buffer hash comparison to avoid unnecessary screenshot updates
- **Cleanup**: Automatically clears intervals when sessions close or max count is reached
- **No Duplicates**: Checks for existing intervals before starting a new one
- **Session Validation**: Verifies session exists before each refresh attempt

## Troubleshooting

### Screenshots Not Auto-Refreshing

**Check 1**: Verify global setting
```
SCREEN_REFRESH_ENABLED=true
```

**Check 2**: Check your user preference
```
/refresh
```
If it shows "OFF ❌", enable it:
```
/refresh on
```

**Check 3**: Restart the bot if you changed `.env`

### Screenshots Refreshing Too Frequently

**Option 1**: Increase the interval
```env
SCREEN_REFRESH_INTERVAL=10000  # 10 seconds instead of 5
```

**Option 2**: Disable for your session
```
/refresh off
```

### Screenshots Stop Refreshing Mid-Command

This is **normal behavior** if:
- Terminal output hasn't changed (smart change detection)
- Maximum refresh count was reached
- You manually requested a new screenshot (via `/screen` or 🔄 button)
- Terminal session was closed

### "Auto-refresh disabled" But I Want It On

Either:
1. The global default is `false` in `.env`, or
2. You previously ran `/refresh off`

**Solution**: Run `/refresh on` to override the setting for your session.

## Migration Guide

### From Previous Versions (< 0.8.7)

**Before:** Auto-refresh was always on with no way to disable it.

**Now:** 
- Auto-refresh is on by default (`SCREEN_REFRESH_ENABLED=true`)
- Users can toggle it with `/refresh on/off`
- Behavior is unchanged if you don't modify settings

**No action required** - existing configurations will continue working.

### Adding to Existing `.env`

Add these lines to your `.env` file (defaults shown):

```env
# Auto-refresh Configuration
SCREEN_REFRESH_ENABLED=true
SCREEN_REFRESH_INTERVAL=5000
SCREEN_REFRESH_MAX_COUNT=5
```

**Note**: `SCREEN_REFRESH_INTERVAL` and `SCREEN_REFRESH_MAX_COUNT` already existed; only `SCREEN_REFRESH_ENABLED` is new.

## FAQ

**Q: Does `/refresh on/off` modify my `.env` file?**  
A: No. User preferences are stored in memory and lost on bot restart.

**Q: Can different users have different refresh settings?**  
A: Yes! Each user can use `/refresh on/off` independently.

**Q: What happens if I change `.env` while the bot is running?**  
A: You must restart the bot. Runtime user preferences (via `/refresh`) override `.env` anyway.

**Q: Does the refresh button (🔄) on screenshots respect my `/refresh` setting?**  
A: The manual refresh button always works, but the **auto-refresh** triggered after clicking it respects your `/refresh on/off` setting.

**Q: Can I set different intervals for different users?**  
A: No. Interval and max count are global settings from `.env`. Only on/off is per-user.

**Q: Does auto-refresh work with both `/xterm` and AI assistant sessions?**  
A: Yes! Auto-refresh works with all terminal sessions (xterm, Copilot, Claude, Gemini, etc.).

**Q: What if I want refresh disabled globally but allow users to enable it?**  
A: Set `SCREEN_REFRESH_ENABLED=false` in `.env`. Users can still enable it with `/refresh on`.

## Related Commands

- `/screen` - Manually capture terminal screenshot (ignores auto-refresh setting)
- `/close` - Close terminal session (automatically stops any running auto-refresh)
- `/xterm` - Start terminal session (auto-refresh will work based on your setting)
- `/copilot`, `/claude`, `/gemini` - Start AI sessions (auto-refresh will work based on your setting)

## See Also

- [Terminal Session Management](./README.md#session-management)
- [Configuration Guide](./README.md#configuration)
- [Environment Variables](./dot-env.template)
