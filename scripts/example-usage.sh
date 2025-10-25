#!/bin/bash

###############################################################################
# Example: How to use run-coderbot-docker.sh
#
# This is a template/example script. 
# DO NOT run this directly - it contains placeholder values!
#
# Copy this file, fill in your actual values, and then run it.
###############################################################################

# Step 1: Set your values
BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"  # Get from @BotFather on Telegram
USER_ID="987654321"                                # Your Telegram user ID
GITHUB_PAT="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"     # GitHub Personal Access Token

# Step 2: Run the script
./scripts/run-coderbot-docker.sh "$BOT_TOKEN" "$USER_ID" "$GITHUB_PAT"

###############################################################################
# After running:
# 1. The script will create a directory like /tmp/coderbot-docker-12345
# 2. Follow the on-screen instructions
# 3. Access your bot on Telegram
# 4. View logs: docker-compose logs -f (from the created directory)
###############################################################################
