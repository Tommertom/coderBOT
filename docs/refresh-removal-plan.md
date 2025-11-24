# Refresh Command Removal Plan

## Overview
This document outlines the complete removal of the refresh command and all related functionality from the coderBOT application.

## Components to Remove/Modify

### 1. Services to Delete
- **File**: `src/services/refresh-state.service.ts`
  - Entire file manages per-user refresh state preferences
  - No longer needed when refresh functionality is removed

### 2. Utilities to Delete
- **File**: `src/utils/screen-refresh.utils.ts`
  - Contains `ScreenRefreshUtils` class with:
    - `createScreenKeyboard()` - Creates keyboard with refresh button
    - `startAutoRefresh()` - Manages automatic screen refresh intervals
    - `stopAutoRefresh()` - Stops auto-refresh intervals

### 3. Service Container Interface Changes
- **File**: `src/services/service-container.interface.ts`
  - Remove import: `import { RefreshStateService } from './refresh-state.service.js';`
  - Remove property: `refreshStateService: RefreshStateService;` from ServiceContainer interface

### 4. Service Container Factory Changes
- **File**: `src/services/service-container.factory.ts`
  - Remove import: `import { RefreshStateService } from './refresh-state.service.js';`
  - Remove static property: `private static globalRefreshState: RefreshStateService | null = null;`
  - Remove initialization in `create()` method (lines 21-25)
  - Remove property from returned object (line 42)
  - Remove method: `static getGlobalRefreshState(): RefreshStateService`

### 5. Configuration Service Changes
- **File**: `src/services/config.service.ts`
  - Remove private properties (lines 32-34):
    - `private readonly screenRefreshInterval: number;`
    - `private readonly screenRefreshMaxCount: number;`
    - `private readonly screenRefreshEnabled: boolean;`
  - Remove initialization in constructor (lines 96-100)
  - Remove getter methods (lines 195-206):
    - `getScreenRefreshInterval(): number`
    - `getScreenRefreshMaxCount(): number`
    - `isScreenRefreshEnabled(): boolean`

### 6. Xterm Types Changes
- **File**: `src/features/xterm/xterm.types.ts`
  - Remove property from `PtySession` interface (line 13):
    - `refreshInterval?: NodeJS.Timeout;`

### 7. Xterm Service Changes
- **File**: `src/features/xterm/xterm.service.ts`
  - Remove cleanup in `closeSession()` method (lines 156-158):
    ```typescript
    if (session.refreshInterval) {
        clearInterval(session.refreshInterval);
    }
    ```
  - Remove methods:
    - `setRefreshInterval(userId: string, interval: NodeJS.Timeout): void` (lines 189-194)
    - `getRefreshInterval(userId: string): NodeJS.Timeout | undefined` (lines 196-199)
    - `clearRefreshInterval(userId: string): void` (lines 201-207)

### 8. Xterm Bot Changes
- **File**: `src/features/xterm/xterm.bot.ts`
  - Remove imports:
    - `import { RefreshStateService } from '../../services/refresh-state.service.js';`
    - `import { ScreenRefreshUtils } from '../../utils/screen-refresh.utils.js';`
  - Remove property: `private refreshStateService: RefreshStateService;`
  - Remove parameter from constructor
  - Remove assignment in constructor
  - Remove command registration (line 93): `bot.command('refresh', ...)`
  - Remove method: `private async handleRefresh(ctx: Context): Promise<void>` (lines 359-408)
  - Remove method: `private triggerAutoRefresh(userId: string, chatId: number): void` (lines 128-141)
  - Remove all calls to `this.triggerAutoRefresh()` (9 occurrences)
  - Modify `sendTerminalScreenshot()` method:
    - Remove keyboard creation using `ScreenRefreshUtils.createScreenKeyboard()`
    - Replace with simple number-only keyboard or no keyboard
  - Remove `refresh_screen` callback handler (lines 522-567)

### 9. Coder Bot Changes
- **File**: `src/features/coder/coder.bot.ts`
  - Remove imports:
    - `import { RefreshStateService } from '../../services/refresh-state.service.js';`
    - `import { ScreenRefreshUtils } from '../../utils/screen-refresh.utils.js';`
  - Remove property: `private refreshStateService: RefreshStateService;`
  - Remove parameter from constructor
  - Remove assignment in constructor
  - Remove method: `private triggerAutoRefresh(userId: string, chatId: number): void` (lines 111-124)
  - Remove all calls to `this.triggerAutoRefresh()` (4 occurrences)
  - Remove `refresh_screen` callback handler (lines 277-336)
  - Modify all keyboard creations using `ScreenRefreshUtils.createScreenKeyboard()`:
    - Replace with simple number-only keyboard or no keyboard
  - Update help text (line 1174):
    - Remove: `'/refresh [on|off] - Toggle/check auto-refresh status\n'`
    - Remove: `'Click 🔄 Refresh button on screenshots to update\n\n'`

