# Audio Transcription Feature

## Overview

The Audio Transcription feature enables coderBOT to automatically convert voice messages and audio files sent via Telegram into text using speech-to-text (STT) services. The bot supports both OpenAI Whisper API and Google Gemini API with automatic provider detection.

## Features

- **Voice Message Support**: Transcribe voice messages recorded directly in Telegram
- **Audio File Support**: Transcribe uploaded audio files in various formats
- **Multi-Provider Support**: Works with OpenAI Whisper and Google Gemini
- **Auto-Detection**: Automatically detects which API to use based on key format
- **Two Transcription Modes**: Copy-paste mode (default) or direct prompt mode
- **Comprehensive Error Handling**: Clear error messages for common issues

## Transcription Modes

### Copy Mode (Default)
The transcribed text is returned as a formatted message that you can copy and paste. This is useful when you want to review the transcription before using it.

### Prompt Mode
The transcribed text is automatically sent to your active terminal session as a prompt, just like typing it manually. This is useful for quick voice commands to your AI assistant.

**Toggle between modes** using the `/audiomode` command. Your preference is saved per user.

## Supported Audio Formats

- `.ogg` (Opus codec - Telegram voice messages)
- `.mp3`
- `.wav`
- `.webm`
- `.m4a`
- `.flac`
- `.opus`

## Configuration

### 1. Get an API Key

You need an API key from either OpenAI or Google Gemini:

#### OpenAI Whisper API
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

#### Google Gemini API
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key (typically starts with `AIza`)

### 2. Configure Environment Variables

Add your API key to the `.env` file:

```env
# OpenAI Whisper API
TTS_API_KEY=sk-proj-abcd1234...

# OR Google Gemini API
TTS_API_KEY=AIzaSy...

# Default audio transcription mode (optional, default: copy)
# copy: Transcribed text is returned for copy-pasting
# prompt: Transcribed text is sent directly to terminal
AUDIO_TRANSCRIPTION_DEFAULT_MODE=copy
```

The bot will automatically detect which service to use based on the key format:
- Keys starting with `sk-` → OpenAI Whisper
- Other formats → Google Gemini

The default mode applies to all users until they override it with `/audiomode`.

### 3. Restart the Bot

After adding the API key, restart coderBOT:

```bash
npm run start
```

Or if using PM2:

```bash
npm run pm2:restart
```

## Usage

### Switching Transcription Modes

Use the `/audiomode` command to toggle between Copy and Prompt modes:

```
/audiomode
```

**Response in Copy Mode:**
```
🎙️ Audio Transcription Mode Changed

🚀 Prompt Mode: Transcribed text will be directly sent to your active terminal session as a prompt.

Use /audiomode again to toggle back.
```

**Response in Prompt Mode:**
```
🎙️ Audio Transcription Mode Changed

📋 Copy Mode: Transcribed text will be sent as a formatted message for you to copy and paste.

Use /audiomode again to toggle back.
```

### Sending Voice Messages (Copy Mode)

