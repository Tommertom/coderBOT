# Buffer Change Detection (Debug Feature)

## Overview

This debugging feature monitors terminal output buffer changes and notifies users when the buffer has remained unchanged for 5 seconds, indicating that terminal output has stabilized.

## Purpose

This is a **trial/debug feature** designed to help understand when terminal commands have finished producing output. It can be useful for:

- Detecting when long-running commands have completed
- Identifying when AI assistants (copilot, claude, gemini) have finished responding
- Understanding terminal output patterns during development

## How It Works

1. **Buffer Monitoring**: When a terminal session is created, a monitoring interval starts that checks the buffer every second
2. **Change Detection**: The system compares the current buffer contents with a snapshot from the previous check
3. **Stabilization Detection**: If the buffer remains unchanged for 5 consecutive seconds, it triggers a notification
4. **One-Time Notification**: Once triggered, the monitoring stops to prevent repeated notifications

## Implementation Details

### Components Modified

1. **PtySession Interface** (`xterm.types.ts`)
   - Added `lastBufferSnapshot?: string` - stores the last buffer state
   - Added `lastBufferChangeTime?: Date` - tracks when buffer last changed
   - Added `bufferMonitorInterval?: NodeJS.Timeout` - interval timer reference
   - Added `onBufferingEndedCallback?: (userId: string, chatId: number) => void` - callback function

2. **XtermService** (`xterm.service.ts`)
   - Modified `createSession()` to accept `onBufferingEndedCallback` parameter
   - Added `startBufferMonitoring()` private method that:
     - Checks buffer every 1 second
     - Compares current buffer with last snapshot
     - Triggers callback after 5 seconds of no changes
     - Cleans up interval after notification
   - Updated buffer change tracking in `onData` handler
   - Added interval cleanup in `closeSession()`

3. **XtermBot** (`xterm.bot.ts`)
   - Added `handleBufferingEnded()` callback method
   - Integrated callback into `handleXterm()` and `handleAIAssistant()` session creation
   - Sends formatted notification to user when triggered

### Notification Format

When the buffer stabilizes, users receive:

```
🔄 *Buffering ended*

Terminal output has not changed for 5 seconds.
```

## Technical Considerations

### Performance

- **Interval**: 1-second checks balance responsiveness with CPU usage
- **Memory**: Stores one buffer snapshot per session (typically <100KB)
- **Cleanup**: Intervals are properly cleared on session close or after notification

### Limitations

1. **False Positives**: May trigger during interactive prompts or pauses
2. **One-Shot**: Only fires once per session (monitoring stops after notification)
3. **No Restart**: If output resumes, no new notification is sent
4. **Buffer-Based**: Detects output changes, not process completion

## Future Enhancements

Potential improvements for production use:

- [ ] Configuration option to enable/disable feature
- [ ] Adjustable timeout duration (currently hardcoded to 5 seconds)
- [ ] Option to restart monitoring after notification
- [ ] Ignore certain types of output (e.g., cursor updates)
- [ ] Integration with auto-refresh logic
- [ ] Configurable notification format/style

## Removal Instructions

If this debug feature needs to be removed:

1. Remove fields from `PtySession` interface in `xterm.types.ts`
2. Remove `onBufferingEndedCallback` parameter from `createSession()`
3. Remove `startBufferMonitoring()` method from `XtermService`
4. Remove `handleBufferingEnded()` from `XtermBot`
5. Remove callback bindings in session creation calls

## Testing

To test this feature:

1. Start a terminal session with `/xterm` or `/copilot`
2. Run a command that produces output (e.g., `ls -la`)
3. Wait without sending additional commands
4. After 5 seconds of no output changes, you should receive the notification
5. Verify the notification appears only once

Example test sequence:
```
/xterm
ls
[wait 5+ seconds]
→ Should see "Buffering ended" notification
```

## Logging

Debug information is logged to console:
```javascript
console.log(`[DEBUG] Buffer stopped changing for user ${userId}`);
```

Check application logs for these entries during testing.
