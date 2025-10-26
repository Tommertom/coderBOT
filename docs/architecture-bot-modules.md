# Bot Module Architecture

## Overview

The coderBOT application is structured into two main bot modules with clear separation of concerns:

1. **XtermBot** - Terminal infrastructure layer
2. **CoderBot** - AI assistant and intelligence layer

## Module Responsibilities

### XtermBot (xterm feature module)

**Purpose:** Provides raw terminal functionality and basic I/O operations.

**Commands:**
- `/xterm` - Spawn a raw bash terminal
- `/keys <text>` - Send keystrokes without Enter
- `/ctrl <char>` - Send control characters
- `/tab`, `/enter`, `/space`, `/delete`, `/esc` - Special keys
- `/ctrlc`, `/ctrlx` - Control combinations
- `/arrowup`, `/arrowdown` - Arrow keys
- `/1`, `/2`, `/3`, `/4`, `/5` - Number keys
- `/screen` - Capture terminal screenshot
- `/urls` - Show discovered URLs

**Handlers:**
- Text message input (sends to terminal)
- Callback queries (refresh screen, number buttons)

**Key Features:**
- Session management (create, write, close)
- Terminal rendering to images
- URL discovery from terminal output
- Auto-refresh functionality
- Special key and control character handling

**Dependencies:**
- `XtermService` - PTY session management
- `XtermRendererService` - Terminal to image conversion
- `ConfigService` - Configuration

**Does NOT:**
- Create data handlers for pattern detection
- Handle AI assistant commands
- Manage media files
- Process [media] placeholders

---

### CoderBot (coder feature module)

**Purpose:** Provides AI assistant integration with intelligent terminal output monitoring.

**Commands:**
- `/copilot` - Start GitHub Copilot CLI session
- `/claude` - Start Claude AI session  
- `/gemini` - Start Gemini AI session
- `/startup <prompt>` - Configure copilot startup prompt
- `/start` - Welcome message
- `/help` - Complete command reference
- `/close` - Close terminal session
- `/esc` - Send escape key
- `/killbot` - Shutdown bot
- `/urls` - Show discovered URLs

**Handlers:**
- Photo uploads (saves to received directory)
- Text messages with [media] placeholder replacement
- Callback queries for AI assistant interactions

**Key Features:**
- **Data Handler Creation:** Creates terminal data handlers with pattern detection:
  - Bell character (`\x07`) detection → Auto-refresh screenshot
  - Confirmation prompts (`1. Yes`) → Send notification
  - Box drawing patterns (╭─, ┌─, ┏━, ╔═) → Debug notification
- **Startup Prompts:** Automatically sends configured prompt to copilot after 3 seconds
- **Media Management:**
  - Saves uploaded photos to received directory
  - Replaces `[media]` placeholder with actual media path
  - Watches media directory for files to send back
- **Session Management:** Clears coder-specific buffers on session close

**Dependencies:**
- `XtermService` - Uses terminal infrastructure
- `XtermRendererService` - Terminal rendering
- `CoderService` - Pattern detection and buffer management
- `ConfigService` - Configuration
- `StartupPromptService` - Startup prompt storage

**Architecture Pattern:**
CoderBot **composes** XtermService to add intelligence:
```typescript
// Create data handler for pattern detection
const dataHandler = this.coderService.createTerminalDataHandler({
    onBell: this.handleBellNotification.bind(this),
    onConfirmationPrompt: this.handleConfirmNotification.bind(this),
    onBoxDetected: this.handleBoxDetected.bind(this),
});

// Create session with data handler
this.xtermService.createSession(userId, chatId, dataHandler, ...);
```

---

## Registration Order

In `bot-worker.ts`:
```typescript
// Register handlers - XtermBot first, then CoderBot
xtermBot.registerHandlers(bot);  // Registers /xterm and terminal I/O
coderBot.registerHandlers(bot);  // Registers AI assistants and adds intelligence
```

**Why this order:**
- XtermBot provides foundational terminal commands
- CoderBot adds AI-specific commands
- No command conflicts (each bot owns distinct commands)

---

## Data Flow

### Raw Terminal (/xterm)
```
User → /xterm → XtermBot → XtermService.createSession(no data handler)
                                ↓
                         PTY spawned (bash)
                                ↓
                         Terminal output → XtermService
                                ↓
                         Screenshot → User
```

### AI Assistant (/copilot, /claude, /gemini)
```
User → /copilot → CoderBot → CoderService.createTerminalDataHandler()
                                ↓
                         Creates handler with pattern detectors
                                ↓
                         XtermService.createSession(WITH data handler)
                                ↓
                         PTY spawned (copilot command)
                                ↓
                         Terminal output → Data handler
                                ↓
                    Pattern detection (bells, boxes, prompts)
                                ↓
                         Notifications + Screenshot → User
```

---

## Key Design Principles

1. **Separation of Concerns**
   - XtermBot = Infrastructure
   - CoderBot = Intelligence

2. **Composition Over Inheritance**
   - CoderBot doesn't extend XtermBot
   - CoderBot uses XtermService as a dependency

3. **Single Responsibility**
   - XtermBot: Terminal operations
   - CoderBot: AI assistant features

4. **No Duplication**
   - Each command is handled by exactly one bot
   - No override conflicts

5. **Layered Architecture**
   ```
   User
     ↓
   Bot Layer (XtermBot, CoderBot)
     ↓
   Service Layer (XtermService, CoderService)
     ↓
   Infrastructure (PTY, Renderer)
   ```

---

## Pattern Detection (CoderBot Only)

### Bell Character Detection
- **Pattern:** `\x07` (ASCII BEL)
- **Action:** Auto-refresh screenshot
- **Use Case:** AI assistant signals output is ready

### Confirmation Prompt Detection
- **Pattern:** `1. Yes` in buffer
- **Action:** Send notification after 3s
- **Use Case:** Copilot asks for confirmation

### Box Drawing Detection
- **Patterns:** `╭─`, `┌─`, `┏━`, `╔═`
- **Action:** Debug notification
- **Debounce:** 5 seconds
- **Use Case:** Copilot renders UI boxes

---

## Future Considerations

If adding new AI assistants or terminal modes:

1. **New AI Assistant?** → Add to CoderBot
2. **New Terminal Feature?** → Add to XtermBot  
3. **New Pattern Detection?** → Add to CoderService
4. **New Terminal Capability?** → Add to XtermService

This architecture ensures clean boundaries and maintainable code.
