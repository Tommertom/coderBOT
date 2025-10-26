import { type CoderConfig } from './coder.types.js';
import { ConfigService } from '../../services/config.service.js';
import { UrlExtractionUtils } from '../../utils/url-extraction.utils.js';
import * as path from 'path';
import * as fs from 'fs';

export interface TerminalDataHandlers {
    onBell?: (userId: string, chatId: number) => void;
    onConfirmationPrompt?: (userId: string, chatId: number, data: string) => void;
    onUrlDiscovered?: (userId: string, chatId: number, url: string) => void;
}

export class CoderService {
    private config: CoderConfig;
    private dataBuffers: Map<string, string> = new Map();
    private botId: string;
    private getFullBufferCallback?: (userId: string) => string[];

    // URL tracking
    private discoveredUrls: Map<string, Set<string>> = new Map();
    private notifiedUrls: Map<string, Set<string>> = new Map();
    private urlNotificationTimeouts: Map<string, Map<number, NodeJS.Timeout>> = new Map();

    constructor(configService: ConfigService, botId: string) {
        this.botId = botId;
        const baseMediaPath = configService.getMediaTmpLocation();
        const mediaPath = path.join(baseMediaPath, botId);
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
        const key = this.getBufferKey(userId, chatId);
        this.dataBuffers.delete(key);
    }

    clearAllBuffers(): void {
        this.dataBuffers.clear();
    }

    setBufferGetter(getFullBuffer: (userId: string) => string[]): void {
        this.getFullBufferCallback = getFullBuffer;
    }

    // URL Tracking Methods

    private getUserKey(userId: string): string {
        return userId;
    }

    getDiscoveredUrls(userId: string): string[] {
        const userKey = this.getUserKey(userId);
        const urls = this.discoveredUrls.get(userKey);
        return urls ? Array.from(urls) : [];
    }

    clearUrlsForUser(userId: string): void {
        const userKey = this.getUserKey(userId);
        this.discoveredUrls.delete(userKey);
        this.notifiedUrls.delete(userKey);

        // Clear all timeouts for this user
        const timeouts = this.urlNotificationTimeouts.get(userKey);
        if (timeouts) {
            timeouts.forEach(timeout => clearTimeout(timeout));
            this.urlNotificationTimeouts.delete(userKey);
        }
    }

    registerUrlNotificationTimeout(userId: string, messageId: number, timeout: NodeJS.Timeout): void {
        const userKey = this.getUserKey(userId);
        if (!this.urlNotificationTimeouts.has(userKey)) {
            this.urlNotificationTimeouts.set(userKey, new Map());
        }
        this.urlNotificationTimeouts.get(userKey)!.set(messageId, timeout);
    }

    clearUrlNotificationTimeout(userId: string, messageId: number): void {
        const userKey = this.getUserKey(userId);
        const timeouts = this.urlNotificationTimeouts.get(userKey);
        if (timeouts) {
            const timeout = timeouts.get(messageId);
            if (timeout) {
                clearTimeout(timeout);
                timeouts.delete(messageId);
            }
        }
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

            const coderWantsInteraction = data.includes('1. Y');
            if (coderWantsInteraction && handlers.onConfirmationPrompt) {
                console.log('YES detected')
                handlers.onConfirmationPrompt(userId, chatId, 'Select option');
            }

            // URL detection
            if (handlers.onUrlDiscovered) {
                const urls = UrlExtractionUtils.extractUrlsFromTerminalOutput(data);
                const userKey = this.getUserKey(userId);

                if (!this.discoveredUrls.has(userKey)) {
                    this.discoveredUrls.set(userKey, new Set());
                }
                if (!this.notifiedUrls.has(userKey)) {
                    this.notifiedUrls.set(userKey, new Set());
                }

                const discovered = this.discoveredUrls.get(userKey)!;
                const notified = this.notifiedUrls.get(userKey)!;

                urls.forEach(url => {
                    discovered.add(url);

                    // Notify only if not already notified
                    if (!notified.has(url)) {
                        notified.add(url);
                        handlers.onUrlDiscovered!(userId, chatId, url);
                    }
                });
            }
        };
    }
}
