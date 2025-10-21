import { Bot, InputFile } from 'grammy';
import { ConfigService } from '../../services/config.service.js';
import * as fs from 'fs';
import * as path from 'path';

export class MediaWatcherService {
    private bots: Bot[] = [];
    private configService: ConfigService;
    private watchPath: string;
    private sentPath: string;
    private receivedPath: string;
    private watcher: fs.FSWatcher | null = null;
    private allowedUserIds: number[] = [];
    private processingFiles: Set<string> = new Set();

    constructor(configService: ConfigService) {
        this.configService = configService;
        this.watchPath = configService.getMediaTmpLocation();
        this.sentPath = path.join(this.watchPath, 'sent');
        this.receivedPath = path.join(this.watchPath, 'received');
    }

    async initialize(bots: Bot[]): Promise<void> {
        this.bots = bots;

        // Load allowed user IDs from config service
        this.allowedUserIds = this.configService.getAllowedUserIds();

        console.log(`Media watcher configured for ${this.allowedUserIds.length} user(s): ${this.allowedUserIds.join(', ')}`);

        await this.ensureDirectories();
        this.startWatching();
        console.log(`Media watcher initialized: ${this.watchPath}`);
    }

    private async ensureDirectories(): Promise<void> {
        try {
            if (!fs.existsSync(this.watchPath)) {
                fs.mkdirSync(this.watchPath, { recursive: true });
                console.log(`Created media directory: ${this.watchPath}`);
            }

            if (!fs.existsSync(this.sentPath)) {
                fs.mkdirSync(this.sentPath, { recursive: true });
                console.log(`Created sent directory: ${this.sentPath}`);
            }

            if (!fs.existsSync(this.receivedPath)) {
                fs.mkdirSync(this.receivedPath, { recursive: true });
                console.log(`Created received directory: ${this.receivedPath}`);
            }
        } catch (error) {
            console.error('Failed to create media directories:', error);
            throw error;
        }
    }

    private startWatching(): void {
        this.watcher = fs.watch(this.watchPath, async (eventType, filename) => {
            if (!filename || eventType !== 'rename') return;

            const filePath = path.join(this.watchPath, filename);

            if (this.processingFiles.has(filePath)) return;

            if (filename === 'sent' || filename === 'received' || filename.startsWith('.')) return;

            try {
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    this.processingFiles.add(filePath);

                    await new Promise(resolve => setTimeout(resolve, 100));

                    await this.processFile(filePath, filename);
                }
            } catch (error) {
                console.error(`Error processing file ${filename}:`, error);
                this.processingFiles.delete(filePath);
            }
        });
    }

    private async processFile(filePath: string, filename: string): Promise<void> {
        if (this.bots.length === 0) {
            console.error('No bots initialized');
            this.processingFiles.delete(filePath);
            return;
        }

        try {
            if (!fs.existsSync(filePath)) {
                console.log(`File no longer exists: ${filename}`);
                this.processingFiles.delete(filePath);
                return;
            }

            console.log(`Processing media file: ${filename}`);
            console.log(`Allowed user IDs: ${this.allowedUserIds.join(', ')}`);

            const ext = path.extname(filename).toLowerCase();

            // Try to send to each user via all bot instances (one will succeed per user)
            for (const userId of this.allowedUserIds) {
                let sent = false;
                for (const bot of this.bots) {
                    try {
                        // Create a new InputFile for each attempt to avoid reuse issues
                        const inputFile = new InputFile(filePath);

                        if (this.isImageFile(ext)) {
                            await bot.api.sendPhoto(userId, inputFile, {
                                caption: filename
                            });
                        } else if (this.isAnimationFile(ext)) {
                            await bot.api.sendAnimation(userId, inputFile, {
                                caption: filename
                            });
                        } else if (this.isVideoFile(ext)) {
                            await bot.api.sendVideo(userId, inputFile, {
                                caption: filename
                            });
                        } else if (this.isAudioFile(ext)) {
                            await bot.api.sendAudio(userId, inputFile, {
                                caption: filename
                            });
                        } else if (this.isVoiceFile(ext)) {
                            await bot.api.sendVoice(userId, inputFile, {
                                caption: filename
                            });
                        } else if (this.isWebPFile(ext)) {
                            // Send WebP as document to preserve format (could be static or animated)
                            await bot.api.sendDocument(userId, inputFile, {
                                caption: filename
                            });
                        } else {
                            // All other file types sent as documents (no size/type restrictions)
                            await bot.api.sendDocument(userId, inputFile, {
                                caption: filename
                            });
                        }

                        console.log(`✅ Successfully sent ${filename} to user ${userId}`);
                        sent = true;
                        break; // Successfully sent, no need to try other bots
                    } catch (error) {
                        // Try next bot instance
                    }
                }
                if (!sent) {
                    console.error(`❌ Failed to send ${filename} to user ${userId} via any bot`);
                }
            }

            await this.moveToSent(filePath, filename);
        } catch (error) {
            console.error(`Failed to process file ${filename}:`, error);
        } finally {
            this.processingFiles.delete(filePath);
        }
    }

    private isImageFile(ext: string): boolean {
        // Photos only - GIF, WebP, and MP4 are handled separately as animations
        return ['.jpg', '.jpeg', '.png', '.bmp'].includes(ext);
    }

    private isAnimationFile(ext: string): boolean {
        // Animated GIFs and MP4 videos without sound
        return ['.gif', '.mp4'].includes(ext);
    }

    private isVideoFile(ext: string): boolean {
        // Video files with sound
        return ['.avi', '.mov', '.mkv', '.webm', '.flv'].includes(ext);
    }

    private isAudioFile(ext: string): boolean {
        // Music files (displayed in music player)
        return ['.mp3', '.m4a', '.flac', '.aac'].includes(ext);
    }

    private isVoiceFile(ext: string): boolean {
        // Voice messages (displayed as playable voice notes)
        return ['.ogg', '.oga', '.opus', '.wav'].includes(ext);
    }

    private isWebPFile(ext: string): boolean {
        // WebP can be static image or animated, send as document to preserve format
        return ext === '.webp';
    }

    private async moveToSent(filePath: string, filename: string): Promise<void> {
        try {
            const sentFilePath = path.join(this.sentPath, filename);

            if (fs.existsSync(sentFilePath)) {
                const timestamp = Date.now();
                const ext = path.extname(filename);
                const nameWithoutExt = path.basename(filename, ext);
                const newFilename = `${nameWithoutExt}_${timestamp}${ext}`;
                fs.renameSync(filePath, path.join(this.sentPath, newFilename));
                console.log(`Moved ${filename} to sent/${newFilename}`);
            } else {
                fs.renameSync(filePath, sentFilePath);
                console.log(`Moved ${filename} to sent/`);
            }
        } catch (error) {
            console.error(`Failed to move ${filename} to sent folder:`, error);
        }
    }

    cleanup(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('Media watcher stopped');
        }
    }
}

// Export a function to create the service with config
export function createMediaWatcherService(configService: ConfigService): MediaWatcherService {
    return new MediaWatcherService(configService);
}
