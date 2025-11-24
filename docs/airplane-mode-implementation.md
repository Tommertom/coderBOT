# Airplane Mode Implementation Report

## Overview

Airplane mode has been successfully implemented for the coderBOT project. When enabled, the bot sends terminal output as text messages instead of rendered images, reducing bandwidth usage and improving response times.

## Changes Made

### 1. Configuration Service (`src/services/config.service.ts`)

**Added:**
- New environment variable `AIRPLANE_MODE` that accepts values: `on`, `off`, `true`, `false`, `1`, `0`
- Private property `airplaneMode: boolean` (default: `false`)
- Getter method `isAirplaneModeEnabled(): boolean`
- Updated debug info to include airplane mode status

**Environment Variable:**
```
AIRPLANE_MODE=on|off|true|false|1|0
```

Default: `off` (disabled)

### 2. Text Sanitization Utility (`src/utils/text-sanitization.utils.ts`)

**New file created** with the following functions:

- `removeAnsiCodes(text: string): string`
  - Removes ANSI escape sequences (color codes, cursor movements, etc.)
  - Handles ESC[ sequences, OSC sequences, and character set selections

- `removeControlCharacters(text: string): string`
  - Removes non-printable control characters
  - Preserves common whitespace (space, tab, newline, carriage return)

- `sanitizeTerminalOutput(text: string, maxLength?: number): string`
  - Main sanitization function
  - Removes ANSI codes and control characters
  - Enforces Telegram message length limit (4096 - 20 for formatting = 4076 chars)
  - Tries to start from a newline for cleaner output when truncating

- `getLastCharactersSanitized(outputBuffer: string[], charCount: number = 500): string`
  - Extracts the last N characters from the output buffer
  - Default: 500 characters (as specified)
  - Returns sanitized text

- `formatAsCodeBlock(text: string): string`
  - Wraps text in Markdown code block (```)
  - Escapes any existing code block markers to prevent formatting breakage

### 3. Screen Refresh Utility (`src/utils/screen-refresh.utils.ts`)

**Modified:**
- Import added: `TextSanitizationUtils`
- Auto-refresh logic updated to check `configService.isAirplaneModeEnabled()`
- When airplane mode is ON:
  - Retrieves last 500 characters using `TextSanitizationUtils.getLastCharactersSanitized()`
  - Formats as code block
  - Updates message using `editMessageText()` instead of `editMessageMedia()`
- When airplane mode is OFF:
  - Original behavior preserved (renders image via xterm.js)

### 4. Xterm Bot (`src/features/xterm/xterm.bot.ts`)

**Modified:**
- Import added: `TextSanitizationUtils`

**Three methods updated to support airplane mode:**

#### a. `sendSessionScreenshot(ctx, userId)` (private helper)
- Used by `/xterm` command for initial session screenshot
- Checks airplane mode setting
- Sends text message with sanitized output OR image based on mode

#### b. `handleScreen(ctx)` 
- Handler for `/screen` command
- Checks airplane mode setting
- Sends text message OR image based on mode

#### c. `handleCallbackQuery(ctx)`
- Handler for the "🔄 Refresh" button callback
- Checks airplane mode setting
- Updates message as text OR image based on mode

### 5. Environment Template (`dot-env.template`)

**Added documentation:**
```bash
# Airplane Mode (Optional)
# When enabled (on/true/1), the bot will send terminal output as text messages
# instead of rendered images. This uses less bandwidth and is faster.
# In airplane mode, only the last 500 characters of terminal output are sent,
# sanitized from ANSI codes and control characters.
# Set to off/false/0 to use normal image rendering mode (default: off)
AIRPLANE_MODE=off
```

## Technical Details

### Message Size Limits
- Telegram message limit: 4096 characters
- Reserved for formatting: 20 characters
- Maximum content: 4076 characters
- Airplane mode default: 500 characters (configurable via function parameter)

### Text Sanitization
The sanitization process removes:
1. **ANSI Escape Codes:**
   - Color codes (`\x1b[31m`, etc.)
   - Cursor movement sequences
   - Terminal control sequences
   - OSC (Operating System Command) sequences

2. **Control Characters:**
   - Non-printable characters (0x00-0x1F, 0x7F)
   - Except: tab (`\t`), newline (`\n`), carriage return (`\r`)

3. **Code Block Breakers:**
   - Triple backticks (```) are replaced with triple apostrophes (''')

### Backward Compatibility
- Default mode is OFF (airplane mode disabled)
- All existing functionality preserved when airplane mode is OFF
- No breaking changes to existing API or user experience
- Seamless switching between modes by changing environment variable

## Usage

### Enable Airplane Mode
Add to `.env` file:
```bash
AIRPLANE_MODE=on
```

Or use any of: `true`, `1`, `on`

### Disable Airplane Mode
```bash
AIRPLANE_MODE=off
```

Or use any of: `false`, `0`, `off`, or omit the variable entirely

### User Experience

**With Airplane Mode ON:**
1. `/xterm` - Creates session, sends last 500 chars as text
2. Terminal commands - Auto-refresh sends text updates
3. `/screen` - Captures and sends last 500 chars as text
4. "🔄 Refresh" button - Updates message with current text
5. All text appears in code blocks for better readability

**With Airplane Mode OFF:**
1. Original behavior - terminal rendered as PNG images via xterm.js
2. Full terminal screen visible with colors and formatting
3. Higher bandwidth usage, slower response times

## Build Status

✅ **Build Successful**
- No TypeScript errors
- All files compiled successfully
- Bundle sizes within acceptable ranges:
  - `app.js`: 28.1kb
  - `cli.js`: 2.7kb
  - `bot-worker.js`: 66.3kb

## Testing Recommendations

1. **Basic Functionality:**
   - Start terminal with `/xterm` in both modes
   - Execute commands and verify auto-refresh works
   - Test `/screen` command in both modes
   - Test refresh button in both modes

2. **Text Sanitization:**
   - Run commands with colorized output (e.g., `ls --color=auto`)
   - Test with long output (verify truncation)
   - Test with special characters and escape sequences

3. **Edge Cases:**
   - Switch between modes (requires bot restart)
   - Test with empty output buffer
   - Test with exactly 500 characters
   - Test with more than 4096 characters

4. **Performance:**
   - Compare response times between modes
   - Verify bandwidth usage difference
   - Check auto-refresh performance in airplane mode

## Files Modified

1. `src/services/config.service.ts` - Added airplane mode configuration
2. `src/utils/text-sanitization.utils.ts` - New file (sanitization logic)
3. `src/utils/screen-refresh.utils.ts` - Added airplane mode support
4. `src/features/xterm/xterm.bot.ts` - Updated screenshot handlers
5. `dot-env.template` - Added documentation

## Summary

The airplane mode feature has been successfully implemented with:
- ✅ Environment variable support (`AIRPLANE_MODE`)
- ✅ Text sanitization (ANSI codes and control characters removed)
- ✅ 500 character limit for messages in airplane mode
- ✅ Telegram message length compliance (max 4096 chars)
- ✅ Full backward compatibility (default: OFF)
- ✅ No code breaking changes
- ✅ Successful build with no errors
- ✅ Comprehensive documentation

The implementation follows the specification exactly:
- Airplane mode controlled via environment variable
- When ON: sends last 500 sanitized characters as text
- When OFF: maintains existing image rendering behavior
- Text is properly sanitized from illegal characters
- Respects Telegram message length limits
