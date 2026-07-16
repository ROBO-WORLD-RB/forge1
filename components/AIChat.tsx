import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Send, X, Minimize2, Globe, Bot, Loader2, ExternalLink, Cpu, Cloud, RefreshCw } from 'lucide-react';
import { 
  sendAIMessage, 
  AIProvider, 
  getProviderStatus, 
  clearConversationHistory,
  getProviderDisplayName 
} from '../services/aiService';
import { ChatMessage } from '../types';
import {
  getInstallPromptVisible,
  subscribeInstallPromptVisible,
} from '../utils/installPromptVisibility';

/** Routes where the FAB would cover primary chat controls (send, composer). */
const HIDE_FAB_ROUTES = ['/messages'];

const AIChat: React.FC = () => {
  const location = useLocation();
  const hideOnRoute = HIDE_FAB_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  const [installPromptVisible, setInstallPromptVisibleState] = useState(getInstallPromptVisible);
  const hideFab = hideOnRoute || installPromptVisible;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I'm Forge AI. I can help you find workers, estimate project costs, or give you DIY advice. Ask me anything!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('ollama');
  const [useSearch, setUseSearch] = useState(false);
  const [providerStatus, setProviderStatus] = useState<{
    ollama: { available: boolean };
    gemini: { available: boolean };
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check provider availability on mount
  useEffect(() => {
    const checkProviders = async () => {
      const status = await getProviderStatus();
      setProviderStatus(status);
      // Auto-select available provider
      if (!status.ollama.available && status.gemini.available) {
        setProvider('gemini');
      }
    };
    checkProviders();
  }, []);

  // Yield bottom-right to PWA install banner (same corner on mobile + desktop)
  useEffect(() => subscribeInstallPromptVisible(setInstallPromptVisibleState), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Close panel when entering a route where the FAB is hidden
  useEffect(() => {
    if (hideFab) setIsOpen(false);
  }, [hideFab]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendAIMessage(input, { 
        provider, 
        useSearch: provider === 'gemini' ? useSearch : false 
      });
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: new Date(),
        groundingUrls: response.groundingUrls
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, something went wrong. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    clearConversationHistory();
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: "Chat cleared! How can I help you today?",
      timestamp: new Date()
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't cover Messages (or similar) composer / send controls
  if (hideFab) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Forge AI assistant"
        className="fixed bottom-20 md:bottom-8 right-4 z-40 bg-forge-navy hover:bg-forge-orange text-white p-4 rounded-full shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2 group"
      >
        <Bot className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium">
          Ask AI
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 z-40 w-[90vw] md:w-[400px] h-[min(600px,75dvh)] max-h-[calc(100dvh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="bg-forge-navy text-white p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-1.5 rounded-lg">
            <Bot className="w-5 h-5 text-forge-cyan" />
          </div>
          <div>
            <h3 className="font-bold">Forge AI Assistant</h3>
            <p className="text-xs text-gray-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-forge-success"></span>
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Bar */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-600 gap-2">
        {/* Provider Selection */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProvider('ollama')}
            disabled={!providerStatus?.ollama.available}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              provider === 'ollama' 
                ? 'bg-forge-navy text-white' 
                : 'hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={providerStatus?.ollama.available ? 'Local Gemma 3 model' : 'Ollama not running'}
          >
            <Cpu className="w-3 h-3" />
            <span className="hidden sm:inline">Local</span>
          </button>
          <button
            onClick={() => setProvider('gemini')}
            disabled={!providerStatus?.gemini.available}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              provider === 'gemini' 
                ? 'bg-forge-navy text-white' 
                : 'hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={providerStatus?.gemini.available ? 'Google Gemini' : 'API key not configured'}
          >
            <Cloud className="w-3 h-3" />
            <span className="hidden sm:inline">Cloud</span>
          </button>
        </div>

        {/* Model Name */}
        <span className="font-medium truncate">
          {getProviderDisplayName(provider)}
        </span>

        {/* Options */}
        <div className="flex items-center gap-2">
          {provider === 'gemini' && (
            <label className="flex items-center gap-1 cursor-pointer hover:text-forge-navy transition-colors select-none">
              <input 
                type="checkbox" 
                checked={useSearch} 
                onChange={(e) => setUseSearch(e.target.checked)}
                className="w-3 h-3 text-forge-orange rounded border-gray-300 focus:ring-forge-orange"
              />
              <Globe className="w-3 h-3" />
            </label>
          )}
          <button
            onClick={handleClearChat}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Clear chat"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-forge-orange text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              
              {/* Grounding Sources */}
              {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Sources:
                  </p>
                  <ul className="space-y-1">
                    {msg.groundingUrls.map((url, idx) => (
                      <li key={idx}>
                        <a 
                          href={url.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-forge-orange hover:underline flex items-center gap-1 truncate max-w-full"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          {url.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <span className={`text-[10px] mt-1 block opacity-70 ${msg.role === 'user' ? 'text-white' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
               <Loader2 className="w-4 h-4 text-forge-orange animate-spin" />
               <span className="text-xs text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-100 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about prices, workers, or advice..."
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forge-orange/20 focus:border-forge-orange max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-forge-navy hover:bg-forge-orange disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
};

export default AIChat;