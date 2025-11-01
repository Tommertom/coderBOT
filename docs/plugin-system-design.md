# CoderBOT Plugin System Design

## Overview

This document outlines the design for a plugin system that allows users to extend CoderBOT's functionality when running via `npx coderbot`. The plugin system enables developers to intercept and modify message handling, add custom commands, and enhance bot behavior without modifying the core codebase.

## Core Principles

1. **Non-invasive**: Plugins work alongside existing functionality without requiring core code changes
2. **Scoped**: Plugins only affect CoderBOT features, not ControlBOT
3. **Simple Discovery**: Automatic plugin detection via `plugin.js` in current working directory
4. **Prioritized Execution**: Plugin handlers execute before built-in handlers
5. **Control Flow**: Plugins can prevent default handler execution
6. **API Access**: Full access to bot API for sending messages and interacting with Telegram

## Plugin Discovery & Loading

### File Location
```
<current-working-directory>/
  └── plugin.js        # Main plugin file (ESM module)
```

### Loading Sequence

1. **Startup Phase** (in `cli.js` or `bot-worker.ts`):
   - Check for `plugin.js` in `process.cwd()`
   - If found, dynamically import the module
   - Validate plugin exports
   - Register plugin handlers

2. **Initialization Order**:
   ```
   Bot Worker Start
     ↓
   Load Configuration
     ↓
   Discover plugin.js
     ↓
   Import & Validate Plugin
     ↓
   Register Plugin Handlers
     ↓
   Register Built-in Handlers
     ↓
   Start Bot Polling
   ```

## Plugin API Specification

### Plugin Module Structure

```javascript
// plugin.js - ESM Module Format
export default {
  name: 'my-plugin',
  version: '1.0.0',
  
  // Called when plugin is loaded
  initialize(context) {
    // context.botId - unique bot identifier (e.g., 'bot-1')
    // context.api - bot API access
    // context.services - access to bot services (optional)
    console.log(`Plugin initialized for ${context.botId}`);
  },
  
  // Message handler registration
  handlers: {
    // Handle text messages before built-in handlers
    onText: async (ctx, next) => {
      // ctx - Grammy context object
      // next - function to call built-in handlers
      
      const text = ctx.message?.text;
      
      // Custom logic
      if (text === '/customplugin') {
        await ctx.reply('Handled by plugin!');
        return; // Stop propagation - built-in handlers won't run
      }
      
      // Let built-in handlers process
      await next();
    },
    
    // Handle all messages (any type)
    onMessage: async (ctx, next) => {
      // Intercept all messages
      console.log('Message received:', ctx.message);
      await next();
    },
    
    // Handle commands specifically
    onCommand: async (ctx, next) => {
      const command = ctx.message?.text?.split(' ')[0];
      
      if (command === '/myplugin') {
        await ctx.reply('Custom plugin command!');
        return;
      }
      
      await next();
    },
    
    // Handle photos
    onPhoto: async (ctx, next) => {
      // Custom photo processing
      await next();
    },
    
    // Handle callback queries (inline buttons)
    onCallbackQuery: async (ctx, next) => {
      const data = ctx.callbackQuery?.data;
      
      if (data?.startsWith('plugin:')) {
        await ctx.answerCallbackQuery('Plugin handled this!');
        return;
      }
      
      await next();
    }
  }
};
```

### Context Object

The plugin receives the full Grammy `Context` object with additional properties:

```typescript
interface PluginContext {
  // Standard Grammy context
  message?: Message;
  update: Update;
  api: Api; // Telegram Bot API
  
  // CoderBOT additions
  botId: string; // 'bot-1', 'bot-2', etc.
  userId: number; // Telegram user ID
  
  // Helper methods
  reply(text: string, options?: any): Promise<Message>;
  replyWithPhoto(photo: InputFile, options?: any): Promise<Message>;
  // ... all Grammy context methods
}
```

### Next Function

```typescript
type NextFunction = () => Promise<void>;
```

- Calling `next()` executes the built-in handler chain
- Not calling `next()` prevents built-in handlers from running
- Must be awaited if called

## Plugin Capabilities

### 1. Message Interception

Plugins can intercept messages before built-in handlers:

