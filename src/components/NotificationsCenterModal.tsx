import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  X,
  CheckCheck,
  MessageCircle,
  Send,
  Reply,
  Heart,
  UserPlus,
  MessageSquare,
  Loader2,
  Check,
} from 'lucide-react';
import type { Language } from '../types';
import { useSocial } from '../context/SocialContext';
import type { ClientSocialNotification } from '../engine/socialClient';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PanelRimSheen,
  backdropVariants,
  centerModalVariants,
} from './MotionPrimitives';

interface NotificationsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOpenDmChat: (senderId: string) => void;
  onOpenRoomChat: (roomId: string) => void;
  onOpenVideos: () => void;
}

function formatNotifTime(ts: number, isAr: boolean): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return isAr ? 'الآن' : 'Now';
  const min = Math.floor(diff / 60);
  if (min < 60) return isAr ? `منذ ${min} د` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isAr ? `منذ ${hr} س` : `${hr}h ago`;
  return new Date(ts).toLocaleDateString(isAr ? 'ar-EG' : 'en-US');
}

export const NotificationsCenterModal: React.FC<NotificationsCenterModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenDmChat,
  onOpenRoomChat,
  onOpenVideos,
}) => {
  const isAr = lang === 'ar';
  const social = useSocial();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const list =
    filter === 'unread'
      ? social.notifications.filter((n) => !n.read)
      : social.notifications;

  const handleOpenNotification = (n: ClientSocialNotification) => {
    social.markNotificationRead({ notificationId: n.id, threadId: n.threadId });
    onClose();
    if (n.kind === 'dm_message' || n.kind === 'dm_reply') {
      onOpenDmChat(n.senderId);
    } else if (n.kind === 'room_reply' && n.roomId) {
      onOpenRoomChat(n.roomId);
    } else {
      onOpenVideos();
    }
  };

  const handleSendInlineReply = async (n: ClientSocialNotification, e: React.FormEvent) => {
    e.preventDefault();
    if (!replyDraft.trim() || sendingId) return;
    setSendingId(n.id);
    try {
      await social.sendDirectMessage(n.senderId, replyDraft.trim(), undefined, {
        id: n.messageId || n.id,
        senderName: n.senderName,
        text: n.textPreview,
      });
      await social.markNotificationRead({ notificationId: n.id, threadId: n.threadId });
      setReplyDraft('');
      setReplyingId(null);
      setSentIds((prev) => ({ ...prev, [n.id]: true }));
    } finally {
      setSendingId(null);
    }
  };

  const renderKindIcon = (kind: ClientSocialNotification['kind']) => {
    switch (kind) {
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-emerald-400" />;
      case 'video_like':
        return <Heart className="w-3.5 h-3.5 text-[#FE2C55] fill-[#FE2C55]" />;
      case 'video_comment':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-300" />;
      case 'room_reply':
        return <Reply className="w-3.5 h-3.5 text-[#64B5F6]" />;
      default:
        return <MessageCircle className="w-3.5 h-3.5 text-[#FE2C55]" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        style={AMBIENT_BACKDROP_STYLE}
        className="fixed inset-0 z-[95] bg-black/82 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none overflow-hidden"
      >
        <AmbientModalGlow />
        <motion.div
          variants={centerModalVariants}
          onClick={(e) => e.stopPropagation()}
          dir={isAr ? 'rtl' : 'ltr'}
          className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[85vh] bg-[#0B0E16] border-0 sm:border sm:border-white/10 sm:rounded-3xl shadow-[0_32px_90px_rgba(0,0,0,0.92)] overflow-hidden text-slate-100 flex flex-col font-['Cairo',sans-serif]"
        >
          <PanelRimSheen roundedClass="sm:rounded-t-3xl" />

          <header className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FE2C55]" />
              <h2 className="text-sm sm:text-base font-black text-white">
                {isAr ? 'صندوق الإشعارات' : 'Notifications Inbox'}
              </h2>
              {social.unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FE2C55] text-white text-[10px] font-black font-mono tabular-nums">
                  {social.unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {social.unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => social.markNotificationRead({ all: true })}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isAr ? 'قراءة الكل' : 'Mark all'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
            {(
              [
                { id: 'all' as const, ar: `الكل (${social.notifications.length})`, en: `All (${social.notifications.length})` },
                { id: 'unread' as const, ar: `غير المقروءة (${social.unreadCount})`, en: `Unread (${social.unreadCount})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  filter === t.id
                    ? 'bg-white text-[#090B10]'
                    : 'bg-white/[0.05] text-slate-400 hover:text-white'
                }`}
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {list.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-2">
                <Bell className="w-9 h-9 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  {isAr ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isAr
                    ? 'عندما يراسلك شخص أو يرد عليك سيظهر إشعاره هنا فوراً.'
                    : 'Incoming messages, replies, and follows appear here in real time.'}
                </p>
              </div>
            ) : (
              list.map((n) => {
                const isDm = n.kind === 'dm_message' || n.kind === 'dm_reply';
                const isReplying = replyingId === n.id;
                const sentHere = sentIds[n.id];

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 sm:p-4 space-y-2.5 transition-colors ${
                      n.read ? 'bg-transparent' : 'bg-[#FE2C55]/[0.06]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(n)}
                        className="flex items-start gap-3 min-w-0 flex-1 text-start cursor-pointer"
                      >
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[#171E2E] border border-white/15 shrink-0 flex items-center justify-center">
                          {n.senderPhoto ? (
                            <img
                              src={n.senderPhoto}
                              alt={n.senderName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-black text-white">
                              {n.senderName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {renderKindIcon(n.kind)}
                            <span className="text-xs font-black text-white truncate">
                              {n.senderName}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-[#FE2C55] shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.textPreview}
                          </p>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {formatNotifTime(n.createdAt, isAr)}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDm && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingId(isReplying ? null : n.id);
                              setReplyDraft('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#FE2C55] hover:bg-[#e5244a] text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Reply className="w-3 h-3" />
                            <span>{isAr ? 'رد' : 'Reply'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenNotification(n)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 text-[11px] font-bold cursor-pointer"
                        >
                          {isAr ? 'فتح' : 'Open'}
                        </button>
                      </div>
                    </div>

                    {sentHere && (
                      <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 ps-12">
                        <Check className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تم إرسال ردك بنجاح' : 'Reply sent'}</span>
                      </div>
                    )}

                    {isReplying && (
                      <form
                        onSubmit={(e) => handleSendInlineReply(n, e)}
                        className="flex items-center gap-2 ps-12"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder={isAr ? 'اكتب ردك الآن...' : 'Write your reply...'}
                          className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#070A10] border border-white/15 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                        />
                        <button
                          type="submit"
                          disabled={sendingId === n.id || !replyDraft.trim()}
                          className="min-h-[38px] px-3 rounded-xl bg-[#FE2C55] text-white text-xs font-black flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                        >
                          {sendingId === n.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
