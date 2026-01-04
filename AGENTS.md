# AGENTS.md - CoderBOT Development Guidelines

This document provides essential guidelines for agentic coding assistants working on the CoderBOT project.

## Build, Lint, and Test Commands

### Building

```bash
# Development build (fast, with sourcemaps)
npm run build

# Production build (minified, optimized)
npm run build:prod

# TypeScript type checking only
npm run build:tsc

# Watch mode for development
npm run watch
```

### Running the Application

```bash
# Start in development mode (rebuilds on changes)
npm run dev

# Start production build
npm start

# Direct CLI execution
node ./dist/cli.js
```

### Testing

**Note**: Automated tests are not currently configured. The project uses manual test scenarios.

```bash
# No automated test runner configured
npm test  # Currently just prints "Error: no test specified"

# Manual test execution (run individual test files)
node tests/test_cwd.ts
node tests/buffer-change-detection.test.ts

# To run a single manual test scenario:
# 1. Start the bot: npm run dev
# 2. Follow the test scenarios documented in the test files
# 3. Use Telegram to interact with the bot as described
```

### Production Deployment (PM2)

```bash
# Build and start with PM2
npm run pm2:start

# PM2 management commands
npm run pm2:stop
npm run pm2:restart
npm run pm2:delete
npm run pm2:logs
npm run pm2:monit
npm run pm2:status
```

### Linting and Code Quality

**Note**: No linting tools are currently configured. Recommended for future:

```bash
# Suggested linting setup (not yet implemented)
npx eslint src/**/*.ts
npx prettier --check src/**/*.ts
npx tsc --noEmit
```

## Code Style Guidelines

### Language and Environment

- **Language**: TypeScript with ES2020 target
- **Module System**: ES Modules (ESM) with `.js` extensions in imports
- **Runtime**: Node.js 18+
- **Package Manager**: npm
- **Engine**: Node.js >= 18.0.0

### Imports and Dependencies

```typescript
// External dependencies - no file extensions
import dotenv from 'dotenv';
import * as fs from 'fs';

// Internal modules - use .js extensions (ESM requirement)
import { ConfigService } from './services/config.service.js';
import { XtermService } from '../features/xterm/xterm.service.js';

// Type-only imports
import type { PtySession } from './xterm.types.js';
```

### Naming Conventions

```typescript
// Classes and Interfaces - PascalCase
export class ConfigService {}
export interface XtermConfig {}

// Methods and Properties - camelCase
private telegramBotTokens: string[];
public getXtermMaxOutputLines(): number {}

// Constants - UPPER_SNAKE_CASE
export const DEFAULT_SESSION_TIMEOUT = 1800000;

// Files - kebab-case with descriptive names
// config.service.ts, xterm-renderer.service.ts
```

### Types and TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use union types for variants
- Leverage generics for reusable components

```typescript
// Interface definitions
export interface XtermConfig {
    maxOutputLines: number;
    sessionTimeout: number;
    terminalRows: number;
    terminalCols: number;
    shellPath: string;
}

// Generic service pattern
export class BaseService<T> {
    constructor(protected config: T) {}
}

// Union types for state management
export type BotStatus = 'starting' | 'running' | 'stopped' | 'error';
```

### Error Handling

Use the established ErrorUtils pattern for consistent error formatting:

```typescript
import { ErrorUtils } from '../utils/error.utils.js';

try {
    // Risky operation
    await riskyAsyncOperation();
} catch (error) {
    // Use ErrorUtils for consistent formatting
    const errorMessage = ErrorUtils.createErrorMessage(
        'initialize bot session',
        error
    );
    console.error(errorMessage);
    throw new Error(`Bot initialization failed: ${ErrorUtils.formatError(error)}`);
}
```

### Async/Await Patterns

- Prefer async/await over Promise chains
- Use Promise.all() for concurrent operations
- Handle errors appropriately in async contexts

```typescript
// Good: async/await with proper error handling
export async function initializeBot(): Promise<void> {
    try {
        await this.configService.validate();
        await Promise.all([
            this.startXtermService(),
            this.startMediaWatcher()
        ]);
    } catch (error) {
        throw new Error(`Bot initialization failed: ${ErrorUtils.formatError(error)}`);
    }
}
```

### Documentation

- Use JSDoc comments for public APIs
- Document complex business logic
- Include parameter and return type descriptions

```typescript
/**
 * Configuration Service
 *
 * Centralizes all environment variable access and provides type-safe
 * configuration management for bot instances.
 */
export class ConfigService {
    /**
     * Gets the maximum number of output lines to keep in buffer
     * @returns The configured maximum output lines
     */
    public getXtermMaxOutputLines(): number {
        return this.xtermMaxOutputLines;
    }
}
```

### Constants and Messages

- Centralize messages in `src/constants/messages.ts`
- Use descriptive constant names
- Group related constants

