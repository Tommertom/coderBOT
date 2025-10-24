# ControlBOT MyCommands Configuration

## Overview

The ControlBOT now has a properly configured command menu (`myCommands`) that displays three essential commands to administrators when interacting with the bot through Telegram.

## Changes Made

### 1. Added BotCommand Type Import
- Imported `BotCommand` type from `@grammyjs/types` to ensure type safety

### 2. Created MY_COMMANDS Static Array
Added a static readonly array containing the three primary commands:

```typescript
private static readonly MY_COMMANDS: BotCommand[] = [
    { command: 'status', description: 'Show status of all worker bots' },
    { command: 'stopall', description: 'Stop all running bots' },
    { command: 'help', description: 'Show complete command reference' },
];
```

### 3. Implemented setCommands() Method
Created a private method that sets the bot's command menu using the Telegram Bot API:

```typescript
private async setCommands(): Promise<void> {
    try {
        await this.bot.api.setMyCommands(ControlBot.MY_COMMANDS);
        console.log('✅ ControlBOT commands set successfully');
    } catch (error) {
        console.error('Failed to set ControlBOT commands:', error);
    }
}
```

### 4. Updated start() Method
Modified the `start()` method to call `setCommands()` before starting the bot:

```typescript
async start(): Promise<void> {
    await this.setCommands();
    await this.bot.start();
    console.log('✅ ControlBOT is running');
}
```

### 5. Removed listbots Command
- Removed the `listbots` command handler registration
- Removed the `handleListBots()` method
- Removed the `listbots` reference from the help message

### 6. Enhanced Status Command
- Added bot fullName display in status output
- Worker bots now send their fullName via IPC after starting
- Status command shows: botId, fullName (if available), status, PID, uptime, and errors

## Commands in MyCommands

1. **status** - Show status of all worker bots
   - Displays botId and fullName
   - Shows running/stopped status, PID, uptime, and errors for all managed bots
   
2. **stopall** - Stop all running bots
   - Gracefully stops all currently running worker bots
   
3. **help** - Show complete command reference
   - Displays comprehensive help with all available commands organized by category

## Benefits

- **User Experience**: Administrators see these three most important commands directly in the Telegram command menu
- **Discoverability**: New administrators can easily discover core functionality
- **Consistency**: Follows the same pattern used by other bots in the system (e.g., XtermBot)
- **Simplified Interface**: Removed less frequently used commands from the main menu
- **Better Identification**: Status command now shows bot names for easier identification

## Technical Details

- The command menu is set when the bot starts
- Uses the official Telegram Bot API `setMyCommands` endpoint
- Type-safe implementation using grammy's BotCommand type
- Graceful error handling if command setting fails
- Bot fullName is retrieved via `bot.api.getMe()` after starting
- Information is sent from worker to parent via IPC using the BOT_INFO message type

## Files Modified

- `src/features/control/control.bot.ts`
- `src/services/process-manager.service.ts`
- `src/bot-worker.ts`
- `src/types/ipc.types.ts`

## Build Status

✅ TypeScript compilation successful
✅ No breaking changes to existing functionality
