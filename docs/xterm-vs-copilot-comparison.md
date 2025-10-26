# Xterm vs Copilot Command Implementation Comparison

## Overview

This document compares the implementation of the `/xterm` command with the `/copilot` (and related AI assistant commands) to ensure consistency and highlight the intentional differences.

## Key Architectural Differences

### 1. Session Creation

**Xterm (`/xterm`)**:
```typescript
// Creates a simple bash session without data handlers - xterm is a raw terminal
this.xtermService.createSession(userId, chatId);
await new Promise(resolve => setTimeout(resolve, 500));
await this.sendSessionScreenshot(ctx, userId);
```

**Copilot (`/copilot`, `/claude`, `/gemini`)**:
```typescript
// Creates a session WITH data handlers for special terminal output
const dataHandler = this.coderService.createTerminalDataHandler({
    onBell: this.handleBellNotification.bind(this),
    onConfirmationPrompt: this.handleConfirmNotification.bind(this),
});
this.xtermService.createSession(userId, chatId, dataHandler);
await new Promise(resolve => setTimeout(resolve, 500));
this.xtermService.writeToSession(userId, assistantType); // Writes "copilot", "claude", or "gemini"
await new Promise(resolve => setTimeout(resolve, 2000));
await this.sendSessionScreenshot(ctx, userId);
```

**Reason**: Xterm provides a raw terminal experience without data monitoring, while copilot needs to monitor for AI assistant prompts and notifications. Both now send an initial screenshot.

### 2. Initial Command Execution

**Xterm (`/xterm`)**:
- Does NOT execute any command automatically
- User sees a clean bash prompt in the screenshot
- User must type their own commands

**Copilot (`/copilot`)**:
- Automatically writes "copilot", "claude", or "gemini" command
- Waits 2 seconds for the AI assistant to load
- User sees the AI assistant's welcome screen in the screenshot

**Reason**: The copilot command is a convenience wrapper that automatically launches the AI assistant CLI tool, while xterm is for direct shell access.

### 3. User Feedback

**Xterm (`/xterm`)**:
- Automatically sends a screenshot showing the bash prompt
- No help text message (cleaner interface)
- User can refresh with the 🔄 Refresh button

**Copilot (`/copilot`)**:
- Waits for the AI assistant to load
- Automatically sends a screenshot of the terminal
- User sees the AI assistant's welcome screen with the 🔄 Refresh button

**Both now provide the same visual feedback pattern - an initial screenshot with refresh button.**

### 4. Terminal Data Monitoring

**Xterm (`/xterm`)**:
- No special monitoring of terminal output
- Simple URL extraction for `/urls` command
- No automatic screen updates

**Copilot (`/copilot`)**:
- Monitors for BEL character (ASCII 0x07) to trigger screenshot updates
- Detects confirmation prompts (e.g., "1. Yes") 
- Automatically updates screenshots when AI assistant produces output
- Provides interactive callback buttons for common choices

## Common Shared Features

Both implementations now share these features:

1. **Session Management**: Both use the same underlying PTY session management
2. **Input Commands**: Both support `/send`, `/keys`, `/tab`, `/enter`, etc.
3. **Screenshot Capability**: Both support `/screen` command and automatic initial screenshot
4. **URL Discovery**: Both support `/urls` command
5. **Session Cleanup**: Both use `/close` to terminate sessions
6. **Access Control**: Both require `AccessControlMiddleware.requireAccess`
7. **Auto-refresh**: Both support automatic screen refresh via `ScreenRefreshUtils`
8. **Text Message Handling**: Both accept plain text messages (sent with Enter)
9. **Callback Query Handling**: Both support refresh button and interactive callbacks
10. **Dot Prefix Support**: Both support `.command` syntax (dot is stripped, Enter added)

## Code Structure Consistency

### Both Follow the Same Pattern:

