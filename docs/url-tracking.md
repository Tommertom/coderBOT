# URL Tracking Feature

## Overview

coderBOT automatically monitors terminal output and extracts all URLs that appear. This is useful for:
- Capturing links from build outputs
- Finding documentation URLs from CLI tools
- Collecting API endpoints from server logs
- Saving generated preview URLs from dev servers

## How It Works

### Automatic Detection

The bot continuously scans terminal output for URLs matching the pattern:
- `http://` or `https://` protocol
- Valid domain names
- Paths, query parameters, and fragments

URLs are extracted even when surrounded by:
- ANSI color codes
- Terminal formatting
- Other text or symbols

### Persistent Storage

- URLs are stored in memory for the duration of the terminal session
- Each user session maintains its own URL collection
- URLs are **never automatically cleared** - they persist until session ends
- Duplicate URLs are automatically filtered out

## Using the `/urls` Command

### Basic Usage

```
/urls
```

### Output Format

When URLs are found:
```
🔗 Discovered URLs (3)

`https://example.com/api/docs`
`http://localhost:3000`
`https://github.com/user/repo`
```

When no URLs are found:
```
🔗 No URLs Found

No URLs have been detected in the terminal output yet.
```

### Features

- **Copy-friendly**: All URLs are in backticks for easy copying
- **Count display**: Shows total number of unique URLs found
- **Auto-dismiss**: Message automatically disappears after configured timeout
- **No duplicates**: Same URL only appears once

## Examples

### Development Server

```bash
.npm run dev
```

Terminal output:
```
> dev
> vite

  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

Then use `/urls` to see:
```
🔗 Discovered URLs (2)

`http://localhost:5173/`
`http://192.168.1.100:5173/`
```

### CI/CD Pipeline

```bash
.gh workflow view
```

Terminal output might include:
```
Build artifacts: https://github.com/org/repo/actions/runs/123456
Documentation: https://docs.example.com/api
```

Use `/urls` to capture all these links.

### API Testing

```bash
.curl -i https://api.example.com/users
```

Any URLs in the response headers or body will be captured.

## Technical Details

### URL Regex Pattern

The bot uses a comprehensive regex to match:
- Standard HTTP/HTTPS URLs
- Localhost and IP addresses
- URLs with ports
- URLs with paths, query strings, and fragments
- International domain names

### ANSI Code Handling

Terminal output often includes ANSI escape codes for colors and formatting. The bot automatically strips these before URL extraction to ensure accurate detection.

### Memory Management

- URLs are stored in a `Set` to prevent duplicates
- Memory is automatically freed when the session closes
- No disk I/O or persistence beyond session lifetime

## Limitations

- Only HTTP and HTTPS URLs are detected
- FTP, SSH, and other protocols are not captured
- Very long URLs (>2000 chars) may not be fully captured
- URLs must be properly formatted with protocol prefix

## Best Practices

1. **Check frequently**: URLs are captured as they appear, so check `/urls` after running commands that generate links
2. **Copy immediately**: The message auto-dismisses, so copy URLs you need right away
3. **Use with logs**: Pipe log files through `cat` to capture historical URLs
4. **Combine with screen**: Use `/screen` to see visual context, then `/urls` to get copyable links
