# Assistant Type Implementation

## Overview
The `AssistantType` enum and `activeAssistantType` property provide type-safe tracking of which AI assistant is currently active in a CoderBot session.

## AssistantType Enum

```typescript
export enum AssistantType {
    COPILOT = 'copilot',
    CLAUDE = 'claude',
    GEMINI = 'gemini'
}
```

### Purpose
- Provides type-safe constants for the three supported AI assistants
- Replaces string literal union types for better maintainability
- Exported from `coder.bot.ts` for use in other modules if needed

### Values
- `COPILOT`: GitHub Copilot CLI assistant
- `CLAUDE`: Claude AI assistant  
- `GEMINI`: Gemini AI assistant

## activeAssistantType Property

```typescript
private activeAssistantType: AssistantType | null = null;
```

### Purpose
- Tracks which AI assistant is currently active in the session
- Set to `null` when no session is active
- Set to the appropriate `AssistantType` when a session starts

### Lifecycle

#### Initialization
- Initialized to `null` in the class property declaration
- Indicates no active session at startup

#### Session Start
When any AI assistant command is executed (`/copilot`, `/claude`, `/gemini`):
```typescript
this.activeAssistantType = assistantType; // Set in handleAIAssistant()
```

#### Session End
When the session is closed via `/close`:
```typescript
this.activeAssistantType = null; // Cleared in handleClose()
```

## Usage Example

The `handleAIAssistant` method now uses the enum:

```typescript
private async handleAIAssistant(
    ctx: Context,
    assistantType: AssistantType
): Promise<void> {
    // ...
    this.activeAssistantType = assistantType;
    
    // Type-safe comparison
    if (assistantType === AssistantType.COPILOT) {
        // Send startup prompt only for copilot
    }
}
```

Handler methods use enum values:

```typescript
private async handleCopilot(ctx: Context): Promise<void> {
    await this.handleAIAssistant(ctx, AssistantType.COPILOT);
}

private async handleClaude(ctx: Context): Promise<void> {
    await this.handleAIAssistant(ctx, AssistantType.CLAUDE);
}

private async handleGemini(ctx: Context): Promise<void> {
    await this.handleAIAssistant(ctx, AssistantType.GEMINI);
}
```

## Benefits

1. **Type Safety**: TypeScript compiler enforces correct usage
2. **Maintainability**: Single source of truth for assistant type values
3. **Refactoring**: Easier to rename or modify assistant types
4. **IDE Support**: Better autocomplete and IntelliSense
5. **Runtime Tracking**: Can query which assistant is active at any time
6. **Extensibility**: Easy to add new assistant types in the future

## Future Enhancements

The `activeAssistantType` property could be used for:
- Conditional behavior based on active assistant
- Logging which assistant was used
- UI indicators showing current assistant
- Assistant-specific command filtering
- Session persistence and restoration
