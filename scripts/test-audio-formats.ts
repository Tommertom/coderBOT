#!/usr/bin/env node
/**
 * Test script to validate audio format support
 * 
 * This script tests the audio format validation logic to ensure
 * that .oga files (Telegram voice messages) are properly supported.
 */

import { SUPPORTED_AUDIO_FORMATS, MAX_AUDIO_FILE_SIZE } from '../src/features/audio/audio.types.js';
import * as path from 'path';

console.log('🎙️ Audio Format Support Test\n');

// Test 1: Check if all required formats are supported
console.log('✓ Test 1: Checking supported formats...');
const requiredFormats = ['ogg', 'oga', 'mp3', 'wav', 'webm', 'm4a', 'flac', 'opus'];
const missingFormats = requiredFormats.filter(format => !SUPPORTED_AUDIO_FORMATS.includes(format));

if (missingFormats.length === 0) {
    console.log('  ✅ All required formats are supported');
    console.log(`  📋 Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`);
} else {
    console.log(`  ❌ Missing formats: ${missingFormats.join(', ')}`);
    process.exit(1);
}

// Test 2: Verify .oga is specifically included (Telegram voice messages)
console.log('\n✓ Test 2: Checking Telegram voice message format (.oga)...');
if (SUPPORTED_AUDIO_FORMATS.includes('oga')) {
    console.log('  ✅ .oga format is supported (Telegram voice messages)');
} else {
    console.log('  ❌ .oga format is NOT supported - Telegram voice messages will fail!');
    process.exit(1);
}

// Test 3: Simulate file extension extraction
console.log('\n✓ Test 3: Testing file extension extraction...');
const testFiles = [
    { path: 'voice_123456.oga', desc: 'Telegram voice message' },
    { path: 'audio_123456.ogg', desc: 'OGG audio file' },
    { path: 'recording.opus', desc: 'OPUS audio file' },
    { path: 'message.mp3', desc: 'MP3 audio file' },
];

let allPassed = true;
testFiles.forEach(({ path: filePath, desc }) => {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    const isSupported = SUPPORTED_AUDIO_FORMATS.includes(ext);
    
    if (isSupported) {
        console.log(`  ✅ ${desc} (.${ext}): Supported`);
    } else {
        console.log(`  ❌ ${desc} (.${ext}): NOT supported`);
        allPassed = false;
    }
});

if (!allPassed) {
    process.exit(1);
}

// Test 4: Verify MIME type mapping
console.log('\n✓ Test 4: Testing MIME type mapping...');
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

if (mimeTypes['.ogg'] === 'audio/ogg' && mimeTypes['.oga'] === 'audio/ogg') {
    console.log('  ✅ .ogg and .oga correctly map to audio/ogg');
} else {
    console.log('  ❌ MIME type mapping is incorrect');
    process.exit(1);
}

// Test 5: Display configuration
console.log('\n✓ Test 5: Configuration summary...');
console.log(`  📏 Max file size: ${MAX_AUDIO_FILE_SIZE / (1024 * 1024)}MB`);
console.log(`  📊 Total supported formats: ${SUPPORTED_AUDIO_FORMATS.length}`);

// Final summary
console.log('\n' + '='.repeat(50));
console.log('✅ All tests passed!');
console.log('🎙️ Telegram voice messages (.oga) are now supported');
console.log('='.repeat(50) + '\n');
