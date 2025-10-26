# Advisory: Moving URL Detection from XtermService to CoderService

## Executive Summary

The URL detection functionality is currently implemented in `XtermService` (the low-level terminal abstraction layer) but is actually only used by the `CoderBot` feature. This document provides multiple architectural approaches to move URL detection to the appropriate layer.

## Current Architecture

### Current Implementation

```
┌─────────────────────────────────────────────────────────────┐
│ CoderBot (High-level feature)                               │
│ - Handles user commands (/urls)                             │
│ - Passes handleUrlDiscovered callback to XtermService       │
│ - Auto-notifies users about discovered URLs                 │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ XtermService (Low-level terminal abstraction)               │
│ - Manages PTY sessions                                      │
│ - Stores discoveredUrls Set in PtySession                   │
│ - Detects URLs using UrlExtractionUtils                     │
│ - Calls onUrlDiscoveredCallback when new URL found          │
│ - Manages URL notification timeouts                         │
│ - Provides getDiscoveredUrls() API                          │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ UrlExtractionUtils (Utility)                                │
│ - extractUrlsFromTerminalOutput()                           │
│ - URL regex pattern matching                                │
│ - ANSI code stripping                                       │
└─────────────────────────────────────────────────────────────┘
```

### Problem Statement

1. **Separation of Concerns**: XtermService should be a pure terminal abstraction, not feature-specific
2. **Unused by XtermBot**: The xterm feature doesn't use URL detection, only coder feature does
3. **Feature Leakage**: URL tracking pollutes the generic PTY session interface
4. **Poor Modularity**: If we add more bots, they inherit URL detection whether they need it or not

## Recommended Approaches

### ⭐ Approach 1: Move to CoderService (RECOMMENDED)

**Best for:** Clean separation, future extensibility, proper layering

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CoderBot                                                     │
│ - Handles /urls command                                     │
│ - Gets URLs from CoderService                               │
│ - Auto-notifies via handleUrlDiscovered                     │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ CoderService (Feature-specific service)                     │
│ - NEW: Stores discoveredUrls Map<userId, Set<string>>      │
│ - NEW: Detects URLs in terminal data handler                │
│ - NEW: Manages URL notification state                       │
│ - NEW: Provides getDiscoveredUrls(userId)                   │
│ - Already has: createTerminalDataHandler()                  │
└─────────────────────────────────────────────────────────────┘
                         ↓ receives data from
┌─────────────────────────────────────────────────────────────┐
│ XtermService (Clean terminal abstraction)                   │
│ - REMOVE: discoveredUrls from PtySession                    │
│ - REMOVE: notifiedUrls from PtySession                      │
│ - REMOVE: URL detection logic                               │
│ - KEEP: Pure terminal operations only                       │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation Steps

**Step 1: Update CoderService to track URLs**

```typescript
// src/features/coder/coder.service.ts

export class CoderService {
    private discoveredUrls: Map<string, Set<string>> = new Map();
    private notifiedUrls: Map<string, Set<string>> = new Map();
    private urlNotificationTimeouts: Map<string, Map<number, NodeJS.Timeout>> = new Map();

    private getUserKey(userId: string): string {
        return userId;
    }

    getDiscoveredUrls(userId: string): string[] {
        const userKey = this.getUserKey(userId);
        const urls = this.discoveredUrls.get(userKey);
        return urls ? Array.from(urls) : [];
    }

    clearUrlsForUser(userId: string): void {
        const userKey = this.getUserKey(userId);
        this.discoveredUrls.delete(userKey);
        this.notifiedUrls.delete(userKey);
        
        // Clear all timeouts for this user
        const timeouts = this.urlNotificationTimeouts.get(userKey);
        if (timeouts) {
            timeouts.forEach(timeout => clearTimeout(timeout));
            this.urlNotificationTimeouts.delete(userKey);
        }
    }

    registerUrlNotificationTimeout(userId: string, messageId: number, timeout: NodeJS.Timeout): void {
        const userKey = this.getUserKey(userId);
        if (!this.urlNotificationTimeouts.has(userKey)) {
            this.urlNotificationTimeouts.set(userKey, new Map());
        }
        this.urlNotificationTimeouts.get(userKey)!.set(messageId, timeout);
    }

    clearUrlNotificationTimeout(userId: string, messageId: number): void {
        const userKey = this.getUserKey(userId);
        const timeouts = this.urlNotificationTimeouts.get(userKey);
        if (timeouts) {
            const timeout = timeouts.get(messageId);
            if (timeout) {
                clearTimeout(timeout);
                timeouts.delete(messageId);
            }
        }
    }
}
```

