# Feature Summary - Recent Additions

## 1. Dot (.) Command Prefix

**Added:** 2025-10-22

### Description
Quick command shortcut that removes the leading dot and sends text to terminal with Enter.

### Usage
```
.command arguments
```

### Examples
- `.ls -la` → sends `ls -la` + Enter
- `.git status` → sends `git status` + Enter
- `.npm start` → sends `npm start` + Enter

### Implementation Details
- **File:** `src/features/coder/coder.bot.ts`
- **Method:** `handleTextMessage()`
- **Logic:** Checks if text starts with `.`, removes it, then processes normally
- Works with `[media]` placeholder substitution

### Benefits
- Faster than typing `/send`
- More intuitive for command-line operations
- Reduces typing friction

---

## 2. URL Tracking and `/urls` Command

**Added:** 2025-10-22

### Description
Automatic detection and collection of all URLs that appear in terminal output, with a command to display them.

### Core Components

#### URL Extraction Utility
- **File:** `src/utils/url-extraction.utils.ts`
- **Features:**
  - Regex-based URL detection
  - ANSI escape code stripping
  - Supports HTTP/HTTPS protocols
  - Handles localhost, IPs, ports, paths, query params

#### URL Storage
- **Modified:** `src/features/xterm/xterm.types.ts`
- **Addition:** `discoveredUrls?: Set<string>` in `PtySession`
- **Behavior:** Stores unique URLs per session, persists until session closes

#### Service Layer
- **Modified:** `src/features/xterm/xterm.service.ts`
- **Added Method:** `getDiscoveredUrls(userId: string): string[]`
- **Hook:** PTY data callback automatically extracts URLs from each data chunk

### Usage

```
/urls
```

**Output when URLs found:**
```
🔗 Discovered URLs (3)

`http://localhost:3000`
`https://github.com/user/repo`
`https://api.example.com`
```

**Output when no URLs:**
```
🔗 No URLs Found

No URLs have been detected in the terminal output yet.
```

### URL Detection Capabilities

✅ **Supported:**
- Standard domains: `https://example.com`
- Subdomains: `https://api.example.com`
- Localhost: `http://localhost:3000`
- IP addresses: `http://192.168.1.100:8080`
- Ports: `:8080`, `:3000`
- Paths: `/api/v1/users`
- Query strings: `?page=1&limit=10`
- Fragments: `#results`
- URLs with ANSI color codes

❌ **Not Supported:**
- FTP, SSH, or other non-HTTP protocols
- Malformed URLs without protocol
- URLs longer than ~2000 characters

### Implementation Details

**Modified Files:**
1. `src/features/xterm/xterm.types.ts` - Added `discoveredUrls` to session
2. `src/features/xterm/xterm.service.ts` - Added URL tracking and getter
3. `src/features/xterm/xterm.bot.ts` - Added `/urls` command handler
4. `src/features/coder/coder.bot.ts` - Added `/urls` command handler and help text
5. `src/utils/url-extraction.utils.ts` - New utility for URL extraction

**Key Design Decisions:**
- **No auto-clear:** URLs persist throughout session (never emptied)
- **Set storage:** Automatic deduplication
- **Per-session:** Each user maintains their own URL collection
- **Real-time:** URLs captured as they stream through terminal
- **ANSI-aware:** Strips formatting codes before extraction

### Use Cases

1. **Development Servers**
   - Capture dev server URLs automatically
   - No need to scroll back to find the localhost link

2. **CI/CD Pipelines**
   - Collect artifact URLs, documentation links
   - Easy access to deployment URLs

3. **API Testing**
   - Capture API endpoints from responses
   - Save webhook URLs for testing

4. **Documentation**
   - Grab help URLs from CLI tools
   - Collect reference links

### Auto-Dismiss Behavior
- Uses `MessageUtils.scheduleMessageDeletion()`
- Respects configured timeout from `ConfigService`
- Gives user time to copy URLs before message disappears

---

## Documentation Created

1. **`docs/command-shortcuts.md`**
   - Detailed explanation of dot (.) prefix feature
   - Examples and comparison table
   - Usage notes and limitations

2. **`docs/url-tracking.md`**
   - Complete URL tracking feature guide
   - Technical details and examples
   - Best practices and limitations

3. **`docs/feature-summary.md`** (this file)
   - Technical overview of both features
   - Implementation details
   - Use cases and design decisions

---

## Testing

### URL Extraction Tests
```javascript
// Basic URL
'https://example.com' → ['https://example.com']

// Localhost with port
'http://localhost:3000' → ['http://localhost:3000']

// IP with port and path
'http://192.168.1.100:8080/api' → ['http://192.168.1.100:8080/api']

// With ANSI codes
'\x1B[32mhttp://localhost:8080\x1B[0m' → ['http://localhost:8080']

// Complex URL
'https://api.example.com/v1/users?page=1&limit=10#results' 
  → ['https://api.example.com/v1/users?page=1&limit=10#results']
```

All tests pass successfully! ✅

---

## Integration with Existing Features

### Dot Command Integration
- Works seamlessly with existing message handling
- Preserves `[media]` placeholder replacement
- Compatible with auto-refresh functionality
- Respects session requirements

### URLs Command Integration
- Available in both `CoderBot` and `XtermBot`
- Uses shared `XtermService` for data access
- Follows same patterns as `/screen` command
- Auto-dismisses using existing utility functions

---

## Future Enhancements (Potential)

### For Dot Command
- [ ] Support for `..` to send without Enter (like `/keys`)
- [ ] Configuration option to customize the prefix character

### For URL Tracking
- [ ] Export URLs to file
- [ ] Filter URLs by domain/pattern
- [ ] Clear URL history command
- [ ] Clickable inline buttons for quick browser open
- [ ] Support for other protocols (FTP, SSH, etc.)
- [ ] URL history across sessions (persistent storage)
