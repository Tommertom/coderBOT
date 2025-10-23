# ControlBOT StatusList Investigation Report

**Date:** 2025-10-22  
**Issue:** ProcessManager-spawned bots failing to start, causing statuslist errors

---

## Executive Summary

The bots managed by ProcessManager (bot-1, bot-2, bot-3) are failing immediately upon startup with exit code 1. This is caused by **two critical bugs** in `process-manager.service.ts`:

1. **Environment Variable Mismatch** (Line 46)
2. **Token Masking Breaking Restart Functionality** (Line 28 & 129)

The statuslist itself works correctly - it accurately reports that these bots have failed.

---

## Detailed Investigation Findings

### Current System State

```
Running Processes:
- 3 bot-worker processes (PID 3488111, 3488122, 3488133) - ✅ WORKING
- ProcessManager attempted to start bot-1, bot-2, bot-3 - ❌ FAILED

Log Evidence:
2025-10-22T23:33:00: ✅ Bot bot-1 started with PID 3488147
2025-10-22T23:33:00: Bot bot-1 exited with code 1
2025-10-22T23:33:01: ✅ Bot bot-2 started with PID 3488158
2025-10-22T23:33:01: Bot bot-2 exited with code 1
2025-10-22T23:33:02: ✅ Bot bot-3 started with PID 3488169
2025-10-22T23:33:02: Bot bot-3 exited with code 1
```

### Manual Test Results

When manually testing a bot worker:
```
[Worker bot-1] Failed to start: GrammyError: Call to 'setMyCommands' failed! 
(404: Not Found)
```

This 404 error indicates the bot token is invalid or not being passed correctly.

---

## Root Cause Analysis

### Bug #1: Environment Variable Mismatch

**Location:** `src/services/process-manager.service.ts`, Line 46

**The Problem:**
```typescript
// ProcessManager sets this:
const childProcess = fork(workerPath, [], {
    env: {
        ...process.env,
        BOT_ID: botId,
        TELEGRAM_BOT_TOKENS: token,  // ❌ WRONG: Plural "TOKENS"
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
});
```

```typescript
// But bot-worker.ts expects this:
const botToken = process.env.BOT_TOKEN;  // ✅ Singular "TOKEN"

if (!botToken) {
    console.error('[Worker] BOT_TOKEN environment variable is required');
    process.exit(1);
}
```

**Why This Happens:**
- The worker receives `undefined` for `BOT_TOKEN`
- It tries to initialize with an invalid token
- Telegram API rejects it with 404 Not Found
- Worker exits with code 1

**Impact:** 
- **Immediate:** All ProcessManager-spawned bots fail to start
- **Severity:** Critical - complete failure of ControlBOT functionality

---

### Bug #2: Token Masking Breaking Restart Operations

**Location:** `src/services/process-manager.service.ts`, Lines 28 & 129

**The Problem:**

```typescript
// Line 21-35: startBot() stores MASKED token
async startBot(botId: string, token: string): Promise<void> {
    const info: BotProcessInfo = {
        botId,
        token: this.maskToken(token),  // ❌ Stores "1234...5678" instead of real token
        pid: null,
        status: 'starting',
        // ...
    };
    this.processInfo.set(botId, info);
    
    // Uses real token here (passed as parameter) - ✅ WORKS
    const childProcess = fork(workerPath, [], {
        env: { BOT_TOKEN: token }
    });
}

// Line 123-136: restartBot() uses MASKED token
async restartBot(botId: string): Promise<void> {
    const info = this.processInfo.get(botId);
    if (!info) throw new Error(`Bot ${botId} not found`);

    const token = info.token;  // ❌ Gets "1234...5678" masked token
    
    if (this.processes.has(botId)) {
        await this.stopBot(botId);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.startBot(botId, token);  // ❌ Passes masked token - FAILS
}

// Line 147-158: startAllBots() also uses MASKED token
async startAllBots(): Promise<void> {
    const startPromises = Array.from(this.processInfo.entries())
        .filter(([botId]) => !this.processes.has(botId))
        .map(([botId, info]) =>
            this.startBot(botId, info.token).catch(err =>  // ❌ Uses masked token
                console.error(`Failed to start ${botId}:`, err)
            )
        );
    await Promise.all(startPromises);
}
```