**Step 2: Update createTerminalDataHandler to detect URLs**

```typescript
// src/features/coder/coder.service.ts

import { UrlExtractionUtils } from '../../utils/url-extraction.utils.js';

export interface TerminalDataHandlers {
    onBell?: (userId: string, chatId: number) => void;
    onConfirmationPrompt?: (userId: string, chatId: number, data: string) => void;
    onBoxDetected?: (userId: string, chatId: number, data: string) => void;
    onUrlDiscovered?: (userId: string, chatId: number, url: string) => void;  // NEW
}

createTerminalDataHandler(handlers: TerminalDataHandlers): (userId: string, chatId: number, data: string) => void {
    return (userId: string, chatId: number, data: string) => {
        const userKey = this.getUserKey(userId);
        
        // Existing detection logic...
        
        // NEW: URL detection
        if (handlers.onUrlDiscovered) {
            const urls = UrlExtractionUtils.extractUrlsFromTerminalOutput(data);
            
            if (!this.discoveredUrls.has(userKey)) {
                this.discoveredUrls.set(userKey, new Set());
            }
            if (!this.notifiedUrls.has(userKey)) {
                this.notifiedUrls.set(userKey, new Set());
            }
            
            const discovered = this.discoveredUrls.get(userKey)!;
            const notified = this.notifiedUrls.get(userKey)!;
            
            urls.forEach(url => {
                discovered.add(url);
                
                // Notify only if not already notified
                if (!notified.has(url)) {
                    notified.add(url);
                    handlers.onUrlDiscovered!(userId, chatId, url);
                }
            });
        }
    };
}
```

**Step 3: Update CoderBot to use CoderService for URLs**

```typescript
// src/features/coder/coder.bot.ts

private async startAssistantSession(ctx: Context, assistantType: string, directory?: string): Promise<void> {
    // ...
    const dataHandler = this.coderService.createTerminalDataHandler({
        onBell: this.handleBellNotification.bind(this),
        onConfirmationPrompt: this.handleConfirmNotification.bind(this),
        onBoxDetected: this.handleBoxDetected.bind(this),
        onUrlDiscovered: this.handleUrlDiscovered.bind(this),  // NEW
    });

    this.xtermService.createSession(
        userId,
        chatId,
        dataHandler,
        undefined,  // REMOVE: no longer pass URL callback to XtermService
        undefined,
        this.xtermService.getSessionOutputBuffer.bind(this.xtermService)
    );
}

private async handleUrls(ctx: Context): Promise<void> {
    const userId = ctx.from!.id.toString();
    
    // CHANGE: Get URLs from CoderService instead of XtermService
    const urls = this.coderService.getDiscoveredUrls(userId);
    
    if (urls.length === 0) {
        await ctx.reply(
            '🔗 *No URLs Found*\n\n' +
            'No URLs have been detected in the terminal output yet.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const urlList = urls.map(url => `\`${url}\``).join('\n');
    await ctx.reply(
        `🔗 *Discovered URLs* (${urls.length})\n\n${urlList}`,
        { parse_mode: 'Markdown' }
    );
}

private async handleUrlDiscovered(userId: string, chatId: number, url: string): Promise<void> {
    if (!this.bot || !this.configService.isAutoNotifyUrlsEnabled()) {
        return;
    }

    try {
        const sentMsg = await this.bot.api.sendMessage(
            chatId,
            `\`${url}\``,
            { parse_mode: 'Markdown' }
        );

        const deleteTimeout = this.configService.getMessageDeleteTimeout();
        if (deleteTimeout > 0) {
            const timeout = setTimeout(async () => {
                try {
                    await this.bot?.api.deleteMessage(chatId, sentMsg.message_id);
                    this.coderService.clearUrlNotificationTimeout(userId, sentMsg.message_id);  // CHANGE
                } catch (error) {
                    console.error('Failed to delete URL notification:', error);
                }
            }, deleteTimeout);

            this.coderService.registerUrlNotificationTimeout(userId, sentMsg.message_id, timeout);  // CHANGE
        }
    } catch (error) {
        console.error('Failed to send URL notification:', error);
    }
}

private async handleClose(ctx: Context): Promise<void> {
    const userId = ctx.from!.id.toString();
    
    if (this.xtermService.hasSession(userId)) {
        this.xtermService.closeSession(userId);
        this.coderService.clearBuffer(userId, ctx.chat!.id);
        this.coderService.clearUrlsForUser(userId);  // NEW: Clear URL tracking
        await ctx.reply(SuccessMessages.SESSION_CLOSED);
    } else {
        await ctx.reply(Messages.NO_ACTIVE_SESSION);
    }
}
```

**Step 4: Clean up XtermService**

```typescript
// src/features/xterm/xterm.types.ts

