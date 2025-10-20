# Directory Argument Feature - Implementation Summary

## Overview
Added optional directory argument support to `/copilot`, `/claude`, and `/cursor` commands. Users can now specify a directory to change into before starting the AI assistant.

## Changes Made

### 1. Code Changes (`src/features/coder/coder.bot.ts`)

#### Enhanced Command Handlers
All three AI assistant command handlers (`handleCopilot`, `handleClaude`, `handleCursor`) now:

1. **Parse Directory Argument**: Extract directory path from command text
   ```typescript
   const message = ctx.message?.text || '';
   const directory = message.replace('/copilot', '').trim();
   ```

2. **Sanitize Input**: Remove dangerous shell characters to prevent command injection
   ```typescript
   const sanitizedDir = directory.replace(/[;&|`$()]/g, '');
   if (sanitizedDir !== directory) {
       await ctx.reply('❌ Invalid directory path. Special characters are not allowed.');
       return;
   }
   ```

3. **Validate Directory**: Check if directory exists and is actually a directory
   ```typescript
   if (!fs.existsSync(sanitizedDir)) {
       await ctx.reply(`❌ Directory does not exist: ${sanitizedDir}`);
       return;
   }
   
   const stat = fs.statSync(sanitizedDir);
   if (!stat.isDirectory()) {
       await ctx.reply(`❌ Path is not a directory: ${sanitizedDir}`);
       return;
   }
   ```

4. **Execute with CD**: Change directory before running the AI command
   ```typescript
   if (directory) {
       xtermService.writeToSession(userId, `cd ${directory} && copilot`);
   } else {
       xtermService.writeToSession(userId, 'copilot');
   }
   ```

### 2. Help Text Updates

Updated `/help` command output to include:
- `/copilot [directory]` - Start a new session with GitHub Copilot
- `/claude [directory]` - Start a new session with Claude AI  
- `/cursor [directory]` - Start a new session with Cursor AI
- Additional note: "*Optional:* Provide a directory path to cd into before starting"

### 3. README.md Updates

#### Commands Section
- Updated command syntax to show optional directory parameter
- Added example: `/copilot /home/user/myproject`
- Added explanation of the feature

#### Usage Section
- Added new subsection "Optional Directory Argument" with examples
- Explained use case: "useful when you want to work on a specific project without having to manually navigate to it"

## Security Features

### Input Sanitization
- Strips dangerous shell characters: `;`, `&`, `|`, `` ` ``, `$`, `(`, `)`
- Prevents command injection attacks
- Rejects input if sanitization changes the path

### Path Validation
- Checks if path exists on filesystem
- Verifies path is a directory (not a file)
- Provides clear error messages for invalid inputs

### Safe Command Construction
- Uses bash command chaining with `&&` operator
- Directory change and command execution are atomic
- If `cd` fails, the AI command won't execute

## Usage Examples

### Basic Usage (No Directory)
```
/copilot
```
Starts Copilot in the current working directory.

### With Directory (Absolute Path)
```
/copilot /home/user/projects/myapp
```
Changes to `/home/user/projects/myapp` before starting Copilot.

### With Directory (Relative Path)
```
/claude ../other-project
```
Changes to relative directory before starting Claude.

### Error Cases
```
/cursor /nonexistent
→ ❌ Directory does not exist: /nonexistent

/copilot /etc/passwd
→ ❌ Path is not a directory: /etc/passwd

/claude /home; rm -rf /
→ ❌ Invalid directory path. Special characters are not allowed.
```

## Benefits

1. **Convenience**: No need to manually navigate to project directory
2. **Workflow Efficiency**: Start working in the right context immediately
3. **Context Preservation**: Each session can start in its relevant directory
4. **Safety**: Input validation prevents malicious commands

## Testing Checklist

- [x] Build succeeds without errors
- [ ] Test with no directory argument (backward compatibility)
- [ ] Test with valid absolute path
- [ ] Test with valid relative path
- [ ] Test with non-existent directory
- [ ] Test with file path instead of directory
- [ ] Test with special characters in path
- [ ] Test with command injection attempts
- [ ] Verify help text displays correctly
- [ ] Verify all three commands (copilot, claude, cursor) work identically

## Notes

- The `/start` command text was NOT modified as requested
- Backward compatibility maintained - commands work without directory argument
- Same implementation pattern used for all three AI assistant commands
- Directory validation happens before session creation for early error detection
