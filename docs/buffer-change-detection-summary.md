# Buffer Change Detection - Implementation Summary

## What Was Added

A debugging feature that monitors terminal buffer output and sends a notification when the buffer hasn't changed for 5 seconds, indicating output has stabilized.

## Files Modified

### 1. `/src/features/xterm/xterm.types.ts`
**Added to `PtySession` interface:**
- `lastBufferSnapshot?: string` - Stores previous buffer state
- `lastBufferChangeTime?: Date` - Timestamp of last change
- `bufferMonitorInterval?: NodeJS.Timeout` - Monitoring interval reference
- `onBufferingEndedCallback?: (userId: string, chatId: number) => void` - Notification callback

### 2. `/src/features/xterm/xterm.service.ts`
**Changes:**
- Updated `createSession()` signature to accept `onBufferingEndedCallback` parameter
- Initialized new buffer tracking fields in session creation
- Added `session.lastBufferChangeTime = new Date()` in `onData` handler
- Added `startBufferMonitoring()` private method that:
  - Checks buffer every 1 second
  - Compares with last snapshot
  - Triggers callback after 5 seconds of no changes
  - Clears interval after triggering (one-time notification)
- Added cleanup of `bufferMonitorInterval` in `closeSession()`
- Called `startBufferMonitoring()` after session creation

### 3. `/src/features/xterm/xterm.bot.ts`
**Changes:**
- Added `handleBufferingEnded()` callback method that:
  - Logs debug message to console
  - Sends formatted notification to user
- Updated `handleXterm()` to pass `handleBufferingEnded` callback
- Updated `handleAIAssistant()` to pass `handleBufferingEnded` callback

## Files Created

### Documentation
- `/docs/buffer-change-detection.md` - Comprehensive feature documentation

### Scripts
- `/scripts/test-buffer-detection.js` - Demonstration/test script
- `/tests/buffer-change-detection.test.ts` - Manual test scenarios guide

## How It Works

```
Session Created
      ↓
Buffer Monitoring Starts (1-sec interval)
      ↓
Each Second:
  - Get current buffer
  - Compare with last snapshot
  - If different → Update snapshot & timestamp
  - If same → Check if 5 seconds elapsed
      ↓
After 5 Seconds of No Changes:
  - Call onBufferingEndedCallback
  - Send notification to user
  - Clear interval (stop monitoring)
```

## User Experience

When buffer stabilizes, user receives:
```
🔄 *Buffering ended*

Terminal output has not changed for 5 seconds.
```

## Testing

**Manual test:**
1. Start terminal: `/xterm`
2. Run command: `ls -la`
3. Wait (don't send more commands)
4. After ~5 seconds: notification appears

**With AI assistant:**
1. Start: `/copilot`
2. Wait for initialization
3. After ~5 seconds: notification confirms copilot is ready

## Configuration

**Current hardcoded values:**
- Check interval: 1000ms (1 second)
- Trigger threshold: 5000ms (5 seconds)
- Notification: One-time per session

## Cleanup Considerations

**Resources properly cleaned up:**
- ✅ Interval cleared when notification triggers
- ✅ Interval cleared when session closes
- ✅ One notification per session (prevents spam)

## Future Enhancements

Potential improvements:
- Make timeout configurable via config service
- Add enable/disable toggle
- Allow monitoring restart after notification
- Filter certain output types (e.g., cursor-only updates)

## Debug Logging

Console log output when triggered:
```javascript
[DEBUG] Buffer stopped changing for user <userId>
```

Check application logs (PM2 or console) to verify detection is working.