```javascript
onText: async (ctx, next) => {
  const text = ctx.message?.text;
  
  // Log all messages
  console.log(`[Plugin] User ${ctx.from?.id} sent: ${text}`);
  
  // Modify context (if needed)
  ctx.customData = { processedBy: 'plugin' };
  
  // Continue to built-in handlers
  await next();
}
```

### 2. Command Registration

Add completely new commands:

```javascript
onCommand: async (ctx, next) => {
  const text = ctx.message?.text;
  
  if (text?.startsWith('/weather')) {
    const location = text.split(' ')[1] || 'default';
    const weather = await fetchWeather(location);
    await ctx.reply(`Weather: ${weather}`);
    return; // Block built-in handlers
  }
  
  await next();
}
```

### 3. Response Modification

Wrap or modify built-in responses:

```javascript
onText: async (ctx, next) => {
  // Before handler
  const startTime = Date.now();
  
  // Execute built-in handlers
  await next();
  
  // After handler
  const duration = Date.now() - startTime;
  console.log(`Processed in ${duration}ms`);
}
```

### 4. Custom Inline Keyboards

Add interactive buttons:

```javascript
import { InlineKeyboard } from 'grammy';

onCommand: async (ctx, next) => {
  if (ctx.message?.text === '/menu') {
    const keyboard = new InlineKeyboard()
      .text('Option 1', 'plugin:opt1')
      .text('Option 2', 'plugin:opt2');
    
    await ctx.reply('Choose an option:', {
      reply_markup: keyboard
    });
    return;
  }
  
  await next();
}
```

### 5. State Management

Plugins can maintain their own state:

```javascript
const userSessions = new Map();

export default {
  name: 'session-plugin',
  
  handlers: {
    onText: async (ctx, next) => {
      const userId = ctx.from?.id;
      
      if (!userSessions.has(userId)) {
        userSessions.set(userId, {
          messageCount: 0,
          firstSeen: Date.now()
        });
      }
      
      const session = userSessions.get(userId);
      session.messageCount++;
      
      if (ctx.message?.text === '/stats') {
        await ctx.reply(
          `Messages: ${session.messageCount}\n` +
          `First seen: ${new Date(session.firstSeen).toLocaleString()}`
        );
        return;
      }
      
      await next();
    }
  }
};
```

## Implementation Architecture

### Core Components

```
┌─────────────────────────────────────────┐
│         cli.js / bot-worker.ts          │
│  - Detect plugin.js                     │
│  - Import plugin module                 │
│  - Pass to PluginManager                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│          PluginManager                   │
│  - Validate plugin structure             │
│  - Call initialize()                     │
│  - Register middleware handlers          │
│  - Manage plugin lifecycle               │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│       Grammy Bot Instance                │
│  - Plugin middleware (first)             │
│  - Built-in handlers (after)             │
└─────────────────────────────────────────┘
```

### New Files to Create

#### 1. `/src/services/plugin-manager.service.ts`

