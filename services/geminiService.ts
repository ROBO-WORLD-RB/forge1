import { GoogleGenAI } from "@google/genai";
import { aiLimiter, RateLimitError } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { analytics } from '../utils/analytics';

// Use Vite env variable for API key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export interface GeminiResponse {
  text: string;
  groundingUrls: { uri: string; title: string }[];
}

/**
 * Sends a message to the AI model.
 * @param message The user's message.
 * @param useSearch If true, enables Google Search grounding (uses gemini-2.5-flash). If false, uses gemini-3-pro-preview.
 * @returns The response text and any grounding URLs.
 */
export const sendGeminiMessage = async (
  message: string,
  useSearch: boolean = false
): Promise<GeminiResponse> => {
  // Rate limiting check
  const rateCheck = aiLimiter.check();
  if (!rateCheck.allowed) {
    logger.warn('AI rate limit exceeded', { retryAfter: rateCheck.retryAfter }, 'geminiService');
    throw new RateLimitError(rateCheck.retryAfter!);
  }

  try {
    logger.debug('Sending AI message', { useSearch, messageLength: message.length }, 'geminiService');

    // Use the @google/genai package API format
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',  // Use the latest flash model
      contents: [{ 
        role: 'user', 
        parts: [{ text: message }] 
      }],
      config: {
        systemInstruction: "You are 'Forge AI', a helpful assistant for the Forge marketplace app connecting blue-collar workers in Ghana and Nigeria. You help users find workers, estimate project costs, and give DIY advice. Be professional, friendly, and concise.",
      },
    });

    const text = response.text || "I'm sorry, I couldn't generate a response.";
    
    // Extract grounding chunks if they exist
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingUrls: { uri: string; title: string }[] = [];

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingUrls.push({
            uri: chunk.web.uri,
            title: chunk.web.title || chunk.web.uri
          });
        }
      });
    }

    logger.info('AI response received', { responseLength: text.length, groundingUrls: groundingUrls.length }, 'geminiService');
    analytics.track('ai_chat', { useSearch, messageLength: message.length });

    return { text, groundingUrls };

  } catch (error: any) {
    // Log detailed error for debugging
    console.error("Gemini API Error:", error);
    logger.error("Gemini API Error", { 
      error: error instanceof Error ? error.message : error,
      stack: error?.stack,
      name: error?.name
    }, 'geminiService');
    analytics.track('ai_error', { error: error instanceof Error ? error.message : 'Unknown error' });
    
    if (error instanceof RateLimitError) {
      return {
        text: `You're sending messages too quickly. Please wait ${error.retryAfter} seconds and try again.`,
        groundingUrls: []
      };
    }

    // Check for specific API errors
    const errorMessage = error?.message || '';
    if (errorMessage.includes('API key')) {
      return {
        text: "Gemini API key is invalid or not configured. Please check your API key.",
        groundingUrls: []
      };
    }
    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return {
        text: "Gemini API quota exceeded. Please try again later or switch to Local mode.",
        groundingUrls: []
      };
    }
    if (errorMessage.includes('model')) {
      return {
        text: "The requested AI model is not available. Please try again.",
        groundingUrls: []
      };
    }
    
    return {
      text: `I apologize, but I'm having trouble connecting to Gemini. Error: ${errorMessage || 'Unknown error'}. Try switching to Local mode.`,
      groundingUrls: []
    };
  }
};