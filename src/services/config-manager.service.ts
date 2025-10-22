import * as fs from 'fs/promises';
import * as path from 'path';
import { Bot } from 'grammy';

export class ConfigManager {
    private envPath: string;
    private envCache: Map<string, string> = new Map();

    constructor(envPath: string = '.env') {
        this.envPath = path.resolve(envPath);
    }

    async initialize(): Promise<void> {
        await this.reloadEnv();
    }

    async getBotTokens(): Promise<string[]> {
        const tokensStr = this.envCache.get('TELEGRAM_BOT_TOKENS') || '';
        return tokensStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }

    async getBotToken(index: number): Promise<string | undefined> {
        const tokens = await this.getBotTokens();
        return tokens[index];
    }

    async addBotToken(token: string): Promise<void> {
        const isValid = await this.validateBotToken(token);
        if (!isValid) {
            throw new Error('Invalid bot token');
        }

        await this.createBackup();

        const tokens = await this.getBotTokens();
        tokens.push(token);

        await this.updateEnvVariable('TELEGRAM_BOT_TOKENS', tokens.join(','));
        await this.reloadEnv();
    }

    async removeBotToken(index: number): Promise<void> {
        const tokens = await this.getBotTokens();
        
        if (index < 0 || index >= tokens.length) {
            throw new Error(`Invalid bot index: ${index}`);
        }

        await this.createBackup();

        tokens.splice(index, 1);

        await this.updateEnvVariable('TELEGRAM_BOT_TOKENS', tokens.join(','));
        await this.reloadEnv();
    }

    async updateBotToken(index: number, newToken: string): Promise<void> {
        const tokens = await this.getBotTokens();
        
        if (index < 0 || index >= tokens.length) {
            throw new Error(`Invalid bot index: ${index}`);
        }

        const isValid = await this.validateBotToken(newToken);
        if (!isValid) {
            throw new Error('Invalid bot token');
        }

        await this.createBackup();

        tokens[index] = newToken;

        await this.updateEnvVariable('TELEGRAM_BOT_TOKENS', tokens.join(','));
        await this.reloadEnv();
    }

    async reloadEnv(): Promise<void> {
        try {
            const content = await fs.readFile(this.envPath, 'utf-8');
            this.envCache.clear();

            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();

                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    this.envCache.set(key, value);
                }
            }
        } catch (error) {
            throw new Error(`Failed to read .env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async validateBotToken(token: string): Promise<boolean> {
        try {
            const bot = new Bot(token);
            const me = await bot.api.getMe();
            return !!me.id;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }

    private async updateEnvVariable(key: string, value: string): Promise<void> {
        try {
            const content = await fs.readFile(this.envPath, 'utf-8');
            const lines = content.split('\n');
            let found = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith(`${key}=`)) {
                    lines[i] = `${key}=${value}`;
                    found = true;
                    break;
                }
            }

            if (!found) {
                lines.push(`${key}=${value}`);
            }

            await fs.writeFile(this.envPath, lines.join('\n'), 'utf-8');
        } catch (error) {
            throw new Error(`Failed to update .env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async createBackup(): Promise<void> {
        try {
            const backupPath = `${this.envPath}.backup`;
            await fs.copyFile(this.envPath, backupPath);
            console.log(`Created backup: ${backupPath}`);
        } catch (error) {
            console.warn('Failed to create backup:', error);
        }
    }

    async restoreBackup(): Promise<void> {
        try {
            const backupPath = `${this.envPath}.backup`;
            await fs.copyFile(backupPath, this.envPath);
            await this.reloadEnv();
            console.log('Restored from backup');
        } catch (error) {
            throw new Error(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    getEnvValue(key: string): string | undefined {
        return this.envCache.get(key);
    }
}