```typescript
import { Bot, Context, NextFunction } from 'grammy';
import * as path from 'path';
import * as fs from 'fs';

interface Plugin {
  name: string;
  version: string;
  initialize?: (context: PluginInitContext) => void | Promise<void>;
  handlers?: PluginHandlers;
}

interface PluginInitContext {
  botId: string;
  api: any;
  services?: any;
}

interface PluginHandlers {
  onText?: PluginHandler;
  onMessage?: PluginHandler;
  onCommand?: PluginHandler;
  onPhoto?: PluginHandler;
  onVideo?: PluginHandler;
  onAudio?: PluginHandler;
  onCallbackQuery?: PluginHandler;
}

type PluginHandler = (ctx: Context, next: NextFunction) => Promise<void>;

export class PluginManager {
  private plugin: Plugin | null = null;
  private botId: string;

  constructor(botId: string) {
    this.botId = botId;
  }

  async loadPlugin(): Promise<boolean> {
    const pluginPath = path.join(process.cwd(), 'plugin.js');
    
    if (!fs.existsSync(pluginPath)) {
      console.log(`[${this.botId}] No plugin.js found, skipping plugin system`);
      return false;
    }

    try {
      const module = await import(`file://${pluginPath}`);
      this.plugin = module.default;
      
      if (!this.validatePlugin(this.plugin)) {
        console.error(`[${this.botId}] Invalid plugin structure`);
        return false;
      }

      console.log(`[${this.botId}] ✅ Loaded plugin: ${this.plugin.name} v${this.plugin.version}`);
      return true;
    } catch (error) {
      console.error(`[${this.botId}] Failed to load plugin:`, error);
      return false;
    }
  }

  private validatePlugin(plugin: any): boolean {
    if (!plugin || typeof plugin !== 'object') return false;
    if (!plugin.name || typeof plugin.name !== 'string') return false;
    if (!plugin.version || typeof plugin.version !== 'string') return false;
    return true;
  }

  async initialize(context: PluginInitContext): Promise<void> {
    if (!this.plugin) return;

    if (this.plugin.initialize) {
      try {
        await this.plugin.initialize(context);
        console.log(`[${this.botId}] Plugin initialized`);
      } catch (error) {
        console.error(`[${this.botId}] Plugin initialization error:`, error);
      }
    }
  }

  registerHandlers(bot: Bot): void {
    if (!this.plugin?.handlers) return;

    const handlers = this.plugin.handlers;

    // Register handlers with priority (before built-in handlers)
    if (handlers.onText) {
      bot.on('message:text', async (ctx, next) => {
        await handlers.onText!(ctx, next);
      });
    }

    if (handlers.onMessage) {
      bot.on('message', async (ctx, next) => {
        await handlers.onMessage!(ctx, next);
      });
    }

    if (handlers.onCommand) {
      bot.on('message:text', async (ctx, next) => {
        if (ctx.message?.text?.startsWith('/')) {
          await handlers.onCommand!(ctx, next);
        } else {
          await next();
        }
      });
    }

    if (handlers.onPhoto) {
      bot.on('message:photo', async (ctx, next) => {
        await handlers.onPhoto!(ctx, next);
      });
    }

    if (handlers.onVideo) {
      bot.on('message:video', async (ctx, next) => {
        await handlers.onVideo!(ctx, next);
      });
    }

    if (handlers.onAudio) {
      bot.on('message:audio', async (ctx, next) => {
        await handlers.onAudio!(ctx, next);
      });
    }

    if (handlers.onCallbackQuery) {
      bot.on('callback_query', async (ctx, next) => {
        await handlers.onCallbackQuery!(ctx, next);
      });
    }

    console.log(`[${this.botId}] Plugin handlers registered`);
  }

  hasPlugin(): boolean {
    return this.plugin !== null;
  }
}
```

#### 2. `/src/types/plugin.types.ts`

```typescript
import { Context, NextFunction } from 'grammy';

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  initialize?: (context: PluginInitContext) => void | Promise<void>;
  handlers?: PluginHandlers;
  shutdown?: () => void | Promise<void>;
}

export interface PluginInitContext {
  botId: string;
  api: any;
  configService?: any;
  services?: {
    xtermService?: any;
    coderService?: any;
    [key: string]: any;
  };
}

export interface PluginHandlers {
  onText?: PluginHandler;
  onMessage?: PluginHandler;
  onCommand?: PluginHandler;
  onPhoto?: PluginHandler;
  onVideo?: PluginHandler;
  onAudio?: PluginHandler;
  onVoice?: PluginHandler;
  onDocument?: PluginHandler;
  onCallbackQuery?: PluginHandler;
}

export type PluginHandler = (ctx: Context, next: NextFunction) => Promise<void>;
```

### Modifications to Existing Files

#### In `bot-worker.ts`:

```typescript
// Add near top with other imports
import { PluginManager } from './services/plugin-manager.service.js';

