
import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';

const MEMORY_DIR = path.join(__dirname, '../../memory');
if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Create a token cache with NodeCache for session-based token management
const tokenCache = new NodeCache({ stdTTL: 600 });  // Cache for 10 minutes

// Function to cache tokens per user session
export function cacheToken(username: string, token: string) {
    const userTokens = tokenCache.get(username) || [];
    userTokens.push(token);
    tokenCache.set(username, userTokens);
}

// Retrieve cached tokens
export function getCachedTokens(username: string): string[] | undefined {
    return tokenCache.get(username);
}

// Save long-term memory for each user
export function saveUserMemory(username: string, message: string) {
    const memoryPath = path.join(MEMORY_DIR, `${username}.json`);
    let memory = [];

    if (fs.existsSync(memoryPath)) {
        memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    }
    memory.push({ timestamp: new Date().toISOString(), message });
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}

// Retrieve long-term memory for a user
export function getUserMemory(username: string): any[] {
    const memoryPath = path.join(MEMORY_DIR, `${username}.json`);
    if (fs.existsSync(memoryPath)) {
        return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    }
    return [];
}
