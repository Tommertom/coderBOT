# Verbose Logging Feature

**Status:** ✅ Implemented  
**Feature Type:** Console Output Control  
**Configuration:** `VERBOSE_LOGGING` environment variable

## Overview

The verbose logging feature provides control over whether child bot process console output (stdout/stderr) is forwarded to the parent ControlBOT process console. This allows administrators to control the amount of console noise in production environments while still maintaining access to all logs through the `/logs` command.

## Configuration

### Environment Variable

```env
# Verbose Logging (Optional)
# When enabled, the ControlBOT will forward all console output (stdout/stderr)
# from child bot processes to its own console for debugging and monitoring
# Set to false to disable verbose console output (default: true)
VERBOSE_LOGGING=true
```

### Default Behavior

- **Default:** `true` (enabled)
- **When not set:** Defaults to `true`
- **Valid values:** `true`, `false`, `1`, `0`

## Behavior

### When Enabled (`VERBOSE_LOGGING=true`)

**Console Output:**
- All stdout from child bot processes is forwarded to parent console
- All stderr from child bot processes is forwarded to parent console
- Each log line is prefixed with `[bot-N]` for identification
- Real-time visibility of all bot activity

**Use Cases:**
- Development and debugging
- Real-time monitoring
- Troubleshooting issues
- Testing new features

**Example Console Output:**
```
[bot-0] ✅ Bot started successfully
[bot-0] Session created for user 123456789
[bot-1] ✅ Bot started successfully
[bot-1] Media watcher initialized
[Parent] ✅ ControlBOT is running
```

### When Disabled (`VERBOSE_LOGGING=false`)

**Console Output:**
- Child bot stdout/stderr is **not** forwarded to parent console
- Only parent process messages and critical errors appear in console
- Cleaner console output with less noise

**Log Storage:**
- All logs are **still captured internally**
- Logs remain accessible via `/logs` command in ControlBOT
- Each bot maintains a 100-line log buffer
- No loss of debugging information

**Use Cases:**
- Production deployments
- Reducing console clutter
- When using external log management tools
- Running as a background service

**Example Console Output:**
```
[Parent] ✅ ControlBOT is running
[Parent] ✅ Bot bot-0 started with PID 12345
[Parent] ✅ Bot bot-1 started with PID 12346
```

## Implementation Details

### ConfigService

The `ConfigService` class handles parsing and validation of the `VERBOSE_LOGGING` environment variable:

```typescript
// Load verbose logging configuration (default: true)
const verboseLoggingValue = process.env.VERBOSE_LOGGING?.toLowerCase();
// Default to true if not set or if explicitly set to 'true' or '1'
this.verboseLogging = verboseLoggingValue !== 'false' && verboseLoggingValue !== '0';
```

**Getter method:**
```typescript
isVerboseLoggingEnabled(): boolean {
    return this.verboseLogging;
}
```

### ProcessManager

The `ProcessManager` conditionally forwards console output based on the verbose flag:

```typescript
childProcess.stdout?.on('data', (data: Buffer) => {
    const logLine = data.toString().trim();
    this.addLog(botId, `[STDOUT] ${logLine}`);
    // Forward to parent console only if verbose logging is enabled
    if (this.configService.isVerboseLoggingEnabled()) {
        console.log(`[${botId}] ${logLine}`);
    }
});

childProcess.stderr?.on('data', (data: Buffer) => {
    const logLine = data.toString().trim();
    this.addLog(botId, `[STDERR] ${logLine}`);
    // Forward to parent console only if verbose logging is enabled
    if (this.configService.isVerboseLoggingEnabled()) {
        console.error(`[${botId}] ${logLine}`);
    }
});
```

## Accessing Logs

Regardless of the `VERBOSE_LOGGING` setting, all logs remain accessible through the ControlBOT `/logs` command:

```
/logs bot-0          # View last 50 logs for bot-0
/logs bot-0 100      # View last 100 logs for bot-0
/logs bot-1 25       # View last 25 logs for bot-1
```

## Best Practices

### Development

✅ **Enable verbose logging:**
```env
VERBOSE_LOGGING=true
```

**Benefits:**
- Real-time visibility into all bot activity
- Easier debugging and troubleshooting
- Immediate feedback on code changes
- Better understanding of system behavior

### Production

✅ **Disable verbose logging:**
```env
VERBOSE_LOGGING=false
```

**Benefits:**
- Cleaner console output
- Reduced log file sizes (if redirecting console to file)
- Better performance (less I/O)
- Focus on critical parent process messages

✅ **Use `/logs` command for debugging:**
- Access detailed logs on-demand via ControlBOT
- View specific bot logs when troubleshooting
- Avoid overwhelming console output

### CI/CD Pipelines

✅ **Enable for test runs:**
```env
VERBOSE_LOGGING=true
```
- Capture all output for test failures
- Easier debugging of integration tests

✅ **Disable for production deployments:**
```env
VERBOSE_LOGGING=false
```
- Cleaner deployment logs
- Focus on deployment status

## Comparison Table

| Aspect | VERBOSE_LOGGING=true | VERBOSE_LOGGING=false |
|--------|---------------------|----------------------|
| **Console Output** | All child bot logs visible | Only parent process logs |
| **Log Storage** | ✅ Captured internally | ✅ Captured internally |
| **`/logs` Command** | ✅ Available | ✅ Available |
| **Performance** | Slightly higher I/O | Lower I/O |
| **Use Case** | Development, debugging | Production |
| **Console Noise** | High | Low |
| **Real-time Visibility** | ✅ Yes | ❌ No (use `/logs`) |

## Migration Guide

### Existing Deployments

If you're upgrading from a previous version without this feature:

1. **No action required** - Verbose logging is enabled by default
2. Behavior remains the same as before the feature was added
3. Console output continues to show all child bot logs

### Opting Out

To reduce console noise in production:

1. Add to `.env`:
   ```env
   VERBOSE_LOGGING=false
   ```

2. Restart the application:
   ```bash
   npm run build
   npm run pm2:restart
   ```

3. Verify reduced console output

4. Use `/logs` command in ControlBOT to view detailed logs when needed

## Troubleshooting

### Not Seeing Child Bot Logs

**Problem:** Child bot console output is not appearing in parent console

**Solution:**
1. Check `.env` configuration:
   ```env
   VERBOSE_LOGGING=true
   ```

2. Restart the application to load new configuration

3. Verify child bots are running: `/status` in ControlBOT

### Too Much Console Output

**Problem:** Console is overwhelmed with child bot logs

**Solution:**
1. Disable verbose logging:
   ```env
   VERBOSE_LOGGING=false
   ```

2. Restart application

3. Use `/logs <bot-id>` for targeted debugging

## Related Documentation

- [ControlBOT Quick Start Guide](control-bot/README.md)
- [ControlBOT Implementation Summary](control-bot/IMPLEMENTATION-SUMMARY.md)
- [Main README](../README.md)
