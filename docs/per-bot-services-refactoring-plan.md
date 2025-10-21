# Per-Bot Services Refactoring Plan

## Executive Summary

This document outlines the plan to refactor singleton services into per-bot instances, enabling true multi-bot support where each bot operates independently with its own service instances.

**Services to Refactor:**
1. `XtermService` - Terminal session management
2. `XtermRendererService` - Terminal screenshot rendering
3. `CoderService` - Coder configuration and utilities

**Service to Keep Singleton:**
- `MediaWatcherService` - Will remain singleton (shared across all bots)

---

## Current Architecture

### Current State
```
┌─────────────────────────────────────────┐
│         Application (app.ts)            │
├─────────────────────────────────────────┤
│  Bot 1    Bot 2    Bot 3    Bot N       │
│    │        │        │        │         │
│    └────────┴────────┴────────┘         │
│              │                          │
│              ▼                          │
│    ┌──────────────────────┐            │
│    │  Singleton Services  │            │
│    │  - xtermService      │            │
│    │  - coderService      │            │
│    │  - rendererService   │            │
│    └──────────────────────┘            │
└─────────────────────────────────────────┘
```

### Problems with Current Architecture
1. **Shared State**: All bots share the same service instances
2. **Session Conflicts**: Sessions are keyed by `botId:userId`, tightly coupling user sessions to specific bots
3. **Resource Contention**: Single Puppeteer browser shared across all bots
4. **Configuration Coupling**: All bots must use identical configuration
5. **Cleanup Complexity**: Cannot independently shut down services for individual bots

---

## Target Architecture

### Target State
```
┌─────────────────────────────────────────────────────┐
│            Application (app.ts)                     │
├─────────────────────────────────────────────────────┤
│  Bot 1          Bot 2          Bot 3                │
│    │              │              │                  │
│    ├─XtermService ├─XtermService ├─XtermService     │
│    ├─CoderService ├─CoderService ├─CoderService     │
│    └─Renderer    └─Renderer    └─Renderer         │
│                                                      │
│         ┌──────────────────────────┐                │
│         │ MediaWatcherService      │                │
│         │ (Shared Singleton)       │                │
│         └──────────────────────────┘                │
└─────────────────────────────────────────────────────┘
```

### Benefits of New Architecture
1. **True Isolation**: Each bot operates completely independently
2. **Simplified Session Management**: No need for `botId` in session keys
3. **Independent Configuration**: Each bot can have different settings
4. **Easier Testing**: Can test individual bot instances in isolation
5. **Flexible Scaling**: Can start/stop individual bot services independently

---

## Implementation Plan

### Phase 1: Service Interface & Container Design

#### Step 1.1: Create Service Container Interface
**File**: `/src/services/service-container.interface.ts`

```typescript
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';

export interface ServiceContainer {
    xtermService: XtermService;
    xtermRendererService: XtermRendererService;
    coderService: CoderService;
    cleanup(): Promise<void>;
}
```

**Impact**: Creates contract for service containers
**Files Created**: 1
**Files Modified**: 0

#### Step 1.2: Create Service Container Factory
**File**: `/src/services/service-container.factory.ts`

```typescript
import { ServiceContainer } from './service-container.interface.js';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';

export class ServiceContainerFactory {
    static create(botId: string): ServiceContainer {
        const xtermService = new XtermService();
        const xtermRendererService = new XtermRendererService();
        const coderService = new CoderService();

        return {
            xtermService,
            xtermRendererService,
            coderService,
            async cleanup() {
                xtermService.cleanup();
                await xtermRendererService.cleanup();
            }
        };
    }
}
```

**Impact**: Centralizes service instantiation per bot
**Files Created**: 1
**Files Modified**: 0

---

### Phase 2: Refactor XtermService

#### Step 2.1: Remove botId from XtermService Session Management
**File**: `/src/features/xterm/xterm.service.ts`

