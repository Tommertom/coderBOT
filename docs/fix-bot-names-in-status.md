# Fix: Bot Names Not Showing in Status Command

## Problem
The `/status` command in the ControlBOT was not displaying bot names and usernames. The status output showed:
```
🟢 *bot-1*
   Status: `running`
   PID: `12345`
   Uptime: `5m 23s`
```

But it should show:
```
🟢 *bot-1*
   coding coderBOT (@copilotControl2_bot)
   Status: `running`
   PID: `12345`
   Uptime: `5m 23s`
```

## Root Cause

The bot worker process was trying to retrieve bot information (`getMe()`) AFTER calling `bot.start()`. In Grammy (the Telegram bot framework), `bot.start()` is a blocking call that begins polling for updates and doesn't return until the bot is stopped. This meant the code to fetch and send bot information was never executed during normal operation.

### Code Flow (Before Fix)
```typescript
// bot-worker.ts
await bot.start();           // ← Blocking call - never returns
console.log("Bot started");  // ← Never reached
const me = await bot.api.getMe();  // ← Never executed
process.send({ type: 'BOT_INFO', ... }); // ← Never sent
```

## Solution

Move the `getMe()` call and IPC message sending to BEFORE `bot.start()` is called. This ensures the bot information is retrieved and sent to the parent process immediately during initialization, before the bot enters its polling loop.

### Code Flow (After Fix)
```typescript
// bot-worker.ts
const me = await bot.api.getMe();  // ← Get bot info first
process.send({ type: 'BOT_INFO', ... }); // ← Send to parent
await bot.start();           // ← Start polling (blocks here)
```

## Files Modified

### `/src/bot-worker.ts`
- **Line 104-130**: Moved bot info retrieval before `bot.start()` call
- The bot now calls `bot.api.getMe()` to fetch its name and username
- Sends `BOT_INFO` IPC message to parent process BEFORE starting the bot
- Bot name is constructed from `first_name` and `last_name` fields

### No Changes Needed
The following files already had correct implementation:
- `/src/services/process-manager.service.ts` - Already handling `BOT_INFO` messages correctly
- `/src/features/control/control.bot.ts` - Already displaying `fullName` and `username` in status

## Testing

### Test Script Created
`/scripts/test-process-manager.js` - Tests if ProcessManager receives bot info correctly

### Verification
```bash
# Run the test
node scripts/test-process-manager.js

# Expected output:
📊 Bot Status:
   Bot ID: bot-1
   Status: running
   Full Name: coding coderBOT
   Username: copilotControl2_bot
   ✅ Bot info received successfully!
```

### Production Testing
```bash
# Build the project
npm run build

# Start the bots
npm start

# Use Telegram to send /status command to your ControlBOT
# Should now show bot names and usernames
```

## Impact

- ✅ Bot names now display correctly in `/status` command
- ✅ Bot usernames now display correctly in `/status` command
- ✅ No performance impact (getMe() is fast)
- ✅ Works with all configured bots
- ✅ Backward compatible

## Related Files

- `/src/bot-worker.ts` - Worker initialization
- `/src/services/process-manager.service.ts` - Process management
- `/src/features/control/control.bot.ts` - Control bot status command
- `/src/types/ipc.types.ts` - IPC message types
- `/scripts/get-bot-info.js` - Utility to check bot information

## Key Learnings

1. **Grammy's `bot.start()` is blocking** - It begins polling and doesn't return until stopped
2. **IPC must be sent during initialization** - Before entering blocking operations
3. **Order matters** - Get metadata before starting long-running operations
4. **Test with real processes** - IPC issues only show up in multi-process scenarios
