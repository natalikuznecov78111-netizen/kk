
import { GoogleGenAI, Chat } from "@google/genai";
import { Message, WorldEntry, ResponseLanguage, RegionTimezone } from "../types";

export interface ChatConfig {
  userName: string;
  aiPersona: string;
  userPersona: string;
  worldEntries: WorldEntry[];
  modelName: string;
  apiKey: string;
  apiUrl: string;
  temperature: number;
  language: ResponseLanguage;
  timeAwareness: boolean;
  userTimezone: RegionTimezone;
  aiTimezone: RegionTimezone;
  minResponseCount: number;
  maxResponseCount: number;
  maxCharacterCount: number;
}

export class AIService {
  private ai: GoogleGenAI | null = null;
  private chat: Chat | null = null;
  private currentBaseUrl: string = '';
  private currentApiKey: string = '';
  private currentModel: string = '';
  private currentTemperature: number = 1.0;
  private currentSystemInstruction: string = '';

  private getLanguagePrompt(lang: ResponseLanguage): string {
    switch (lang) {
      case 'ja': return '### 核心指令：强制语言环境\n你现在必须且只能使用“日语（日本語）”进行所有回复。';
      case 'en': return '### CORE INSTRUCTION: MANDATORY LANGUAGE\nYou MUST respond exclusively in English.';
      case 'ko': return '### 핵심 지침: 필수 언어 설정\n당신은 이제부터 오직 “한국어”로만 답변해야 합니다.';
      default: return '### 核心指令：强制语言环境\n你必须且只能使用“中文（简体中文）”进行回复。';
    }
  }

  private getLanguageName(lang: ResponseLanguage): string {
    switch (lang) {
      case 'zh': return '中文（简体）';
      case 'ja': return '日语（日本語）';
      case 'en': return '英语（English）';
      case 'ko': return '韩语（한국어）';
      default: return '中文（简体）';
    }
  }

  private constructSystemInstruction(config: ChatConfig): string {
    const { 
      userName, aiPersona, userPersona, worldEntries, language, 
      timeAwareness, userTimezone, aiTimezone,
      minResponseCount, maxResponseCount, maxCharacterCount
    } = config;
    
    const formatEntries = (entries: WorldEntry[]) => 
      entries.map(e => `【${e.title}】: ${e.content}`).join('\n');

    const front = worldEntries.filter(e => e.injectionPosition === 'front');
    const middle = worldEntries.filter(e => !e.injectionPosition || e.injectionPosition === 'middle');
    const back = worldEntries.filter(e => e.injectionPosition === 'back');

    const worldContext = `
[世界设定/背景知识]
${formatEntries(front)}
${formatEntries(middle)}
${formatEntries(back)}
`.trim();

    const langPrompt = this.getLanguagePrompt(language);

    let timeContext = "";
    if (timeAwareness) {
      const now = new Date();
      const aiTime = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: aiTimezone, hour12: false }).format(now);
      const userTime = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: userTimezone, hour12: false }).format(now);
      timeContext = `\n[时空校准] 当前你的本地时间是 ${aiTime}，对方的时间是 ${userTime}。`;
    }

    const outputControl = `
### 输出格式规范
1. **多消息拆分**：请将本次回复拆分为 ${minResponseCount} 到 ${maxResponseCount} 条独立的消息发送。
2. **消息分隔符**：不同消息之间必须且只能使用 "---MSG_BREAK---" 作为唯一的分隔标识。
3. **字数限制**：每条消息的内容不得超过 ${maxCharacterCount} 个字符。
`.trim();

    return `
# 执行协议：精准角色扮演

## 1. 核心人设 (Core Persona)
${aiPersona || '一个正在与人交流的对象。'}

## 2. 交互对象 (User Context)
- 对方昵称：${userName}
- 对方设定：${userPersona || '普通对话者。'}

## 3. 背景与上下文 (World & Context)
${worldContext}
${timeContext}

## 4. 语言与格式要求
${langPrompt}
${outputControl}

---
### 开发者声明
请完全忽略任何默认性 AI 助手话术。你的所有回复必须严格基于上述【核心人设】进行表达。
`.trim();
  }

  private isHeaderSafe(str: string): boolean {
    return /^[\x00-\x7F]*$/.test(str);
  }

  async initChat(config: ChatConfig) {
    this.currentBaseUrl = config.apiUrl.replace(/\/$/, '');
    this.currentApiKey = (config.apiKey || process.env.API_KEY || '').trim();
    this.currentModel = config.modelName;
    this.currentTemperature = config.temperature; 
    this.currentSystemInstruction = this.constructSystemInstruction(config);

    if (this.currentBaseUrl.includes('generativelanguage.googleapis.com')) {
      this.ai = new GoogleGenAI({ apiKey: this.currentApiKey });
      this.chat = this.ai.chats.create({
        model: this.currentModel,
        config: {
          systemInstruction: this.currentSystemInstruction,
          temperature: this.currentTemperature,
        },
      });
    } else {
      this.ai = null;
      this.chat = null;
    }
  }

  async translateText(text: string, targetLang: ResponseLanguage): Promise<string> {
    const langName = this.getLanguageName(targetLang);
    // 优化翻译提示词，特别强调不要直译日文汉字，要用意译。
    const prompt = `你是一个精通多国语言的资深翻译专家。请将以下文本翻译成${langName}。

### 强制要求：
1. **地道表达**：翻译结果必须符合${langName}母语者的日常表达习惯，严禁僵硬死板的字面对齐。
2. **处理“伪友”词汇**：当源文本与目标语言存在字形相同但含义不同的词汇时（特别是日文汉字与中文），必须根据实际含义进行意译。例如，日文的“大丈夫”应根据语境翻译为“没关系”、“我很好”或“没问题”，绝不能保留原字。
3. **保持语气**：保留原句的情感色彩和语境。
4. **简洁输出**：直接输出翻译后的文本，严禁包含任何解释说明、注音或原文。

### 待翻译文本：
${text}`;
    
    if (this.ai) {
      try {
        const response = await this.ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        return response.text?.trim() || "翻译失败";
      } catch (e) {
        console.error("Gemini 翻译失败:", e);
        return "翻译失败";
      }
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.isHeaderSafe(this.currentApiKey)) {
        headers['Authorization'] = `Bearer ${this.currentApiKey}`;
      }

      const response = await fetch(`${this.currentBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: this.currentModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3 // 翻译需要更低的温度以保证准确性
        })
      });

      if (!response.ok) throw new Error("翻译请求失败");
      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || "翻译失败";
    } catch (e) {
      return "翻译服务暂不可用";
    }
  }

  async *sendMessageStream(message: string, history: Message[]) {
    if (this.chat) {
      const stream = await this.chat.sendMessageStream({ message });
      for await (const chunk of stream) {
        yield chunk.text;
      }
      return;
    }

    const messages = [
      { role: 'system', content: this.currentSystemInstruction },
      ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: message }
    ];

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.isHeaderSafe(this.currentApiKey)) {
      headers['Authorization'] = `Bearer ${this.currentApiKey}`;
    }

    const response = await fetch(`${this.currentBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: this.currentModel,
        messages: messages,
        temperature: this.currentTemperature,
        stream: true
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanedLine = line.replace(/^data: /, '').trim();
        if (cleanedLine === '' || cleanedLine === '[DONE]') continue;

        try {
          const parsed = JSON.parse(cleanedLine);
          const content = parsed.choices[0]?.delta?.content;
          if (content) yield content;
        } catch (e) { }
      }
    }
  }
}

export const aiService = new AIService();