1. **Access Control**: All handlers protected by `AccessControlMiddleware.requireAccess`
2. **Session Validation**: Use `requireActiveSession()` helper or explicit session checks
3. **Error Handling**: Use `ErrorUtils.createErrorMessage()` for consistent error reporting
4. **Message Cleanup**: Use `MessageUtils.scheduleMessageDeletion()` for temporary messages
5. **Success Messages**: Use `SuccessMessages` constants for feedback

## Implementation Files

### Xterm Feature:
- `src/features/xterm/xterm.bot.ts` - Bot command handlers
- `src/features/xterm/xterm.service.ts` - Session management
- `src/features/xterm/xterm-renderer.service.ts` - Screenshot rendering

### Coder (Copilot) Feature:
- `src/features/coder/coder.bot.ts` - Bot command handlers (includes AI assistant commands)
- `src/features/coder/coder.service.ts` - Terminal data monitoring and media handling
- Uses the same `xterm.service.ts` and `xterm-renderer.service.ts`

## Design Principles

### Xterm Philosophy:
- **Raw and Direct**: Provides unfiltered access to bash
- **User Control**: User decides what to run
- **Minimal Interference**: No automatic actions beyond session creation

### Copilot Philosophy:
- **Convenience First**: Automatically launches AI assistant
- **Interactive Experience**: Monitors output and provides visual feedback
- **Assisted Workflow**: Detects prompts and offers quick actions

## When to Use Which

**Use `/xterm` when:**
- Need a raw bash terminal
- Want direct shell access without any wrapper
- Debugging or running system commands
- Don't need AI assistant integration

**Use `/copilot`, `/claude`, or `/gemini` when:**
- Want to interact with an AI coding assistant
- Need automatic screenshot updates
- Want interactive confirmation buttons
- Prefer a guided development experience

## Recent Changes (2025)

### Command Reorganization

The commands have been reorganized between the two bots:

**Coder Bot (CoderBot) Commands:**
- `/start` - Welcome message
- `/help` - Show help
- `/esc` - Send Escape key (moved from xterm)
- `/close` - Close terminal session (moved from xterm)
- `/send` - Send text with Enter
- `/killbot` - Shutdown the bot
- `/urls` - Show discovered URLs

**Xterm Bot Commands:**
- `/xterm` - Start raw bash terminal
- `/copilot` - Start GitHub Copilot session (moved from coder)
- `/claude` - Start Claude AI session (moved from coder)
- `/gemini` - Start Cursor AI session (moved from coder)
- `/send` - Send text with Enter
- `/keys` - Send text without Enter
- `/tab` - Send Tab
- `/enter` - Send Enter
- `/space` - Send Space
- `/delete` - Send Delete
- `/ctrl` - Send Ctrl+character
- `/ctrlc` - Send Ctrl+C
- `/ctrlx` - Send Ctrl+X
- `/esc` - Send Escape
- `/arrowup` - Send Arrow Up
- `/arrowdown` - Send Arrow Down
- `/screen` - Capture screenshot
- `/urls` - Show URLs
- `/1` through `/5` - Send number keys

### Implementation Alignment

✅ **Now Identical**:
- Both send automatic initial screenshots
- Both handle text messages and callback queries
- Both support `/send` command
- Both use the same helper methods (`sendSessionScreenshot`, `safeAnswerCallbackQuery`)
- Both provide refresh buttons on screenshots
- Both auto-refresh after commands

❌ **Still Different**:
- Xterm `/copilot`, `/claude`, `/gemini` do NOT have data handlers for BEL or confirmation monitoring
- Coder bot is simpler with fewer special key commands

## Conclusion

The implementations now follow the same code patterns and provide a similar user experience:

- **Xterm** = Raw terminal access with modern UX (screenshots, callbacks, auto-refresh)
- **Copilot** = AI-assisted development with the same UX plus intelligent monitoring

Both share the same underlying terminal service and now provide nearly identical user experiences, with the only difference being that copilot automatically launches an AI assistant and monitors its output. The code follows consistent patterns for error handling, access control, message management, and user interaction.