**Why This Is A Problem:**

The `maskToken()` function converts tokens like this:
```typescript
private maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return token.substring(0, 4) + '...' + token.substring(token.length - 4);
}

// Example:
// Real token:   "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
// Masked token: "1234...wxYZ"
```

**Flow Analysis:**

1. **Initial Start** (WORKS):
   ```
   app.ts calls: processManager.startBot(botId, realToken)
   → Stores masked token in processInfo
   → Passes realToken to worker process
   → Bot starts successfully
   ```

2. **Restart Operation** (FAILS):
   ```
   restartBot() retrieves: info.token = "1234...wxYZ"
   → Calls startBot(botId, "1234...wxYZ")
   → Passes "1234...wxYZ" to worker process
   → Telegram rejects invalid token
   → Bot fails to start
   ```

**Impact:**
- **Immediate:** None (restart hasn't been called yet)
- **Future:** Any restart operation will fail
- **Commands Affected:**
  - `/restart <bot-id>` - Will always fail
  - `/restartall` - Will fail for all bots
  - `/startall` - Will fail if trying to start stopped bots
  - Auto-restart on crash - Will fail

---

## Token Storage Deep Dive

### Why Store Tokens At All?

The ProcessManager needs tokens for two scenarios:

1. **Display purposes** - Show masked tokens in `/listbots` command
2. **Restart operations** - Need real tokens to restart bots

### Current Architecture Problem

```typescript
interface BotProcessInfo {
    botId: string;
    token: string;      // Currently stores MASKED token
    pid: number | null;
    status: string;
    // ...
}
```

**The Conflict:**
- For **security/display**: Want masked token (safe to log/display)
- For **functionality**: Need real token (to restart bots)
- Current design: Stores masked token → breaks restart functionality

---

## Proposed Solutions

### Solution 1: Store Real Token, Mask On Display (RECOMMENDED)

**Changes Required:**
```typescript
// Keep interface the same
interface BotProcessInfo {
    botId: string;
    token: string;      // Store REAL token here
    pid: number | null;
    // ...
}

// Modify startBot to store real token
async startBot(botId: string, token: string): Promise<void> {
    const info: BotProcessInfo = {
        botId,
        token: token,  // ✅ Store real token
        // ...
    };
}

// Mask when displaying/returning to control bot
getBotStatus(botId: string): BotProcessInfo | undefined {
    const info = this.processInfo.get(botId);
    if (!info) return undefined;
    
    return {
        ...info,
        token: this.maskToken(info.token)  // ✅ Mask on display
    };
}

getAllBotStatuses(): BotProcessInfo[] {
    return Array.from(this.processInfo.values()).map(info => ({
        ...info,
        token: this.maskToken(info.token)  // ✅ Mask on display
    }));
}
```

**Pros:**
- Minimal code changes
- Fixes both restart and startAll operations
- Token only masked when displayed
- Simple and straightforward

**Cons:**
- Real tokens stored in memory (but this is necessary for functionality)
- Must remember to mask in display methods

**Security Note:** The real token must be stored somewhere for restart to work. This solution keeps it in memory only, which is the same security level as the current bot-worker processes that already have tokens in memory.

---

### Solution 2: Separate Storage for Real and Masked Tokens

**Changes Required:**
```typescript
// Modify interface to have both
interface BotProcessInfo {
    botId: string;
    token: string;          // Real token (private, for operations)
    displayToken: string;   // Masked token (public, for display)
    pid: number | null;
    // ...
}

// Store both versions
async startBot(botId: string, token: string): Promise<void> {
    const info: BotProcessInfo = {
        botId,
        token: token,                    // ✅ Real token
        displayToken: this.maskToken(token),  // ✅ Masked token
        // ...
    };
}

// Use displayToken in control.bot.ts
// Line 271 in control.bot.ts
message += `   Token: \`${status.displayToken}\`\n`;
```

**Pros:**
- Explicit separation of concerns
- Clear intent in code
- No chance of accidentally displaying real token

**Cons:**
- More code changes required
- Interface change affects multiple files
- Must update control.bot.ts to use displayToken

---

### Solution 3: Don't Store Token At All (ALTERNATIVE)

**Changes Required:**
```typescript
// Add private map for tokens
export class ProcessManager {
    private processes: Map<string, ChildProcess> = new Map();
    private processInfo: Map<string, BotProcessInfo> = new Map();
    private tokenStore: Map<string, string> = new Map();  // ✅ Separate token storage

    async startBot(botId: string, token: string): Promise<void> {
        this.tokenStore.set(botId, token);  // ✅ Store real token separately
        
        const info: BotProcessInfo = {
            botId,
            token: this.maskToken(token),  // Keep masked in processInfo
            // ...
        };
    }

    async restartBot(botId: string): Promise<void> {
        const token = this.tokenStore.get(botId);  // ✅ Get from token store
        if (!token) throw new Error(`Token not found for ${botId}`);
        // ...
    }
}
```

**Pros:**
- Clear separation of sensitive data
- BotProcessInfo stays display-safe
- Centralized token management

**Cons:**
- More complex architecture
- Two data structures to maintain in sync
- Must handle token cleanup when bot is removed

---

## Recommended Fix

**I recommend Solution 1** for these reasons:

1. **Simplicity:** Minimal code changes, easy to implement
2. **Correctness:** Fixes the immediate problem
3. **Maintainability:** Easy to understand and maintain
4. **Security:** No worse than current architecture (tokens already in memory)

### Why Token Storage IS Necessary

**Q: Can we just get tokens from config each time?**

**A: No, because:**

1. **Dynamic bot addition:** When using `/addbot` command, the token comes from the command, not from config
2. **Token changes:** Bots might be added/removed without restarting the parent process
3. **Performance:** Avoid re-parsing config file on every restart
4. **Separation of concerns:** ProcessManager should be independent of config source

**Q: Why not query the token from the running process?**

**A: Because:**

1. **Process is stopped during restart:** Can't query a stopped process
2. **No IPC for token retrieval:** Bot workers don't expose their token via IPC
3. **Security:** Workers shouldn't expose their token via IPC

---

## Implementation Steps

### Step 1: Fix Environment Variable Name

**File:** `src/services/process-manager.service.ts`  
**Line:** 46

```typescript
// BEFORE:
const childProcess = fork(workerPath, [], {
    env: {
        ...process.env,
        BOT_ID: botId,
        TELEGRAM_BOT_TOKENS: token,  // ❌
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
});

// AFTER:
const childProcess = fork(workerPath, [], {
    env: {
        ...process.env,
        BOT_ID: botId,
        BOT_TOKEN: token,  // ✅
        BOT_INDEX: botId.replace('bot-', ''),  // ✅ Also add this for consistency
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
});
```

### Step 2: Store Real Token Instead of Masked

**File:** `src/services/process-manager.service.ts`  
**Line:** 28

```typescript
// BEFORE:
const info: BotProcessInfo = {
    botId,
    token: this.maskToken(token),  // ❌
    pid: null,
    // ...
};

// AFTER:
const info: BotProcessInfo = {
    botId,
    token: token,  // ✅ Store real token
    pid: null,
    // ...
};
```

### Step 3: Mask Token When Displaying

**File:** `src/services/process-manager.service.ts`  
**Lines:** 171-176 & 183-191

```typescript
// BEFORE:
getBotStatus(botId: string): BotProcessInfo | undefined {
    const info = this.processInfo.get(botId);
    if (!info) return undefined;

    if (info.startTime && info.status === 'running') {
        info.uptime = Date.now() - info.startTime.getTime();
    }

    return { ...info };  // ❌ Returns real token
}

// AFTER:
getBotStatus(botId: string): BotProcessInfo | undefined {
    const info = this.processInfo.get(botId);
    if (!info) return undefined;

    if (info.startTime && info.status === 'running') {
        info.uptime = Date.now() - info.startTime.getTime();
    }

    return { 
        ...info,
        token: this.maskToken(info.token)  // ✅ Mask before returning
    };
}
```

```typescript
// BEFORE:
getAllBotStatuses(): BotProcessInfo[] {
    return Array.from(this.processInfo.values()).map(info => {
        if (info.startTime && info.status === 'running') {
            info.uptime = Date.now() - info.startTime.getTime();
        }
        return { ...info };  // ❌ Returns real tokens
    });
}

// AFTER:
getAllBotStatuses(): BotProcessInfo[] {
    return Array.from(this.processInfo.values()).map(info => {
        if (info.startTime && info.status === 'running') {
            info.uptime = Date.now() - info.startTime.getTime();
        }
        return { 
            ...info,
            token: this.maskToken(info.token)  // ✅ Mask before returning
        };
    });
}
```

---

## Testing Plan

After implementing fixes:

### 1. Test Initial Start
```bash
# Restart the application
pm2 restart coderBOT

# Check if all 3 ProcessManager bots start successfully
# Expected: No "exited with code 1" messages in logs
tail -f logs/combined.log
```

### 2. Test Status Command
```
# In Telegram ControlBOT:
/status

# Expected output:
📊 Worker Bot Status

🟢 bot-1
   Status: running
   PID: [number]
   Uptime: [time]

🟢 bot-2
   Status: running
   ...

Summary: 3/3 bots running
```

### 3. Test Restart Command
```
/restart bot-1

# Expected: Bot restarts successfully
# Then check status again:
/status

# Expected: bot-1 shows running with fresh uptime
```

### 4. Test RestartAll Command
```
/restartall

# Expected: All bots restart successfully
# Check status after:
/status

# Expected: All 3 bots running with fresh uptimes
```

### 5. Test ListBots Command
```
/listbots

# Expected: Should show masked tokens like "1234...5678"
# Should NOT show full tokens
```

---

## Risk Assessment

### Critical Risks (Must Fix Immediately)
- ✅ **Bug #1 - Environment Variable:** Complete failure of ProcessManager bots
- ✅ **Bug #2 - Token Masking:** Future restart operations will fail

### Medium Risks (Should Monitor)
- Token security: Real tokens stored in memory (same as current bot-workers)
- Memory leaks: Ensure tokens are cleared when bots are removed

### Low Risks
- None identified

---

## Additional Observations

### Duplicate Bot Management System

The current architecture has **TWO separate bot management systems**:

1. **Original System** (`app.ts` - `startBotWorkers()`):
   - Spawns bot workers directly with `fork()`
   - These are the 3 working bots (PID 3488111, 3488122, 3488133)
   - ✅ Currently working

2. **ProcessManager System** (`app.ts` - `startBotWorkersWithProcessManager()`):
   - Uses ProcessManager to spawn bots
   - These are bot-1, bot-2, bot-3
   - ❌ Currently failing

**Why Both Systems Exist:**

Looking at `app.ts` lines 356-366:
```typescript
startBotWorkers().then(async () => {
    console.log(`[Parent] ✅ CoderBot parent process ready`);
    
    // Start new ProcessManager-based workers
    await startBotWorkersWithProcessManager();
    
    // Initialize Control Bot
    await initializeControlBot();
});
```

**This means:**
- You have 6 bot processes trying to run (3 old + 3 new)
- All using the same 3 bot tokens
- This will cause "Conflict: terminated by other getUpdates request" errors

**Recommendation:** Once ProcessManager is fixed, remove the old `startBotWorkers()` system and only use ProcessManager. This should be a separate task after the immediate bugs are fixed.

---

## Conclusion

**Immediate Actions Required:**
1. Fix environment variable name: `TELEGRAM_BOT_TOKENS` → `BOT_TOKEN`
2. Store real tokens, mask only on display
3. Test restart functionality

**Expected Results:**
- All 3 ProcessManager bots start successfully
- Status command shows correct bot states  
- Restart commands work as expected
- No duplicate bot conflicts

**Priority:** **CRITICAL** - Current system is non-functional

---

## Appendix: Code Snippets

### Full startBot() Method (Before)
```typescript
async startBot(botId: string, token: string): Promise<void> {
    if (this.processes.has(botId)) {
        throw new Error(`Bot ${botId} is already running`);
    }

    const info: BotProcessInfo = {
        botId,
        token: this.maskToken(token),  // ❌ Problem here
        pid: null,
        status: 'starting',
        startTime: null,
        uptime: 0,
        lastError: null,
        logs: [],
    };

    this.processInfo.set(botId, info);

    try {
        const workerPath = path.join(process.cwd(), 'dist', 'bot-worker.js');
        
        const childProcess = fork(workerPath, [], {
            env: {
                ...process.env,
                BOT_ID: botId,
                TELEGRAM_BOT_TOKENS: token,  // ❌ Problem here
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });

        info.pid = childProcess.pid || null;
        info.startTime = new Date();
        info.status = 'running';

        this.processes.set(botId, childProcess);

        childProcess.on('message', (message: IPCMessage) => {
            this.handleIPCMessage(botId, message);
        });

        childProcess.stdout?.on('data', (data: Buffer) => {
            const logLine = data.toString().trim();
            this.addLog(botId, `[STDOUT] ${logLine}`);
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
            const logLine = data.toString().trim();
            this.addLog(botId, `[STDERR] ${logLine}`);
        });

        childProcess.on('exit', (code, signal) => {
            this.handleProcessExit(botId, code, signal);
        });

        childProcess.on('error', (error) => {
            this.handleProcessError(botId, error);
        });

        console.log(`✅ Bot ${botId} started with PID ${info.pid}`);
    } catch (error) {
        info.status = 'error';
        info.lastError = error instanceof Error ? error.message : 'Unknown error';
        throw error;
    }
}
```

### Full startBot() Method (After)
```typescript
async startBot(botId: string, token: string): Promise<void> {
    if (this.processes.has(botId)) {
        throw new Error(`Bot ${botId} is already running`);
    }

    const info: BotProcessInfo = {
        botId,
        token: token,  // ✅ Store real token
        pid: null,
        status: 'starting',
        startTime: null,
        uptime: 0,
        lastError: null,
        logs: [],
    };

    this.processInfo.set(botId, info);

    try {
        const workerPath = path.join(process.cwd(), 'dist', 'bot-worker.js');
        
        const childProcess = fork(workerPath, [], {
            env: {
                ...process.env,
                BOT_ID: botId,
                BOT_TOKEN: token,  // ✅ Fixed variable name
                BOT_INDEX: botId.replace('bot-', ''),  // ✅ Added for consistency
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });

        info.pid = childProcess.pid || null;
        info.startTime = new Date();
        info.status = 'running';

        this.processes.set(botId, childProcess);

        childProcess.on('message', (message: IPCMessage) => {
            this.handleIPCMessage(botId, message);
        });

        childProcess.stdout?.on('data', (data: Buffer) => {
            const logLine = data.toString().trim();
            this.addLog(botId, `[STDOUT] ${logLine}`);
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
            const logLine = data.toString().trim();
            this.addLog(botId, `[STDERR] ${logLine}`);
        });

        childProcess.on('exit', (code, signal) => {
            this.handleProcessExit(botId, code, signal);
        });

        childProcess.on('error', (error) => {
            this.handleProcessError(botId, error);
        });

        console.log(`✅ Bot ${botId} started with PID ${info.pid}`);
    } catch (error) {
        info.status = 'error';
        info.lastError = error instanceof Error ? error.message : 'Unknown error';
        throw error;
    }
}
```

---

**Report End**