// After creating bot instance and before registering handlers
async function startWorker() {
  // ... existing code ...
  
  // Initialize plugin system (CoderBot only)
  const pluginManager = new PluginManager(botId);
  const hasPlugin = await pluginManager.loadPlugin();
  
  if (hasPlugin) {
    await pluginManager.initialize({
      botId,
      api: bot.api,
      configService: services.configService,
      services: {
        xtermService: services.xtermService,
        coderService: services.coderService,
        xtermRendererService: services.xtermRendererService
      }
    });
    
    // Register plugin handlers BEFORE built-in handlers
    pluginManager.registerHandlers(bot);
  }
  
  // Register built-in handlers (existing code)
  coderBot.registerHandlers(bot);
  xtermBot.registerHandlers(bot);
  
  // ... rest of existing code ...
}
```

## Security Considerations

### 1. Access Control

Plugins must respect existing access control:

```javascript
// Plugin should check user permissions
onCommand: async (ctx, next) => {
  const userId = ctx.from?.id;
  
  // Built-in access control still applies
  // Plugin runs after AccessControlMiddleware
  
  await next();
}
```

### 2. Error Handling

Plugins should handle errors gracefully:

```javascript
export default {
  handlers: {
    onText: async (ctx, next) => {
      try {
        // Plugin logic
        await riskyOperation();
      } catch (error) {
        console.error('[Plugin] Error:', error);
        // Don't crash the bot
      }
      
      await next(); // Always call next
    }
  }
};
```

### 3. Resource Cleanup

Plugins should clean up resources:

```javascript
export default {
  name: 'resource-plugin',
  
  initialize(context) {
    this.interval = setInterval(() => {
      // Periodic task
    }, 60000);
  },
  
  shutdown() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
};
```

## Use Cases & Examples

### Example 1: Message Logger

```javascript
// plugin.js
export default {
  name: 'message-logger',
  version: '1.0.0',
  
  handlers: {
    onMessage: async (ctx, next) => {
      const from = ctx.from?.username || ctx.from?.id;
      const type = ctx.message?.text ? 'text' : 
                   ctx.message?.photo ? 'photo' : 'other';
      
      console.log(`[Log] ${from} sent ${type} message`);
      
      await next();
    }
  }
};
```

### Example 2: Custom Command

```javascript
// plugin.js
export default {
  name: 'greeting-plugin',
  version: '1.0.0',
  
  handlers: {
    onCommand: async (ctx, next) => {
      const text = ctx.message?.text;
      
      if (text === '/greet') {
        const name = ctx.from?.first_name || 'friend';
        await ctx.reply(`Hello, ${name}! 👋`);
        return; // Don't call next()
      }
      
      await next();
    }
  }
};
```

### Example 3: Analytics Tracker

```javascript
// plugin.js
const stats = {
  messageCount: 0,
  commandCount: 0,
  photoCount: 0
};

export default {
  name: 'analytics-plugin',
  version: '1.0.0',
  
  handlers: {
    onMessage: async (ctx, next) => {
      stats.messageCount++;
      await next();
    },
    
    onCommand: async (ctx, next) => {
      stats.commandCount++;
      
      if (ctx.message?.text === '/stats') {
        await ctx.reply(
          `📊 Statistics:\n` +
          `Messages: ${stats.messageCount}\n` +
          `Commands: ${stats.commandCount}\n` +
          `Photos: ${stats.photoCount}`
        );
        return;
      }
      
      await next();
    },
    
    onPhoto: async (ctx, next) => {
      stats.photoCount++;
      await next();
    }
  }
};
```

### Example 4: Rate Limiter

```javascript
// plugin.js
const userLimits = new Map();
const RATE_LIMIT = 10; // messages per minute
const WINDOW = 60000; // 1 minute

export default {
  name: 'rate-limiter',
  version: '1.0.0',
  
  handlers: {
    onMessage: async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) {
        await next();
        return;
      }
      
      const now = Date.now();
      const userData = userLimits.get(userId) || { count: 0, window: now };
      
      // Reset window if expired
      if (now - userData.window > WINDOW) {
        userData.count = 0;
        userData.window = now;
      }
      
      userData.count++;
      userLimits.set(userId, userData);
      
      // Check limit
      if (userData.count > RATE_LIMIT) {
        await ctx.reply('⚠️ Rate limit exceeded. Please wait a moment.');
        return; // Block message
      }
      
      await next();
    }
  }
};
```

### Example 5: Message Transformer

```javascript
// plugin.js
export default {
  name: 'transformer-plugin',
  version: '1.0.0',
  
  handlers: {
    onText: async (ctx, next) => {
      const text = ctx.message?.text;
      
      // Transform text before AI sees it
      if (text && text.startsWith('!translate ')) {
        const content = text.substring(11);
        // Modify the message text
        ctx.message.text = `Please translate this to English: ${content}`;
      }
      
      await next();
    }
  }
};
```

## Testing & Development

### Local Testing

1. Create `plugin.js` in your project directory:
```bash
cd /path/to/your/bot
nano plugin.js
```

2. Add test plugin:
```javascript
export default {
  name: 'test-plugin',
  version: '0.0.1',
  
  initialize(context) {
    console.log('Test plugin loaded for', context.botId);
  },
  
  handlers: {
    onCommand: async (ctx, next) => {
      if (ctx.message?.text === '/test') {
        await ctx.reply('Plugin is working! ✅');
        return;
      }
      await next();
    }
  }
};
```

3. Run CoderBOT:
```bash
npx coderbot
```

4. Test the `/test` command in Telegram

### Plugin Template

```javascript
/**
 * CoderBOT Plugin Template
 * 
 * Copy this template to create your own plugin
 */