**Changes Required:**
```typescript
// BEFORE: Sessions keyed by "botId:userId"
private getSessionKey(botId: string, userId: string): string {
    return `${botId}:${userId}`;
}

// AFTER: Sessions keyed by userId only (each bot has its own service)
private getSessionKey(userId: string): string {
    return userId;
}
```

**Method Signatures to Update:**
- `createSession(userId: string, chatId: number, ...)` - Remove `botId` param
- `hasSession(userId: string)` - Remove `botId` param
- `writeToSession(userId: string, data: string)` - Remove `botId` param
- `writeRawToSession(userId: string, data: string)` - Remove `botId` param
- `getSessionOutput(userId: string, waitMs?: number)` - Remove `botId` param
- `getSessionOutputBuffer(userId: string)` - Remove `botId` param
- `getSessionDimensions(userId: string)` - Remove `botId` param
- `closeSession(userId: string)` - Remove `botId` param
- `setLastScreenshotMessageId(userId: string, messageId: number)` - Remove `botId` param
- `getLastScreenshotMessageId(userId: string)` - Remove `botId` param

**Lines to Modify**: ~30 method signatures + internal calls
**Files Modified**: 1

#### Step 2.2: Remove Singleton Export from XtermService
**File**: `/src/features/xterm/xterm.service.ts`

**Changes:**
```typescript
// REMOVE THIS LINE:
export const xtermService = new XtermService();

// Keep only the class export:
export class XtermService { ... }
```

**Lines Modified**: 1-2
**Files Modified**: 1

---

### Phase 3: Refactor XtermRendererService

#### Step 3.1: Make XtermRendererService Instance-Safe
**File**: `/src/features/xterm/xterm-renderer.service.ts`

**Current Issue**: Shares single Puppeteer browser/page across all bots

**Changes Required:**
- Keep current implementation (already instance-safe)
- Each instance gets its own browser and page
- Remove singleton export

**Changes:**
```typescript
// REMOVE THIS LINE:
export const xtermRendererService = new XtermRendererService();

// Keep only class export:
export class XtermRendererService { ... }
```

**Lines Modified**: 1-2
**Files Modified**: 1

---

### Phase 4: Refactor CoderService

#### Step 4.1: Make CoderService Instance-Safe
**File**: `/src/features/coder/coder.service.ts`

**Current State**: Stores configuration as instance properties (already instance-safe)

**Changes:**
```typescript
// REMOVE THIS LINE:
export const coderService = new CoderService();

// Keep only class export:
export class CoderService { ... }
```

**Lines Modified**: 1-2
**Files Modified**: 1

---

### Phase 5: Refactor Bot Classes

#### Step 5.1: Update CoderBot to Accept Services
**File**: `/src/features/coder/coder.bot.ts`

**Changes:**
```typescript
// BEFORE:
import { xtermService } from '../xterm/xterm.service.js';
import { xtermRendererService } from '../xterm/xterm-renderer.service.js';
import { coderService } from './coder.service.js';

export class CoderBot {
    constructor(botId: string) {
        this.mediaPath = coderService.getMediaPath();
        // ... uses global singletons
    }
}

// AFTER:
import { XtermService } from '../xterm/xterm.service.js';
import { XtermRendererService } from '../xterm/xterm-renderer.service.js';
import { CoderService } from './coder.service.js';

export class CoderBot {
    private xtermService: XtermService;
    private xtermRendererService: XtermRendererService;
    private coderService: CoderService;
    
    constructor(
        botId: string,
        xtermService: XtermService,
        xtermRendererService: XtermRendererService,
        coderService: CoderService
    ) {
        this.xtermService = xtermService;
        this.xtermRendererService = xtermRendererService;
        this.coderService = coderService;
        this.mediaPath = this.coderService.getMediaPath();
    }
}
```

