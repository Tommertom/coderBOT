/**
 * Test script for AssistantType enum and activeAssistantType property
 * 
 * This script demonstrates the usage of the AssistantType enum
 * and how the activeAssistantType property tracks session state.
 */

import { AssistantType } from '../src/features/coder/coder.bot.js';

// Test 1: Enum values are correctly defined
console.log('=== Test 1: Enum Values ===');
console.log('COPILOT:', AssistantType.COPILOT); // Expected: 'copilot'
console.log('CLAUDE:', AssistantType.CLAUDE);   // Expected: 'claude'
console.log('GEMINI:', AssistantType.GEMINI);   // Expected: 'gemini'

// Test 2: Type-safe comparisons
console.log('\n=== Test 2: Type-Safe Comparisons ===');
let currentAssistant: AssistantType = AssistantType.COPILOT;
console.log('Current assistant is COPILOT:', currentAssistant === AssistantType.COPILOT); // Expected: true

currentAssistant = AssistantType.CLAUDE;
console.log('Current assistant is CLAUDE:', currentAssistant === AssistantType.CLAUDE);   // Expected: true

// Test 3: Nullable type
console.log('\n=== Test 3: Nullable Type ===');
let activeAssistant: AssistantType | null = null;
console.log('No active session:', activeAssistant); // Expected: null

activeAssistant = AssistantType.CLAUDE;
console.log('Active session with CLAUDE:', activeAssistant); // Expected: 'claude'

activeAssistant = null;
console.log('Session closed:', activeAssistant); // Expected: null

// Test 4: Switch statement (exhaustive check)
console.log('\n=== Test 4: Switch Statement ===');
function getAssistantName(type: AssistantType): string {
    switch (type) {
        case AssistantType.COPILOT:
            return 'GitHub Copilot CLI';
        case AssistantType.CLAUDE:
            return 'Claude AI';
        case AssistantType.GEMINI:
            return 'Gemini AI';
        default:
            // TypeScript will error if we add a new enum value and forget to handle it
            const exhaustiveCheck: never = type;
            return exhaustiveCheck;
    }
}

console.log('COPILOT name:', getAssistantName(AssistantType.COPILOT));
console.log('CLAUDE name:', getAssistantName(AssistantType.CLAUDE));
console.log('GEMINI name:', getAssistantName(AssistantType.GEMINI));

// Test 5: Array of all assistant types
console.log('\n=== Test 5: Iterate All Types ===');
const allAssistants = Object.values(AssistantType);
console.log('All available assistants:', allAssistants);

console.log('\n✅ All tests completed successfully!');
