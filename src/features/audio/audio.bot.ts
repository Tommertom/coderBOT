/**
 * Audio Bot Integration
 * 
 * Handles audio and voice messages from Telegram users and
 * transcribes them using the AudioService.
 */

import { Bot, Context } from 'grammy';
import { AudioService } from './audio.service.js';
import { ConfigService } from '../../services/config.service.js';
import { AudioPreferencesService, AudioTranscriptionMode } from '../../services/audio-preferences.service.js';
import { XtermService } from '../xterm/xterm.service.js';
import { AudioTranscriptionError, AudioErrorType, AudioProvider } from './audio.types.js';
import { Messages, AudioErrors, ErrorActions } from '../../constants/messages.js';
import { ErrorUtils } from '../../utils/error.utils.js';
import { MessageUtils } from '../../utils/message.utils.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export class AudioBot {
    private bot: Bot | null = null;
    private audioService: AudioService;
    private configService: ConfigService;
    private xtermService: XtermService;
    private audioPreferencesService: AudioPreferencesService;
    private botId: string;
    private audioTmpPath: string;

    constructor(
        botId: string,
        audioService: AudioService,
        configService: ConfigService,
        xtermService: XtermService,
        audioPreferencesService: AudioPreferencesService
    ) {
        this.botId = botId;
        this.audioService = audioService;
        this.configService = configService;
        this.xtermService = xtermService;
        this.audioPreferencesService = audioPreferencesService;

        // Create bot-specific audio temp directory
        const baseMediaPath = configService.getMediaTmpLocation();
        this.audioTmpPath = path.join(baseMediaPath, botId, 'audio');
    }

    async initialize(bot: Bot): Promise<void> {
        this.bot = bot;
        await this.ensureDirectories();
        this.registerHandlers();
        console.log(`[${this.botId}] Audio transcription bot initialized`);
    }

    private async ensureDirectories(): Promise<void> {
        try {
            if (!fs.existsSync(this.audioTmpPath)) {
                fs.mkdirSync(this.audioTmpPath, { recursive: true });
                console.log(`[${this.botId}] Created audio temp directory: ${this.audioTmpPath}`);
            }
        } catch (error) {
            console.error(`[${this.botId}] Failed to create audio temp directory:`, error);
            throw error;
        }
    }

    private registerHandlers(): void {
        if (!this.bot) return;

        // Handle voice messages
        this.bot.on('message:voice', async (ctx) => {
            await this.handleAudioMessage(ctx, 'voice');
        });

        // Handle audio files
        this.bot.on('message:audio', async (ctx) => {
            await this.handleAudioMessage(ctx, 'audio');
        });

        // Handle audio mode toggle command
        this.bot.command('audiomode', async (ctx) => {
            await this.handleAudioModeToggle(ctx);
        });
    }

    private async handleAudioMessage(ctx: Context, type: 'voice' | 'audio'): Promise<void> {
        try {
            // Check if STT is configured
            if (!this.configService.hasTtsApiKey()) {
                await ctx.reply(AudioErrors.NO_API_KEY_CONFIGURED);
                return;
            }

            const userId = ctx.from!.id.toString();

            // Send processing message
            const processingMsg = await ctx.reply(Messages.TRANSCRIBING_AUDIO);

            try {
                // Get file info
                const fileInfo = type === 'voice' ? ctx.message?.voice : ctx.message?.audio;
                if (!fileInfo) {
                    throw new Error('No audio file found in message');
                }

                // Download audio file
                const audioFilePath = await this.downloadAudioFile(ctx, fileInfo.file_id, type);

                // Transcribe audio
                const result = await this.audioService.transcribe(audioFilePath);

                // Clean up downloaded file
                this.cleanupFile(audioFilePath);

                // Delete processing message
                await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);

                // Get user's transcription mode preference
                const mode = this.audioPreferencesService.getTranscriptionMode(userId);

                if (mode === AudioTranscriptionMode.PROMPT) {
                    // Direct prompt mode: send transcribed text to terminal
                    await this.sendAsPrompt(ctx, result.text, userId);
                } else {
                    // Copy mode: send transcription result for copy-pasting
                    await this.sendTranscriptionResult(ctx, result.text, result.provider);
                }

            } catch (error) {
                // Delete processing message
                try {
                    await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
                } catch (e) {
                    // Ignore if message already deleted
                }

                // Handle specific error types
                if (error instanceof AudioTranscriptionError) {
                    await this.handleTranscriptionError(ctx, error);
                } else {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    await ctx.reply(
                        ErrorUtils.createErrorMessage(ErrorActions.TRANSCRIBE_AUDIO, errorMsg)
                    );
                }
            }

        } catch (error) {
            console.error(`[${this.botId}] Error handling audio message:`, error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            await ctx.reply(
                ErrorUtils.createErrorMessage(ErrorActions.TRANSCRIBE_AUDIO, errorMsg)
            );
        }
    }

    private async downloadAudioFile(
        ctx: Context,
        fileId: string,
        type: 'voice' | 'audio'
    ): Promise<string> {
        try {
            // Get file from Telegram
            const file = await ctx.api.getFile(fileId);

            if (!file.file_path) {
                throw new AudioTranscriptionError(
                    AudioErrorType.DOWNLOAD_FAILED,
                    'File path not available from Telegram'
                );
            }

            // Generate unique filename
            const timestamp = Date.now();
            const extension = this.getFileExtension(file.file_path, type);
            const filename = `${type}_${timestamp}${extension}`;
            const localPath = path.join(this.audioTmpPath, filename);

            // Sanitize path to prevent directory traversal
            const sanitizedPath = path.normalize(localPath);
            if (!sanitizedPath.startsWith(this.audioTmpPath)) {
                throw new AudioTranscriptionError(
                    AudioErrorType.FILE_ACCESS_ERROR,
                    'Invalid file path'
                );
            }

            // Download file from Telegram
            const botToken = this.bot!.token;
            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

            await this.downloadFile(fileUrl, sanitizedPath);

            return sanitizedPath;

        } catch (error) {
            if (error instanceof AudioTranscriptionError) {
                throw error;
            }
            throw new AudioTranscriptionError(
                AudioErrorType.DOWNLOAD_FAILED,
                `Failed to download audio: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private downloadFile(url: string, destination: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destination);

            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(destination);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (err) => {
                    file.close();
                    fs.unlinkSync(destination);
                    reject(err);
                });
            }).on('error', (err) => {
                file.close();
                fs.unlinkSync(destination);
                reject(err);
            });
        });
    }

    private getFileExtension(filePath: string, type: 'voice' | 'audio'): string {
        const ext = path.extname(filePath);
        if (ext) return ext;

        // Default extensions for voice messages
        return type === 'voice' ? '.ogg' : '.mp3';
    }

    private cleanupFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[${this.botId}] Cleaned up audio file: ${filePath}`);
            }
        } catch (error) {
            console.error(`[${this.botId}] Failed to clean up audio file:`, error);
        }
    }

    private async sendTranscriptionResult(
        ctx: Context,
        text: string,
        provider: AudioProvider
    ): Promise<void> {
        const message = `🎙️ Transcription:\n\`${text}\``;
        await ctx.reply(message, { parse_mode: 'Markdown' });
    }

    private async sendAsPrompt(ctx: Context, text: string, userId: string): Promise<void> {
        try {
            // Check if user has an active terminal session
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active terminal session. Start a session first with /copilot, /opencode, or /gemini.');
                return;
            }

            // Send transcribed text to terminal
            this.xtermService.writeRawToSession(userId, text);

            // Wait a moment then send enter
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.xtermService.writeRawToSession(userId, '\r');

            await ctx.reply(`✅ Transcribed text sent to terminal as prompt`);

        } catch (error) {
            console.error(`[${this.botId}] Error sending transcription as prompt:`, error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            await ctx.reply(
                ErrorUtils.createErrorMessage('send transcription to terminal', errorMsg)
            );
        }
    }

    private async handleAudioModeToggle(ctx: Context): Promise<void> {
        try {
            const userId = ctx.from!.id.toString();
            const newMode = this.audioPreferencesService.toggleTranscriptionMode(userId);

            const modeDescription = newMode === AudioTranscriptionMode.COPY
                ? '📋 *Copy Mode*: Transcribed text will be sent as a formatted message for you to copy and paste.'
                : '🚀 *Prompt Mode*: Transcribed text will be directly sent to your active terminal session as a prompt.';

            const message = await ctx.reply(
                `🎙️ Audio Transcription Mode Changed\n\n${modeDescription}\n\n_Use /audiomode again to toggle back._`,
                { parse_mode: 'Markdown' }
            );

            MessageUtils.scheduleMessageDeletion(ctx, message.message_id, this.configService);
        } catch (error) {
            console.error(`[${this.botId}] Error toggling audio mode:`, error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            await ctx.reply(
                ErrorUtils.createErrorMessage('toggle audio mode', errorMsg)
            );
        }
    }

    private async handleTranscriptionError(
        ctx: Context,
        error: AudioTranscriptionError
    ): Promise<void> {
        let errorMessage: string;

        switch (error.type) {
            case AudioErrorType.NO_API_KEY:
                errorMessage = AudioErrors.NO_API_KEY_CONFIGURED;
                break;
            case AudioErrorType.INVALID_API_KEY:
                errorMessage = AudioErrors.INVALID_API_KEY;
                break;
            case AudioErrorType.UNSUPPORTED_FORMAT:
                errorMessage = AudioErrors.UNSUPPORTED_FORMAT;
                break;
            case AudioErrorType.FILE_TOO_LARGE:
                errorMessage = AudioErrors.FILE_TOO_LARGE;
                break;
            case AudioErrorType.DOWNLOAD_FAILED:
                errorMessage = AudioErrors.DOWNLOAD_FAILED;
                break;
            case AudioErrorType.RATE_LIMIT:
                errorMessage = AudioErrors.RATE_LIMIT;
                break;
            case AudioErrorType.QUOTA_EXCEEDED:
                errorMessage = AudioErrors.QUOTA_EXCEEDED;
                break;
            case AudioErrorType.TRANSCRIPTION_FAILED:
                errorMessage = AudioErrors.TRANSCRIPTION_FAILED;
                break;
            default:
                errorMessage = ErrorUtils.createErrorMessage(ErrorActions.TRANSCRIBE_AUDIO, error.message);
        }

        await ctx.reply(errorMessage);
    }

    async cleanup(): Promise<void> {
        console.log(`[${this.botId}] Audio bot cleanup completed`);
    }
}
