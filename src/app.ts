import { fork, ChildProcess } from 'child_process';
import { ConfigService } from './services/config.service.js';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Parent] Starting CoderBot parent process...');

dotenv.config();

// Initialize global config service
const globalConfig = new ConfigService();

try {
    globalConfig.validate();
    console.log('[Parent] Configuration loaded successfully');
    console.log(globalConfig.getDebugInfo());
} catch (error) {
    console.error('[Parent] Configuration error:', error);
    process.exit(1);
}

interface BotWorker {
    process: ChildProcess;
    botIndex: string;
    token: string;
    ready: boolean;
}

const botWorkers: BotWorker[] = [];

// Get bot tokens from config
const botTokens = globalConfig.getTelegramBotTokens();

console.log(`[Parent] Found ${botTokens.length} bot token(s)`);

/**
 * Spawn a bot worker process
 */
function spawnBotWorker(token: string, index: number): BotWorker {
    const botIndex = index.toString();
    const workerPath = path.join(__dirname, 'bot-worker.js');

    console.log(`[Parent] Spawning bot worker ${botIndex}...`);

    const childProcess = fork(workerPath, [], {
        env: {
            ...process.env,
            BOT_TOKEN: token,
            BOT_INDEX: botIndex,
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    const worker: BotWorker = {
        process: childProcess,
        botIndex,
        token,
        ready: false,
    };

    // Handle messages from child
    childProcess.on('message', (message: any) => {
        if (message.type === 'READY') {
            worker.ready = true;
            console.log(`[Parent] Bot worker ${botIndex} is ready`);
        }
    });

    // Handle child exit
    childProcess.on('exit', (code, signal) => {
        console.log(`[Parent] Bot worker ${botIndex} exited with code ${code}, signal ${signal}`);

        // Auto-restart on unexpected exit (not during shutdown)
        if (!shuttingDown && code !== 0) {
            console.log(`[Parent] Restarting bot worker ${botIndex} in 5 seconds...`);
            setTimeout(() => {
                const newWorker = spawnBotWorker(token, index);
                const workerIndex = botWorkers.findIndex(w => w.botIndex === botIndex);
                if (workerIndex !== -1) {
                    botWorkers[workerIndex] = newWorker;
                }
            }, 5000);
        }
    });

    // Handle child errors
    childProcess.on('error', (error) => {
        console.error(`[Parent] Bot worker ${botIndex} error:`, error);
    });

    return worker;
}

/**
 * Start all bot workers
 */
async function startBotWorkers() {
    try {
        // Spawn a worker for each bot token
        for (let i = 0; i < botTokens.length; i++) {
            const worker = spawnBotWorker(botTokens[i], i);
            botWorkers.push(worker);

            // Add small delay between spawns to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`[Parent] ✅ All ${botWorkers.length} bot worker(s) spawned`);
    } catch (error) {
        console.error('[Parent] Failed to start bot workers:', error);
        process.exit(1);
    }
}

let shuttingDown = false;

/**
 * Graceful shutdown handler for cleanup on process termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        console.log('[Parent] Shutdown already in progress...');
        return;
    }

    shuttingDown = true;
    console.log(`[Parent] Received ${signal}, shutting down gracefully...`);

    // Send SIGTERM to all child processes
    const shutdownPromises = botWorkers.map((worker) => {
        return new Promise<void>((resolve) => {
            if (worker.process.killed) {
                resolve();
                return;
            }

            console.log(`[Parent] Sending shutdown signal to bot worker ${worker.botIndex}`);

            // Set timeout for forced kill
            const timeout = setTimeout(() => {
                console.log(`[Parent] Force killing bot worker ${worker.botIndex}`);
                worker.process.kill('SIGKILL');
                resolve();
            }, 10000); // 10 second timeout

            worker.process.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });

            worker.process.kill('SIGTERM');
        });
    });

    await Promise.all(shutdownPromises);
    console.log('[Parent] ✅ All bot workers stopped');
    process.exit(0);
}

// Handle graceful shutdown for both SIGINT and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Parent] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[Parent] Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start all bot workers
startBotWorkers().then(() => {
    console.log(`[Parent] ✅ CoderBot parent process ready with ${botWorkers.length} worker(s)`);
}).catch(console.error);
