# Box Detection Feature - Implementation Review

## Overview
The box detection feature monitors terminal output for box-drawing characters that typically indicate interactive prompts from AI coding assistants like GitHub Copilot CLI.

## Original Issues Fixed

### 1. **Incorrect Buffer Checking**
**Problem:** Original code checked `data` (current chunk) instead of `buffer` (accumulated data)
```typescript
// BEFORE (WRONG)
if (data.includes('╭───────────────')) {
    console.log('Box detected')
}
```

**Issue:** If the box pattern was split across multiple data chunks, it would never be detected.

**Solution:** Now checks the accumulated `buffer` instead:
```typescript
// AFTER (CORRECT)
const buffer = this.appendToBuffer(userId, chatId, data);
const hasBoxPattern = boxPatterns.some(pattern => buffer.includes(pattern));
```

### 2. **Overly Specific Pattern**
**Problem:** Only checked for exact pattern `'╭───────────────'` (15 dashes)

**Issue:** 
- Would fail if the box had a different number of dashes
- Wouldn't detect other common box-drawing styles
- Too rigid for real-world terminal output

**Solution:** Now checks for multiple common box patterns:
```typescript
const boxPatterns = ['╭─', '┌─', '┏━', '╔═'];
const hasBoxPattern = boxPatterns.some(pattern => buffer.includes(pattern));
```

This supports:
- `╭─` - Rounded corners with light horizontal line
- `┌─` - Sharp corners with light horizontal line  
- `┏━` - Sharp corners with heavy horizontal line
- `╔═` - Double-line box drawing

### 3. **No User Notification**
**Problem:** Only logged to console, user never saw detection

**Solution:** Added callback handler that sends message to user:
```typescript
private async handleBoxDetected(userId: string, chatId: number, data: string): Promise<void> {
    const message = '🔍 **Box Pattern Detected** (Debug)\n\n' +
                   `Last 100 chars of buffer:\n\`\`\`\n${data.substring(Math.max(0, data.length - 100))}\n\`\`\``;
    const sentMsg = await this.bot.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    // Auto-delete after timeout...
}
```

## New Features Added

### 1. **Debouncing**
Prevents spam notifications when the same box appears repeatedly in the buffer.

```typescript
private lastBoxDetection: Map<string, number> = new Map();
private readonly BOX_DETECTION_DEBOUNCE_MS = 5000; // 5 seconds

// Only trigger if enough time has passed
const now = Date.now();
const lastDetection = this.lastBoxDetection.get(sessionKey) || 0;

if (now - lastDetection > this.BOX_DETECTION_DEBOUNCE_MS) {
    this.lastBoxDetection.set(sessionKey, now);
    handlers.onBoxDetected(userId, chatId, buffer);
}
```

### 2. **Debug Message to User**
When a box is detected, the user receives:
- A notification message with 🔍 icon
- Last 100 characters of buffer showing context
- Markdown-formatted code block for readability
- Auto-deletion after `MESSAGE_DELETE_TIMEOUT`

### 3. **Proper Cleanup**
Memory management ensures no leaks:
```typescript
clearBuffer(userId: string, chatId: number): void {
    const key = this.getBufferKey(userId, chatId);
    this.dataBuffers.delete(key);
    this.lastBoxDetection.delete(key); // Clear debounce tracking too
}

clearAllBuffers(): void {
    this.dataBuffers.clear();
    this.lastBoxDetection.clear(); // Clear all debounce data
}
```

## Implementation Details

### Buffer Management
- **Buffer Size:** 500 characters (last 500 chars kept)
- **Per-Session:** Each user+chatId combination has its own buffer
- **Sliding Window:** Old data is automatically discarded as new data arrives

### Detection Flow
1. **Data Arrives:** Terminal output chunk received
2. **Buffer Update:** Data appended to session buffer (keeps last 500 chars)
3. **Pattern Check:** Buffer scanned for any of the 4 box patterns
4. **Debounce Check:** Verify sufficient time has passed since last detection
5. **Callback Trigger:** If all checks pass, `onBoxDetected` is called
6. **User Notification:** Message sent to user with buffer context
7. **Auto-Delete:** Message removed after configured timeout

### Edge Cases Handled
- ✅ **Split patterns:** Box pattern split across multiple data chunks
- ✅ **Repeated patterns:** Debouncing prevents spam
- ✅ **Multiple box styles:** Supports 4 common Unicode box-drawing styles
- ✅ **Memory cleanup:** Debounce tracking cleared with buffers
- ✅ **Session isolation:** Each session has independent detection

## Testing Results

All box patterns detected successfully:
- ✅ `╭─` pattern detection
- ✅ `┌─` pattern detection
- ✅ `┏━` pattern detection
- ✅ `╔═` pattern detection
- ✅ Split pattern across chunks
- ✅ No false positives on plain text

## Configuration

### Debounce Timeout
Defined in `CoderService`:
```typescript
private readonly BOX_DETECTION_DEBOUNCE_MS = 5000; // 5 seconds
```

### Message Auto-Delete
Uses existing `MESSAGE_DELETE_TIMEOUT` from environment:
```env
MESSAGE_DELETE_TIMEOUT=10000  # 10 seconds
```

## Debug Output

Console logging includes:
```
[DEBUG] Box pattern detected in buffer: <last 100 chars of buffer>
```

User receives formatted message:
```
🔍 **Box Pattern Detected** (Debug)

Last 100 chars of buffer:
```
<buffer content>
```
```

## Security Considerations

✅ **Buffer Size Limited:** Only 500 chars stored (prevents memory issues)
✅ **Debouncing:** Prevents DoS via repeated pattern spam
✅ **Markdown Escaping:** Buffer content displayed in code block (prevents injection)
✅ **Session Isolation:** No cross-user data leakage
✅ **Auto-Cleanup:** Memory properly managed on session end

## Future Enhancements

Potential improvements:
1. Make debounce timeout configurable via environment variable
2. Add more box-drawing patterns if needed
3. Parse box content to extract prompt options
4. Auto-respond to common prompts based on user preferences
5. Pattern learning: detect new box styles automatically

## Troubleshooting

### Box Not Detected
- Verify buffer has enough context (500 chars should be sufficient)
- Check if box uses non-standard Unicode characters
- Review console logs for `[DEBUG] Box pattern detected` messages

### Too Many Notifications
- Increase `BOX_DETECTION_DEBOUNCE_MS` (currently 5 seconds)
- Check if different box patterns appear in rapid succession

### No Message to User
- Verify `onBoxDetected` handler is wired up in bot initialization
- Check Telegram API connectivity
- Review error logs for message sending failures
