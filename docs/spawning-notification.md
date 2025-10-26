# Spawning Notification Feature

## Overview
When starting a terminal session using `/xterm`, `/copilot`, `/claude`, or `/gemini` commands, the bot now displays a temporary "🚀 Spawning now..." message to provide immediate feedback to the user.

## Implementation Details

### Message Display
- **Message**: "🚀 Spawning now..."
- **Trigger**: Sent immediately when any of the following commands are invoked:
  - `/xterm`
  - `/copilot`
  - `/claude`
  - `/gemini`

### Auto-Deletion
- The spawning message is automatically deleted after **half** of the configured `MESSAGE_DELETE_TIMEOUT`
- Default deletion time: 5 seconds (if `MESSAGE_DELETE_TIMEOUT=10000` ms)
- This ensures the message disappears quickly after the terminal session starts

### Configuration
The deletion timeout is controlled by the `MESSAGE_DELETE_TIMEOUT` environment variable:
- **Environment Variable**: `MESSAGE_DELETE_TIMEOUT`
- **Default Value**: 10000 ms (10 seconds)
- **Spawning Message Deletion**: `MESSAGE_DELETE_TIMEOUT / 2` (5 seconds by default)

### Code Changes

#### Constants
Added new message constant in `src/constants/messages.ts`:
```typescript
export const Messages = {
    // ...
    SPAWNING_SESSION: '🚀 Spawning now...',
} as const;
```

#### Handlers Modified
Both `handleXterm` and `handleAIAssistant` methods in `src/features/xterm/xterm.bot.ts` now:
1. Send the spawning message immediately
2. Schedule deletion at half the configured timeout
3. Handle deletion errors gracefully

### User Experience
1. User sends `/copilot` (or other terminal command)
2. Bot immediately responds with "🚀 Spawning now..."
3. Terminal session starts
4. After ~5 seconds (default), the spawning message automatically disappears
5. Terminal screenshot appears with interaction keyboard

### Error Handling
- Deletion errors are logged to console but do not affect session creation
- If deletion fails, the message remains visible (graceful degradation)

## Related Features
- **Message Auto-Deletion**: Uses the same `MESSAGE_DELETE_TIMEOUT` configuration
- **Terminal Session Management**: Part of the session lifecycle notifications
- **Command Menu Updates**: Commands change after session starts

## Future Enhancements
Potential improvements could include:
- Configurable spawning message text
- Different timeouts for spawning vs. other messages
- Progress indicator during session initialization
