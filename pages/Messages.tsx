import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getConversations, 
  getMessages, 
  sendMessage, 
  markAsRead,
  getUnreadCount,
  getOrCreateConversation,
  subscribeToMessages,
} from '../services/chatService';
import type { Conversation, Message } from '../types/database';
import { 
  MessageSquare, Send, Loader2, ArrowLeft, User, 
  Check, CheckCheck, Search, AlertCircle, RefreshCw
} from 'lucide-react';
import PageHelmet from '../components/PageHelmet';

const Messages: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchConversations();
  }, [user?.id]);

  // Open conversation when navigated from JobDetail, WorkerProfile, or Bookings
  useEffect(() => {
    const state = location.state as { recipientId?: string; bookingId?: string } | null;
    const params = new URLSearchParams(location.search);
    const recipientId = state?.recipientId || params.get('to') || undefined;
    const bookingId = state?.bookingId || params.get('bookingId') || undefined;

    if (!user?.id || !recipientId || recipientId === user.id) return;

    let cancelled = false;

    const openConversation = async () => {
      const result = await getOrCreateConversation(user.id, recipientId, bookingId);
      if (cancelled) return;

      if (result.data) {
        setSelectedConversation(result.data);
        setConversationsError(null);
        setConversations(prev => {
          if (prev.some(c => c.id === result.data!.id)) return prev;
          return [result.data!, ...prev];
        });
      } else if (result.error) {
        setConversationsError(
          result.error.message || 'Could not start a conversation with this user.'
        );
      }

      navigate('/messages', { replace: true, state: {} });
    };

    openConversation();
    return () => {
      cancelled = true;
    };
  }, [user?.id, location.state, location.search, navigate]);

  useEffect(() => {
    if (selectedConversation && user?.id) {
      setMessages([]);
      fetchMessages(selectedConversation.id);
      markAsRead(selectedConversation.id, user.id);
    }
  }, [selectedConversation?.id, user?.id]);

  // Realtime subscription for new messages in the open conversation
  useEffect(() => {
    if (!selectedConversation?.id || !user?.id) return;

    const conversationId = selectedConversation.id;

    const unsubscribe = subscribeToMessages(conversationId, (newMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });

      if (newMessage.sender_id !== user.id) {
        markAsRead(conversationId, user.id);
      }

      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId
            ? { ...c, last_message_at: newMessage.created_at }
            : c
        ).sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        })
      );
    });

    return unsubscribe;
  }, [selectedConversation?.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    if (!user?.id) return;
    setLoading(true);
    setConversationsError(null);
    const result = await getConversations(user.id);
    if (result.error) {
      setConversationsError(result.error.message || 'Failed to load conversations.');
      setConversations([]);
    } else if (result.data) {
      setConversations(result.data);
    }
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);
    const result = await getMessages(conversationId, 50);
    if (result.error) {
      setMessagesError(result.error.message || 'Failed to load messages.');
      setMessages([]);
    } else if (result.data) {
      setMessages(result.data.messages.reverse());
    }
    setMessagesLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user?.id || sending) return;

    setSending(true);
    setSendError(null);
    const result = await sendMessage(selectedConversation.id, user.id, newMessage.trim());
    if (result.data) {
      setMessages(prev => [...prev, result.data!]);
      setNewMessage('');
    } else if (result.error) {
      setSendError(result.error.message || 'Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const getOtherParticipantId = (conv: Conversation) => {
    return conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <PageHelmet title="Messages" path="/messages" />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Loading conversations...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Messages" path="/messages" />
      {/* Mobile: full-height column above bottom nav. Desktop: padded side-by-side card.
          TopNav ≈ 3.5–4rem + safe-area-top; BottomNav cleared via pb-nav. */}
      <div className="bg-gray-50 h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] sm:h-[calc(100dvh-4rem-env(safe-area-inset-top,0px))] pb-nav md:pb-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto md:p-4">
          <div className="flex h-full bg-white overflow-hidden md:rounded-xl md:shadow-sm">
          {/* Conversations List — full screen on mobile when no thread open */}
          <div className={`w-full md:w-80 md:border-r border-gray-200 flex flex-col min-h-0 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-200 shrink-0">
              <h1 className="text-xl font-bold text-forge-navy mb-3">Messages</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-forge-orange"
                />
              </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto touch-scroll">
              {conversationsError ? (
                <div className="p-6 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                  <p className="text-sm text-gray-700 font-medium">Couldn&apos;t load conversations</p>
                  <p className="text-xs text-gray-500 mt-1">{conversationsError}</p>
                  <button
                    onClick={fetchConversations}
                    className="mt-3 inline-flex items-center gap-1.5 text-forge-orange text-sm font-medium hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try again
                  </button>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-forge-navy">No conversations yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {user?.role === 'worker'
                      ? 'Apply to a project or accept a booking to start chatting'
                      : 'Book a worker or post a project to start chatting'}
                  </p>
                  <div className="flex flex-col gap-2 mt-4">
                    {user?.role === 'worker' ? (
                      <Link
                        to="/jobs"
                        className="text-sm text-forge-orange font-medium hover:underline"
                      >
                        Browse projects
                      </Link>
                    ) : (
                      <>
                        <Link
                          to="/search"
                          className="text-sm text-forge-orange font-medium hover:underline"
                        >
                          Find workers
                        </Link>
                        <Link
                          to="/jobs?create=1"
                          className="text-sm text-gray-500 hover:text-forge-orange"
                        >
                          Post a project
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      selectedConversation?.id === conv.id ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-forge-navy/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-forge-navy" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        User {getOtherParticipantId(conv).slice(0, 8)}...
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {conv.last_message_at ? formatTime(conv.last_message_at) : 'No messages'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area — full screen on mobile when a thread is open */}
          <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center gap-3 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden p-2 -ml-1 text-gray-600 hover:text-forge-navy rounded-lg"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-forge-navy/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-forge-navy" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      User {getOtherParticipantId(selectedConversation).slice(0, 8)}...
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedConversation.booking_id ? 'Booking conversation' : 'Direct message'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto touch-scroll p-4 space-y-4">
                  {messagesLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-forge-orange animate-spin mb-2" />
                      <p className="text-gray-500 text-sm">Loading messages...</p>
                    </div>
                  ) : messagesError ? (
                    <div className="text-center py-12 px-4">
                      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                      <p className="text-sm text-gray-700 font-medium">Couldn&apos;t load messages</p>
                      <p className="text-xs text-gray-500 mt-1">{messagesError}</p>
                      <button
                        type="button"
                        onClick={() => selectedConversation && fetchMessages(selectedConversation.id)}
                        className="mt-3 inline-flex items-center gap-1.5 text-forge-orange text-sm font-medium hover:underline"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Try again
                      </button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <div className="w-14 h-14 rounded-full bg-forge-orange/10 flex items-center justify-center mb-3">
                        <MessageSquare className="w-7 h-7 text-forge-orange" />
                      </div>
                      <p className="font-medium text-forge-navy">Start the conversation</p>
                      <p className="text-sm text-gray-500 mt-1 max-w-xs">
                        Say hello or confirm details about the booking below.
                      </p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] sm:max-w-[70%] ${
                          msg.sender_id === user?.id 
                            ? 'bg-forge-orange text-white rounded-l-xl rounded-tr-xl' 
                            : 'bg-gray-100 text-gray-900 rounded-r-xl rounded-tl-xl'
                        } px-4 py-2`}>
                          <p className="text-sm break-words">{msg.body}</p>
                          <div className={`flex items-center gap-1 mt-1 ${
                            msg.sender_id === user?.id ? 'justify-end' : ''
                          }`}>
                            <span className={`text-xs ${
                              msg.sender_id === user?.id ? 'text-white/70' : 'text-gray-400'
                            }`}>
                              {formatTime(msg.created_at)}
                            </span>
                            {msg.sender_id === user?.id && (
                              msg.read_at 
                                ? <CheckCheck className="w-3 h-3 text-white/70" />
                                : <Check className="w-3 h-3 text-white/70" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer — sticky above bottom nav; send always clear of FAB (FAB hidden on this route) */}
                <form
                  onSubmit={handleSendMessage}
                  className="shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4 safe-area-bottom"
                >
                  {sendError && (
                    <div className="mb-3 bg-red-50 text-red-600 p-2.5 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 min-w-0 break-words">{sendError}</span>
                      <button
                        type="button"
                        onClick={() => setSendError(null)}
                        className="text-red-400 hover:text-red-600 text-xs min-h-[44px] px-2"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        if (sendError) setSendError(null);
                      }}
                      placeholder="Type a message..."
                      enterKeyHint="send"
                      autoComplete="off"
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-forge-orange text-base"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      aria-label="Send message"
                      className="shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-3 bg-forge-orange text-white rounded-full hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 p-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-forge-navy/5 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-forge-navy/40" />
                  </div>
                  <p className="text-lg font-medium text-forge-navy">Select a conversation</p>
                  <p className="text-sm text-gray-500 mt-1 hidden md:block">
                    Choose from your existing conversations on the left
                  </p>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Messages;
