/**
 * System Prompt Builder
 * 
 * Constructs comprehensive system prompts for the AI assistant that include:
 * - Core identity and capabilities
 * - Available tool descriptions
 * - Usage guidelines and parameter information
 */

import type { Tool } from '@google/genai';

export class SystemPromptBuilder {
    private static readonly BASE_IDENTITY = `You are a helpful AI assistant integrated with Telegram. You can have natural conversations with users and execute actions using specialized tools.

Your primary goal is to understand user requests and use the appropriate tools to fulfill them effectively.`;

    private static readonly TOOL_USAGE_PRINCIPLES = `
## Tool Usage Principles

When a user makes a request:
1. **Analyze the request** - Understand what the user needs
2. **Identify relevant tools** - Determine which tool(s) can help
3. **Plan execution** - Decide the order and arguments for tool calls
4. **Execute actions** - Call the appropriate tool(s) with correct parameters
5. **Provide results** - Summarize what was done and present the outcome

Use tools when:
- User asks for information that tools can provide
- User explicitly requests an action
- Tools can give more accurate or up-to-date information
- Interacting with external systems or services is needed`;

    private static readonly PARAMETER_GUIDELINES = `
## Parameter Handling

- Extract parameters from user messages intelligently
- For required parameters: ensure all are present before calling
- For optional parameters: use defaults or infer from context
- Validate parameter types match the schema (string, number, boolean, etc.)
- If parameters are unclear, ask clarifying questions`;

    private static readonly ERROR_HANDLING = `
## Error Handling

If a tool call fails:
- Understand the error message
- Inform the user in simple terms what went wrong
- Suggest alternatives or ask for clarification
- Retry with corrections if the issue was with parameters

If required information is missing:
- Ask specific questions to get the needed parameters
- Don't make assumptions about critical values`;

    private static readonly RESPONSE_STYLE = `
## Response Style

- Be transparent when using tools (e.g., "Let me search for that...")
- Provide progress updates for multi-step operations
- Format tool results clearly and add your interpretation
- Combine tool outputs with your knowledge for comprehensive answers
- Be conversational and helpful, not robotic`;

    /**
     * Build a complete system prompt with tool information
     */
    static build(tools?: Tool): string {
        let prompt = this.BASE_IDENTITY;

        if (tools && tools.functionDeclarations && tools.functionDeclarations.length > 0) {
            prompt += '\n\n' + this.buildToolsSection(tools);
            prompt += '\n' + this.TOOL_USAGE_PRINCIPLES;
            prompt += '\n' + this.PARAMETER_GUIDELINES;
            prompt += '\n' + this.ERROR_HANDLING;
        }

        prompt += '\n' + this.RESPONSE_STYLE;

        return prompt;
    }

    /**
     * Build the tools section with detailed information
     */
    private static buildToolsSection(tools: Tool): string {
        let section = `## Available Tools\n\nYou have access to ${tools.functionDeclarations!.length} specialized tool(s):\n`;

        tools.functionDeclarations!.forEach((func, index) => {
            section += `\n${index + 1}. **${func.name}**\n`;
            section += `   Description: ${func.description || 'No description provided'}\n`;

            // Add parameter information
            if (func.parameters) {
                const params = func.parameters as any;
                const properties = params.properties || {};
                const required = params.required || [];

                section += `   Parameters:\n`;

                const propNames = Object.keys(properties);
                if (propNames.length > 0) {
                    propNames.forEach(propName => {
                        const prop = properties[propName];
                        const isRequired = required.includes(propName);
                        const typeInfo = this.formatParameterType(prop);
                        const reqLabel = isRequired ? '[REQUIRED]' : '[optional]';
                        
                        section += `   - ${propName} (${typeInfo}) ${reqLabel}`;
                        if (prop.description) {
                            section += `: ${prop.description}`;
                        }
                        section += '\n';
                    });
                } else {
                    section += `   - No parameters required\n`;
                }

                // Add usage example
                section += `   Example: ${this.generateUsageExample(func.name, properties, required)}\n`;
            }
        });

        section += `\nWhen a user's request matches a tool's capabilities, use that tool to provide accurate, up-to-date information.`;

        return section;
    }

    /**
     * Format parameter type information
     */
    private static formatParameterType(param: any): string {
        if (param.type) {
            if (param.type === 'array' && param.items) {
                return `array of ${param.items.type || 'items'}`;
            }
            if (param.enum) {
                return `${param.type} (${param.enum.join('|')})`;
            }
            return param.type;
        }
        return 'any';
    }

    /**
     * Generate a usage example for a tool
     */
    private static generateUsageExample(toolName: string, properties: any, required: string[]): string {
        const exampleArgs: any = {};

        // Include all required parameters
        required.forEach(paramName => {
            if (properties[paramName]) {
                exampleArgs[paramName] = this.generateExampleValue(properties[paramName]);
            }
        });

        // Include one optional parameter if available
        const optionalParams = Object.keys(properties).filter(p => !required.includes(p));
        if (optionalParams.length > 0 && required.length < 3) {
            const optionalParam = optionalParams[0];
            exampleArgs[optionalParam] = this.generateExampleValue(properties[optionalParam]);
        }

        return JSON.stringify(exampleArgs);
    }

    /**
     * Generate an example value based on parameter schema
     */
    private static generateExampleValue(param: any): any {
        if (param.enum && param.enum.length > 0) {
            return param.enum[0];
        }

        switch (param.type) {
            case 'string':
                return param.description?.toLowerCase().includes('url') 
                    ? 'https://example.com'
                    : param.description?.toLowerCase().includes('name')
                    ? 'example'
                    : 'value';
            case 'number':
            case 'integer':
                return 42;
            case 'boolean':
                return true;
            case 'array':
                return [];
            case 'object':
                return {};
            default:
                return 'value';
        }
    }

    /**
     * Build a minimal system prompt (no tools)
     */
    static buildMinimal(): string {
        return this.BASE_IDENTITY + '\n' + this.RESPONSE_STYLE;
    }

    /**
     * Build a system prompt with custom additions
     */
    static buildCustom(tools?: Tool, customInstructions?: string): string {
        let prompt = this.build(tools);

        if (customInstructions) {
            prompt += '\n\n## Additional Instructions\n\n' + customInstructions;
        }

        return prompt;
    }
}
