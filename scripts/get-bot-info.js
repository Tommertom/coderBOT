#!/usr/bin/env node

/**
 * Script to read bot tokens from .env file and extract bot details
 * Usage: node scripts/get-bot-info.js
 */

import { config } from 'dotenv';
import { Bot } from 'grammy';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
config({ path: join(__dirname, '..', '.env') });

async function getBotInfo(token, index) {
    try {
        const bot = new Bot(token);
        const botInfo = await bot.api.getMe();
        
        console.log(`\n🤖 Bot #${index + 1} Information:`);
        console.log(`   Name: ${botInfo.first_name}`);
        console.log(`   Username: @${botInfo.username}`);
        console.log(`   ID: ${botInfo.id}`);
        console.log(`   Can Join Groups: ${botInfo.can_join_groups}`);
        console.log(`   Can Read All Group Messages: ${botInfo.can_read_all_group_messages}`);
        console.log(`   Supports Inline Queries: ${botInfo.supports_inline_queries}`);
        
        return {
            name: botInfo.first_name,
            username: botInfo.username,
            id: botInfo.id,
            token: token.substring(0, 10) + '...' // Only show first 10 chars for security
        };
    } catch (error) {
        console.error(`\n❌ Error fetching info for Bot #${index + 1}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('📋 Reading bot tokens from .env file...\n');
    
    const tokensStr = process.env.TELEGRAM_BOT_TOKENS;
    
    if (!tokensStr) {
        console.error('❌ No TELEGRAM_BOT_TOKENS found in .env file');
        console.log('\nPlease add your bot token(s) to the .env file:');
        console.log('TELEGRAM_BOT_TOKENS=your_token_here');
        console.log('\nFor multiple bots, separate tokens with commas:');
        console.log('TELEGRAM_BOT_TOKENS=token1,token2,token3');
        process.exit(1);
    }
    
    const tokens = tokensStr
        .split(',')
        .map(token => token.trim())
        .filter(token => token.length > 0);
    
    console.log(`Found ${tokens.length} bot token(s)\n`);
    console.log('='.repeat(60));
    
    const results = [];
    for (let i = 0; i < tokens.length; i++) {
        const result = await getBotInfo(tokens[i], i);
        if (result) {
            results.push(result);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Successfully retrieved info for ${results.length} bot(s)`);
    
    if (results.length > 0) {
        console.log('\n📊 Summary:');
        results.forEach((bot, idx) => {
            console.log(`   ${idx + 1}. ${bot.name} (@${bot.username}) - ID: ${bot.id}`);
        });
    }
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