export interface PtySession {
    pty: IPty;
    output: string[];
    lastActivity: Date;
    rows: number;
    cols: number;
    chatId: number;
    onDataCallback?: (userId: string, chatId: number, data: string) => void;
    lastScreenshotMessageId?: number;
    refreshInterval?: NodeJS.Timeout;
    // REMOVE: discoveredUrls?: Set<string>;
    // REMOVE: notifiedUrls?: Set<string>;
    // REMOVE: urlNotificationTimeouts?: Map<number, NodeJS.Timeout>;
    lastBufferSnapshot?: string;
    lastBufferChangeTime?: Date;
    bufferMonitorInterval?: NodeJS.Timeout;
    onBufferingEndedCallback?: (userId: string, chatId: number) => void;
}
```

```typescript
// src/features/xterm/xterm.service.ts

createSession(
    userId: string,
    chatId: number,
    onDataCallback?: (userId: string, chatId: number, data: string) => void,
    // REMOVE: onUrlDiscoveredCallback parameter
    onBufferingEndedCallback?: (userId: string, chatId: number) => void,
    getFullBufferCallback?: (userId: string) => string[]
): void {
    // ...
    const session: PtySession = {
        pty: ptyProcess,
        output: [],
        lastActivity: new Date(),
        rows: this.config.terminalRows,
        cols: this.config.terminalCols,
        chatId,
        onDataCallback,
        // REMOVE: discoveredUrls: new Set<string>(),
        // REMOVE: notifiedUrls: new Set<string>(),
        // REMOVE: urlNotificationTimeouts: new Map<number, NodeJS.Timeout>(),
        lastBufferSnapshot: '',
        lastBufferChangeTime: new Date(),
        onBufferingEndedCallback,
    };

    ptyProcess.onData((data) => {
        session.output.push(data);
        if (session.output.length > this.config.maxOutputLines) {
            session.output.shift();
        }
        session.lastActivity = new Date();

        // REMOVE: URL extraction logic
        
        // Pass all data to the callback if provided
        if (session.onDataCallback) {
            session.onDataCallback(userId, chatId, data);
        }
    });
    
    // ...
}

// REMOVE: getDiscoveredUrls() method
// REMOVE: clearUrlNotificationTimeout() method
// REMOVE: registerUrlNotificationTimeout() method
```

#### Benefits

✅ **Clean Separation**: XtermService becomes a pure terminal abstraction  
✅ **Feature Isolation**: URL detection is isolated to the coder feature  
✅ **Better Extensibility**: Easy to add more coder-specific features  
✅ **Testability**: Can test URL detection independently  
✅ **Reusability**: XtermService can be reused for non-coder bots without URL overhead

#### Drawbacks

⚠️ **Moderate Refactoring**: Requires changes to multiple files  
⚠️ **Data Flow Change**: URLs detected in data handler instead of session creation

---

### Approach 2: Create URL Tracking Service

**Best for:** Maximum reusability across multiple features

#### Architecture

```
┌──────────────┐         ┌──────────────┐
│  CoderBot    │         │  XtermBot    │
└──────┬───────┘         └──────┬───────┘
       │                        │
       └────────┬───────────────┘
                ↓ uses
┌─────────────────────────────────────────┐
│ UrlTrackingService (NEW)                │
│ - trackUrlsForUser(userId, data)        │
│ - getUrlsForUser(userId)                │
│ - clearUrlsForUser(userId)              │
│ - Stores URL state per user             │
└─────────────────────────────────────────┘
                ↓ uses
┌─────────────────────────────────────────┐
│ XtermService (Clean)                    │
│ - Pure terminal operations              │
└─────────────────────────────────────────┘
```

#### Implementation

```typescript
// src/services/url-tracking.service.ts (NEW FILE)

import { UrlExtractionUtils } from '../utils/url-extraction.utils.js';

export interface UrlTrackingCallbacks {
    onUrlDiscovered?: (userId: string, url: string) => void;
}

export class UrlTrackingService {
    private discoveredUrls: Map<string, Set<string>> = new Map();
    private notifiedUrls: Map<string, Set<string>> = new Map();
    private callbacks: Map<string, UrlTrackingCallbacks> = new Map();

    setCallbacks(userId: string, callbacks: UrlTrackingCallbacks): void {
        this.callbacks.set(userId, callbacks);
    }

