
import { cacheToken, getCachedTokens, saveUserMemory, getUserMemory } from './src/services/userMemory';
import { saveFileToSandbox, readFileFromSandbox, analyzeFileContent } from './src/services/fileManager';
import { sendRealTimeRequest } from './src/services/realTimeAPI';

describe('userMemory Module', () => {
    test('should cache tokens per user session', () => {
        cacheToken('testUser', 'testToken123');
        const tokens = getCachedTokens('testUser');
        expect(tokens).toContain('testToken123');
    });

    test('should save and retrieve user memory', () => {
        saveUserMemory('testUser', 'Hello, this is a test message!');
        const memory = getUserMemory('testUser');
        expect(memory[memory.length - 1].message).toBe('Hello, this is a test message!');
    });
});

describe('fileManager Module', () => {
    test('should save and read files from sandbox', () => {
        const filename = 'test.txt';
        const content = Buffer.from('This is a test file');
        saveFileToSandbox(filename, content);

        const readContent = readFileFromSandbox(filename);
        expect(readContent).toBe('This is a test file');
    });

    test('should analyze text files correctly', () => {
        const analysis = analyzeFileContent('This is a test file content');
        expect(analysis).toContain('Количество слов: 5');
    });

    test('should analyze binary files with byte summary', () => {
        const binaryContent = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
        const analysis = analyzeFileContent(binaryContent);
        expect(analysis).toContain('Тип: Бинарный файл');
        expect(analysis).toContain('Размер: 4 байт');
    });
});

describe('realTimeAPI Module', () => {
    test('should handle real-time request', async () => {
        const response = await sendRealTimeRequest('Test real-time API message');
        expect(response).toBeTruthy();
    });
});
