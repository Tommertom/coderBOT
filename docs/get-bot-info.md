# Get Bot Info Script

## Description

This script reads Telegram bot tokens from your `.env` file and retrieves detailed information about each bot using the Telegram Bot API.

## Usage

```bash
# Run from the project root
node scripts/get-bot-info.js

# Or make it executable and run directly
chmod +x scripts/get-bot-info.js
./scripts/get-bot-info.js
```

## What It Does

The script will:

1. Load environment variables from the `.env` file in the project root
2. Parse the `TELEGRAM_BOT_TOKENS` variable (supports comma-separated multiple tokens)
3. Connect to each bot using the Grammy library
4. Retrieve and display bot information including:
   - Bot name (e.g., "coderBOT")
   - Username (e.g., "@copilotControl2_bot")
   - Bot ID
   - Capabilities (can join groups, read messages, etc.)

## Example Output

```
📋 Reading bot tokens from .env file...

Found 3 bot token(s)

============================================================

🤖 Bot #1 Information:
   Name: coding TelegramGPT
   Username: @copilotControl_bot
   ID: 8178003297
   Can Join Groups: true
   Can Read All Group Messages: false
   Supports Inline Queries: false

🤖 Bot #2 Information:
   Name: coding coderBOT
   Username: @copilotControl2_bot
   ID: 8265364913
   Can Join Groups: true
   Can Read All Group Messages: false
   Supports Inline Queries: false

============================================================

✅ Successfully retrieved info for 2 bot(s)

📊 Summary:
   1. coding TelegramGPT (@copilotControl_bot) - ID: 8178003297
   2. coding coderBOT (@copilotControl2_bot) - ID: 8265364913
```

## Requirements

- Node.js 18.0.0 or higher
- Valid bot token(s) in the `.env` file
- The `grammy` and `dotenv` packages (already included in project dependencies)

## Configuration

Ensure your `.env` file contains the `TELEGRAM_BOT_TOKENS` variable:

```env
# Single bot
TELEGRAM_BOT_TOKENS=1234567890:AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPPQQrrss

# Multiple bots (comma-separated)
TELEGRAM_BOT_TOKENS=token1,token2,token3
```

## Error Handling

The script will:
- Display an error if no tokens are found in the `.env` file
- Continue processing other bots if one fails
- Show which bot failed and why
- Return exit code 1 if no tokens are configured or a fatal error occurs

## Security Note

The script only displays the first 10 characters of each token in the output for security purposes.
