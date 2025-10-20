# AI CLI Tools Setup Guide

This guide explains how to set up and use AI CLI tools (GitHub Copilot CLI, Claude CLI, and alternatives) within the CoderBOT Docker container.

## Installed Tools

### 1. GitHub Copilot CLI ✅

**Status**: Installed (requires authentication)

**What's Included**:
- GitHub CLI (`gh`) - fully installed
- GitHub Copilot CLI extension - ready to install

**Setup Instructions**:

After starting the Docker container, you need to authenticate:

```bash
# Enter the container
docker exec -it coderbot /bin/bash

# Authenticate with GitHub
gh auth login

# Install Copilot extension
gh extension install github/gh-copilot

# Verify installation
gh copilot --version
```

**Authentication via Web Browser**:
1. Run `gh auth login`
2. Select "GitHub.com"
3. Select "HTTPS"
4. Authenticate with your web browser
5. Paste the one-time code when prompted

**Alternatively - Using Token**:
```bash
# Set your GitHub token
gh auth login --with-token < your_token.txt
```

**Usage**:

```bash
# Get coding suggestions
gh copilot suggest "How do I list files in a directory?"

# Explain code
gh copilot explain "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)"

# Interactive mode
gh copilot suggest
```

**Quick Helper**:
```bash
# Run this in the container for setup instructions
setup-copilot
```

---

### 2. Claude CLI ⚠️

**Status**: No official CLI available

**Why Not Installed**:
Anthropic does not provide an official Claude CLI tool. However, you can interact with Claude using:

#### Option A: Direct API Calls with curl

```bash
# Set your API key (add to .env file)
export ANTHROPIC_API_KEY="your-api-key"

# Example API call
curl https://api.anthropic.com/v1/messages \
  --header "x-api-key: $ANTHROPIC_API_KEY" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

#### Option B: Create a Simple Shell Script

Create `/usr/local/bin/claude`:

```bash
#!/bin/bash
# Simple Claude CLI wrapper

API_KEY="${ANTHROPIC_API_KEY}"
MODEL="${CLAUDE_MODEL:-claude-3-5-sonnet-20241022}"
MESSAGE="$*"

if [ -z "$API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY environment variable not set"
    exit 1
fi

if [ -z "$MESSAGE" ]; then
    echo "Usage: claude <your message>"
    exit 1
fi

curl -s https://api.anthropic.com/v1/messages \
  --header "x-api-key: $API_KEY" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data "{
    \"model\": \"$MODEL\",
    \"max_tokens\": 2048,
    \"messages\": [
      {\"role\": \"user\", \"content\": \"$MESSAGE\"}
    ]
  }" | jq -r '.content[0].text'
```

Make it executable:
```bash
chmod +x /usr/local/bin/claude
```

Usage:
```bash
claude "Explain Docker containers"
```

#### Option C: Python SDK

```bash
# Install Anthropic Python SDK
pip3 install anthropic

# Create a Python script
cat > /usr/local/bin/claude.py << 'EOF'
#!/usr/bin/env python3
import os
import sys
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

message = " ".join(sys.argv[1:])
if not message:
    print("Usage: claude.py <your message>")
    sys.exit(1)

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=2048,
    messages=[{"role": "user", "content": message}]
)

print(response.content[0].text)
EOF

chmod +x /usr/local/bin/claude.py
```

Usage:
```bash
claude.py "What is Docker?"
```

---

### 3. Cursor CLI ❌

**Status**: Not available

**Why Not Installed**:
Cursor CLI is part of the Cursor editor and requires the full GUI application. It's not available as a standalone CLI tool.

#### Alternatives:

**Option A: Use GitHub Copilot CLI** (recommended)
- Similar functionality
- Works in terminal environments
- Already installed (see above)

**Option B: Aider.chat**
Install Aider - an AI pair programming tool:

```bash
pip3 install aider-chat

# Usage
aider --model gpt-4 file1.py file2.py
```

**Option C: Continue.dev CLI**
Continue.dev has a CLI mode:

```bash
npm install -g continue-cli

# Usage  
continue "explain this code" file.js
```

**Option D: Install Cursor Editor (Advanced)**
If you really need Cursor, you would need to:
1. Install a desktop environment in the container
2. Install Cursor .deb package
3. Use VNC or X11 forwarding for GUI access

This is not recommended for a bot environment.

---

## Quick Reference

### Check Installed Tools

Run this command in the container:

```bash
ai-tools-info
```

### Environment Variables

Add these to your `.env` file for API-based tools:

```env
# GitHub (for Copilot CLI)
GITHUB_TOKEN=ghp_your_token_here

# Anthropic (for Claude API)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# OpenAI (alternative)
OPENAI_API_KEY=sk-your-key-here
```

### Mounting Credentials

To persist GitHub authentication, mount the GitHub CLI config:

```yaml
# In docker-compose.yml
volumes:
  - gh_config:/home/node/.config/gh
```

---

## Post-Installation Checklist

After building and starting the container:

- [ ] Authenticate GitHub CLI: `gh auth login`
- [ ] Install Copilot extension: `gh extension install github/gh-copilot`
- [ ] Test Copilot: `gh copilot suggest "list files"`
- [ ] Set Claude API key: `export ANTHROPIC_API_KEY=...`
- [ ] (Optional) Create Claude wrapper script
- [ ] (Optional) Install alternative tools (aider, continue)

---

## Troubleshooting

### GitHub Copilot CLI Issues

**Error: "extension not installed"**
```bash
gh extension install github/gh-copilot
```

**Error: "not authenticated"**
```bash
gh auth status
gh auth login
```

**Error: "Copilot subscription required"**
- You need an active GitHub Copilot subscription
- Sign up at: https://github.com/features/copilot

### Claude API Issues

**Error: "API key not set"**
```bash
export ANTHROPIC_API_KEY="your-key-here"
# Or add to .env file
```

**Error: "Rate limit exceeded"**
- Check your API usage at: https://console.anthropic.com
- Upgrade your plan if needed

---

## Cost Considerations

### GitHub Copilot
- **Individual**: $10/month or $100/year
- **Business**: $19/user/month
- Free for verified students and open source maintainers

### Claude API
- Pay-as-you-go pricing
- Claude 3.5 Sonnet: ~$3 per million input tokens
- Check current pricing: https://www.anthropic.com/pricing

### Alternatives
- **Aider**: Uses your OpenAI/Anthropic API keys
- **Continue.dev**: Uses various AI providers
- **Local models**: Use Ollama for free local LLMs

---

## Recommendations

**For Best Experience**:
1. ✅ **Use GitHub Copilot CLI** - Most integrated, best for terminal use
2. ⚠️ **Use Claude API** - Powerful but requires scripting
3. ❌ **Skip Cursor** - Not practical in container environment

**For Cost-Conscious Users**:
1. Start with GitHub Copilot ($10/month flat rate)
2. Use Claude API for specific tasks (pay-per-use)
3. Consider Aider with GPT-3.5-Turbo (cheaper)

**For Privacy-Conscious Users**:
1. Use local models with Ollama
2. Self-host Code Llama or similar
3. Keep sensitive code off external APIs

---

## Additional Resources

- GitHub Copilot CLI: https://docs.github.com/en/copilot/github-copilot-in-the-cli
- Anthropic API Docs: https://docs.anthropic.com/
- Aider Documentation: https://aider.chat/
- Continue.dev: https://continue.dev/
- Ollama (local LLMs): https://ollama.ai/