export default {
  // Required: Plugin identification
  name: 'my-awesome-plugin',
  version: '1.0.0',
  description: 'Does something awesome',
  author: 'Your Name',
  
  // Optional: Initialize plugin
  initialize(context) {
    // context.botId - Bot identifier
    // context.api - Telegram Bot API
    // context.services - Access to bot services
    
    console.log(`${this.name} initialized`);
  },
  
  // Optional: Handle messages
  handlers: {
    // Handle text messages
    onText: async (ctx, next) => {
      // Your logic here
      await next(); // Call to continue to built-in handlers
    },
    
    // Handle any message
    onMessage: async (ctx, next) => {
      await next();
    },
    
    // Handle commands
    onCommand: async (ctx, next) => {
      const command = ctx.message?.text?.split(' ')[0];
      
      // Handle your custom commands
      if (command === '/yourcommand') {
        await ctx.reply('Your response');
        return; // Don't call next() to block built-in handlers
      }
      
      await next();
    },
    
    // Handle photos
    onPhoto: async (ctx, next) => {
      await next();
    },
    
    // Handle callback queries (inline buttons)
    onCallbackQuery: async (ctx, next) => {
      await next();
    }
  },
  
  // Optional: Cleanup when bot shuts down
  shutdown() {
    console.log(`${this.name} shutting down`);
  }
};
```

## Limitations

1. **Single Plugin File**: Only one `plugin.js` per bot instance
2. **No Hot Reload**: Changes require bot restart
3. **CoderBot Only**: Plugins don't affect ControlBOT
4. **No npm Dependencies**: Plugin must be self-contained or use global modules
5. **Access Control**: Plugins run after access control middleware
6. **Error Isolation**: Plugin errors should not crash the bot

## Future Enhancements

1. **Multiple Plugins**: Support loading multiple plugins from a directory
2. **Plugin Registry**: Central repository of community plugins
3. **Hot Reload**: Reload plugins without restarting bot
4. **Plugin Configuration**: Per-plugin config files
5. **Plugin Dependencies**: Allow plugins to depend on npm packages
6. **Plugin Marketplace**: Browse and install plugins via command
7. **Plugin Sandboxing**: Isolate plugins for better security
8. **Event System**: Publish/subscribe events between plugins

## Migration Path

For users with existing custom coders:

1. Custom coders continue to work as-is
2. Plugin system is additive, not replacement
3. Plugins and custom coders can coexist
4. Future: Consider migrating custom coders to plugin format

## Documentation for End Users

### Quick Start

1. Create `plugin.js` in the directory where you run CoderBOT
2. Export a plugin object with handlers
3. Run `npx coderbot`
4. Plugin loads automatically

### Example: Add a Custom Command

```javascript
// plugin.js
export default {
  name: 'my-plugin',
  version: '1.0.0',
  
  handlers: {
    onCommand: async (ctx, next) => {
      if (ctx.message?.text === '/hello') {
        await ctx.reply('Hello from my plugin!');
        return;
      }
      await next();
    }
  }
};
```

Run the bot and use `/hello` in Telegram!

## Conclusion

This plugin system provides a powerful, flexible way for users to extend CoderBOT without modifying core code. The middleware-based approach using Grammy's `next()` function ensures plugins can intercept, modify, or replace default behavior while maintaining backward compatibility.

The system is designed to be:
- **Simple**: Single file, standard JavaScript
- **Powerful**: Full API access, middleware control
- **Safe**: Error isolation, access control respected
- **Extensible**: Easy to add new handler types

This enables a rich ecosystem of community-contributed plugins while keeping the core CoderBOT codebase clean and maintainable.
