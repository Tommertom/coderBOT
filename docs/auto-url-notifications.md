# Automatic URL Notifications

## Overview

The coderBOT now supports automatic detection and notification of URLs that appear in terminal output. When enabled, any URL discovered in the terminal buffer will be automatically sent to the user as a message (formatted with backticks) and then deleted after a configurable timeout interval.

## Features

- **Automatic URL Detection**: URLs are extracted from terminal output in real-time using a comprehensive regex pattern that supports:
  - HTTP and HTTPS protocols
  - Domain names with subdomains
  - IP addresses
  - Localhost
  - Custom ports
  - URL paths and query parameters

- **Clean ANSI Handling**: ANSI escape codes are stripped from terminal output before URL extraction to ensure accurate detection

- **Backtick Formatting**: URLs are sent between backticks (`` `url` ``) for easy copying and clickability in Telegram

- **Auto-Deletion**: URL notification messages are automatically deleted after the configured `MESSAGE_DELETE_TIMEOUT` interval to keep the chat clean

- **Deduplication**: Each URL is only notified once per session, preventing spam from repeated appearances

## Configuration

### Environment Variable

Add the following to your `.env` file:

```bash
# Automatically notify users when URLs are detected in terminal output (true/false)
# When enabled, URLs found in the terminal buffer will be sent as messages
# and deleted after MESSAGE_DELETE_TIMEOUT interval (default: true)
AUTO_NOTIFY_URLS=true
```

### Related Configuration

The auto-delete timeout is controlled by the existing `MESSAGE_DELETE_TIMEOUT` setting:

```bash
# Message auto-delete timeout in milliseconds (default: 10000 = 10 seconds)
# Time to wait before automatically deleting confirmation messages
# Set to 0 to disable auto-deletion of messages
MESSAGE_DELETE_TIMEOUT=10000
```

## Usage

### Enabling/Disabling

1. **Enable**: Set `AUTO_NOTIFY_URLS=true` in your `.env` file
2. **Disable**: Set `AUTO_NOTIFY_URLS=false` or omit the variable (defaults to enabled)

### How It Works

1. When a terminal session is created (via `/xterm`, `/copilot`, `/claude`, or `/gemini`), the URL notification callback is registered
2. As terminal output is received, the system:
   - Strips ANSI escape codes from the output
   - Extracts any URLs using a comprehensive regex pattern
   - Checks if the URL has already been notified
   - Sends a new message with the URL in backticks
   - Schedules the message for deletion after `MESSAGE_DELETE_TIMEOUT` milliseconds
3. The URL is added to the session's `notifiedUrls` set to prevent duplicate notifications

### Manual URL Listing

Users can also manually view all discovered URLs using the `/urls` command, which will display all URLs found in the terminal session.

## Implementation Details

### Session Tracking

Each PTY session maintains:
- `discoveredUrls`: A Set of all URLs found in the terminal output
- `notifiedUrls`: A Set of URLs that have been sent as notifications
- `urlNotificationTimeouts`: A Map of message IDs to timeout handles for cleanup

### Cleanup

When a session is closed:
- All pending URL notification deletion timeouts are cleared
- The session's URL tracking sets are cleared
- No orphaned timeouts remain in memory

## Example

When running a development server that outputs a URL:

```bash
$ npm run dev
> Server running at http://localhost:3000
```

The bot will automatically send:
```
`http://localhost:3000`
```

This message will remain visible for the configured `MESSAGE_DELETE_TIMEOUT` (default: 10 seconds) before being automatically deleted.

## Security Considerations

- URLs are sent with Markdown formatting (backticks) which prevents them from being auto-linked as inline buttons
- The regex pattern only matches valid URL structures to prevent false positives
- ANSI escape codes are properly stripped to prevent injection attacks
- Each URL is deduplicated per session to prevent spam

## Troubleshooting

### URLs Not Being Detected

1. Check that `AUTO_NOTIFY_URLS=true` is set in your `.env` file
2. Verify the URL format is supported by the regex pattern
3. Check that the terminal output doesn't have malformed ANSI codes interfering with detection

### Messages Not Auto-Deleting

1. Verify `MESSAGE_DELETE_TIMEOUT` is set to a value greater than 0
2. Check that the bot has permission to delete messages in the chat
3. Ensure the session hasn't been closed before the timeout expires

### Duplicate Notifications

If you're seeing duplicate notifications, this may indicate:
- A new terminal session was started (each session has its own tracking)
- The URL appears with slight variations (different query parameters, etc.)
