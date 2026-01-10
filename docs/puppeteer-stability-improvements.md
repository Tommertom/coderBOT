# Puppeteer Stability Improvements

## Date
2026-01-10

## Problem
Terminal screenshot functionality was experiencing intermittent `TargetCloseError: Protocol error (Target.createTarget): Target closed` failures when initializing the Puppeteer browser renderer.

## Root Cause Analysis

### Investigation Summary
The error `Failed to initialize renderer: TargetCloseError` is a known issue in Puppeteer/Chrome DevTools Protocol when:

1. **Browser target closes prematurely** during initialization
2. **Resource exhaustion** with multiple concurrent browser instances
3. **Chrome instability** in newer versions (142.x series on Debian)
4. **Insufficient timeouts** for protocol handshake completion
5. **Missing stability flags** for headless operation

### Research Findings
Based on extensive research of GitHub issues in both Puppeteer and Playwright repositories:
- Issue commonly occurs in Docker/Linux environments
- Chromium updates can introduce instability
- Single-process mode helps reduce race conditions
- Extended timeouts prevent premature failures
- Retry logic with cleanup is essential for reliability

## Solution Implemented

### 1. Enhanced Browser Launch Configuration

**Added timeout settings:**
```typescript
timeout: 60000,           // Browser launch timeout: 1 minute
protocolTimeout: 180000,  // Protocol timeout: 3 minutes (critical!)
```

**Additional stability flags:**
```typescript
'--no-zygote',                                    // Disable zygote process
'--single-process',                               // Run in single process mode
'--disable-web-security',                         // Disable CORS for local content
'--disable-features=IsolateOrigins,site-per-process',
'--disable-background-networking',
'--disable-default-apps',
'--disable-extensions',
'--disable-sync',
'--no-first-run',
'--disable-translate',
```

### 2. Retry Logic with Exponential Backoff

**Browser initialization:**
- 3 retry attempts with cleanup between attempts
- Exponential backoff: 2s, 4s between retries
- Full cleanup of browser resources before retry
- Detailed logging for each attempt

**Rendering:**
- 2 retry attempts for screenshot generation
- 1s delay between retries
- Re-initialization if page becomes invalid

### 3. Enhanced Error Handling

**Improved cleanup:**
- Check if page is already closed before attempting to close
- Check if browser is still connected before closing
- Graceful error handling with logging
- Proper null assignment after cleanup

**Better error messages:**
- Include attempt count in error messages
- Preserve and report the actual error from last attempt
- Detailed logging at each stage

### 4. Extended Timeouts for Network Operations

```typescript
await this.page.setContent(htmlContent, { 
    waitUntil: 'networkidle0', 
    timeout: 30000 
});

await this.page.waitForFunction(..., { timeout: 30000 });

await element.screenshot({
    type: 'png',
    timeout: 30000,
});
```

## Technical Details

### Files Modified
- `src/features/xterm/xterm-renderer.service.ts`

### Key Changes
1. **initialize()**: Added retry loop with 3 attempts, exponential backoff, and enhanced logging
2. **renderToImage()**: Added retry loop with 2 attempts and proper error recovery
3. **cleanup()**: Enhanced with connection checks and better error handling

### Code Quality
- Maintains backward compatibility
- No breaking changes to API
- Improved logging for debugging
- Type-safe error handling

## Benefits

1. **Reliability**: Handles transient browser failures automatically
2. **Debugging**: Detailed logs help identify issues quickly
3. **Recovery**: Automatic cleanup and retry on failures
4. **Stability**: Multiple Chrome stability flags reduce crash likelihood
5. **Timeout Protection**: Extended timeouts prevent premature failures

## Testing Recommendations

1. Test with multiple concurrent bot instances
2. Monitor memory usage during extended operation
3. Test under low-resource conditions
4. Verify screenshot quality remains consistent
5. Check logs for initialization patterns

## Configuration Notes

The following environment variables affect renderer behavior:
- `XTERM_TERMINAL_ROWS`: Terminal height (default: 50)
- `XTERM_TERMINAL_COLS`: Terminal width (default: 100)
- `XTERM_FONT_SIZE`: Font size for rendering (default: 14)

Note: Very small terminal sizes (e.g., 40x40) with large fonts (e.g., 30) may cause rendering issues.

## Known Limitations

1. `--single-process` flag may reduce performance on multi-core systems
2. Extended timeouts increase total initialization time on persistent failures
3. Multiple browser instances still consume significant memory

## Future Improvements

Consider:
1. Browser instance pooling for better resource management
2. Health check endpoint for renderer status
3. Configurable retry counts and timeouts
4. Browser restart on repeated failures
5. Alternative rendering engines (Cairo, ImageMagick)

## References

- Puppeteer Issue #10153: Protocol error (Target.setAutoAttach)
- Puppeteer Issue #12189: Network.enable timeout in Alpine
- Puppeteer Issue #13945: TargetCloseError with setOfflineMode
- Playwright Issue #24252: CDP connection issues
- Playwright Issue #29726: Target.createTarget failures

## Commit Information

- Previous working version: No functional changes in last 2 commits (only formatting)
- Renderer last modified: October 2025 (refactor: per-bot services architecture)
- This fix addresses environmental/version-related instability
