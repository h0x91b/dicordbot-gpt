
import { sendRealTimeRequest } from './realTimeAPI';

class ReasoningService {
    // Function to perform reasoning for complex tasks
    async performReasoning(taskDescription: string): Promise<string> {
        const reasoningPrompt = `Подробный анализ и рассуждение по вопросу: ${taskDescription}`;
        return await sendRealTimeRequest(reasoningPrompt);
    }

    // Background processing of reasoning tasks
    async processInBackground(taskDescription: string, callback: (result: string) => void) {
        const result = await this.performReasoning(taskDescription);
        callback(result);  // Send result back to bot once reasoning is complete
    }
}

export const reasoningService = new ReasoningService();
