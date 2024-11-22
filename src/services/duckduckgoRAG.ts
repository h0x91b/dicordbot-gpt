
import axios from 'axios';
import { getChatCompletion } from './openai'; // Используем OpenAI API для генерации ответов с извлеченной информацией
import dotenv from 'dotenv';

dotenv.config();

const DUCKDUCKGO_API_URL = 'https://api.duckduckgo.com/';

// Функция для поиска через DuckDuckGo
export async function fetchDuckDuckGoResults(query: string): Promise<string[]> {
    try {
        const response = await axios.get(DUCKDUCKGO_API_URL, {
            params: {
                q: query,
                format: 'json',
                no_html: 1,
                skip_disambig: 1
            }
        });
        return response.data.RelatedTopics.map((topic: any) => topic.Text);
    } catch (error) {
        console.error('Ошибка при поиске через DuckDuckGo:', error);
        return [];
    }
}

// Функция для генерации ответа с учетом информации из DuckDuckGo
export async function generateWithContext(query: string): Promise<string> {
    const results = await fetchDuckDuckGoResults(query);
    const context = results.join(" ");
    const prompt = `Вопрос: ${query} Ответ (учитывая информацию из сети): ${context}`;
    const response = await getChatCompletion(prompt);
    return response;
}
