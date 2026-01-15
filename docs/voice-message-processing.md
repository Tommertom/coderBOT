# Voice Message Processing Flow in coderBOT

When a user submits a voice message to the bot, here's the complete flow:

## 1. Message Reception & Routing
- Grammy bot framework receives the Telegram update containing a voice message
- The message is caught by the `message:voice` handler registered in `AudioBot.registerHandlers()` (line 62-64 in audio.bot.ts)
- Similar handling exists for `message:audio` for audio file uploads

## 2. Initial Validation
- **API Key Check**: First checks if `TTS_API_KEY` is configured via `configService.hasTtsApiKey()`
- If not configured, immediately replies with error: "Audio transcription is not configured"
- **Processing Message**: Sends a "🎙️ Transcribing your audio..." message to provide user feedback

## 3. Provider Detection
The system automatically detects which transcription provider to use based on the API key format:
- **OpenAI Whisper**: Keys starting with `sk-`
- **Google Gemini**: All other key formats (typically starting with `AIza`)

## 4. Audio File Download
- Retrieves file metadata from Telegram API using `ctx.api.getFile(fileId)`
- Downloads the audio file from Telegram servers to a temporary directory:
  - Path: `{MEDIA_TMP_LOCATION}/{botId}/audio/`
  - Filename format: `{type}_{timestamp}{extension}` (e.g., `voice_1736444765123.ogg`)
- **Security**: Path traversal protection via `path.normalize()` validation
- Default extensions: `.ogg` for voice messages, `.mp3` for audio files

## 5. Audio File Validation
Before transcription, the service validates:
- **File exists**: Checks the downloaded file is accessible
- **File size**: Maximum 25MB (`MAX_AUDIO_FILE_SIZE`)
- **Format support**: Supports `ogg`, `mp3`, `wav`, `webm`, `m4a`, `flac`, `opus`

## 6. Transcription Process

### OpenAI Whisper Path (if API key starts with `sk-`):
- Uses Vercel AI SDK with `@ai-sdk/openai` package
- Reads audio file as buffer
- Calls `transcribe()` with `whisper-1` model
- Returns plain text transcription

### Google Gemini Path (for other API keys):
- Uses direct Gemini API call (not AI SDK, as transcription may not be fully supported)
- Converts audio file to base64 encoding
- Determines MIME type based on file extension
- Makes POST request to `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- Includes prompt: "Transcribe this audio file. Return only the transcribed text without any additional commentary or formatting."
- Extracts text from JSON response

## 7. Error Handling
Comprehensive error handling for various scenarios:
- **NO_API_KEY**: TTS_API_KEY not configured
- **INVALID_API_KEY**: Authentication failures (401/403 errors)
- **RATE_LIMIT**: Too many requests (429 errors)
- **QUOTA_EXCEEDED**: API quota exhausted
- **FILE_TOO_LARGE**: File exceeds 25MB
- **UNSUPPORTED_FORMAT**: Invalid audio format
- **DOWNLOAD_FAILED**: Telegram download issues
- **TRANSCRIPTION_FAILED**: General transcription errors

## 8. Response Delivery
- **Delete** the "Transcribing..." processing message
- **Send formatted response**:
  ```
  🎙️ *Transcription* (via OpenAI Whisper/Google Gemini):
  
  ```
  {transcribed text}
  ```
  
  _You can now copy and use this text for your command._
  ```
- Uses Markdown formatting for better readability

## 9. Cleanup
- Automatically deletes the temporary audio file after transcription completes
- Prevents disk space accumulation from voice messages

## Key Features
✅ **Multi-provider support** - Works with both OpenAI Whisper and Google Gemini  
✅ **Automatic provider detection** - Based on API key format  
✅ **Secure file handling** - Path traversal protection, size limits  
✅ **Comprehensive error handling** - Specific messages for each error type  
✅ **User feedback** - Processing indicators and clear results  
✅ **Automatic cleanup** - Temporary files are removed after processing

## Code Location Reference
- **Main Handler**: `src/features/audio/audio.bot.ts`
- **Transcription Service**: `src/features/audio/audio.service.ts`
- **Type Definitions**: `src/features/audio/audio.types.ts`
- **Configuration**: `src/services/config.service.ts`
- **Integration**: `src/bot-worker.ts` (lines 106-114)
