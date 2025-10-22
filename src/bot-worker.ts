import { Bot } from "grammy";
import { XtermBot } from './features/xterm/xterm.bot.js';
import { CoderBot } from './features/coder/coder.bot.js';
import { ServiceContainerFactory } from './services/service-container.factory.js';
import { createMediaWatcherService } from './features/media/media-watcher.service.js';
import { AccessControlMiddleware } from './middleware/access-control.middleware.js';
import { ConfigService } from './services/config.service.js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

console.log('[Worker] Starting bot worker process...');

dotenv.config();

// Get bot configuration from environment variables
const botToken = process.env.BOT_TOKEN;
const botIndex = process.env.BOT_INDEX;

if (!botToken) {
    console.error('[Worker] BOT_TOKEN environment variable is required');
    process.exit(1);
}

if (!botIndex) {
    console.error('[Worker] BOT_INDEX environment variable is required');
    process.exit(1);
}

const botId = `bot-${botIndex}`;
console.log(`[Worker ${botId}] Initializing with token: ${botToken.substring(0, 10)}...`);

// Initialize config service
const configService = new ConfigService();

try {
    configService.validate();
    console.log(`[Worker ${botId}] Configuration loaded successfully`);
} catch (error) {
    console.error(`[Worker ${botId}] Configuration error:`, error);
    process.exit(1);
}

// Create bot instance
const bot = new Bot(botToken);

// Set global error handler to prevent crashes
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Worker ${botId}] Error while handling update ${ctx.update.update_id}:`, err.error);
});

// Create per-bot services
const services = ServiceContainerFactory.create(botId);

// Initialize media watcher with bot-specific directory
const mediaWatcherService = createMediaWatcherService(configService, botId);

async function startWorker() {
    try {
        console.log(`[Worker ${botId}] Starting initialization...`);

        // Clean up media directory if configured
        if (configService.shouldCleanUpMediaDir()) {
            const botMediaPath = path.join(configService.getMediaTmpLocation(), botId);
            if (fs.existsSync(botMediaPath)) {
                console.log(`[Worker ${botId}] Cleaning up media directory: ${botMediaPath}`);
                fs.rmSync(botMediaPath, { recursive: true, force: true });
                console.log(`[Worker ${botId}] ✅ Media directory cleaned`);
            }
        }

        // Set config service for access control
        AccessControlMiddleware.setConfigService(configService);

        // Initialize media watcher with this bot only
        await mediaWatcherService.initialize(bot);
        console.log(`[Worker ${botId}] Media watcher initialized`);

        // Initialize bot handlers
        const xtermBot = new XtermBot(
            botId,
            services.xtermService,
            services.xtermRendererService,
            services.configService
        );

        const coderBot = new CoderBot(
            botId,
            botToken,
            services.xtermService,
            services.xtermRendererService,
            services.coderService,
            services.configService
        );

        // Register handlers - CoderBot first for general commands, then XtermBot for specific ones
        coderBot.registerHandlers(bot);
        xtermBot.registerHandlers(bot);

        // Set bot commands
        await bot.api.setMyCommands([
            { command: 'screen', description: 'Capture and view terminal screenshot' },
            { command: 'help', description: 'Show complete command reference' },
            { command: 'tab', description: 'Send Tab character' },
            { command: 'copilot', description: 'Start a new terminal session with Copilot' },
            { command: 'claude', description: 'Start a new terminal session with Claude' },
            { command: 'cursor', description: 'Start a new terminal session with Cursor' },
            { command: 'enter', description: 'Send Enter key' },
            { command: 'start', description: 'Show help message with all commands' },
            { command: 'close', description: 'Close the current terminal session' },
        ]);

        // Start the bot
        await bot.start();
        console.log(`[Worker ${botId}] ✅ Bot started successfully`);

        // Notify parent that worker is ready
        if (process.send) {
            process.send({ type: 'READY', botId });
        }
    } catch (error) {
        console.error(`[Worker ${botId}] Failed to start:`, error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown handler for cleanup on process termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
    console.log(`[Worker ${botId}] Received ${signal}, shutting down gracefully...`);

    try {
        // Cleanup media watcher
        mediaWatcherService.cleanup();

        // Cleanup services
        await services.cleanup();

        // Stop bot
        await bot.stop();

        console.log(`[Worker ${botId}] ✅ Shutdown complete`);
        process.exit(0);
    } catch (error) {
        console.error(`[Worker ${botId}] Error during shutdown:`, error);
        process.exit(1);
    }
}

// Handle graceful shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(`[Worker ${botId}] Unhandled Rejection at:`, promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(`[Worker ${botId}] Uncaught Exception:`, error);
    process.exit(1);
});

// Start the worker
startWorker().catch((error) => {
    console.error(`[Worker ${botId}] Fatal error:`, error);
    process.exit(1);
});