1. Open your Telegram chat with coderBOT
2. Record a voice message using Telegram's voice recorder
3. Send the voice message
4. Wait for the bot to process (you'll see "🎙️ Transcribing audio...")
5. Receive the transcribed text in a code block for copying

### Sending Voice Messages (Prompt Mode)

1. Make sure you have an active terminal session (`/copilot`, `/opencode`, or `/gemini`)
2. Record and send a voice message
3. Wait for transcription
4. The transcribed text is automatically sent to your terminal as a prompt

### Sending Audio Files

1. Upload an audio file to the chat (must be in a supported format)
2. Wait for transcription
3. Depending on your mode setting, text is either returned for copying or sent as a prompt

### Example Responses

**Copy Mode:**
```
🎙️ Transcription (via OpenAI Whisper):

```
Hello, please run npm install and then start the development server.
```

You can now copy and use this text for your command.
```

**Prompt Mode:**
```
✅ Transcribed text sent to terminal as prompt
```

## Error Messages

### No API Key Configured

**Message:** 
```
⚠️ Audio transcription is not configured.

Please set TTS_API_KEY in your .env file with either:
• OpenAI API key (sk-...)
• Google Gemini API key
```

**Solution:** Add `TTS_API_KEY` to your `.env` file

### Invalid API Key

**Message:**
```
❌ Invalid API key.

Please check your TTS_API_KEY configuration.
```

**Solution:** Verify your API key is correct and has not expired

### Unsupported Format

**Message:**
```
⚠️ Unsupported audio format.

Supported formats: .ogg, .mp3, .wav, .webm, .m4a, .flac, .opus
```

**Solution:** Convert your audio file to a supported format

### File Too Large

**Message:**
```
⚠️ Audio file is too large.

Maximum size: 25MB
```

**Solution:** Trim or compress your audio file to under 25MB

### Rate Limit Exceeded

**Message:**
```
⚠️ API rate limit exceeded.

Please wait a moment and try again.
```

**Solution:** Wait a few moments before sending another audio message

### Quota Exceeded

**Message:**
```
❌ API quota exceeded.

Please check your API account billing and limits.
```

**Solution:** Check your API provider's billing dashboard and increase quota if needed

## Technical Details

### Architecture

The audio transcription feature is implemented as a separate module using the **Vercel AI SDK**:

- **`audio.types.ts`**: Type definitions and interfaces
- **`audio.service.ts`**: Core transcription logic using AI SDK for OpenAI, direct API for Gemini
- **`audio.bot.ts`**: Telegram bot integration and message handlers

### API Integration

The implementation uses the **Vercel AI SDK** (`ai` package) for a clean, unified interface:

#### OpenAI Whisper
- **Via AI SDK**: Uses `experimental_transcribe` function
- **Model**: `whisper-1`
- **Method**: Buffer-based upload through AI SDK
- **Advantages**: Type-safe, automatic error handling, consistent API

```typescript
import { experimental_transcribe as transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey });
const { text } = await transcribe({
  model: openai.transcription('whisper-1'),
  audio: audioBuffer,
});
```

#### Google Gemini
- **Direct REST API**: Uses fetch to Gemini API endpoint
- **Model**: `gemini-1.5-flash`
- **Method**: Base64 encoded audio in JSON request
- **Note**: Gemini transcription not yet in AI SDK, using direct API

### File Processing

1. Audio file is downloaded from Telegram to a temporary directory
2. File is validated (format, size)
3. File is sent to the appropriate API
4. Response is parsed and formatted
5. Temporary file is deleted

### Security Features

- Path traversal prevention
- File size limits (25MB max)
- Format validation
- Secure temporary file handling
- API key validation before requests

## Cost Considerations

### OpenAI Whisper API Pricing
- Charged per minute of audio
- Check [OpenAI Pricing](https://openai.com/pricing) for current rates
- Typically $0.006 per minute (as of 2024)

### Google Gemini API Pricing
- Free tier available with rate limits
- Check [Google AI Pricing](https://ai.google.dev/pricing) for current rates
- May have different pricing for audio processing

## Troubleshooting

### Audio not being transcribed

1. Verify `TTS_API_KEY` is set in `.env`
2. Restart the bot after adding the key
3. Check bot logs for initialization message
4. Verify API key is valid and has quota

### Transcription quality issues

- Ensure audio is clear and has minimal background noise
- Use higher quality audio formats (lossless if possible)
- For OpenAI, you can specify language hints (future enhancement)
- For Gemini, ensure audio is in a format it handles well

### Network errors

- Check your internet connection
- Verify API endpoints are accessible from your server
- Check for firewall rules blocking HTTPS requests

### Bot not responding

- Check bot logs for errors
- Verify the bot process is running
- Check Telegram API connectivity
- Ensure disk space is available for temporary files

## Development

### Adding New Providers

To add support for additional STT providers:

1. Update `AudioProvider` enum in `audio.types.ts`
2. Implement provider method in `audio.service.ts`
3. Update provider detection in `config.service.ts`
4. Add error handling for provider-specific errors

### Testing

Test with various audio formats and scenarios:

```bash
# Test voice messages
- Record short voice message
- Record long voice message
- Test in noisy environment

# Test audio files
- Upload .mp3 file
- Upload .wav file
- Upload large file (near 25MB limit)

# Test error conditions
- Remove API key and test
- Test with invalid API key
- Test with unsupported format
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Language detection and specification
- [ ] Support for longer audio files (chunking)
- [ ] Audio file transcription status tracking
- [ ] Batch transcription support
- [ ] Custom vocabulary/terminology support
- [ ] Transcription history
- [ ] Cost tracking and reporting
- [ ] Alternative providers (Azure Speech, AWS Transcribe)
- [ ] Real-time streaming transcription

## References

- [OpenAI Whisper API Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Telegram Bot API - Voice Messages](https://core.telegram.org/bots/api#voice)
- [Grammy Bot Framework](https://grammy.dev/)