```typescript
// src/constants/messages.ts
export const BOT_MESSAGES = {
    SESSION_STARTED: '✅ Session started successfully',
    SESSION_CLOSED: '🔒 Session closed',
    UNAUTHORIZED: '❌ Access denied. Your user ID is not authorized.',
    COMMAND_NOT_FOUND: '❓ Unknown command. Type /help for available commands.'
} as const;
```

### Architecture Patterns

- **Service Layer**: Use service classes for business logic
- **Dependency Injection**: Constructor injection for services
- **Factory Pattern**: For complex object creation
- **Observer Pattern**: For event handling (media watcher, etc.)

```typescript
// Service with dependency injection
export class XtermService {
    constructor(
        private configService: ConfigService,
        private eventEmitter: EventEmitter
    ) {}
}

// Factory pattern for service creation
export class ServiceContainerFactory {
    static create(): ServiceContainer {
        const config = new ConfigService();
        return {
            configService: config,
            xtermService: new XtermService(config),
            // ... other services
        };
    }
}
```

### File Organization

```
src/
├── app.ts                 # Main application entry
├── cli.ts                 # CLI interface
├── bot-worker.ts          # Bot worker process
├── constants/             # Application constants
├── features/              # Feature modules (coder, xterm, audio, etc.)
├── services/              # Business logic services
├── middleware/            # Telegram middleware
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
└── tests/                 # Manual test scenarios
```

### Security Considerations

- Never log sensitive data (tokens, passwords)
- Use environment variables for configuration
- Validate user input thoroughly
- Implement proper access control
- Handle errors without exposing internal details

## Copilot Instructions Integration

### Coding Standards

- Write clean, maintainable, and well-documented code
- Follow TypeScript best practices
- Use meaningful variable and function names
- Keep functions small and focused on single responsibilities

### Testing Standards

- Write comprehensive tests for new features
- Test edge cases and error conditions
- Ensure tests are deterministic and reliable
- Document test scenarios clearly

### Documentation Files

When you create md files, put them in the `/docs` folder in the root of the repo, unless otherwise instructed.

### Agent Behavior

You MUST iterate and keep going until the problem is solved.

You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user.

Your thinking should be thorough and so it's fine if it's very long. However, avoid unnecessary repetition and verbosity. You should be concise, but thorough.

Your output will be displayed on a command line interface. Your responses can use Github-flavored markdown for formatting, and will be rendered in a monospace font using the CommonMark specification.

Only use tools to complete tasks. Never use tools like Bash or code comments as means to communicate with the user during the session.

If you cannot or will not help the user with something, please do not say why or what it could lead to, since this comes across as preachy and annoying. Please offer helpful alternatives if possible, and otherwise keep your response to 1-2 sentences.

Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.

### Workflow

1. Fetch any URL's provided by the user using the `fetch_webpage` tool.
2. Understand the problem deeply. Carefully read the issue and think critically about what is required. Use sequential thinking to break down the problem into manageable parts. Consider the following:
   - What is the expected behavior?
   - What are the edge cases?
   - What are the potential pitfalls?
   - How does this fit into the larger context of the codebase?
   - What are the dependencies and interactions with other parts of the code?
3. Investigate the codebase. Explore relevant files, search for key functions, and gather context.
4. Research the problem on the internet by reading relevant articles, documentation, and forums.
5. Develop a clear, step-by-step plan. Break down the fix into manageable, incremental steps. Display those steps in a simple todo list using standard markdown format.
6. Implement the fix incrementally. Make small, testable code changes.
7. Debug as needed. Use debugging techniques to isolate and resolve issues.
8. Test frequently. Run tests after each change to verify correctness.
9. Iterate until the root cause is fixed and all tests pass.
10. Reflect and validate comprehensively. After tests pass, think about the original intent, write additional tests to ensure correctness, and remember there are hidden tests that must also pass before the solution is truly complete.

### Making Code Changes

- Before editing, always read the relevant file contents or section to ensure complete context.
- Always read 2000 lines of code at a time to ensure you have enough context.
- If a patch is not applied correctly, attempt to reapply it.
- Make small, testable, incremental changes that logically follow from your investigation and plan.

### Debugging

- Use the `get_errors` tool to identify and report any issues in the code. This tool replaces the previously used `#problems` tool.
- Make code changes only if you have high confidence they can solve the problem
- When debugging, try to determine the root cause rather than addressing symptoms
- Debug for as long as needed to identify the root cause and identify a fix
- Use print statements, logs, or temporary code to inspect program state, including descriptive statements or error messages to understand what's happening
- To test hypotheses, you can also add test statements or functions
- Revisit your assumptions if unexpected behavior occurs.

## Future Improvements

- Add ESLint and Prettier for code formatting and linting
- Set up automated testing framework (Jest or similar)
- Add pre-commit hooks for code quality
- Implement CI/CD pipeline with automated builds and tests</content>
<parameter name="filePath">C:\Data\src\coderBOT\AGENTS.md