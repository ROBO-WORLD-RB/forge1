import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Send, X, Minimize2, Globe, Loader2, ExternalLink, RefreshCw, Sparkles, AlertTriangle, Star } from 'lucide-react';
import {
  sendAIMessage,
  clearConversationHistory,
  getProviderStatus,
  type AiChatMode,
} from '../services/aiService';
import { matchWorkersWithAI } from '../services/aiMatchService';
import { useAuth } from '../context/AuthContext';
import { ChatMessage, UserRole } from '../types';
import {
  getInstallPromptVisible,
  subscribeInstallPromptVisible,
} from '../utils/installPromptVisibility';
import { SimpleMarkdown } from '../utils/simpleMarkdown';
import { FORGE_AI_OPEN_EVENT, type ForgeAiOpenDetail } from '../utils/forgeAiEvents';

/** Routes where the FAB would cover primary chat controls (send, composer). */
const HIDE_FAB_ROUTES = ['/messages'];

export { FORGE_AI_OPEN_EVENT } from '../utils/forgeAiEvents';

function modeForRole(role?: UserRole | string): AiChatMode {
  if (role === UserRole.WORKER || role === 'worker') return 'worker';
  if (role === UserRole.CUSTOMER || role === 'customer') return 'customer';
  return 'general';
}

function welcomeForMode(mode: AiChatMode): string {
  if (mode === 'customer') {
    return "Hi! I'm your Forge AI hiring assistant. Describe a problem (e.g. \"emergency plumber in Accra tonight\") or tap Find a pro with AI — I'll match skilled workers and share rough cost tips.";
  }
  if (mode === 'worker') {
    return "Hi! I'm your Forge AI business assistant. Ask for quote wording, profile tips, or pricing ideas for jobs in Ghana & Nigeria. On a project page you can also Generate quote.";
  }
  return "Hello! I'm Forge AI. I can help you find workers, estimate project costs, or give DIY advice. Ask me anything!";
}

