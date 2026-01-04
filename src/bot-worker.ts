import { Bot } from "grammy";
import { XtermBot } from './features/xterm/xterm.bot.js';
import { CoderBot } from './features/coder/coder.bot.js';
import { AudioBot } from './features/audio/audio.bot.js';
import { AudioService } from './features/audio/audio.service.js';
import { ServiceContainerFactory } from './services/service-container.factory.js';
import { createMediaWatcherService } from './features/media/media-watcher.service.js';
import { AccessControlMiddleware } from './middleware/access-control.middleware.js';
import { ConfigService } from './services/config.service.js';
import { IPCMessage, IPCMessageType } from './types/ipc.types.js';
import { CommandMenuUtils } from './utils/command-menu.utils.js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

console.log('[Worker] Starting bot worker process...');

dotenv.config();

// Initialize config service first
const configService = new ConfigService();

// Get bot configuration from environment variables (set by ProcessManager)
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

// Declare audioBot at module level for cleanup access
let audioBot: AudioBot | null = null;

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
            services.configService,
            services.airplaneStateService
        );

        const coderBot = new CoderBot(
            botId,
            botToken,
            services.xtermService,
            services.xtermRendererService,
            services.coderService,
            services.configService,
            services.airplaneStateService
        );

        // Initialize audio bot if STT is configured
        if (configService.hasTtsApiKey()) {
            const audioService = new AudioService(configService);
            audioBot = new AudioBot(botId, audioService, configService);
            await audioBot.initialize(bot);
            console.log(`[Worker ${botId}] Audio transcription initialized (Provider: ${configService.detectTtsProvider()})`);
        } else {
            console.log(`[Worker ${botId}] Audio transcription disabled (no TTS_API_KEY configured)`);
        }

        // Register handlers - CoderBot first for general commands, then XtermBot for specific ones
        coderBot.registerHandlers(bot);
        xtermBot.registerHandlers(bot);

        // Set initial bot commands (before session)
        await CommandMenuUtils.setNoSessionCommands(bot);

        // Get bot info and send to parent BEFORE starting (so it's available immediately)
        try {
            const me = await bot.api.getMe();
            const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
            console.log(`[Worker ${botId}] Bot info: ${fullName} (@${me.username})`);
            
            if (process.send) {
                process.send({ 
                    type: IPCMessageType.BOT_INFO, 
                    botId,
                    data: {
                        fullName,
                        username: me.username
                    },
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error(`[Worker ${botId}] Failed to get bot info:`, error);
        }

        // Start the bot (this will block and keep running)
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
 * Handle IPC messages from parent process
 */
function handleIPCMessage(message: IPCMessage): void {
    switch (message.type) {
        case IPCMessageType.HEALTH_CHECK:
            sendHealthResponse();
            break;
        case IPCMessageType.SHUTDOWN:
            console.log(`[Worker ${botId}] Received shutdown command from parent`);
            gracefulShutdown('IPC_SHUTDOWN');
            break;
        default:
            console.log(`[Worker ${botId}] Received unknown IPC message:`, message.type);
    }
}

/**
 * Send health response to parent
 */
function sendHealthResponse(): void {
    if (process.send) {
        const response: IPCMessage = {
            type: IPCMessageType.HEALTH_RESPONSE,
            botId,
            data: {
                healthy: true,
                uptime: process.uptime() * 1000,
                memoryUsage: process.memoryUsage(),
            },
            timestamp: new Date(),
        };
        process.send(response);
    }
}

/**
 * Send status update to parent
 */
function sendStatusUpdate(status: string, data?: any): void {
    if (process.send) {
        const message: IPCMessage = {
            type: IPCMessageType.STATUS_UPDATE,
            botId,
            data: { status, ...data },
            timestamp: new Date(),
        };
        process.send(message);
    }
}

/**
 * Send log message to parent
 */
function sendLogMessage(message: string): void {
    if (process.send) {
        const ipcMessage: IPCMessage = {
            type: IPCMessageType.LOG_MESSAGE,
            botId,
            data: message,
            timestamp: new Date(),
        };
        process.send(ipcMessage);
    }
}

// Listen for IPC messages from parent
process.on('message', handleIPCMessage);

/**
 * Graceful shutdown handler for cleanup on process termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
    console.log(`[Worker ${botId}] Received ${signal}, shutting down gracefully...`);

    try {
        sendStatusUpdate('stopping');

        // Cleanup audio bot if initialized
        if (audioBot) {
            await audioBot.cleanup();
        }

        // Cleanup media watcher
        mediaWatcherService.cleanup();

        // Cleanup services
        await services.cleanup();

        // Stop bot
        await bot.stop();

        console.log(`[Worker ${botId}] ✅ Shutdown complete`);
        sendStatusUpdate('stopped');
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