**All Method Calls to Update:**
- Remove `this.botId` parameter from all `xtermService` calls (~40 occurrences)
- Change from `xtermService.method()` to `this.xtermService.method()`
- Change from `coderService.method()` to `this.coderService.method()`
- Change from `xtermRendererService.method()` to `this.xtermRendererService.method()`

**Lines Modified**: ~45-50
**Files Modified**: 1

#### Step 5.2: Update XtermBot to Accept Services
**File**: `/src/features/xterm/xterm.bot.ts`

**Changes:**
```typescript
// BEFORE:
import { xtermService } from './xterm.service.js';
import { xtermRendererService } from './xterm-renderer.service.js';

export class XtermBot {
    constructor(botId: string) {
        // ... uses global singletons
    }
}

// AFTER:
import { XtermService } from './xterm.service.js';
import { XtermRendererService } from './xterm-renderer.service.js';

export class XtermBot {
    private xtermService: XtermService;
    private xtermRendererService: XtermRendererService;
    
    constructor(
        botId: string,
        xtermService: XtermService,
        xtermRendererService: XtermRendererService
    ) {
        this.xtermService = xtermService;
        this.xtermRendererService = xtermRendererService;
    }
}
```

**All Method Calls to Update:**
- Remove `this.botId` parameter from all `xtermService` calls (~20 occurrences)
- Change from `xtermService.method()` to `this.xtermService.method()`
- Change from `xtermRendererService.method()` to `this.xtermRendererService.method()`

**Lines Modified**: ~25-30
**Files Modified**: 1

---

### Phase 6: Update Application Bootstrap

#### Step 6.1: Refactor app.ts to Create Per-Bot Services
**File**: `/src/app.ts`

**Changes:**
```typescript
// BEFORE:
import { xtermService } from './features/xterm/xterm.service.js';
import { xtermRendererService } from './features/xterm/xterm-renderer.service.js';
import { mediaWatcherService } from './features/media/media-watcher.service.js';

async function startBot() {
    await mediaWatcherService.initialize(bots);
    
    for (let i = 0; i < bots.length; i++) {
        const botId = botInfo.id.toString();
        const xtermBot = new XtermBot(botId);
        const coderBot = new CoderBot(botId);
        // ...
    }
}

process.on('SIGINT', async () => {
    mediaWatcherService.cleanup();
    xtermService.cleanup();
    await xtermRendererService.cleanup();
    await Promise.all(bots.map(bot => bot.stop()));
});

// AFTER:
import { ServiceContainerFactory } from './services/service-container.factory.js';
import { mediaWatcherService } from './features/media/media-watcher.service.js';

interface BotInstance {
    bot: Bot;
    services: ServiceContainer;
    xtermBot: XtermBot;
    coderBot: CoderBot;
}

const botInstances: BotInstance[] = [];

async function startBot() {
    await mediaWatcherService.initialize(bots);
    
    for (let i = 0; i < bots.length; i++) {
        const botId = botInfo.id.toString();
        
        // Create per-bot services
        const services = ServiceContainerFactory.create(botId);
        
        // Pass services to bot classes
        const xtermBot = new XtermBot(
            botId,
            services.xtermService,
            services.xtermRendererService
        );
        const coderBot = new CoderBot(
            botId,
            services.xtermService,
            services.xtermRendererService,
            services.coderService
        );
        
        botInstances.push({
            bot: bots[i],
            services,
            xtermBot,
            coderBot
        });
        
        // ...
    }
}

process.on('SIGINT', async () => {
    mediaWatcherService.cleanup();
    
    // Cleanup each bot's services independently
    await Promise.all(
        botInstances.map(async (instance) => {
            await instance.services.cleanup();
            await instance.bot.stop();
        })
    );
    
    process.exit(0);
});
```

**Lines Modified**: ~40-50
**Files Modified**: 1

---

## Testing Strategy

### Unit Tests