    trackUrlsInData(userId: string, data: string): void {
        const urls = UrlExtractionUtils.extractUrlsFromTerminalOutput(data);
        
        if (!this.discoveredUrls.has(userId)) {
            this.discoveredUrls.set(userId, new Set());
        }
        if (!this.notifiedUrls.has(userId)) {
            this.notifiedUrls.set(userId, new Set());
        }
        
        const discovered = this.discoveredUrls.get(userId)!;
        const notified = this.notifiedUrls.get(userId)!;
        const callbacks = this.callbacks.get(userId);
        
        urls.forEach(url => {
            discovered.add(url);
            
            if (!notified.has(url)) {
                notified.add(url);
                if (callbacks?.onUrlDiscovered) {
                    callbacks.onUrlDiscovered(userId, url);
                }
            }
        });
    }

    getUrlsForUser(userId: string): string[] {
        const urls = this.discoveredUrls.get(userId);
        return urls ? Array.from(urls) : [];
    }

    clearUrlsForUser(userId: string): void {
        this.discoveredUrls.delete(userId);
        this.notifiedUrls.delete(userId);
        this.callbacks.delete(userId);
    }
}
```

#### Benefits

✅ **Highly Reusable**: Any bot can use URL tracking  
✅ **Single Responsibility**: One service, one job  
✅ **Easy Integration**: Just inject and call trackUrlsInData()

#### Drawbacks

⚠️ **New Dependency**: Adds another service to manage  
⚠️ **Overkill**: If only coder bot needs it, this is over-engineering

---

### Approach 3: Middleware Pattern

**Best for:** Cross-cutting concern that might be needed across multiple features

#### Architecture

```
┌─────────────────────────────────────────┐
│ UrlDetectionMiddleware (NEW)            │
│ - Wraps onDataCallback                  │
│ - Intercepts terminal data              │
│ - Detects and stores URLs               │
│ - Calls original callback               │
└─────────────────────────────────────────┘
                ↓ wraps
┌─────────────────────────────────────────┐
│ CoderBot Terminal Data Handler          │
│ - Receives data after URL detection     │
└─────────────────────────────────────────┘
                ↓ uses
┌─────────────────────────────────────────┐
│ XtermService (Clean)                    │
└─────────────────────────────────────────┘
```

This is less ideal for this use case but included for completeness.

---

## Migration Plan for Recommended Approach 1

### Phase 1: Preparation (No Breaking Changes)

1. ✅ Add URL tracking methods to CoderService
2. ✅ Update CoderService.createTerminalDataHandler to support onUrlDiscovered
3. ✅ Keep XtermService URL functionality intact (backward compatible)

### Phase 2: Migrate CoderBot

1. ✅ Update CoderBot to use CoderService for URL tracking
2. ✅ Test thoroughly with /urls command
3. ✅ Test auto-notifications

### Phase 3: Clean Up XtermService

1. ✅ Remove URL-related code from XtermService
2. ✅ Remove URL-related fields from PtySession interface
3. ✅ Update XtermBot if needed (it shouldn't be affected)

### Phase 4: Documentation

1. ✅ Update architecture documentation
2. ✅ Update feature documentation
3. ✅ Create migration guide if releasing as new version

## Testing Checklist

- [ ] `/urls` command returns correct URLs
- [ ] Auto-notification of new URLs works
- [ ] URL notification timeout/deletion works
- [ ] URLs cleared when session closes
- [ ] Multiple URLs detected correctly
- [ ] URLs with ANSI codes detected correctly
- [ ] Localhost URLs detected (http://localhost:3000)
- [ ] IP address URLs detected (http://192.168.1.1:8080)
- [ ] HTTPS URLs detected
- [ ] No URLs shows appropriate message

## Code Quality Considerations

### Before (Current State)

**Pros:**
- Working implementation
- URLs detected reliably

**Cons:**
- Feature leakage into generic service
- Tight coupling between layers
- XtermBot inherits unused functionality

### After (Recommended Approach)

**Pros:**
- Clean separation of concerns
- Feature-specific code in feature layer
- XtermService is pure terminal abstraction
- Better testability
- Easier to extend coder features

**Cons:**
- Requires refactoring effort
- More code in CoderService (but correctly placed)

## Conclusion

**Recommendation: Implement Approach 1 - Move to CoderService**

This approach provides the best balance of:
- ✅ Clean architecture (separation of concerns)
- ✅ Appropriate layering (feature code in feature module)
- ✅ Maintainability (easy to understand and extend)
- ✅ Testability (isolated URL detection logic)
- ✅ Reusability (XtermService stays generic)

The migration can be done incrementally with minimal risk using the provided 4-phase plan.