### 10. Bot Worker Changes
- **File**: `src/bot-worker.ts`
  - Review and remove any references to refreshStateService (lines 88, 99)

### 11. Constants/Messages Changes
- **File**: `src/constants/messages.ts`
  - Review line 10 for refresh-related messages
  - Remove any refresh-related message constants

### 12. Environment Template Changes
- **File**: `dot-env.template`
  - Remove refresh configuration section:
    ```
    # Auto-refresh Configuration
    SCREEN_REFRESH_ENABLED=true
    SCREEN_REFRESH_INTERVAL=5000
    SCREEN_REFRESH_MAX_COUNT=5
    ```

## Replacement Keyboard

Since the refresh button is being removed from keyboards, we need to decide on a replacement:

### Option 1: Number-only keyboard
```typescript
new InlineKeyboard()
    .text('1', 'num_1')
    .text('2', 'num_2')
    .text('3', 'num_3');
```

### Option 2: No keyboard
Remove inline keyboards entirely from screenshot messages.

**Recommendation**: Use Option 1 (number-only keyboard) to maintain the number key functionality.

## Implementation Order

1. **Phase 1 - Remove Command Handler**
   - Remove `/refresh` command registration and handler from xterm.bot.ts

2. **Phase 2 - Remove Callback Handlers**
   - Remove `refresh_screen` callback handlers from both xterm.bot.ts and coder.bot.ts

3. **Phase 3 - Remove Auto-Refresh Logic**
   - Remove triggerAutoRefresh methods from both bot files
   - Remove all calls to triggerAutoRefresh

4. **Phase 4 - Update Keyboards**
   - Replace all ScreenRefreshUtils.createScreenKeyboard() calls with number-only keyboards

5. **Phase 5 - Remove Utilities and Services**
   - Delete screen-refresh.utils.ts
   - Delete refresh-state.service.ts

6. **Phase 6 - Clean Up Service Container**
   - Remove RefreshStateService from interface
   - Remove from factory
   - Update bot-worker.ts to not pass refreshStateService

7. **Phase 7 - Clean Up Xterm Service**
   - Remove refreshInterval property from PtySession type
   - Remove refresh interval management methods

8. **Phase 8 - Clean Up Configuration**
   - Remove refresh-related config properties and methods from ConfigService
   - Remove from dot-env.template

9. **Phase 9 - Update Documentation**
   - Remove refresh command from help text
   - Update any related documentation

## Testing Checklist

After removal, verify:
- [ ] Bot starts without errors
- [ ] Terminal screenshots still work
- [ ] Number buttons (1, 2, 3) still function
- [ ] No console errors related to refresh
- [ ] Help command doesn't show refresh command
- [ ] Airplane mode still works
- [ ] No TypeScript compilation errors
- [ ] No unused imports remain

## Files Summary

### Files to Delete (2):
1. `src/services/refresh-state.service.ts`
2. `src/utils/screen-refresh.utils.ts`

### Files to Modify (10):
1. `src/services/service-container.interface.ts`
2. `src/services/service-container.factory.ts`
3. `src/services/config.service.ts`
4. `src/features/xterm/xterm.types.ts`
5. `src/features/xterm/xterm.service.ts`
6. `src/features/xterm/xterm.bot.ts`
7. `src/features/coder/coder.bot.ts`
8. `src/bot-worker.ts`
9. `src/constants/messages.ts`
10. `dot-env.template`

## Impact Analysis

### User-Facing Changes:
- `/refresh` command will no longer be available
- 🔄 Refresh button removed from screenshot keyboards
- Automatic screen refresh after commands will stop
- Users will need to use `/screen` command to manually refresh

### Technical Changes:
- Reduced code complexity
- Fewer service dependencies
- Simplified keyboard layouts
- Less state management required
- Reduced interval management overhead

### Benefits:
- Cleaner codebase
- Fewer moving parts
- Reduced potential for bugs related to refresh intervals
- Simpler user experience (one way to refresh: `/screen` command)

## Notes

- The number key buttons (1, 2, 3) functionality is preserved
- Airplane mode functionality is not affected
- The core screenshot functionality (`/screen` command) remains intact
- Users can still manually capture terminal output using `/screen`
