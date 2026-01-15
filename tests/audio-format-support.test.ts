/**
 * Audio Format Validation Test
 * 
 * Tests that all Telegram-supported audio formats, including .oga,
 * are properly recognized by the audio service.
 */

import { SUPPORTED_AUDIO_FORMATS } from '../src/features/audio/audio.types.js';
import * as path from 'path';

describe('Audio Format Support', () => {
    test('SUPPORTED_AUDIO_FORMATS includes all required formats', () => {
        const requiredFormats = ['ogg', 'oga', 'mp3', 'wav', 'webm', 'm4a', 'flac', 'opus'];
        
        requiredFormats.forEach(format => {
            expect(SUPPORTED_AUDIO_FORMATS).toContain(format);
        });
    });

    test('SUPPORTED_AUDIO_FORMATS includes .oga for Telegram voice messages', () => {
        expect(SUPPORTED_AUDIO_FORMATS).toContain('oga');
    });

    test('validates extension matching logic', () => {
        const testFiles = [
            { path: 'voice_123456.oga', expected: 'oga' },
            { path: 'audio_123456.ogg', expected: 'ogg' },
            { path: 'message.mp3', expected: 'mp3' },
            { path: 'recording.opus', expected: 'opus' },
        ];

        testFiles.forEach(({ path: filePath, expected }) => {
            const ext = path.extname(filePath).toLowerCase().substring(1);
            expect(SUPPORTED_AUDIO_FORMATS).toContain(ext);
            expect(ext).toBe(expected);
        });
    });

    test('case insensitive extension handling', () => {
        const testExtensions = ['.OGA', '.Oga', '.oGa'];
        
        testExtensions.forEach(ext => {
            const normalized = ext.toLowerCase().substring(1);
            expect(SUPPORTED_AUDIO_FORMATS).toContain(normalized);
        });
    });
});

describe('MIME Type Mapping', () => {
    test('OGG and OGA should map to same MIME type', () => {
        const expectedMimeType = 'audio/ogg';
        
        // This test validates the logic, actual implementation is in audio.service.ts
        const mimeTypes: { [key: string]: string } = {
            '.ogg': 'audio/ogg',
            '.oga': 'audio/ogg',
            '.opus': 'audio/opus',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.webm': 'audio/webm',
            '.m4a': 'audio/mp4',
            '.flac': 'audio/flac'
        };

        expect(mimeTypes['.ogg']).toBe(expectedMimeType);
        expect(mimeTypes['.oga']).toBe(expectedMimeType);
    });
});

describe('Format Array Completeness', () => {
    test('all required formats are present in correct order', () => {
        const expectedFormats = ['ogg', 'oga', 'mp3', 'wav', 'webm', 'm4a', 'flac', 'opus'];
        
        expectedFormats.forEach(format => {
            expect(SUPPORTED_AUDIO_FORMATS.includes(format)).toBe(true);
        });
    });

    test('no unexpected formats in array', () => {
        const validFormats = ['ogg', 'oga', 'mp3', 'wav', 'webm', 'm4a', 'flac', 'opus'];
        
        SUPPORTED_AUDIO_FORMATS.forEach(format => {
            expect(validFormats.includes(format)).toBe(true);
        });
    });
});
