/**
 * Audio Transcription Service
 * 
 * Handles speech-to-text transcription using Vercel AI SDK
 * with support for OpenAI Whisper and Google Gemini.
 */

import { experimental_transcribe as transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ConfigService } from '../../services/config.service.js';
import {
    AudioProvider,
    TranscriptionResponse,
    AudioErrorType,
    AudioTranscriptionError,
    SUPPORTED_AUDIO_FORMATS,
    MAX_AUDIO_FILE_SIZE
} from './audio.types.js';
import * as fs from 'fs';
import { readFile } from 'fs/promises';
import * as path from 'path';

export class AudioService {
    private configService: ConfigService;

    constructor(configService: ConfigService) {
        this.configService = configService;
    }

    /**
     * Main transcription method with automatic provider detection
     */
    async transcribe(audioFilePath: string): Promise<TranscriptionResponse> {
        // Check if API key is configured
        if (!this.configService.hasTtsApiKey()) {
            throw new AudioTranscriptionError(
                AudioErrorType.NO_API_KEY,
                'TTS_API_KEY is not configured'
            );
        }

        const apiKey = this.configService.getTtsApiKey()!;
        const provider = this.configService.detectTtsProvider();

        if (!provider) {
            throw new AudioTranscriptionError(
                AudioErrorType.INVALID_API_KEY,
                'Unable to detect TTS provider from API key format'
            );
        }

        // Validate audio file
        await this.validateAudioFile(audioFilePath);

        // Route to appropriate provider
        if (provider === 'openai') {
            return await this.transcribeWithOpenAI(audioFilePath, apiKey);
        } else {
            return await this.transcribeWithGemini(audioFilePath, apiKey);
        }
    }

    /**
     * Validate audio file before processing
     */
    private async validateAudioFile(filePath: string): Promise<void> {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new AudioTranscriptionError(
                AudioErrorType.FILE_ACCESS_ERROR,
                'Audio file not found'
            );
        }

        // Get file stats
        const stats = fs.statSync(filePath);

        // Check file size
        if (stats.size > MAX_AUDIO_FILE_SIZE) {
            throw new AudioTranscriptionError(
                AudioErrorType.FILE_TOO_LARGE,
                `Audio file exceeds maximum size of ${MAX_AUDIO_FILE_SIZE / (1024 * 1024)}MB`
            );
        }

        // Check file format
        const ext = path.extname(filePath).toLowerCase().substring(1);
        if (!SUPPORTED_AUDIO_FORMATS.includes(ext)) {
            throw new AudioTranscriptionError(
                AudioErrorType.UNSUPPORTED_FORMAT,
                `Unsupported audio format: ${ext}`
            );
        }
    }

    /**
     * Transcribe audio using OpenAI Whisper API via AI SDK
     */
    private async transcribeWithOpenAI(
        audioFilePath: string,
        apiKey: string
    ): Promise<TranscriptionResponse> {
        try {
            const audioBuffer = await readFile(audioFilePath);

            // Create OpenAI instance with API key
            const openaiProvider = createOpenAI({ apiKey });

            const { text } = await transcribe({
                model: openaiProvider.transcription('whisper-1'),
                audio: audioBuffer,
            });

            return {
                text,
                provider: AudioProvider.OPENAI
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // Check for specific error patterns
            if (message.includes('401') || message.includes('invalid_api_key') || message.includes('Incorrect API key')) {
                throw new AudioTranscriptionError(
                    AudioErrorType.INVALID_API_KEY,
                    'Invalid OpenAI API key',
                    AudioProvider.OPENAI
                );
            }
            if (message.includes('429') || message.includes('rate_limit')) {
                throw new AudioTranscriptionError(
                    AudioErrorType.RATE_LIMIT,
                    'OpenAI API rate limit exceeded',
                    AudioProvider.OPENAI
                );
            }
            if (message.includes('quota') || message.includes('insufficient_quota')) {
                throw new AudioTranscriptionError(
                    AudioErrorType.QUOTA_EXCEEDED,
                    'OpenAI API quota exceeded',
                    AudioProvider.OPENAI
                );
            }

            throw new AudioTranscriptionError(
                AudioErrorType.TRANSCRIPTION_FAILED,
                `OpenAI transcription failed: ${message}`,
                AudioProvider.OPENAI
            );
        }
    }

    /**
     * Transcribe audio using Google Gemini API
     * Note: Uses direct API since Gemini transcription may not be in AI SDK yet
     */
    private async transcribeWithGemini(
        audioFilePath: string,
        apiKey: string
    ): Promise<TranscriptionResponse> {
        try {
            const audioBuffer = await readFile(audioFilePath);
            const base64Audio = audioBuffer.toString('base64');
            const mimeType = this.getMimeType(audioFilePath);

            // Make direct API request to Gemini
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: "Transcribe this audio file. Return only the transcribed text without any additional commentary or formatting."
                                },
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Audio
                                    }
                                }
                            ]
                        }]
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (!text) {
                throw new Error('No transcription returned from Gemini');
            }

            return {
                text: text.trim(),
                provider: AudioProvider.GEMINI
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // Check for specific error patterns
            if (message.includes('401') || message.includes('403') || message.includes('API_KEY') || message.includes('invalid')) {
                throw new AudioTranscriptionError(
                    AudioErrorType.INVALID_API_KEY,
                    'Invalid Gemini API key',
                    AudioProvider.GEMINI
                );
            }
            if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
                throw new AudioTranscriptionError(
                    AudioErrorType.RATE_LIMIT,
                    'Gemini API rate limit exceeded',
                    AudioProvider.GEMINI
                );
            }

            throw new AudioTranscriptionError(
                AudioErrorType.TRANSCRIPTION_FAILED,
                `Gemini transcription failed: ${message}`,
                AudioProvider.GEMINI
            );
        }
    }

    /**
     * Get MIME type for audio file
     */
    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.ogg': 'audio/ogg',
            '.opus': 'audio/opus',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.webm': 'audio/webm',
            '.m4a': 'audio/mp4',
            '.flac': 'audio/flac'
        };
        return mimeTypes[ext] || 'audio/mpeg';
    }
}
