# Quick Command Reference

## Coder Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message |
| `/help` | Show all available commands |
| `/esc` | Send Escape key to terminal |
| `/close` | Close the terminal session |
| `/send <text>` | Send text to terminal with Enter |
| `/killbot` | Shutdown the bot |
| `/urls` | Show discovered URLs in terminal |

**Plus:** Any plain text message is sent directly to the terminal with Enter.

---

## Xterm Bot Commands

### Session Management
| Command | Description |
|---------|-------------|
| `/xterm` | Start raw bash terminal |
| `/copilot` | Start GitHub Copilot CLI session |
| `/claude` | Start Claude AI session |
| `/gemini` | Start Google Gemini session |
| `/gemini` | Start Gemini AI session |

### Text Input
| Command | Description |
|---------|-------------|
| `/send <text>` | Send text to terminal with Enter |
| `/keys <text>` | Send text without Enter |

### Special Keys
| Command | Description |
|---------|-------------|
| `/tab` | Send Tab character |
| `/enter` | Send Enter key |
| `/space` | Send Space character |
| `/delete` | Send Delete key |
| `/esc` | Send Escape key |
| `/arrowup` | Send Arrow Up key |
| `/arrowdown` | Send Arrow Down key |

### Control Keys
| Command | Description |
|---------|-------------|
| `/ctrl <char>` | Send Ctrl+character (e.g., `/ctrl c`) |
| `/ctrlc` | Send Ctrl+C (interrupt) |
| `/ctrlx` | Send Ctrl+X |

### Number Keys
| Command | Description |
|---------|-------------|
| `/1` through `/5` | Send number keys (for menu selections) |

### Output & Viewing
| Command | Description |
|---------|-------------|
| `/screen` | Capture terminal screenshot |
| `/urls` | Show discovered URLs |

**Plus:** Any plain text message is sent directly to the terminal with Enter.

---

## Quick Tips

### Coder Bot (Simple & Clean)
- **Best for:** General terminal interaction
- **Focus:** Simple, minimal command set
- **Use when:** You need basic terminal access

### Xterm Bot (Feature-Rich)
- **Best for:** Advanced terminal operations and AI assistants
- **Focus:** Full terminal control and special keys
- **Use when:** You need precise control or want to use AI coding assistants

### Common Features (Both Bots)
- ✅ Send plain text messages (automatically sent with Enter)
- ✅ Use `.command` syntax (dot is stripped, Enter added)
- ✅ Auto-refresh screenshots after commands
- ✅ Refresh button on all screenshots
- ✅ URL detection in terminal output
- ✅ Callback query support for interactive elements
