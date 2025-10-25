#!/bin/bash

###############################################################################
# Example: How to use run-coderbot-docker.sh
#
# This is a template/example script. 
# DO NOT run this directly - it contains placeholder values!
#
# Copy this file, fill in your actual values, and then run it.
###############################################################################

# Example 1: Single bot, single user
BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"  # Get from @BotFather on Telegram
USER_ID="987654321"                                # Your Telegram user ID
GITHUB_PAT="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"     # GitHub Personal Access Token

./scripts/run-coderbot-docker.sh "$BOT_TOKEN" "$USER_ID" "$GITHUB_PAT"

# Example 2: Multiple bots, multiple users (comma-separated)
BOT_TOKENS="123456789:ABCdef...,987654321:XYZabc..."  # Multiple bot tokens
USER_IDS="111111111,222222222,333333333"             # Multiple user IDs
GITHUB_PAT="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"        # GitHub Personal Access Token

./scripts/run-coderbot-docker.sh "$BOT_TOKENS" "$USER_IDS" "$GITHUB_PAT"

###############################################################################
# After running:
# 1. The script will create a directory like /tmp/coderbot-docker-12345
# 2. Follow the on-screen instructions
# 3. Access your bot on Telegram
# 4. View logs: docker-compose logs -f (from the created directory)
###############################################################################
