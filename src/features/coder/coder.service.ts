import { type CoderConfig } from './coder.types.js';
import { ConfigService } from '../../services/config.service.js';
import * as path from 'path';

export interface TerminalDataHandlers {
    onBell?: (userId: string, chatId: number) => void;
    onConfirmationPrompt?: (userId: string, chatId: number, data: string) => void;
}

export class CoderService {
    private config: CoderConfig;
    private dataBuffers: Map<string, string> = new Map();

    constructor(configService: ConfigService) {
        const mediaPath = configService.getMediaTmpLocation();
        this.config = {
            mediaPath,
            receivedPath: path.join(mediaPath, 'received'),
        };
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
        this.dataBuffers.delete(this.getBufferKey(userId, chatId));
    }

    clearAllBuffers(): void {
        this.dataBuffers.clear();
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
            // Append incoming data to buffer for this session
            const buffer = this.appendToBuffer(userId, chatId, data);

            // Check for BEL character (ASCII 0x07)
            if (data.includes('\x07') && handlers.onBell) {
                handlers.onBell(userId, chatId);
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
