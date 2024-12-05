
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

const SANDBOX_DIR = path.join(__dirname, '../../sandbox');
if (!fs.existsSync(SANDBOX_DIR)) {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

// Save any file type to the sandbox
export function saveFileToSandbox(filename: string, content: Buffer): string {
    const filePath = path.join(SANDBOX_DIR, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
}

// Read file with flexible handling based on file type
export function readFileFromSandbox(filename: string): string | Buffer | null {
    const filePath = path.join(SANDBOX_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.error('Файл не найден в песочнице:', filename);
        return null;
    }

    const extension = path.extname(filename).toLowerCase();
    try {
        if (extension === '.txt' || extension === '.js' || extension === '.md') {
            return fs.readFileSync(filePath, 'utf8');
        } else if (extension === '.docx') {
            const buffer = fs.readFileSync(filePath);
            const { value: text } = mammoth.extractRawText({ buffer });
            return text;
        } else {
            return fs.readFileSync(filePath);  // For binary and other formats
        }
    } catch (error) {
        console.error('Ошибка чтения файла:', error);
        return null;
    }
}

// Analyze file content based on type, using byte-level analysis for non-text files
export function analyzeFileContent(content: string | Buffer): string {
    if (typeof content === 'string') {
        const wordCount = content.split(/\s+/).length;
        const charCount = content.length;
        const lineCount = content.split('\n').length;
        return `Анализ файла:\n- Количество слов: ${wordCount}\n- Количество символов: ${charCount}\n- Количество строк: ${lineCount}`;
    } else {
        // Byte analysis for binary and other file types
        const byteSummary = Array.from(content.slice(0, 20)).map(byte => byte.toString(16).padStart(2, '0')).join(' ');
        return `Анализ файла:\n- Тип: Бинарный файл\n- Размер: ${content.byteLength} байт\n- Первые 20 байт: ${byteSummary}...`;
    }
}
