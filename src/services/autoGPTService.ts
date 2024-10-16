
import { cacheToken, getCachedTokens, saveUserMemory, getUserMemory } from './userMemory';
import { sendRealTimeRequest } from './realTimeAPI';
import { generateImage } from './imageGeneration';
import { saveFileToSandbox, readFileFromSandbox, analyzeFileContent } from './fileManager';

type Task = {
    id: number;
    description: string;
    completed: boolean;
    result?: string;
};

class AutoGPTService {
    private tasks: Task[] = [];
    private taskIdCounter = 1;

    // Add a new task to the queue
    addTask(description: string): number {
        const task: Task = { id: this.taskIdCounter++, description, completed: false };
        this.tasks.push(task);
        return task.id;
    }

    // Run tasks and update status
    async runTasks() {
        for (const task of this.tasks) {
            if (!task.completed) {
                task.result = await this.executeTask(task.description);
                task.completed = true;
            }
        }
    }

    // Execute a specific task based on description
    private async executeTask(description: string): Promise<string> {
        // Determine task type and route to appropriate function
        if (/generate image/i.test(description)) {
            const prompt = description.replace(/generate image/i, '').trim();
            return await generateImage(prompt);
        } else if (/analyze file/i.test(description)) {
            const filename = description.replace(/analyze file/i, '').trim();
            const content = readFileFromSandbox(filename);
            return content ? analyzeFileContent(content) : 'File not found';
        } else {
            // Default to RealTime request
            return await sendRealTimeRequest(description);
        }
    }

    // Retrieve task status and results
    getTaskStatus(id: number): string {
        const task = this.tasks.find(task => task.id === id);
        if (!task) return 'Task not found';
        return task.completed ? `Task completed: ${task.result}` : 'Task in progress';
    }
}

export const autoGPTService = new AutoGPTService();
