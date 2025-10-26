# Command Reorganization - January 2025

## Summary

Commands have been reorganized between the Coder Bot and Xterm Bot to better align with their intended purposes. Additionally, the bot command menu (mycommands) now dynamically updates based on session state.

## Changes Made

### Coder Bot (Main Bot)

**Commands Removed:**
- `/copilot` → Moved to Xterm Bot
- `/claude` → Moved to Xterm Bot  
- `/gemini` → Moved to Xterm Bot

**Commands Added:**
- `/esc` ← Moved from Xterm Bot (placed after `/help`)
- `/close` ← Kept (no change, already had it)

**Final Command List:**
1. `/start` - Welcome message
2. `/help` - Show help documentation
3. `/esc` - Send Escape key to terminal
4. `/close` - Close the terminal session
5. `/send` - Send text to terminal with Enter
6. `/killbot` - Shutdown the bot
7. `/urls` - Show discovered URLs

### Xterm Bot (Terminal Bot)

**Commands Added:**
- `/copilot` ← Moved from Coder Bot
- `/claude` ← Moved from Coder Bot
- `/gemini` ← Moved from Coder Bot

**Commands Removed:**
- `/close` → Moved to Coder Bot

**Final Command List:**
1. `/xterm` - Start raw bash terminal
2. `/copilot` - Start GitHub Copilot AI session
3. `/claude` - Start Claude AI session
4. `/gemini` - Start Gemini AI session
5. `/send` - Send text with Enter
6. `/keys` - Send text without Enter
7. `/tab` - Send Tab character
8. `/enter` - Send Enter key
9. `/space` - Send Space character
10. `/delete` - Send Delete key
11. `/ctrl` - Send Ctrl+character
12. `/ctrlc` - Send Ctrl+C
13. `/ctrlx` - Send Ctrl+X
14. `/esc` - Send Escape key
15. `/arrowup` - Send Arrow Up key
16. `/arrowdown` - Send Arrow Down key
17. `/screen` - Capture terminal screenshot
18. `/urls` - Show discovered URLs
19. `/1` through `/5` - Send number keys

## Rationale

### Why This Organization?

**Coder Bot (Simplified)**:
- Acts as the main user interface
- Minimal command set focused on core functionality
- `/esc` added for quick escape key access
- `/close` for session management
- Removed AI assistant commands to reduce complexity

**Xterm Bot (Feature-Rich)**:
- Contains all terminal manipulation commands
- Includes AI assistant launchers (`/copilot`, `/claude`, `/gemini`)
- Full special key support for power users
- Better suited for advanced terminal operations

### Benefits

1. **Clearer Separation of Concerns**: Coder Bot for simple interactions, Xterm Bot for advanced terminal work
2. **Reduced Cognitive Load**: Users see fewer commands in Coder Bot's help
3. **Logical Grouping**: AI assistants grouped with terminal commands in Xterm Bot
4. **Easier Maintenance**: Related functionality in same module

## Implementation Details

### Coder Bot Changes

**File**: `src/features/coder/coder.bot.ts`

- Added `handleEsc()` method with auto-refresh support
- Updated `handleStart()` to remove AI assistant references
- Updated `handleHelp()` to show simplified command list
- Removed AI assistant handler registrations

### Xterm Bot Changes

**File**: `src/features/xterm/xterm.bot.ts`

- Added `handleAIAssistant()` generic method
- Added `handleCopilot()`, `handleClaude()`, `handleGemini()` methods
- Removed `handleClose()` method
- AI assistants now run without data handlers (no BEL/confirmation monitoring in xterm context)

## Migration Notes

### For Users

- **To start AI assistants**: Use Xterm Bot's `/copilot`, `/claude`, or `/gemini` commands
- **To close sessions**: Use Coder Bot's `/close` command
- **To send escape**: Both bots support `/esc` (Coder Bot after `/help`, Xterm Bot in full list)

### For Developers

- Coder Bot remains the main bot for simple terminal interactions
- Xterm Bot handles all advanced terminal features including AI assistants
- Both bots share the same underlying `XtermService`
- AI assistants in Xterm Bot do not have data handlers (intentional)

## Testing

Build verification: ✅ Successful

```bash
npm run build
```

All TypeScript compilation passed without errors.

## Files Modified

1. `src/features/coder/coder.bot.ts` - Command list reorganization, added /esc handler
2. `src/features/xterm/xterm.bot.ts` - Added AI assistant handlers, removed /close handler
3. `docs/xterm-vs-copilot-comparison.md` - Updated comparison documentation
4. `docs/command-reorganization-2025.md` - This document

## Dynamic Command Menu

The bot now implements a dynamic command menu that changes based on session state:

### Before Session (No Active Terminal)
The mycommands menu shows:
- `/screen` - Capture terminal screenshot
- `/help` - Show complete command reference
- `/tab` - Send Tab character
- `/enter` - Send Enter key
- `/ctrlc` - Send Ctrl+C (interrupt)
- `/copilot` - Start session with GitHub Copilot ⬅️ Visible
- `/claude` - Start session with Claude AI ⬅️ Visible
- `/gemini` - Start session with Gemini AI ⬅️ Visible
- `/start` - Show help message

**Note:** `/close` is NOT shown when there's no active session.

### After Starting a Session
When `/copilot`, `/claude`, `/gemini`, or `/xterm` is used, the menu changes to:
- `/screen` - Capture terminal screenshot
- `/help` - Show complete command reference
- `/tab` - Send Tab character
- `/enter` - Send Enter key
- `/ctrlc` - Send Ctrl+C (interrupt)
- `/close` - Close the current terminal session ⬅️ Now visible
- `/start` - Show help message

**Note:** `/copilot`, `/claude`, `/gemini` are removed from the menu.

### After Closing a Session
When `/close` is used, the menu reverts back to the "no session" state with AI assistant commands visible again.

## Future Considerations

- Consider whether `/esc` should remain in both bots or only in Coder Bot
- Monitor user feedback on the new command organization and dynamic menu
- May need to update user-facing documentation and tutorials
- Consider adding command aliases for backward compatibility if needed
- Evaluate if per-user command menus would be beneficial (currently global)
