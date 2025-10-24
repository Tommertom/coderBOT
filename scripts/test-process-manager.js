#!/usr/bin/env node

/**
 * Script to test if ProcessManager receives bot info correctly
 * This simulates starting a bot and checking if the info is stored
 */

import { config } from 'dotenv';
import { ProcessManager } from '../dist/services/process-manager.service.js';
import { ConfigService } from '../dist/services/config.service.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
config({ path: join(__dirname, '..', '.env') });

async function test() {
    console.log('🧪 Testing ProcessManager bot info retrieval...\n');
    
    const configService = new ConfigService();
    const processManager = new ProcessManager(configService);
    
    try {
        const tokens = configService.getTelegramBotTokens();
        
        if (tokens.length === 0) {
            console.error('❌ No bot tokens found in .env file');
            process.exit(1);
        }
        
        console.log(`Found ${tokens.length} bot token(s)\n`);
        
        // Start first bot
        const botId = 'bot-1';
        console.log(`⏳ Starting ${botId}...`);
        await processManager.startBot(botId, tokens[0]);
        
        // Wait a bit for the bot to initialize and send info
        console.log('⏳ Waiting 5 seconds for bot to initialize and send info...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check bot status
        const status = processManager.getBotStatus(botId);
        
        console.log('\n📊 Bot Status:');
        console.log(`   Bot ID: ${status.botId}`);
        console.log(`   Status: ${status.status}`);
        console.log(`   PID: ${status.pid}`);
        console.log(`   Full Name: ${status.fullName || '❌ NOT SET'}`);
        console.log(`   Username: ${status.username || '❌ NOT SET'}`);
        console.log(`   Uptime: ${status.uptime}ms`);
        
        // Show captured logs
        console.log('\n📋 Captured Logs:');
        const logs = processManager.getBotLogs(botId, 50);
        logs.forEach(log => console.log(`   ${log}`));
        
        if (status.fullName) {
            console.log('\n✅ Bot info received successfully!');
        } else {
            console.log('\n❌ Bot info NOT received - this is the bug!');
        }
        
        // Cleanup
        console.log('\n⏳ Stopping bot...');
        await processManager.stopBot(botId);
        console.log('✅ Test complete');
        
    } catch (error) {
        console.error('💥 Error:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

test();
