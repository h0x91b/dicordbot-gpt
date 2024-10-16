
import { sendRealTimeRequest } from './realTimeAPI';
import { getUserMemory } from './userMemory';

class ResponseGenerator {
    // Generates a quick preliminary response based on query and user context
    async generatePreliminaryResponse(query: string, username: string): Promise<string> {
        const memory = getUserMemory(username);
        const context = memory.map(mem => mem.message).join(' ');
        const preliminaryPrompt = `Быстрый ответ на вопрос пользователя с учетом предыдущих сообщений: \nКонтекст: ${context}\nПользователь: ${query}`;
        return await sendRealTimeRequest(preliminaryPrompt);
    }

    // Generates a detailed response based on keywords and context
    async generateDetailedResponse(query: string, username: string): Promise<string> {
        const memory = getUserMemory(username);
        const context = memory.map(mem => mem.message).join(' ');
        const detailedPrompt = `Детальный ответ на вопрос с контекстом и возможным дополнительным пояснением: \nКонтекст: ${context}\nПользователь: ${query}`;
        return await sendRealTimeRequest(detailedPrompt);
    }
    
    // Combines preliminary and detailed responses with optional elaboration
    async generateResponse(query: string, username: string): Promise<string> {
        const preliminaryResponse = await this.generatePreliminaryResponse(query, username);
        const detailedResponse = await this.generateDetailedResponse(query, username);
        return `${preliminaryResponse}\n\n---\n\n${detailedResponse}`;
    }
}

export const responseGenerator = new ResponseGenerator();