#### Test 1: Service Isolation
```typescript
describe('Service Isolation', () => {
    it('should create independent service instances per bot', () => {
        const services1 = ServiceContainerFactory.create('bot1');
        const services2 = ServiceContainerFactory.create('bot2');
        
        expect(services1.xtermService).not.toBe(services2.xtermService);
        expect(services1.coderService).not.toBe(services2.coderService);
    });
});
```

#### Test 2: Session Independence
```typescript
describe('XtermService Session Independence', () => {
    it('should manage sessions independently per bot', () => {
        const service1 = new XtermService();
        const service2 = new XtermService();
        
        service1.createSession('user1', 123);
        
        expect(service1.hasSession('user1')).toBe(true);
        expect(service2.hasSession('user1')).toBe(false);
    });
});
```

### Integration Tests

#### Test 3: Multi-Bot Operation
```typescript
describe('Multi-Bot Integration', () => {
    it('should allow same user to have sessions on different bots', async () => {
        const bot1Services = ServiceContainerFactory.create('bot1');
        const bot2Services = ServiceContainerFactory.create('bot2');
        
        bot1Services.xtermService.createSession('user1', 123);
        bot2Services.xtermService.createSession('user1', 456);
        
        expect(bot1Services.xtermService.hasSession('user1')).toBe(true);
        expect(bot2Services.xtermService.hasSession('user1')).toBe(true);
        
        // Both sessions should be independent
        bot1Services.xtermService.writeToSession('user1', 'echo bot1');
        const output1 = await bot1Services.xtermService.getSessionOutput('user1');
        
        bot2Services.xtermService.writeToSession('user1', 'echo bot2');
        const output2 = await bot2Services.xtermService.getSessionOutput('user1');
        
        expect(output1).toContain('bot1');
        expect(output2).toContain('bot2');
    });
});
```

### Manual Testing Checklist

- [ ] Start multiple bots and verify each has independent services
- [ ] Create terminal sessions on Bot 1 for User A
- [ ] Create terminal sessions on Bot 2 for User A
- [ ] Verify both sessions are independent and don't interfere
- [ ] Send commands to Bot 1 session, verify Bot 2 session unaffected
- [ ] Close Bot 1 session, verify Bot 2 session still active
- [ ] Restart one bot, verify other bot continues operating normally
- [ ] Test graceful shutdown with multiple bots active
- [ ] Verify memory cleanup after bot shutdown

---

## Migration Checklist

### Pre-Migration
- [ ] Create feature branch: `feature/per-bot-services`
- [ ] Review all service dependencies
- [ ] Document current behavior
- [ ] Create backup of current working state

### Phase 1: Foundation (Low Risk)
- [ ] Create `ServiceContainer` interface
- [ ] Create `ServiceContainerFactory`
- [ ] Run existing tests to ensure nothing broken

### Phase 2: XtermService (Medium Risk)
- [ ] Update `XtermService` method signatures
- [ ] Remove `botId` parameter logic
- [ ] Remove singleton export
- [ ] Update unit tests for `XtermService`

### Phase 3: Renderer & Coder (Low Risk)
- [ ] Remove singleton export from `XtermRendererService`
- [ ] Remove singleton export from `CoderService`
- [ ] Update unit tests

### Phase 4: Bot Classes (High Risk)
- [ ] Update `CoderBot` constructor and methods
- [ ] Update `XtermBot` constructor and methods
- [ ] Verify all method calls updated
- [ ] Run integration tests

### Phase 5: Bootstrap (High Risk)
- [ ] Update `app.ts` initialization
- [ ] Update shutdown handlers
- [ ] Test with single bot
- [ ] Test with multiple bots

### Post-Migration
- [ ] Run full test suite
- [ ] Perform manual testing with checklist
- [ ] Update documentation
- [ ] Monitor logs for errors
- [ ] Performance testing with multiple bots

---

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: 
   ```bash
   git checkout main
   npm run build
   pm2 restart coderBOT
   ```

2. **Partial Rollback**: Keep completed phases, revert problematic phase

