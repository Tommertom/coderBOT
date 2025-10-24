# Bot Name Display Fix

## Issue
The status command was not displaying bot names. The bot info retrieval code was completely missing from the worker process, so bot names and usernames were never sent to the ProcessManager.

## Solution
Updated the bot name retrieval and display logic to use a more robust approach based on the Grammy.js best practices.

## Changes Made

### 1. Updated `src/bot-worker.ts`
**Changed the fullName construction method** (line 113):

**Before:**
```typescript
const fullName = me.first_name + (me.last_name ? ` ${me.last_name}` : '');
```

**After:**
```typescript
const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
```

**Benefits:**
- More robust handling of undefined/null values
- Cleaner, more maintainable code
- Follows Grammy.js recommended pattern
- Better handles edge cases where first_name might be missing

### 2. Updated `src/services/process-manager.service.ts`
**Added username field** to `BotProcessInfo` interface:
```typescript
export interface BotProcessInfo {
    botId: string;
    token: string;
    pid: number | null;
    status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
    startTime: Date | null;
    uptime: number;
    lastError: string | null;
    logs: string[];
    fullName?: string;
    username?: string;  // <- Added
}
```

**Updated IPC message handler** to store username (lines 255-262):
```typescript
case IPCMessageType.BOT_INFO:
    if (message.data?.fullName) {
        info.fullName = message.data.fullName;
        this.addLog(botId, `[INFO] Bot name: ${message.data.fullName}`);
    }
    if (message.data?.username) {
        info.username = message.data.username;
    }
    break;
```

### 3. Updated `src/features/control/control.bot.ts`
**Enhanced status display** to show both full name and username (lines 107-114):

**Before:**
```typescript
message += `${statusIcon} *${status.botId}*\n`;
if (status.fullName) {
    message += `   ${status.fullName}\n`;
}
```

**After:**
```typescript
message += `${statusIcon} *${status.botId}*\n`;
if (status.fullName) {
    message += `   ${status.fullName}`;
    if (status.username) {
        message += ` (@${status.username})`;
    }
    message += `\n`;
}
```

## Example Output

### Before:
```
📊 Worker Bot Status

🟢 bot-1
   Status: `running`
   PID: `12345`
   Uptime: `2h 30m`
```

### After:
```
📊 Worker Bot Status

🟢 bot-1
   CoderBot (@coderbot_helper)
   Status: `running`
   PID: `12345`
   Uptime: `2h 30m`
```

## How It Works

1. When a worker bot starts, it calls `bot.api.getMe()` to retrieve bot information
2. The bot constructs a `fullName` using the improved filter/join pattern
3. It sends both `fullName` and `username` via IPC to the parent process
4. The ProcessManager stores this information in the `BotProcessInfo` object
5. When the `/status` command is called, the control bot displays this information

## Testing

To test the changes:
1. Rebuild the project: `npm run build`
2. Restart the coderBOT system
3. Run the `/status` command in the control bot
4. Verify that bot names and usernames are displayed correctly

## Reference

This implementation is based on the Grammy.js recommended pattern for retrieving bot information:
```typescript
import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

(async () => {
  const me = await bot.api.getMe();
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
  console.log({ id: me.id, fullName, username: me.username });
})();
```