const AIChat: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const mode = modeForRole(user?.role);
  const hideOnRoute = HIDE_FAB_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  const [installPromptVisible, setInstallPromptVisibleState] = useState(getInstallPromptVisible);
  const hideFab = hideOnRoute || installPromptVisible;
  const [isOpen, setIsOpen] = useState(false);
  const [matchMode, setMatchMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: welcomeForMode(mode),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openrouterAvailable, setOpenrouterAvailable] = useState(true);
  const [openrouterReason, setOpenrouterReason] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Refresh welcome when role/mode changes and chat is still at welcome
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
          {
            id: 'welcome',
            role: 'model',
            text: welcomeForMode(mode),
            timestamp: new Date(),
          },
        ];
      }
      return prev;
    });
  }, [mode]);

  useEffect(() => {
    const checkProvider = async () => {
      const status = await getProviderStatus();
      setOpenrouterAvailable(status.openrouter.available);
      setOpenrouterReason(status.openrouter.reason);
    };
    checkProvider();
  }, []);

  useEffect(() => subscribeInstallPromptVisible(setInstallPromptVisibleState), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    if (hideFab) setIsOpen(false);
  }, [hideFab]);

  // External open (Customer Hub "Find a pro with AI", etc.)
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ForgeAiOpenDetail>).detail || {};
      setIsOpen(true);
      if (detail.intent === 'match') {
        setMatchMode(true);
      }
      if (detail.prompt?.trim()) {
        setInput(detail.prompt.trim());
      }
    };
    window.addEventListener(FORGE_AI_OPEN_EVENT, handler as EventListener);
    return () => window.removeEventListener(FORGE_AI_OPEN_EVENT, handler as EventListener);
  }, []);

  const runMatch = async (query: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await matchWorkersWithAI(query, {
        defaultCountry: user?.country || null,
        limit: 6,
      });

      const urgency = result.parsed.emergency || result.parsed.urgency === 'emergency' || result.parsed.urgency === 'high';
      const lines: string[] = [];
      if (urgency) {
        lines.push('**URGENCY: high** — this looks time-sensitive. Stay safe and hire a pro quickly.');
      }
      lines.push(
        result.parsed.summary
          ? `I understood: *${result.parsed.summary}*`
          : 'Here are workers that fit your request.'
      );
      if (result.parsed.service) lines.push(`Trade: **${result.parsed.service}**`);
      if (result.parsed.location || result.parsed.country) {
        lines.push(
          `Area: **${[result.parsed.location, result.parsed.country].filter(Boolean).join(', ')}**`
        );
      }
      if (result.error) lines.push(`Note: ${result.error}`);
      if (result.workers.length === 0) {
        lines.push('No strong matches yet — try a clearer trade + city, or browse Search.');
      } else {
        lines.push(`Top ${result.workers.length} ranked pros:`);
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: lines.join('\n\n'),
        timestamp: new Date(),
        urgencyFlag: urgency,
        matchedWorkers: result.workers.map((w) => ({
          userId: w.user_id,
          name: w.name,
          role: w.role,
          location: w.location,
          rating: w.rating,
          reviewCount: w.review_count,
          matchReason: w.matchReason,
          profilePath: w.profilePath,
          verified: w.verified,
        })),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: 'Matching failed. Try again or use Search to browse workers.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setMatchMode(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput('');

    if (!openrouterAvailable && !matchMode) {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text:
            openrouterReason ||
            'Configure OpenRouter: deploy the ai-chat Edge Function with OPENROUTER_API_KEY, or set VITE_OPENROUTER_API_KEY for local fallback.',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // Match intent: explicit mode, or natural "find a ..." phrasing for customers
    const wantsMatch =
      matchMode ||
      (mode === 'customer' &&
        /\b(find|hire|need|looking for)\b/i.test(text) &&
        /\b(plumber|electrician|carpenter|painter|cleaner|worker|pro|technician|hvac|mason)\b/i.test(
          text
        ));

    if (wantsMatch) {
      await runMatch(text);
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await sendAIMessage(text, { provider: 'openrouter', mode });

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: new Date(),
        groundingUrls: response.groundingUrls,
        urgencyFlag: response.urgencyFlag,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: 'Could not reach OpenRouter. Check your Edge Function / API key and try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    clearConversationHistory();
    setMatchMode(false);
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: 'Chat cleared! How can I help you today?',
        timestamp: new Date(),
      },
    ]);
  };

  const handleFindPro = () => {
    setMatchMode(true);
    setIsOpen(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `match-hint-${Date.now()}`,
        role: 'model',
        text: 'Describe the job in plain language — trade, city, budget, and when you need it. Example: "Need an electrician in Kumasi this weekend, budget GHS 800."',
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (hideFab) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Forge AI assistant"
        className="fixed bottom-20 md:bottom-8 right-4 z-40 bg-forge-navy hover:bg-forge-orange text-white p-3.5 rounded-full shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2 group"
      >
        <img src="/logo.png" alt="" className="w-7 h-7 object-contain" aria-hidden="true" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium">
          Ask AI
        </span>
      </button>
    );
  }

  const placeholder =
    matchMode
      ? 'e.g. Emergency plumber in Accra tonight...'
      : mode === 'worker'
        ? 'Ask for quote drafts, pricing, or profile tips...'
        : mode === 'customer'
          ? 'Describe a job, ask for costs, or find a pro...'
          : 'Ask about prices, workers, or advice...';

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 z-40 w-[90vw] md:w-[400px] h-[min(600px,75dvh)] max-h-[calc(100dvh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="bg-forge-navy text-white p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-1.5 rounded-lg">
            <img src="/logo.png" alt="" className="w-5 h-5 object-contain" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-bold">Forge AI Assistant</h3>
            <p className="text-[10px] text-white/70 capitalize">
              {mode === 'general' ? 'General' : `${mode} mode`}
              {matchMode ? ' · matching' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearChat}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Clear chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {(mode === 'customer' || !user) && (
        <div className="px-3 py-2 border-b border-gray-100 bg-orange-50/60 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleFindPro}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-forge-navy bg-white border border-forge-orange/30 rounded-lg px-3 py-2 hover:bg-orange-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-forge-orange" />
            Find a pro with AI
          </button>
          <Link
            to="/search"
            className="inline-flex items-center justify-center text-xs font-medium text-gray-600 px-3 py-2 hover:text-forge-orange"
          >
            Browse
          </Link>
        </div>
      )}

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
              {msg.urgencyFlag && msg.role === 'model' && (
                <p className="text-xs font-bold text-red-600 flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Urgent situation flagged
                </p>
              )}
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              ) : (
                <SimpleMarkdown text={msg.text} />
              )}

              {msg.matchedWorkers && msg.matchedWorkers.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {msg.matchedWorkers.map((w) => (
                    <li key={w.userId}>
                      <Link
                        to={w.profilePath}
                        className="block rounded-xl border border-gray-100 bg-gray-50 hover:border-forge-orange/40 hover:bg-orange-50/50 px-3 py-2 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-forge-navy truncate">
                              {w.name}
                              {w.verified ? (
                                <span className="ml-1 text-[10px] text-forge-orange font-bold">
                                  ✓
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {w.role} · {w.location}
                            </p>
                            <p className="text-[11px] text-forge-orange mt-0.5">{w.matchReason}</p>
                          </div>
                          {w.reviewCount > 0 ? (
                            <span className="text-[11px] text-gray-600 flex items-center gap-0.5 shrink-0">
                              <Star className="w-3 h-3 text-forge-orange fill-current" />
                              {w.rating.toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

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

              <span
                className={`text-[10px] mt-1 block opacity-70 ${
                  msg.role === 'user' ? 'text-white' : 'text-gray-400'
                }`}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-forge-orange animate-spin" />
              <span className="text-xs text-gray-500">
                {matchMode ? 'Matching workers...' : 'Thinking...'}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-100 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
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
