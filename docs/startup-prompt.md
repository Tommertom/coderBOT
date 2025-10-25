# Startup Prompt Feature

## Overview

The Startup Prompt feature allows you to configure custom initialization messages that are automatically sent to terminal sessions when launching AI assistants like Copilot.

## How It Works

### Setting a Startup Prompt

Send a message starting with `./cwd` to store it as a startup prompt:

```
./cwd cd /home/user/project && npm start
```

This message will be:
1. Stored as a JSON file in the `startip/` directory
2. Named `copilot-{botId}.json` to be unique per bot
3. Automatically sent to the terminal 3 seconds after launching `/copilot`

### JSON File Structure

The startup prompt is stored with the following structure:

```json
{
  "botId": "your-bot-id",
  "message": "./cwd cd /home/user/project && npm start",
  "timestamp": "2025-10-25T09:01:08.071Z"
}
```

### Using the Startup Prompt

1. **Set the prompt** by sending a message starting with `./cwd`:
   ```
   ./cwd echo "Hello from startup prompt!"
   ```

2. **Launch Copilot** using the `/copilot` command

3. **Wait 3 seconds** - the startup prompt will be automatically sent to the terminal

The system will:
- Send the entire message exactly as typed (including the `./cwd` prefix)
- Execute it as if you typed it manually

## File Storage

- **Directory**: `startip/` (created in the project root)
- **Filename pattern**: `copilot-{botId}.json`
- **Unique per**: Bot ID (each bot can have its own startup prompt)

## Example Use Cases

### Navigate to a specific directory
```
./cwd cd /workspace/my-project
```

### Run a development server
```
./cwd cd /app && npm run dev
```

### Execute a setup script
```
./cwd source ~/.bashrc && cd ~/projects
```

### Chain multiple commands
```
./cwd cd /workspace && ls -la && git status
```

## Implementation Details

- The startup prompt is only sent when using `/copilot` command
- The 3-second delay allows the copilot session to fully initialize
- The prompt is sent exactly as typed, including the `./cwd` prefix
- No modification or stripping of the original message

## API Reference

### StartupPromptService

#### Methods

- `savePrompt(botId: string, message: string): void`
  - Saves a startup prompt for a specific bot ID
  
- `loadPrompt(botId: string): string | null`
  - Loads the startup prompt for a specific bot ID
  - Returns null if no prompt exists
  
- `hasPrompt(botId: string): boolean`
  - Checks if a startup prompt exists for a specific bot ID
  
- `deletePrompt(botId: string): void`
  - Deletes the startup prompt for a specific bot ID

## Notes

- Only messages starting with `./cwd` are stored as startup prompts
- Each bot has its own unique startup prompt file
- The prompt is sent automatically only for `/copilot` (not `/claude` or `/cursor`)
- You can update the prompt by sending a new `./cwd` message
