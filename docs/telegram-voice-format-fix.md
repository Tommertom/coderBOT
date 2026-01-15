# Telegram Voice Message Format Support Fix

## Issue
Voice messages from Telegram were being rejected with the error:
```
⚠️ Unsupported audio format.
Supported formats: .ogg, .mp3, .wav, .webm, .m4a, .flac, .opus
```

## Root Cause
Telegram voice messages are sent as OGG files encoded with OPUS codec, but they use the `.oga` file extension (OGG Audio container) rather than the generic `.ogg` extension. The audio transcription service was not recognizing `.oga` as a supported format.

## Solution
Added `.oga` extension to the list of supported audio formats in three locations:

### 1. Audio Types (`src/features/audio/audio.types.ts`)
Added `.oga` to the `SUPPORTED_AUDIO_FORMATS` array:
```typescript
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
```

### 2. Audio Service (`src/features/audio/audio.service.ts`)
Added `.oga` to the MIME type mapping:
```typescript
private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg',  // OGG Audio - Telegram voice messages
        '.opus': 'audio/opus',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.webm': 'audio/webm',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
}
```

### 3. Error Messages (`src/constants/messages.ts`)
Updated the error message to include `.oga`:
```typescript
UNSUPPORTED_FORMAT: '⚠️ Unsupported audio format.\n\n' +
    'Supported formats: .ogg, .oga, .mp3, .wav, .webm, .m4a, .flac, .opus',
```

## Technical Background

### Telegram Voice Message Format
According to the [Telegram Bot API documentation](https://core.telegram.org/bots/api#voice):
- Voice messages must be in `.OGG` file encoded with OPUS
- Alternative formats: `.MP3` or `.M4A`
- Maximum size: 50 MB

### OGG vs OGA
- `.ogg` - Generic OGG container extension
- `.oga` - Specific OGG Audio container extension
- Both use the same `audio/ogg` MIME type
- Telegram uses `.oga` for voice messages to explicitly indicate audio content

## Impact
- Voice messages from Telegram can now be transcribed successfully
- Both OpenAI Whisper and Google Gemini transcription providers support OGG/OGA format
- No breaking changes to existing functionality

## Testing
To test the fix:
1. Send a voice message to the bot via Telegram
2. Verify it transcribes successfully without format errors
3. Check that the transcription text is returned correctly

## Related Files
- `src/features/audio/audio.types.ts` - Format definitions
- `src/features/audio/audio.service.ts` - Transcription service with MIME type mapping
- `src/features/audio/audio.bot.ts` - Telegram bot audio handler
- `src/constants/messages.ts` - User-facing error messages
