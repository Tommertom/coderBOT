# Audio Transcription Modes Feature

## Summary

Added a new feature that allows users to choose how transcribed audio is handled:
- **Copy Mode (default)**: Transcribed text is returned as a formatted message for copy-pasting
- **Prompt Mode**: Transcribed text is directly sent to the active terminal session as a prompt

Users can override the default mode using the `/audiomode` command.

## Configuration

### Environment Variable

Add to `.env` file:

```env
# Default audio transcription mode (optional, default: copy)
AUDIO_TRANSCRIPTION_DEFAULT_MODE=copy  # or 'prompt'
```

This sets the default mode for all users. Individual users can override this with `/audiomode`.

## Implementation Details

### New Files Created

1. **`src/services/audio-preferences.service.ts`**
   - Service for managing per-user audio transcription preferences
   - Stores user preferences in memory (Map-based)
   - Provides methods to get, set, toggle, and clear preferences
   - Defines `AudioTranscriptionMode` enum with two modes: COPY and PROMPT
   - Uses ConfigService to get default mode from environment

### Modified Files

1. **`src/services/config.service.ts`**
   - Added `audioTranscriptionDefaultMode` property
   - Added `getAudioTranscriptionDefaultMode()` method
   - Reads `AUDIO_TRANSCRIPTION_DEFAULT_MODE` from .env (defaults to 'copy')

2. **`dot-env.template`**
   - Added `AUDIO_TRANSCRIPTION_DEFAULT_MODE` configuration option
   - Documented both 'copy' and 'prompt' values

3. **`.env`**
   - Added `AUDIO_TRANSCRIPTION_DEFAULT_MODE=copy` setting

4. **`src/services/service-container.factory.ts`**
   - Added `AudioPreferencesService` as a global singleton service
   - Passes ConfigService to AudioPreferencesService constructor
   - Injected into service container for all bots

5. **`src/services/service-container.interface.ts`**
   - Updated interface to include `audioPreferencesService` property

6. **`src/bot-worker.ts`**
   - Updated AudioBot instantiation to include `xtermService` and `audioPreferencesService`

7. **`src/features/audio/audio.bot.ts`**
   - Added constructor parameters for `xtermService` and `audioPreferencesService`
   - Registered new `/audiomode` command handler
   - Modified `handleAudioMessage` to check user's transcription mode preference
   - Added `sendAsPrompt` method to send transcribed text directly to terminal
   - Added `handleAudioModeToggle` method to toggle between modes
   - Updated imports to include new service and types

8. **`docs/audio-transcription-feature.md`**
   - Updated documentation to explain both transcription modes
   - Added usage instructions for `/audiomode` command
   - Added example responses for both modes
   - Documented the new .env setting

## User Experience

### Default Behavior
- All users start with the mode configured in `AUDIO_TRANSCRIPTION_DEFAULT_MODE` (default: 'copy')
- Users can override this at any time with `/audiomode`
- Transcribed text behavior depends on the active mode

### Toggle Command
Users can switch modes at any time using:
```
/audiomode
```

The bot responds with the new mode and a clear description of how it works.

### Copy Mode
When a user sends voice/audio:
1. Audio is transcribed
2. Text is returned in a code block with copy instructions
3. User can copy the text and manually send it as needed

### Prompt Mode
When a user sends voice/audio:
1. Audio is transcribed
2. Bot checks if user has an active terminal session
3. If yes: text is automatically sent to terminal (with Enter key)
4. If no: error message explaining they need an active session first
5. Confirmation message is sent: "✅ Transcribed text sent to terminal as prompt"

## Technical Implementation

### Architecture
- **Service Layer**: `AudioPreferencesService` manages user preferences globally
- **State Management**: In-memory Map stores user preferences (userId → mode)
- **Dependency Injection**: Service is injected through service container
- **Mode Detection**: On audio message, bot checks user's current mode
- **Terminal Integration**: Uses existing `XtermService.writeRawToSession()` for prompt mode

### Key Design Decisions
1. **Per-User Preferences**: Each user can have their own mode preference
2. **In-Memory Storage**: Preferences reset on bot restart (simple, no persistence needed)
3. **Default to Copy**: Conservative default that won't surprise users
4. **Toggle Command**: Simple `/audiomode` command with no arguments for easy switching
5. **Clear Feedback**: Bot always confirms the current mode when toggling

## Testing Checklist

- [ ] Build completes successfully ✅
- [ ] `/audiomode` command toggles between modes
- [ ] Copy mode returns transcribed text in formatted message
- [ ] Prompt mode sends text to active terminal
- [ ] Prompt mode shows error when no terminal session exists
- [ ] Multiple users can have different preferences
- [ ] Mode preference persists during bot runtime
- [ ] Documentation is clear and accurate ✅

## Future Enhancements

Potential improvements for future versions:
- Persist user preferences to disk/database
- Add `/audiomode copy` and `/audiomode prompt` for direct mode selection
- Show current mode in `/help` or `/status` command
- Add configuration option for default mode in .env file
