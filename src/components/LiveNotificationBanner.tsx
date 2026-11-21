import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Send, X, MessageCircle, Loader2, Check } from 'lucide-react';
import type { Language } from '../types';
import { useSocial } from '../context/SocialContext';
import type { ClientSocialNotification } from '../engine/socialClient';
import { PANEL_SPRING, PanelRimSheen } from './MotionPrimitives';

interface LiveNotificationBannerProps {
  lang: Language;
  onOpenDmChat: (senderId: string) => void;
  onOpenRoomChat: (roomId: string) => void;
  onOpenVideos: () => void;
}

function getKindLabel(kind: ClientSocialNotification['kind'], isAr: boolean): string {
  switch (kind) {
    case 'dm_reply':
      return isAr ? 'رد على رسالتك' : 'Replied to you';
    case 'dm_message':
      return isAr ? 'رسالة جديدة' : 'New message';
    case 'room_reply':
      return isAr ? 'رد في القناة / المجموعة' : 'Room reply';
    case 'follow':
      return isAr ? 'متابعة جديدة' : 'New follower';
    case 'video_comment':
      return isAr ? 'تعليق على منشورك' : 'Commented on your post';
    case 'video_like':
      return isAr ? 'إعجاب بمنشورك' : 'Liked your post';
    default:
      return isAr ? 'إشعار جديد' : 'Notification';
  }
}

export const LiveNotificationBanner: React.FC<LiveNotificationBannerProps> = ({
  lang,
  onOpenDmChat,
  onOpenRoomChat,
  onOpenVideos,
}) => {
  const isAr = lang === 'ar';
  const social = useSocial();
  const notif = social.latestToastNotification;

  const [quickReply, setQuickReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);

  const isDmNotif = notif?.kind === 'dm_message' || notif?.kind === 'dm_reply';

  const handleQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notif || !quickReply.trim() || sending) return;
    setSending(true);
    try {
      await social.sendDirectMessage(notif.senderId, quickReply.trim(), undefined, {
        id: notif.messageId || notif.id,
        senderName: notif.senderName,
        text: notif.textPreview,
      });
      await social.markNotificationRead({ notificationId: notif.id, threadId: notif.threadId });
      setQuickReply('');
      setSentNotice(true);
      setTimeout(() => {
        setSentNotice(false);
        social.dismissToastNotification();
      }, 950);
    } catch {
      // Keep banner open on network failure so user can retry
    } finally {
      setSending(false);
    }
  };

  const handleOpenTarget = () => {
    if (!notif) return;
    social.markNotificationRead({ notificationId: notif.id, threadId: notif.threadId });
    social.dismissToastNotification();
    if (notif.kind === 'dm_message' || notif.kind === 'dm_reply') {
      onOpenDmChat(notif.senderId);
    } else if (notif.kind === 'room_reply' && notif.roomId) {
      onOpenRoomChat(notif.roomId);
    } else {
      onOpenVideos();
    }
  };

  return (
    <AnimatePresence>
      {notif && (
        <motion.div
          key={notif.id}
          dir={isAr ? 'rtl' : 'ltr'}
          initial={{ opacity: 0, y: -32, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.95 }}
          transition={PANEL_SPRING}
          className="fixed top-3 inset-x-3 sm:inset-x-auto sm:end-5 sm:w-[400px] z-[110] rounded-2xl bg-[#0E131E]/96 backdrop-blur-xl border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.85)] overflow-hidden font-['Cairo',sans-serif]"
        >
          <PanelRimSheen roundedClass="rounded-t-2xl" />
          <div className="relative z-10 p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#192234] border border-white/15 shrink-0 flex items-center justify-center">
                  {notif.senderPhoto ? (
                    <img
                      src={notif.senderPhoto}
                      alt={notif.senderName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-black text-white">
                      {notif.senderName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-3 h-3 text-[#FE2C55] shrink-0" />
                    <span className="text-[11px] font-bold text-[#FE2C55] truncate">
                      {getKindLabel(notif.kind, isAr)}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white truncate">
                    {notif.senderName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenTarget}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/18 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>{isAr ? 'فتح' : 'Open'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => social.dismissToastNotification()}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  aria-label={isAr ? 'إغلاق الإشعار' : 'Dismiss'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed line-clamp-2 bg-black/25 px-3 py-2 rounded-xl border border-white/[0.06]">
              {notif.textPreview}
            </p>

            {isDmNotif && (
              <form onSubmit={handleQuickReply} className="flex items-center gap-2 pt-0.5">
                {sentNotice ? (
                  <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تم إرسال الرد!' : 'Reply sent!'}</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={quickReply}
                      onChange={(e) => setQuickReply(e.target.value)}
                      placeholder={
                        isAr ? `رد سريع على ${notif.senderName}...` : `Quick reply to ${notif.senderName}...`
                      }
                      className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#070A10] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FE2C55]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !quickReply.trim()}
                      className="min-h-[38px] px-3 rounded-xl bg-[#FE2C55] hover:bg-[#e5244a] text-white text-xs font-black flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isAr ? 'رد' : 'Reply'}</span>
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
