import * as fs from 'fs';
import * as path from 'path';
import { CustomCoder, ValidationResult } from '../types/custom-coder.types.js';

export class CustomCoderService {
    private readonly customCodersDir: string;
    private readonly MIN_NAME_LENGTH = 2;
    private readonly MAX_NAME_LENGTH = 20;

    constructor() {
        this.customCodersDir = path.join(process.cwd(), 'customcoders');
        this.ensureCustomCodersDirectory();
    }

    private ensureCustomCodersDirectory(): void {
        try {
            if (!fs.existsSync(this.customCodersDir)) {
                fs.mkdirSync(this.customCodersDir, { recursive: true });
                console.log(`Created custom coders directory: ${this.customCodersDir}`);
            }
        } catch (error) {
            console.error('Failed to create custom coders directory:', error);
        }
    }

    /**
     * Sanitize coder name to lowercase a-z only
     * CRITICAL: This function must be used consistently across all commands
     */
    sanitizeCoderName(name: string): string {
        let sanitized = name.replace(/[^a-z]/gi, '');
        return sanitized.toLowerCase();
    }

    /**
     * Validate coder name
     */
    validateCoderName(name: string): ValidationResult {
        if (!name || name.length < this.MIN_NAME_LENGTH) {
            return {
                valid: false,
                error: `Coder name must be at least ${this.MIN_NAME_LENGTH} characters.`
            };
        }

        if (name.length > this.MAX_NAME_LENGTH) {
            return {
                valid: false,
                error: `Coder name must be ${this.MAX_NAME_LENGTH} characters or less.`
            };
        }

        // Check if name contains only letters
        if (!/^[a-z]+$/.test(name)) {
            return {
                valid: false,
                error: 'Coder name must contain only lowercase letters (a-z).'
            };
        }

        return { valid: true };
    }

    /**
     * Check if name is valid (combines sanitization and validation)
     */
    isValidCoderName(name: string): boolean {
        const sanitized = this.sanitizeCoderName(name);
        return this.validateCoderName(sanitized).valid;
    }

    /**
     * Get file path for custom coder
     */
    getCustomCoderPath(userId: string, coderName: string): string {
        const sanitizedName = this.sanitizeCoderName(coderName);
        const filename = `${userId}-${sanitizedName}.json`;
        return path.join(this.customCodersDir, filename);
    }

    /**
     * Save custom coder configuration
     */
    saveCustomCoder(userId: string, coderName: string, botId: string = 'unknown'): void {
        try {
            const sanitizedName = this.sanitizeCoderName(coderName);
            const filepath = this.getCustomCoderPath(userId, sanitizedName);

            const data: CustomCoder = {
                userId,
                coderName: sanitizedName,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                metadata: {
                    botId,
                    version: '1.0'
                }
            };

            fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`Saved custom coder for user ${userId}: ${sanitizedName}`);
        } catch (error) {
            console.error(`Failed to save custom coder for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Delete custom coder configuration
     */
    deleteCustomCoder(userId: string, coderName: string): boolean {
        try {
            const sanitizedName = this.sanitizeCoderName(coderName);
            const filepath = this.getCustomCoderPath(userId, sanitizedName);

            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`Deleted custom coder for user ${userId}: ${sanitizedName}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Failed to delete custom coder for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Check if custom coder exists
     */
    hasCustomCoder(userId: string, coderName: string): boolean {
        const sanitizedName = this.sanitizeCoderName(coderName);
        const filepath = this.getCustomCoderPath(userId, sanitizedName);
        return fs.existsSync(filepath);
    }

    /**
     * Load all custom coders for a user
     */
    loadCustomCoders(userId: string): CustomCoder[] {
        try {
            const files = fs.readdirSync(this.customCodersDir);
            const userPrefix = `${userId}-`;
            const customCoders: CustomCoder[] = [];

            for (const file of files) {
                if (file.startsWith(userPrefix) && file.endsWith('.json')) {
                    try {
                        const filepath = path.join(this.customCodersDir, file);
                        const content = fs.readFileSync(filepath, 'utf-8');
                        const data = JSON.parse(content) as CustomCoder;
                        customCoders.push(data);
                    } catch (error) {
                        console.error(`Failed to load custom coder file ${file}:`, error);
                    }
                }
            }

            return customCoders;
        } catch (error) {
            console.error(`Failed to load custom coders for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Update last used timestamp
     */
    updateLastUsed(userId: string, coderName: string): void {
        try {
            const sanitizedName = this.sanitizeCoderName(coderName);
            const filepath = this.getCustomCoderPath(userId, sanitizedName);

            if (fs.existsSync(filepath)) {
                const content = fs.readFileSync(filepath, 'utf-8');
                const data = JSON.parse(content) as CustomCoder;
                data.lastUsed = new Date().toISOString();
                fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
            }
        } catch (error) {
            console.error(`Failed to update last used for ${coderName}:`, error);
        }
    }
}