3. **Data Migration**: No data migration needed (session state is in-memory)

---

## File Impact Summary

### Files to Create (2)
1. `/src/services/service-container.interface.ts`
2. `/src/services/service-container.factory.ts`

### Files to Modify (7)
1. `/src/features/xterm/xterm.service.ts` (~30 lines)
2. `/src/features/xterm/xterm-renderer.service.ts` (~2 lines)
3. `/src/features/coder/coder.service.ts` (~2 lines)
4. `/src/features/coder/coder.bot.ts` (~45-50 lines)
5. `/src/features/xterm/xterm.bot.ts` (~25-30 lines)
6. `/src/app.ts` (~40-50 lines)
7. `/src/middleware/access-control.middleware.ts` (no changes to logic)

### Total Lines of Code Impact
- **New Code**: ~60 lines
- **Modified Code**: ~160-180 lines
- **Deleted Code**: ~6 lines (singleton exports)
- **Total Estimated Changes**: ~220-240 lines

---

## Risk Assessment

### High Risk Areas
1. **XtermService Session Management**: Many call sites to update
2. **app.ts Bootstrap Logic**: Critical initialization code
3. **Graceful Shutdown**: Must cleanup all bot services properly

### Medium Risk Areas
1. **CoderBot Method Updates**: Large number of service calls
2. **XtermBot Method Updates**: Many service interactions

### Low Risk Areas
1. **Service Container Creation**: New code, no existing dependencies
2. **Singleton Export Removal**: Simple deletions
3. **MediaWatcherService**: No changes needed

---

## Performance Considerations

### Memory Impact
- **Before**: 3 singleton services (1 instance each)
- **After**: 3 services × N bots (N instances each)
- **Estimated Increase**: ~2-5MB per additional bot

### Puppeteer Browsers
- **Before**: 1 shared Puppeteer browser
- **After**: 1 Puppeteer browser per bot
- **Impact**: More memory but better isolation
- **Mitigation**: Browser instances created lazily, cleaned up properly

### Session Management
- **Before**: Single Map with composite keys "botId:userId"
- **After**: Multiple Maps, one per service instance
- **Impact**: Negligible performance difference, improved code clarity

---

## Success Criteria

✅ **Must Have**
1. Each bot operates with independent service instances
2. Same user can have active sessions on multiple bots simultaneously
3. Bot shutdown cleans up only that bot's services
4. No memory leaks after service cleanup
5. All existing functionality works as before

✅ **Should Have**
1. Improved code clarity and maintainability
2. Easier to test individual components
3. Better logging with per-bot context

✅ **Nice to Have**
1. Performance improvements from reduced contention
2. Ability to configure different settings per bot
3. Easier debugging of multi-bot issues

---

## Timeline Estimate

- **Phase 1 (Foundation)**: 1-2 hours
- **Phase 2 (XtermService)**: 2-3 hours
- **Phase 3 (Renderer/Coder)**: 1 hour
- **Phase 4 (Bot Classes)**: 3-4 hours
- **Phase 5 (Bootstrap)**: 2-3 hours
- **Testing & Validation**: 2-3 hours
- **Documentation**: 1 hour

**Total Estimated Time**: 12-17 hours

---

## Questions & Considerations

### Open Questions
1. Should we maintain backward compatibility with singleton exports temporarily?
2. Do we need configuration differences per bot, or just isolation?
3. Should MediaWatcherService notify all bots or just the originating bot?

### Future Enhancements
1. Add service health monitoring per bot
2. Implement service restart without full bot restart
3. Add metrics/telemetry per bot service
4. Consider service pooling for resource optimization

---

## Conclusion

This refactoring will significantly improve the architecture by:
- Providing true multi-bot independence
- Simplifying session management
- Improving testability and maintainability
- Enabling future scalability enhancements

The changes are surgical and focused, with clear rollback options if issues arise. The phased approach allows for incremental validation and reduces risk.
