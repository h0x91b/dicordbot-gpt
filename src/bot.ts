import { generateWithContext } from './services/duckduckgoRAG';  
import { saveFileToSandbox, readFileFromSandbox, analyzeFileContent } from './services/fileManager';
import { cacheToken, getCachedTokens, saveUserMemory, getUserMemory } from './services/userMemory';
import { generateImage } from './services/imageGeneration';
import { sendRealTimeRequest } from './services/realTimeAPI';
import { autoGPTService } from './services/autoGPTService';
import { responseGenerator } from './services/responseGenerator';
import { reasoningService } from './services/reasoningService';

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const username = message.author.username;
    const query = message.content.trim();

    // RAG-based response for questions with certain keywords
    if (message.content.startsWith('!ask')) {
        const query = message.content.replace('!ask', '').trim();
        const response = await generateWithContext(query);
        message.reply(response);
        return;
    }

    const useRAG = query.length > 50 || /learn|explain|define|who|what|why|how/.test(query.toLowerCase());
    let response;
    if (useRAG) {
        response = await generateWithContext(query);
    } else {
        response = await getChatCompletion(query);
    }
    message.reply(response);

    // Работа с файлами
    if (message.content.startsWith('!upload') && message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment) {
            const response = await fetch(attachment.url);
            const buffer = await response.buffer();
            const filePath = saveFileToSandbox(attachment.name, buffer);
            message.reply(`Файл загружен в песочницу: ${filePath}`);
        }
    }

    if (message.content.startsWith('!read')) {
        const filename = message.content.replace('!read', '').trim();
        const content = readFileFromSandbox(filename);
        if (content) {
            message.reply(`Содержимое файла ${filename}:\n\n${content.slice(0, 2000)}`);
        } else {
            message.reply('Файл не найден или пуст.');
        }
    }

    if (message.content.startsWith('!analyze')) {
        const filename = message.content.replace('!analyze', '').trim();
        const content = readFileFromSandbox(filename);
        if (content) {
            const analysis = analyzeFileContent(content);
            message.reply(analysis);
        } else {
            message.reply('Файл не найден или пуст.');
        }
    }

    // Автоматический анализ всех вложений
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment) {
            const response = await fetch(attachment.url);
            const buffer = await response.buffer();
            const filename = attachment.name;

            saveFileToSandbox(filename, buffer);
            const content = readFileFromSandbox(filename);
            if (content !== null) {
                const analysis = analyzeFileContent(content);
                message.reply(`Анализ файла ${filename}:\n${analysis}`);
            } else {
                message.reply('Не удалось прочитать файл.');
            }
        }
    }

    // Кэширование токенов и сохранение в долговременной памяти
    cacheToken(username, 'sampleToken'); 
    saveUserMemory(username, query);
    const memory = getUserMemory(username);
    const context = memory.map(mem => mem.message).join(' ');

    // Генерация изображения по ключевым словам
    const imageKeywords = /draw|illustrate|image|picture|visualize|show/i;
    if (imageKeywords.test(query)) {
        const imageDescription = query.replace(imageKeywords, '').trim();
        const imageUrl = await generateImage(imageDescription);
        response = `Вот изображение по запросу: "${imageDescription}"\n${imageUrl}`;
    } else {
        response = await getChatCompletion(`${context}\nПользователь: ${query}`);
    }
    message.reply(response);

    // Запросы в реальном времени
    const realTimeResponse = await sendRealTimeRequest(`${context}\nПользователь: ${query}`);
    message.reply(realTimeResponse);

    // Запуск долгосрочных задач с автоGPT
    if (/task|long-term|automate/i.test(query)) {
        const taskDescription = query.replace(/task|long-term|automate/i, '').trim();
        const taskId = autoGPTService.addTask(taskDescription);
        message.reply(`Задача добавлена в автоматизацию с ID: ${taskId}. Я сообщу, когда она будет завершена.`);
    } else {
        response = await sendRealTimeRequest(query);
    }
    message.reply(response);
});

// Проверка завершения задач каждые 60 секунд
setInterval(async () => {
    await autoGPTService.runTasks();
    for (const task of autoGPTService['tasks']) {
        if (task.completed && task.result) {
            client.channels.cache.find(channel => channel.type === 'text')?.send(`Задача ${task.id} завершена: ${task.result}`);
        }
    }
}, 60000);

// Генерация и ответ пользователю через responseGenerator
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const username = message.author.username;
    const query = message.content.trim();
    saveUserMemory(username, query);
    const generatedResponse = await responseGenerator.generateResponse(query, username);
    message.reply(generatedResponse);
});

// Углубленный анализ запроса с использованием reasoningService
const complexKeywords = /analyze deeply|explain thoroughly|complex|detailed/i;
if (complexKeywords.test(query) || query.length > 100) {
    response = 'Запрос принят. Начинаю углубленный анализ. Вы получите результат через некоторое время.';
    reasoningService.processInBackground(query, (result) => {
        client.channels.cache.find(channel => channel.type === 'text')?.send(`Углубленный анализ запроса "${query}": ${result}`);
    });
} else {
    response = await sendRealTimeRequest(query);
}
message.reply(response);
