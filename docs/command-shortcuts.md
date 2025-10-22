# Command Shortcuts and Special Features

## Dot (.) Command Prefix

The dot prefix provides a quick way to send commands to the terminal without typing `/send`.

### How It Works

When you send a message starting with a dot (`.`), the bot will:
1. Remove the leading dot
2. Send the remaining text to the terminal
3. Automatically press Enter

### Examples

- `.ls -la` → sends `ls -la` + Enter
- `.cd /tmp` → sends `cd /tmp` + Enter
- `.echo hello` → sends `echo hello` + Enter
- `.git status` → sends `git status` + Enter

### Benefits

- **Faster**: Less typing than `/send command`
- **Intuitive**: Similar to shell command prefixes in other tools
- **Flexible**: Works with any command or text

### Comparison

| Input | What Gets Sent | Enter Key? |
|-------|----------------|------------|
| `hello world` | `hello world` | ✅ Yes |
| `.hello world` | `hello world` | ✅ Yes |
| `/send hello world` | `hello world` | ✅ Yes |
| `/keys hello world` | `hello world` | ❌ No |

### Notes

- The dot must be the **first character** of your message
- Only **one dot** is removed (`.` not `..`)
- Works with `[media]` placeholder: `.cp file [media]`
- Cannot be used with Telegram commands (those starting with `/`)
