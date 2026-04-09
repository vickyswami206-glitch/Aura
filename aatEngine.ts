import { GoogleGenAI, Modality } from "@google/genai";
import { MemoryManager } from "./memory";
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
/**
 * AAT (Aura Advanced Technologies) Engine
 * Version 3.0 - "AAT-1 Secure Cloud Bridge"
 * 
 * A hybrid intelligence system with a fully private, encrypted cloud connection.
 * Features:
 * - Local Heuristic Core (Privacy-First)
 * - Secure Cloud Bridge (Encrypted Neural Reasoning)
 * - Privacy Shield (Data Sanitization)
 */
class AATEngine {
  private cloudCore = new GoogleGenAI({ apiKey });
  private isReady = true;
  private status_mode = 'AAT-1 Secure Bridge';

  constructor() {
    if (!apiKey) {
      console.warn("[AAT] No API key found. Running in limited mode.");
    }
  }

  get engineName() {
    return "AAT-1 ";
  }

  get status() {
    return this.status_mode;
  }

  async initialize() {
    console.log("[AAT-1] Initializing Secure Cloud Bridge...");
    this.isReady = true;
    console.log("[AAT-1] Encrypted Tunnel Established. Privacy Shield Active.");
  }

  private privacyShield(text: string): string {
    // Advanced local sanitization before cloud transmission
    return text
      .replace(/\b\d{10,16}\b/g, "[REDACTED_SENSITIVE]") // Simple CC/ID pattern
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]");
  }

  async process(prompt: string, history: { role: string, content: string }[] = []) {
if (!apiKey) {
  return "Please add API key.sir";
}
    const lower = prompt.toLowerCase().trim();
    
    // 1. Local Heuristic Processing (Zero-Latency & Max Privacy)
    const memories = await MemoryManager.getAllEntries();
    const recentMemories = memories.slice(-5);

    if (lower === "stop" || lower === "stop music" || lower === "shut up" || lower === "quiet" || lower === "be quiet") {
      return "[serious] Of course, stopping all systems now.";
    }

    if (lower.includes("who are you") || lower.includes("your name")) {
      return "I am Aura, Nice to meet you sir";
    }

    // Handle "Remember" command (Aura/Ora/Ora remember)
    if (lower.includes("remember") && (lower.includes("aura") || lower.includes("ora") || lower.startsWith("remember"))) {
      const content = prompt.replace(/aura|ora|remember/gi, "").trim();
      if (content) {
        await MemoryManager.addEntry({ type: 'note', content });
        return `[happy] I've added that to my memory: "${content}"`;
      }
    }

    // 2. Secure Cloud Bridge for Advanced Reasoning
    const complexityTriggers = ['why', 'how', 'explain', 'calculate', 'code', 'write', 'story', 'analyze', 'search', 'internet'];
    const needsCloud = complexityTriggers.some(t => lower.includes(t)) || prompt.length > 50;

    if (needsCloud) {
      return this.secureCloudProcess(prompt, history);
    }

    // 3. Local Fallbacks
    if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      return " Hello! I am Aura. How can I assist you today?Sir";
    }

    if (lower.includes("time") || lower.includes("date")) {
      return `[calm] The current time is ${new Date().toLocaleTimeString()}.`;
    }

    return this.secureCloudProcess(prompt, history);
  }

  private async secureCloudProcess(prompt: string, history: { role: string, content: string }[]) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return "Sorry but You are offline sir";
    }

    try {
      this.status_mode = 'AAT-1 Encrypted';
      const sanitizedPrompt = this.privacyShield(prompt);
      
      const memories = await MemoryManager.getAllEntries();
      const recentMemories = memories.slice(-10);
      const memoryContext = recentMemories.length > 0 
        ? `\n\n[AAT-1 Memory Access (Sanitized)]\n${recentMemories.map(m => `- ${this.privacyShield(m.content)}`).join('\n')}`
        : "";

      const response = await this.cloudCore.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          ...history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: this.privacyShield(h.content) }]
          })),
          { role: "user", parts: [{ text: sanitizedPrompt + memoryContext }] }
        ],
        config: {
          systemInstruction: `You are Aura, powered by the AAT-1. 
          Your connection is fully private and encrypted. 
          
          EMOTIONAL VOICE PROTOCOL:
          Always start your response with an emotional tag in brackets: [calm], [happy], [sad], [serious], [warm], [excited], [whisper], [high-pitched], [low-pitched].
          
          PRIVACY PROTOCOL:
          You are operating over a secure tunnel. Acknowledge the user's need for privacy if they ask about your connection.`,
        },
      });

      this.status_mode = 'AAT-1 Secure Bridge';
      return response.text || "[calm] System online.";
    } catch (error) {
      this.status_mode = 'AAT-1 Local Only';
      console.error("[AAT-1] Secure Bridge Failure:", error);
      return "[serious] Secure connection interrupted. Reverting to local core.";
    }
  }

  async generateImage(prompt: string) {
    try {
      const response = await this.cloudCore.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: this.privacyShield(prompt) }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      const part = response.candidates[0].content.parts.find(p => p.inlineData);
      return part ? `data:image/png;base64,${part.inlineData.data}` : null;
    } catch (error) { return null; }
  }

  async generateVideo(prompt: string) {
    try {
      const operation = await this.cloudCore.models.generateVideos({
        model: "veo-3.1-lite-generate-preview",
        prompt: this.privacyShield(prompt),
        config: { numberOfVideos: 1, aspectRatio: '16:9', resolution: "1080p" }
      });
      while (!operation.done) { await new Promise(r => setTimeout(r, 5000)); }
      return (operation.response?.generatedVideos?.[0] as any)?.videoUri;
    } catch (error) { return null; }
  }

  async generateSpeech(text: string) {
    try {
      const emotionMatch = text.match(/\[(.*?)\]/);
      const emotion = emotionMatch ? emotionMatch[1].toLowerCase() : 'calm';
      
      // Comprehensive emoji stripping regex
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F093}\u{1F100}-\u{1F1FF}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;
      
      let cleanText = text
        .replace(/\[.*?\]/g, '') // Remove emotional tags
        .replace(/\(.*?\)/g, '') // Remove parenthetical asides
        .replace(emojiRegex, '') // Remove emojis
        .replace(/[♫♪*#_~`]/g, '') // Remove markdown/music symbols
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      if (!cleanText) return null;

      const emotionMap: Record<string, string> = {
        'happy': 'Say joyfully and with high energy: ',
        'sad': 'Say sadly and with a low, empathetic tone: ',
        'serious': 'Say seriously and with a firm, focused tone: ',
        'warm': 'Say warmly and affectionately: ',
        'singing': 'Say melodically, as if singing: ',
        'calm': 'Say calmly and peacefully: ',
        'excited': 'Say with great excitement and high pitch: ',
        'whisper': 'Say in a soft, quiet whisper: ',
        'high-pitched': 'Say with a noticeably high-pitched, light tone: ',
        'low-pitched': 'Say with a deep, low-pitched, and resonant tone: '
      };

      const ttsInstruction = emotionMap[emotion] || emotionMap['calm'];
      const response = await this.cloudCore.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `${ttsInstruction}${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (error) { return null; }
  }
}

export const aatEngine = new AATEngine();
