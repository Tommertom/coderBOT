# Box Detection Code Removal Plan

## Overview
The box detection feature was an experimental attempt to detect interactive prompts from AI coding assistants by looking for box-drawing characters in terminal output. This feature should be removed as it's no longer needed.

## Files to Modify

### 1. `/home/tom/coderBOT/src/features/coder/coder.service.ts`

#### Remove from `TerminalDataHandlers` interface (line 10)
```typescript
onBoxDetected?: (userId: string, chatId: number, data: string) => void;
```

#### Remove constant (line 18)
```typescript
private readonly BOX_DETECTION_DEBOUNCE_MS = 5000; // 5 seconds debounce
```

**Note:** This constant is declared but never actually used in the codebase - the box detection logic was never fully implemented in the service layer.

### 2. `/home/tom/coderBOT/src/features/coder/coder.bot.ts`

#### Remove entire method `handleBoxDetected` (lines 229-257)
```typescript
private async handleBoxDetected(userId: string, chatId: number, data: string): Promise<void> {
    if (!this.bot) {
        console.error('Bot instance not available for box detection notification');
        return;
    }

    try {
        // Send debug notification to user
        const message = '🔍 **Box Pattern Detected** (Debug)\n\n' +
            `Last 100 chars of buffer:\n\`\`\`\n${data.substring(Math.max(0, data.length - 100))}\n\`\`\``;

        const sentMsg = await this.bot.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        // Auto-delete after configured timeout
        const deleteTimeout = this.configService.getMessageDeleteTimeout();
        if (deleteTimeout > 0) {
            setTimeout(async () => {
                try {
                    await this.bot!.api.deleteMessage(chatId, sentMsg.message_id);
                } catch (error) {
                    console.error('Failed to delete box detection notification message:', error);
                }
            }, deleteTimeout);
        }
    } catch (error) {
        console.error(`Failed to send box detection notification: ${error}`);
    }
}
```

#### Remove from handler registration (line 504)
```typescript
onBoxDetected: this.handleBoxDetected.bind(this),
```

This line appears in the `handleAIAssistant` method where terminal data handlers are created.

## Summary of Changes

### coder.service.ts
- **Lines to remove:** 1 line from interface, 1 constant declaration
- **Impact:** Removes unused handler interface and constant

### coder.bot.ts  
- **Lines to remove:** ~29 lines (entire method + 1 line from handler registration)
- **Impact:** Removes non-functional debug feature

## Why Remove This Code?

1. **Incomplete Implementation:** The box detection logic was never fully implemented. The constant `BOX_DETECTION_DEBOUNCE_MS` is declared but never used.

2. **Debug-Only Feature:** The `handleBoxDetected` method only sends debug messages showing "last 100 chars of buffer" - it doesn't provide any real functionality.

3. **No Active Detection:** There's no actual box pattern detection logic in the codebase that would trigger this handler.

4. **Code Cleanliness:** Removing this experimental/incomplete code will make the codebase cleaner and easier to maintain.

## Related Documentation

The following documentation file references box detection and may need updating or removal:
- `/home/tom/coderBOT/docs/box-detection-review.md` - Documents the feature design but the feature was never completed
- `/home/tom/coderBOT/docs/url-detection-migration-complete.md` - Mentions the interface in historical context

These documentation files can remain as historical reference or be moved to an archive folder.
