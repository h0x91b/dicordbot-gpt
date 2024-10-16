
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_REALTIME_API_URL = process.env.OPENAI_REALTIME_API_URL; // URL Realtime API OpenAI
const API_KEY = process.env.OPENAI_API_KEY; // API ключ для доступа

// Функция для отправки запроса в режиме реального времени
export async function sendRealTimeRequest(query: string) {
    try {
        const response = await axios.post(OPENAI_REALTIME_API_URL, {
            model: 'gpt-4', // Указываем модель для API
            messages: [{ role: 'user', content: query }]
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Ошибка в RealTime API запросе:', error);
        return 'Извините, произошла ошибка при обработке вашего запроса в режиме реального времени.';
    }
}
