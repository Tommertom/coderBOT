/**
 * Audio Transcription Types
 * 
 * Type definitions for audio transcription feature supporting
 * multiple speech-to-text providers (OpenAI Whisper, Google Gemini).
 */

export enum AudioProvider {
    OPENAI = 'openai',
    GEMINI = 'gemini'
}

export interface TranscriptionRequest {
    audioPath: string;
    provider: AudioProvider;
    apiKey: string;
    language?: string; // Optional language hint (ISO 639-1 code)
}

export interface TranscriptionResponse {
    text: string;
    provider: AudioProvider;
    duration?: number; // Duration in seconds, if available
    language?: string; // Detected language
    error?: string;
}

export interface AudioFileInfo {
    path: string;
    format: string;
    size: number; // Size in bytes
    mimeType: string;
}

export enum AudioErrorType {
    NO_API_KEY = 'NO_API_KEY',
    INVALID_API_KEY = 'INVALID_API_KEY',
    UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
    DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
    FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    RATE_LIMIT = 'RATE_LIMIT',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

export class AudioTranscriptionError extends Error {
    constructor(
        public readonly type: AudioErrorType,
        message: string,
        public readonly provider?: AudioProvider
    ) {
        super(message);
        this.name = 'AudioTranscriptionError';
    }
}

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = [
    'ogg',
    'oga',  // OGG Audio - Telegram voice messages
    'mp3',
    'wav',
    'webm',
    'm4a',
    'flac',
    'opus'
];

// Maximum file size (25MB - safe limit for most APIs)
export const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
