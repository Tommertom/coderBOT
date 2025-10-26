# Quick Reference: Buffer Change Detection

## 🎯 Purpose
Debug feature to detect when terminal output stops changing for 5 seconds.

## 📋 Quick Test
```
/xterm
ls
[wait 5 seconds]
→ "🔄 Buffering ended" notification appears
```

## 🔧 Implementation
- **Check Interval:** Every 1 second
- **Trigger Time:** After 5 seconds of no changes
- **Notification:** One-time per session
- **Cleanup:** Automatic

## 📁 Modified Files
1. `src/features/xterm/xterm.types.ts` - Added tracking fields
2. `src/features/xterm/xterm.service.ts` - Added monitoring logic
3. `src/features/xterm/xterm.bot.ts` - Added notification handler

## 🔍 Debug Output
```
[DEBUG] Buffer stopped changing for user <userId>
```

## 📝 Key Methods

### XtermService
```typescript
private startBufferMonitoring(userId: string): void
```
- Starts 1-second interval check
- Compares buffer snapshots
- Triggers callback after 5 seconds

### XtermBot
```typescript
private async handleBufferingEnded(userId: string, chatId: number): Promise<void>
```
- Sends notification to user
- Logs debug message

## 🎮 Use Cases
- Detect command completion
- Know when AI assistant is ready
- Identify output stabilization
- Debug terminal interactions

## ⚙️ Configuration
Currently hardcoded - future enhancement:
```typescript
// Potential config options:
BUFFER_CHECK_INTERVAL: 1000,  // ms
BUFFER_STABLE_TIMEOUT: 5000,  // ms
ENABLE_BUFFER_DETECTION: true
```

## 🗑️ To Remove Feature
1. Remove fields from `PtySession` interface
2. Remove `startBufferMonitoring()` method
3. Remove `handleBufferingEnded()` method
4. Remove callback parameter from `createSession()`
5. Remove callback bindings in session creation

## 📚 Full Documentation
See: `docs/buffer-change-detection.md`
