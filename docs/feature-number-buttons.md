# Feature: Number Buttons (1, 2 and 3) on Screen Refresh

## Overview

Added inline keyboard buttons "1", "2" and "3" alongside the existing "🔄 Refresh" button when terminal screenshots are sent. These buttons execute the same functionality as the `/1`, `/2` and `/3` commands but without adding messages to the chat.

## Changes Made

### 1. XtermBot (`src/features/xterm/xterm.bot.ts`)

#### Updated Keyboard Creation
- Modified `sendSessionScreenshot()` method to include "1", "2" and "3" buttons
- Updated `/screen` command keyboard to include the new buttons
- Updated refresh callback keyboard to include the new buttons

#### Added Callback Handlers
Added new callback handlers for `num_1`, `num_2` and `num_3`:
```typescript
if (callbackData === 'num_1' || callbackData === 'num_2' || callbackData === 'num_3') {
    if (!this.xtermService.hasSession(userId)) {
        await this.safeAnswerCallbackQuery(ctx, Messages.NO_ACTIVE_TERMINAL_SESSION);
        return;
    }

    const number = callbackData === 'num_1' ? '1' : callbackData === 'num_2' ? '2' : '3';
    this.xtermService.writeRawToSession(userId, number);
    await this.safeAnswerCallbackQuery(ctx, SuccessMessages.SENT(number));
    this.triggerAutoRefresh(userId, chatId);
    return;
}
```

### 2. CoderBot (`src/features/coder/coder.bot.ts`)

#### Updated Keyboard Creation
- Modified `sendSessionScreenshot()` method to include "1", "2" and "3" buttons
- Updated `refreshScreen()` method keyboard
- Updated `handleBellNotification()` method keyboard
- Updated refresh callback keyboard

#### Added Callback Handlers
Added the same `num_1`, `num_2` and `num_3` callback handlers as in XtermBot

#### Added Helper Method
Added `triggerAutoRefresh()` method to support auto-refresh after button press:
```typescript
private triggerAutoRefresh(userId: string, chatId: number): void {
    if (this.bot) {
        ScreenRefreshUtils.startAutoRefresh(
            userId,
            chatId,
            this.bot,
            this.xtermService,
            this.xtermRendererService,
            this.configService
        );
    }
}
```

### 3. ScreenRefreshUtils (`src/utils/screen-refresh.utils.ts`)

#### Updated Auto-Refresh Keyboard
Modified the keyboard in `startAutoRefresh()` to include "1", "2" and "3" buttons:
```typescript
const keyboard = new InlineKeyboard()
    .text('🔄 Refresh', 'refresh_screen')
    .row()
    .text('1', 'num_1')
    .text('2', 'num_2')
    .text('3', 'num_3');
```

## Keyboard Layout

The inline keyboard now appears as:
```
[ 🔄 Refresh ]
[  1  ] [  2  ] [  3  ]
```

## Behavior

### Button "1"
- Writes the character "1" to the terminal session
- Shows a success notification via callback query
- Triggers auto-refresh to update the screen
- **Does not** add a message to the chat

### Button "2"
- Writes the character "2" to the terminal session
- Shows a success notification via callback query
- Triggers auto-refresh to update the screen
- **Does not** add a message to the chat

### Button "3"
- Writes the character "3" to the terminal session
- Shows a success notification via callback query
- Triggers auto-refresh to update the screen
- **Does not** add a message to the chat

### Refresh Button
- Refreshes the terminal screenshot
- Updates the image in place
- Maintains the same keyboard with all four buttons
- **Triggers auto-refresh interval** to keep the screen updated automatically
- Prevents overlapping refresh processes

## Use Cases

1. **Menu Navigation**: Quickly select menu options (1, 2 or 3) without cluttering the chat
2. **Multi-choice Prompts**: Answer questions with multiple options in interactive terminal programs
3. **Silent Input**: Send input to the terminal without creating chat messages

## Technical Notes

- The buttons use callback queries (`num_1`, `num_2`, `num_3`, `refresh_screen`) instead of commands
- All buttons check for an active session before executing
- Auto-refresh is triggered after each button press (including Refresh) to show results continuously
- The `startAutoRefresh` utility prevents overlapping intervals by checking if one is already running
- If an interval is already running, it continues without creating a duplicate process
- The implementation is consistent across both XtermBot and CoderBot
- Error handling is in place for missing sessions

## Testing

To test the feature:
1. Start a terminal session with `/xterm`
2. Run an interactive command (e.g., a menu-driven program)
3. Send a screenshot with `/screen`
4. Click the "1", "2", "3", or "🔄 Refresh" buttons to interact with the terminal
5. Observe that:
   - No new message is added to the chat
   - The terminal receives the input (for number buttons)
   - The screen auto-refreshes to show the result continuously
   - A success notification appears briefly
   - Auto-refresh interval continues for configured duration

## Future Enhancements

Potential improvements:
- Add buttons 4, 5 if needed
- Make button labels configurable
- Add custom button sets for specific use cases
- Support for letter keys (Y/N, etc.)

## Changelog

### October 25, 2024
- Added button "3" to all inline keyboards alongside existing "1" and "2" buttons
- Updated callback handlers to support `num_3`
- Modified keyboard layout to place buttons 1, 2, and 3 on a second row under the Refresh button
- **Added auto-refresh interval trigger when Refresh button is pressed**
- Auto-refresh now prevents overlapping processes by checking if already running
- Updated documentation to reflect the new button, layout, and auto-refresh behavior
