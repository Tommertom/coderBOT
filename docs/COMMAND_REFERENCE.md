# Command Reference - Complete List

## Worker Bot Commands (37 total)

### Session Management
- `/copilot` - Start GitHub Copilot CLI session
- `/claude` - Start Claude AI session  
- `/cursor` - Start Cursor AI session
- `/xterm` - Start raw terminal (no AI)
- `/startup <prompt>` - Set/view auto-startup prompt for /copilot
- `/close` - Close the current terminal session

### Text Input
- Regular text message - Sent to terminal with Enter
- `.command` - Send command (dot removed, Enter added)
- `/keys <text>` - Send text without pressing Enter

### Special Keys
- `/tab` - Send Tab character
- `/enter` - Send Enter key
- `/space` - Send Space character
- `/esc` - Send Escape key
- `/delete` - Send Delete/Backspace key
- `/ctrlc` - Send Ctrl+C (interrupt)
- `/ctrlx` - Send Ctrl+X
- `/ctrl <char>` - Send any Ctrl+ combination (a-z, @, [, \, ], ^, _, ?)
- `/arrowup` - Send Arrow Up key
- `/arrowdown` - Send Arrow Down key

### Number Keys
- `/1` - Send number 1
- `/2` - Send number 2
- `/3` - Send number 3
- `/4` - Send number 4
- `/5` - Send number 5

### Viewing Output
- `/screen` - Capture and view terminal screenshot
- `/urls` - Show all URLs found in terminal output

### Media
- Photo uploads - Automatically saved to received directory
- Files in [media] directory - Automatically sent to you

### Other
- `/start` - Show welcome message
- `/help` - Show detailed help
- `/killbot` - Shutdown the bot

## Control Bot Commands (19 total)

### Process Management
- `/status` - Show status with action buttons
- `/stopall` - Stop all running bots
- `/startall` - Start all stopped bots
- `/restartall` - Restart all bots

### Bot Configuration
- `/addbot <token>` - Add and start a new bot
- `/removebot <bot-id>` - Remove a bot
- `/reload` - Reload .env configuration

### Monitoring
- `/logs <bot-id> [lines]` - Show bot logs (default: 50 lines)
- `/health` - Health check for all bots
- `/uptime` - Show uptime for all bots

### Administrative
- `/shutdown` - Shutdown entire system
- `/help` - Show help message
- `/controlstart` - Show control bot status

### Inline Buttons
- Start, Stop, Restart, Logs - Per-bot action buttons

## Special Features

### [media] Placeholder
Use `[media]` in your messages - it gets replaced with the media directory path.

**Example:** `cp output.png [media]` → File will be sent to you automatically

### Dot Prefix for Commands
Messages starting with `.` have the dot removed and Enter added.

**Example:** `.ls -la` → Executes `ls -la` in terminal

### Auto-refresh Screenshots
Click 🔄 Refresh button on screenshots to update the view. Auto-refresh triggers after sending input.

### Startup Prompt (Copilot only)
Set a startup prompt that automatically runs when launching /copilot:
```
/startup ./cwd /home/user/project
```

### Callback Query Buttons
Screenshots include inline buttons:
- 🔄 Refresh - Update screenshot
- 1, 2, 3 - Quick number input for menu selections
