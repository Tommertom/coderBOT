import { type CoderConfig } from './coder.types.js';
import { ConfigService } from '../../services/config.service.js';
import * as path from 'path';
import * as fs from 'fs';

export interface TerminalDataHandlers {
    onBell?: (userId: string, chatId: number) => void;
    onConfirmationPrompt?: (userId: string, chatId: number, data: string) => void;
    onBoxDetected?: (userId: string, chatId: number, data: string) => void;
}

export class CoderService {
    private config: CoderConfig;
    private dataBuffers: Map<string, string> = new Map();
    private lastBoxDetection: Map<string, number> = new Map();
    private botId: string;
    private readonly BOX_DETECTION_DEBOUNCE_MS = 5000; // 5 seconds debounce
    private streamLogPath: string;

    constructor(configService: ConfigService, botId: string) {
        this.botId = botId;
        const baseMediaPath = configService.getMediaTmpLocation();
        const mediaPath = path.join(baseMediaPath, botId);
        this.config = {
            mediaPath,
            receivedPath: path.join(mediaPath, 'received'),
        };

        // Initialize stream.dat log file path
        this.streamLogPath = '/home/tom/stream.dat';

        // Clear the file on service initialization
        try {
            fs.writeFileSync(this.streamLogPath, '', 'utf-8');
            console.log(`[DEBUG] Stream log initialized at: ${this.streamLogPath}`);
        } catch (error) {
            console.error(`[ERROR] Failed to initialize stream log: ${error}`);
        }
    }

    private getBufferKey(userId: string, chatId: number): string {
        return `${userId}-${chatId}`;
    }

    private getBuffer(userId: string, chatId: number): string {
        return this.dataBuffers.get(this.getBufferKey(userId, chatId)) || '';
    }

    private appendToBuffer(userId: string, chatId: number, data: string): string {
        const key = this.getBufferKey(userId, chatId);
        const currentBuffer = this.getBuffer(userId, chatId);
        const newBuffer = (currentBuffer + data).slice(-500); // Keep last 500 chars
        this.dataBuffers.set(key, newBuffer);
        return newBuffer;
    }

    clearBuffer(userId: string, chatId: number): void {
        const key = this.getBufferKey(userId, chatId);
        this.dataBuffers.delete(key);
        this.lastBoxDetection.delete(key);
    }

    clearAllBuffers(): void {
        this.dataBuffers.clear();
        this.lastBoxDetection.clear();
    }

    getMediaPath(): string {
        return this.config.mediaPath;
    }

    getReceivedPath(): string {
        return this.config.receivedPath;
    }

    replaceMediaPlaceholder(text: string): string {
        return text.replace(/\[media\]/gi, this.config.mediaPath);
    }

    /**
     * Creates a terminal data handler that detects specific patterns in terminal output
     * and triggers appropriate callbacks. Uses buffering to handle patterns split across chunks.
     */
    createTerminalDataHandler(handlers: TerminalDataHandlers): (userId: string, chatId: number, data: string) => void {
        return (userId: string, chatId: number, data: string) => {

            console.log('Handling data', userId, chatId)
            // Log all received data to stream.dat for debugging
            try {
                const timestamp = new Date().toISOString();
                const dataType = typeof data;
                const dataLength = data.length;
                const hexDump = Buffer.from(data, 'utf-8').toString('hex').match(/.{1,2}/g)?.join(' ') || '';
                const logEntry = `\n=== ${timestamp} ===\n` +
                    `Type: ${dataType}\n` +
                    `Length: ${dataLength}\n` +
                    `Raw: ${JSON.stringify(data)}\n` +
                    `Display: ${data}\n`;

                fs.appendFileSync(this.streamLogPath, logEntry, 'utf-8');
            } catch (error) {
                console.error(`[ERROR] Failed to write to stream log: ${error}`);
            }

            // Append incoming data to buffer for this session
            const buffer = this.appendToBuffer(userId, chatId, data);
            const sessionKey = this.getBufferKey(userId, chatId);

            // Check for BEL character (ASCII 0x07)
            if (data.includes('\x07') && handlers.onBell) {
                handlers.onBell(userId, chatId);
            }

            // Box detection - check buffer (not just current data chunk) for box drawing characters
            // Common box patterns: ╭─, ┌─, ┏━, ╔═
            const boxPatterns = ['╭─', '┌─', '┏━', '╔═', '╭'];
            const hasBoxPattern = boxPatterns.some(pattern => data.includes(pattern));

            if (hasBoxPattern && handlers.onBoxDetected) {
                // Debounce: only trigger if enough time has passed since last detection
                const now = Date.now();
                const lastDetection = this.lastBoxDetection.get(sessionKey) || 0;

                if (now - lastDetection > this.BOX_DETECTION_DEBOUNCE_MS) {
                    console.log('[DEBUG] Box pattern detected in buffer:', buffer.substring(Math.max(0, buffer.length - 100)));
                    this.lastBoxDetection.set(sessionKey, now);
                    handlers.onBoxDetected(userId, chatId, buffer);
                }
            }

            // Check for Copilot confirmation prompts in the buffered data
            if (buffer.includes('1. Yes') && handlers.onConfirmationPrompt) {
                setTimeout(() => {
                    handlers.onConfirmationPrompt(userId, chatId, buffer);
                }, 3000);
            }
        };
    }
}
