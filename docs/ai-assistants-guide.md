# AI Assistants Integration Guide

CoderBOT supports multiple AI coding assistants, allowing you to access powerful AI tools directly from your Telegram bot on any device.

## Supported AI Assistants

### 🤖 GitHub Copilot CLI
- **Description**: GitHub's official AI pair programmer for the command line
- **Command**: `/copilot [directory]`
- **Requirements**: 
  - GitHub CLI (`gh`) installed and authenticated
  - Active GitHub Copilot subscription
  - GitHub Personal Access Token with appropriate scopes
- **Installation**: `npm install -g @github/copilot`
- **Authentication**: `gh auth login` followed by Copilot CLI setup

### 🧠 Claude AI
- **Description**: Anthropic's advanced AI assistant for coding and problem-solving
- **Command**: `/claude [directory]`
- **Requirements**:
  - Claude CLI tool installed
  - Anthropic API key or Claude authentication
- **Installation**: `npm install -g @anthropic-ai/claude-code`
- **Authentication**: Configure API key or use `claude auth`

### ✨ Google Gemini
- **Description**: Google's multimodal AI model with advanced reasoning capabilities
- **Command**: `/gemini [directory]`
- **Requirements**:
  - Gemini CLI tool or SDK installed
  - Google AI API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Installation**: Varies by implementation (npm, pip, or direct SDK)
- **Authentication**: Set `GOOGLE_AI_API_KEY` environment variable or use Gemini auth flow

## General Setup

### 1. Pre-Installation
Before using any AI assistant through CoderBOT, you must:

1. Install the CLI tool on the server where CoderBOT runs
2. Authenticate the tool manually
3. Verify the tool works in a standard terminal
4. Ensure Git and GitHub CLI are also configured (most AI tools depend on them)

### 2. Docker Environment
When running CoderBOT in Docker, you need to:

1. Install tools inside the container
2. Mount volumes for authentication persistence
3. Set environment variables for API keys

Example docker-compose.yml volume configuration:
```yaml
volumes:
  - gh_config:/root/.config/gh        # GitHub CLI auth
  - claude_config:/root/.config/claude # Claude auth (if applicable)
```

### 3. Environment Variables

Some AI tools may require environment variables:

```env
# Google Gemini
GOOGLE_AI_API_KEY=your_api_key_here

# Anthropic Claude (alternative to CLI auth)
ANTHROPIC_API_KEY=your_api_key_here

# GitHub (for Copilot)
GITHUB_TOKEN=your_github_pat
```

## Using AI Assistants

### Starting a Session

All AI assistant commands support an optional directory parameter:

```
/copilot                          # Start in current directory
/copilot /home/user/myproject    # Start in specific directory
/claude ~/code/webapp            # Works with ~ expansion
/gemini /workspace/ai-project    # Any valid path
```

### Session Features

When you start an AI session:
- ✅ The bot changes to your specified directory
- ✅ Terminal context is initialized
- ✅ You can send commands and interact with the AI
- ✅ Screenshots show the AI responses
- ✅ All terminal features remain available (special keys, file uploads, etc.)

### Switching Between AI Tools

You can close one session and start another:

```
/copilot              # Start Copilot session
# ... work with Copilot ...
/close                # Close current session
/claude              # Start Claude session
# ... work with Claude ...
/close               # Close current session
/gemini              # Start Gemini session
```

### Raw Terminal Access

Use `/xterm` for standard bash terminal without AI assistance:

```
/xterm               # Start plain bash terminal
# ... run standard commands ...
/close               # Close session
```

## Troubleshooting

### AI Tool Not Found

**Error**: Command not found or tool doesn't start

**Solutions**:
1. Verify the tool is installed: `which copilot` / `which claude` / etc.
2. Check PATH configuration
3. For Docker: Ensure tool is installed in container
4. Try starting the tool manually first: `copilot --version`

### Authentication Issues

**Error**: Not authenticated or invalid credentials

**Solutions**:
1. Run authentication command manually in terminal
2. For GitHub Copilot: `gh auth status` to verify GitHub CLI auth
3. For Claude: Check API key or run `claude auth`
4. For Gemini: Verify `GOOGLE_AI_API_KEY` is set
5. For Docker: Ensure auth volumes are mounted and persisted

### Session Not Responding

**Error**: AI doesn't respond to prompts

**Solutions**:
1. Check `/screen` to see current terminal state
2. Try sending `/enter` to complete a prompt
3. Use `/ctrlc` to interrupt if stuck
4. Close and restart session with `/close` then start command again
5. Check logs for error messages

### API Rate Limits

**Error**: Too many requests or quota exceeded

**Solutions**:
1. GitHub Copilot: Check your subscription status
2. Claude/Gemini: Verify API quota and billing
3. Wait before retrying
4. Consider upgrading API tier if needed

## Best Practices

### 1. Choose the Right Tool
- **GitHub Copilot**: Best for code completion and GitHub-integrated workflows
- **Claude**: Excellent for complex reasoning and detailed explanations
- **Gemini**: Great for multimodal tasks and Google ecosystem integration

### 2. Optimize for Mobile
- Use screenshots (`/screen`) to see AI output visually
- Leverage number keys (`/1`, `/2`, `/3`) for menu selections
- Use quick commands with dot prefix: `.git status`
- Take advantage of auto-refresh for real-time updates

### 3. Security Considerations
- Never share API keys in terminal output
- Use environment variables for sensitive credentials
- Review CoderBOT access control settings
- Consider running in isolated Docker environment
- Monitor API usage and costs

### 4. Efficiency Tips
- Use startup prompts for common workflows (Copilot)
- Chain commands with `&&` for faster execution
- Leverage URL tracking to capture generated links
- Use media folder for sharing generated files

## Multiple Bot Instances

You can run multiple CoderBOT instances with different AI tool configurations:

```env
# Bot 1: GitHub Copilot focused
TELEGRAM_BOT_TOKENS=token1

# Bot 2: Claude AI focused  
TELEGRAM_BOT_TOKENS=token2

# Or combine in single instance
TELEGRAM_BOT_TOKENS=token1,token2
```

Each bot maintains isolated sessions and can be configured with different AI tools.

## Additional Resources

- [GitHub Copilot CLI Documentation](https://docs.github.com/en/copilot/github-copilot-in-the-cli)
- [Claude AI Documentation](https://docs.anthropic.com/claude/docs)
- [Google Gemini Documentation](https://ai.google.dev/docs)
- [CoderBOT Main README](../README.md)
- [Docker Setup Guide](../DOCKER_README.md)
- [Command Reference](./COMMAND_REFERENCE.md)

## Support

If you encounter issues with AI integrations:

1. Check this guide first
2. Review the main [README troubleshooting section](../README.md#troubleshooting)
3. Verify AI tool works independently outside CoderBOT
4. Check GitHub issues for similar problems
5. Create a new issue with details about your setup

---

**Pro Tip**: The real power comes from combining these AI tools with CoderBOT's mobile-first approach. You can now access the world's best AI coding assistants from your phone, anywhere, anytime! 🚀
