import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markNotificationRead } from '../services/notificationService';
import type { Notification, NotificationType } from '../types/database';
import {
  Bell, Loader2, Briefcase, MessageSquare, Crown,
  CreditCard, Star, ChevronRight
} from 'lucide-react';
import PageHelmet from '../components/PageHelmet';

function getNotificationLink(type: NotificationType, metadata: Record<string, unknown> | null): string {
  const jobId = metadata?.job_id as string | undefined;
  const conversationId = metadata?.conversation_id as string | undefined;

  switch (type) {
    case 'booking_request':
    case 'booking_accepted':
    case 'booking_completed':
      return jobId ? `/jobs/${jobId}` : '/bookings';
    case 'new_message':
      return conversationId ? '/messages' : '/messages';
    case 'subscription_expiring':
    case 'subscription_expired':
    case 'payment_failed':
      return '/subscription';
    case 'new_review':
      return '/bookings';
    default:
      return '/dashboard';
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'booking_request':
    case 'booking_accepted':
    case 'booking_completed':
      return Briefcase;
    case 'new_message':
      return MessageSquare;
    case 'subscription_expiring':
    case 'subscription_expired':
      return Crown;
    case 'payment_failed':
      return CreditCard;
    case 'new_review':
      return Star;
    default:
      return Bell;
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
  }, [user?.id, filter]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await getNotifications(user.id, filter === 'unread');
    if (result.data) {
      setNotifications(result.data);
    }
    setLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      const result = await markNotificationRead(notification.id);
      if (result.data) {
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? result.data! : n))
        );
      }
    }
    navigate(getNotificationLink(notification.type, notification.metadata));
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <>
      <PageHelmet title="Notifications" path="/notifications" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-forge-navy">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {filter === 'unread' && unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'Stay updated on your bookings and activity'}
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-forge-orange text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-forge-orange text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unread
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">No notifications</p>
            <p className="text-gray-500 mt-1">
              {filter === 'unread'
                ? "You're all caught up"
                : "You don't have any notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => {
              const Icon = getNotificationIcon(notification.type);
              const isUnread = !notification.read_at;

              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left bg-white rounded-xl shadow-sm p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors ${
                    isUnread ? 'border-l-4 border-forge-orange' : ''
                  }`}
                >
                  <div className={`p-2 rounded-full shrink-0 ${
                    isUnread ? 'bg-orange-100 text-forge-orange' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium ${isUnread ? 'text-forge-navy' : 'text-gray-700'}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.body}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Notifications;
