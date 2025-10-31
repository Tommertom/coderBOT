# Projects Command Documentation

## Overview

The `/projects` command provides a quick and intuitive way to navigate between project directories in your home directory. It displays all non-hidden directories as clickable buttons, allowing you to change directories without typing full paths.

## Features

- 📁 **Automatic Discovery**: Lists all directories in the user's home directory (excluding hidden directories starting with `.`)
- 🎯 **Interactive Selection**: Click a button to navigate to that directory
- ⏱️ **Auto-Deletion**: Message automatically deletes at the configured timeout interval
- ❌ **Cancel Option**: Cancel button to dismiss without taking action
- 🔒 **Session Required**: Requires an active terminal session to function

## Usage

### Basic Usage

Simply type `/projects` in your Telegram chat:

```
You: /projects

Bot: 📁 Select a Project (5)
     Choose a directory to navigate to:
     
     [coderBOT] [myapp]
     [website] [scripts]
     [documents]
     [❌ Cancel]
```

Click any directory button to navigate to it. The bot will execute `cd /home/user/directory-name` in your active terminal session.

### Response After Selection

When you select a directory:

```
Bot: ✅ Changed to: coderBOT
```

The message will then auto-delete according to your `MESSAGE_DELETE_TIMEOUT` configuration, and the terminal will automatically refresh to show the new directory.

### Cancel Operation

Click the "❌ Cancel" button to dismiss the menu without changing directories:

```
Bot: ❌ Cancelled
```

The message is immediately deleted.

## Configuration

The command uses the following configuration from your environment:

- **`HOME`**: The home directory path (default: `/tmp` if not set)
- **`MESSAGE_DELETE_TIMEOUT`**: How long (in milliseconds) before the message auto-deletes (default: 10000 = 10 seconds)

## Requirements

- ✅ **Active Terminal Session**: You must have an active terminal session (started with `/copilot`, `/claude`, `/gemini`, or `/xterm`)
- ✅ **Home Directory Access**: The bot must have read permissions on your home directory

## Behavior Details

### Directory Filtering

- **Included**: All directories in the home directory
- **Excluded**: 
  - Hidden directories (starting with `.`)
  - Files (only directories are shown)
  - Symbolic links pointing to directories are included if they appear as directories

### Button Layout

Directories are displayed in a 2-column grid layout:

```
[dir1] [dir2]
[dir3] [dir4]
[dir5]
[❌ Cancel]
```

If there's an odd number of directories, the last one appears on its own row before the Cancel button.

### Sorting

Directories are sorted alphabetically (case-sensitive, with uppercase letters coming before lowercase).

## Error Handling

### No Active Session

If you run `/projects` without an active terminal session:

```
Bot: ⚠️ No active terminal session.
     Use /copilot, /claude, /gemini, or /xterm to start one.
```

### No Directories Found

If your home directory has no non-hidden subdirectories:

```
Bot: 📁 No Projects Found

     No directories found in /home/username
```

### Read Permission Error

If the bot cannot read your home directory, it will display an error message with the system error details.

## Integration with Terminal

When you select a directory:

1. The bot executes: `cd /path/to/selected/directory` in your terminal
2. The command is written to the terminal session (same as if you typed it)
3. An auto-refresh is triggered to show the updated terminal state
4. The selection message is deleted after the configured timeout

## Use Cases

### Quick Project Switching

Navigate between projects without typing full paths:

```
You: /projects
     [Select "mywebsite"]
Bot: ✅ Changed to: mywebsite

You: .git status
Bot: [Shows git status of mywebsite project]
```

### Session Initialization

Quickly navigate to your working directory after starting a new session:

```
You: /copilot
Bot: [Starts Copilot session in home directory]

You: /projects
     [Select "work-project"]
Bot: ✅ Changed to: work-project

You: What files are in this directory?
```

### Exploratory Navigation

Browse your projects visually without needing to remember exact names:

```
You: /projects
Bot: [Shows all your project directories]
     [You can see what projects you have available]
```

## Technical Details

### Implementation

The command is implemented in the `CoderBot` class at `/src/features/coder/coder.bot.ts`:

- **Handler**: `handleProjects(ctx: Context)`
- **Callback Handler**: Processes `project:*` callback data
- **Keyboard**: Uses grammy's `InlineKeyboard` for button layout

### Security

- Uses the `AccessControlMiddleware.requireAccess` to ensure only authorized users can use the command
- Directory paths are properly escaped when passed to the shell
- Only directories within the configured home directory are accessible
- Path traversal attacks are prevented by using `path.join()` and `path.basename()`

### Auto-Refresh Integration

After selecting a directory, the command triggers the auto-refresh mechanism to update the terminal screenshot automatically, providing immediate visual feedback of the directory change.

## Limitations

- Only shows directories directly under the home directory (not nested subdirectories)
- Maximum button text length is determined by Telegram's inline keyboard limits
- Very long directory names may be truncated in the button display
- The command does not validate whether you have permission to `cd` into the selected directory (this is handled by the shell)

## Related Commands

- `/screen` - View the current terminal state after changing directories
- `/close` - Close the current terminal session
- `/urls` - View URLs discovered in terminal output
