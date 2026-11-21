import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Video as VideoIcon,
  Users,
  MessageCircle,
  Megaphone,
  UserPlus,
  UserCheck,
  Send,
  Heart,
  Eye,
  MessageSquare,
  Trash2,
  Upload,
  Plus,
  Loader2,
  Play,
  Volume2,
  VolumeX,
  Share2,
  ChevronUp,
  ChevronDown,
  Reply,
  Pin,
  Smile,
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
  Film,
  Music2,
  Image as ImageIcon,
  Images,
  ChevronLeft,
  ChevronRight,
  Bell,
  Lock,
} from 'lucide-react';
import type { Language } from '../types';
import type { FirebaseUser } from '../lib/firebase';
import {
  ClientDmMessage,
  ClientDmThread,
  ClientRoomMessage,
  ClientSocialCreator,
  ClientSocialRoom,
  ClientSocialVideo,
} from '../engine/socialClient';
import { useSocial } from '../context/SocialContext';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  ITEM_SPRING,
  PANEL_SPRING,
  PILL_SPRING,
  PanelRimSheen,
  backdropVariants,
  bottomSheetVariants,
  centerModalVariants,
  dropdownVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
  viewTransitionVariants,
} from './MotionPrimitives';

export type SocialTabId =
  | 'videos'
  | 'chats'
  | 'followers'
  | 'people'
  | 'messages'
  | 'channels'
  | 'groups';

type TopSectionId = 'videos' | 'chats' | 'followers';
type ChatFolderId = 'all' | 'messages' | 'channels' | 'groups' | 'people';
type OpenedChatTarget =
  | { kind: 'dm'; id: string }
  | { kind: 'room'; id: string }
  | null;

interface SocialCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user?: FirebaseUser | null;
  initialTab?: SocialTabId;
  initialDmRecipientId?: string | null;
  initialRoomId?: string | null;
  onOpenProfile?: () => void;
  onOpenNotifications?: () => void;
}

function formatRelativeTime(ts: number, isAr: boolean): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return isAr ? 'الآن' : 'Now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isAr ? `${diffMin} د` : `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return isAr ? `${diffHr} س` : `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return isAr ? `${diffDay} ي` : `${diffDay}d`;
  return new Date(ts).toLocaleDateString(isAr ? 'ar-EG' : 'en-US');
}

function formatClockTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const TELEGRAM_SENDER_COLORS = [
  'text-sky-400',
  'text-emerald-400',
  'text-amber-300',
  'text-violet-400',
  'text-rose-400',
  'text-cyan-300',
];

function getSenderColorClass(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return TELEGRAM_SENDER_COLORS[hash % TELEGRAM_SENDER_COLORS.length];
}

const CreatorAvatar: React.FC<{
  photoURL?: string;
  name: string;
  sizeClass?: string;
  shapeClass?: string;
  online?: boolean;
}> = ({ photoURL, name, sizeClass = 'w-10 h-10', shapeClass = 'rounded-full', online }) => {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div
      className={`relative ${sizeClass} ${shapeClass} overflow-hidden bg-[#18222F] border border-white/15 shrink-0 flex items-center justify-center`}
    >
      {photoURL && !imgErr ? (
        <img
          src={photoURL}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-sm font-black text-slate-100 uppercase">
          {(name || 'C').trim().slice(0, 1)}
        </span>
      )}
      {online && (
        <span
          className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0E1621]"
          title="Online"
        />
      )}
    </div>
  );
};

const IMAGE_URL_REGEX = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

function isImagePostUrl(url?: string): boolean {
  return Boolean(url && IMAGE_URL_REGEX.test(url.trim()));
}

// Individual TikTok-Style Reel Slide supporting Video + Photo Carousel Mode with double-tap like & motion springs
const TikTokReelSlide: React.FC<{
  video: ClientSocialVideo;
  isActive: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  isMine: boolean;
  isFollowingAuthor: boolean;
  isLiked: boolean;
  authorOnline?: boolean;
  isAr: boolean;
  onToggleFollow: () => void;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenAuthorChat: () => void;
  onDelete: () => void;
  onViewed: () => void;
}> = ({
  video,
  isActive,
  muted,
  onToggleMuted,
  isMine,
  isFollowingAuthor,
  isLiked,
  authorOnline,
  isAr,
  onToggleFollow,
  onToggleLike,
  onOpenComments,
  onOpenShare,
  onOpenAuthorChat,
  onDelete,
  onViewed,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [heartBursts, setHeartBursts] = useState<number[]>([]);
  const lastTapRef = useRef<number>(0);

  const isPhotoPost =
    video.mediaType === 'image' ||
    isImagePostUrl(video.videoUrl) ||
    (Array.isArray(video.mediaUrls) &&
      video.mediaUrls.length > 0 &&
      video.mediaUrls.every((u) => isImagePostUrl(u)));

  const photoSlides = useMemo(() => {
    if (!isPhotoPost) return [];
    const list =
      Array.isArray(video.mediaUrls) && video.mediaUrls.length > 0
        ? video.mediaUrls
        : [video.videoUrl];
    return list.filter(Boolean);
  }, [isPhotoPost, video.mediaUrls, video.videoUrl]);

  useEffect(() => {
    setPhotoIdx(0);
  }, [video.id]);

  useEffect(() => {
    if (isPhotoPost) {
      if (isActive) {
        setPausedByUser(false);
        onViewed();
      }
      return;
    }
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      setPausedByUser(false);
      el.play().catch(() => {});
      onViewed();
    } else {
      el.pause();
    }
  }, [isActive, isPhotoPost]);

  // Auto-advance multi-photo carousel (TikTok Photo Mode)
  useEffect(() => {
    if (!isPhotoPost || !isActive || pausedByUser || photoSlides.length <= 1) return;
    const timer = setInterval(() => {
      setPhotoIdx((prev) => (prev + 1) % photoSlides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [isPhotoPost, isActive, pausedByUser, photoSlides.length]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const triggerDoubleTapLike = () => {
    const id = Date.now();
    setHeartBursts((prev) => [...prev.slice(-2), id]);
    setTimeout(() => {
      setHeartBursts((prev) => prev.filter((item) => item !== id));
    }, 750);
    if (!isLiked) {
      onToggleLike();
    }
  };

  const togglePlayPause = () => {
    if (isPhotoPost) {
      setPausedByUser((p) => !p);
      return;
    }
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      setPausedByUser(false);
      el.play().catch(() => {});
    } else {
      setPausedByUser(true);
      el.pause();
    }
  };

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 270) {
      lastTapRef.current = 0;
      triggerDoubleTapLike();
    } else {
      lastTapRef.current = now;
      togglePlayPause();
    }
  };

  const stepPhoto = (delta: -1 | 1, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (photoSlides.length <= 1) return;
    setPhotoIdx((prev) => (prev + delta + photoSlides.length) % photoSlides.length);
  };

  return (
    <div
      data-reel-id={video.id}
      className="relative w-full h-full snap-start shrink-0 bg-black flex items-center justify-center overflow-hidden"
    >
      {isPhotoPost ? (
        <div
          onClick={handleMediaTap}
          className="relative w-full h-full flex items-center justify-center bg-black cursor-pointer select-none"
        >
          {/* Blurred ambient background from current slide */}
          {photoSlides[photoIdx] && (
            <img
              src={photoSlides[photoIdx]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-25 blur-2xl scale-110 pointer-events-none"
            />
          )}

          <AnimatePresence mode="wait">
            <motion.img
              key={photoSlides[photoIdx] || video.videoUrl}
              src={photoSlides[photoIdx] || video.videoUrl}
              alt={video.title}
              initial={{ opacity: 0.35, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.25, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="relative z-[1] w-full h-full object-contain"
            />
          </AnimatePresence>

          {/* Segmented TikTok Photo Carousel Bars */}
          {photoSlides.length > 1 && (
            <div className="absolute top-12 inset-x-3 z-20 flex items-center gap-1.5">
              {photoSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIdx(idx);
                  }}
                  aria-label={`Slide ${idx + 1}`}
                  className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden cursor-pointer"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      width: idx <= photoIdx ? '100%' : '0%',
                      opacity: idx === photoIdx ? 1 : idx < photoIdx ? 0.85 : 0,
                    }}
                    transition={PILL_SPRING}
                    className="h-full bg-white rounded-full"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Left / Right Slide Steppers for Multi-Photo Carousel */}
          {photoSlides.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => stepPhoto(-1, e)}
                className="absolute start-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer"
                title={isAr ? 'الصورة السابقة' : 'Previous photo'}
              >
                {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={(e) => stepPhoto(1, e)}
                className="absolute end-16 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer"
                title={isAr ? 'الصورة التالية' : 'Next photo'}
              >
                {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.posterUrl}
          loop
          playsInline
          muted={muted}
          preload="metadata"
          onClick={handleMediaTap}
          className="w-full h-full object-contain cursor-pointer"
        />
      )}

      {/* TikTok Double-Tap Heart Burst */}
      <AnimatePresence>
        {heartBursts.map((id) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, scale: 0.35, rotate: -14 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.35, 1.32, 1.1, 1.45], rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
          >
            <Heart className="w-24 h-24 text-[#FE2C55] fill-[#FE2C55] drop-shadow-[0_12px_36px_rgba(254,44,85,0.65)]" />
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {pausedByUser && (
          <motion.button
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={PILL_SPRING}
            type="button"
            onClick={togglePlayPause}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
              <Play className="w-8 h-8 fill-white ms-1" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

      <div className="absolute top-16 end-3 z-10 flex items-center gap-2">
        {isPhotoPost && (
          <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white/95 tabular-nums flex items-center gap-1">
            <Images className="w-3.5 h-3.5 text-amber-300" />
            {photoSlides.length > 1
              ? `${photoIdx + 1}/${photoSlides.length}`
              : isAr
              ? 'صورة'
              : 'Photo'}
          </span>
        )}
        <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-[11px] font-mono text-white/85 tabular-nums flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          {video.viewsCount}
        </span>
        {!isPhotoPost && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.88 }}
            transition={PILL_SPRING}
            type="button"
            onClick={onToggleMuted}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/75 cursor-pointer"
            title={muted ? (isAr ? 'تشغيل الصوت' : 'Unmute') : isAr ? 'كتم الصوت' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </motion.button>
        )}
      </div>

      {/* TikTok Action Rail */}
      <div className="absolute end-3 bottom-6 z-20 flex flex-col items-center gap-4">
        <div className="relative mb-1">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            transition={PILL_SPRING}
            type="button"
            onClick={isMine ? undefined : onOpenAuthorChat}
            className="block rounded-full ring-2 ring-white/90 shadow-lg cursor-pointer"
            title={video.authorName}
          >
            <CreatorAvatar
              photoURL={video.authorPhoto}
              name={video.authorName}
              sizeClass="w-12 h-12"
              online={authorOnline}
            />
          </motion.button>
          {!isMine && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.8 }}
              transition={PILL_SPRING}
              type="button"
              onClick={onToggleFollow}
              title={
                isFollowingAuthor
                  ? isAr
                    ? 'إلغاء المتابعة'
                    : 'Unfollow'
                  : isAr
                  ? 'متابعة'
                  : 'Follow'
              }
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer ${
                isFollowingAuthor ? 'bg-slate-700' : 'bg-[#FE2C55]'
              }`}
            >
              {isFollowingAuthor ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </motion.button>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.84 }}
          transition={PILL_SPRING}
          type="button"
          onClick={onToggleLike}
          className="flex flex-col items-center gap-1 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
            <Heart
              className={`w-6 h-6 transition-colors ${
                isLiked ? 'text-[#FE2C55] fill-[#FE2C55]' : 'text-white group-hover:text-rose-200'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-white tabular-nums drop-shadow">
            {video.likesCount}
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.84 }}
          transition={PILL_SPRING}
          type="button"
          onClick={onOpenComments}
          className="flex flex-col items-center gap-1 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white tabular-nums drop-shadow">
            {video.comments.length}
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.84 }}
          transition={PILL_SPRING}
          type="button"
          onClick={onOpenShare}
          className="flex flex-col items-center gap-1 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow">
            {isAr ? 'مشاركة' : 'Share'}
          </span>
        </motion.button>

        {isMine ? (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.84 }}
            transition={PILL_SPRING}
            type="button"
            onClick={onDelete}
            className="flex flex-col items-center gap-1 cursor-pointer"
            title={isAr ? 'حذف المنشور' : 'Delete Post'}
          >
            <div className="w-10 h-10 rounded-full bg-rose-600/35 border border-rose-500/40 flex items-center justify-center text-rose-200">
              <Trash2 className="w-4 h-4" />
            </div>
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.84 }}
            transition={PILL_SPRING}
            type="button"
            onClick={onOpenAuthorChat}
            className="flex flex-col items-center gap-1 cursor-pointer"
            title={isAr ? 'مراسلة صانع المحتوى' : 'Message Creator'}
          >
            <div className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white">
              <MessageCircle className="w-4 h-4" />
            </div>
          </motion.button>
        )}
      </div>

      <div className="absolute start-4 end-20 bottom-5 z-20 space-y-1.5 text-start">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isMine ? undefined : onOpenAuthorChat}
            className="text-sm sm:text-base font-black text-white hover:underline drop-shadow cursor-pointer"
          >
            @{video.authorHandle || video.authorName}
          </button>
          <span className="text-xs text-white/75 drop-shadow">
            · {formatRelativeTime(video.createdAt, isAr)}
          </span>
        </div>

        <h4 className="text-xs sm:text-sm font-bold text-white leading-snug drop-shadow">
          {video.title}
        </h4>

        {video.description && (
          <p
            onClick={() => setDescExpanded((v) => !v)}
            className={`text-xs text-slate-200/90 leading-relaxed drop-shadow cursor-pointer ${
              descExpanded ? '' : 'line-clamp-2'
            }`}
          >
            {video.description}
          </p>
        )}

        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-bold text-white/95 drop-shadow">
            {video.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}

        <div className="pt-1 flex items-center gap-2 text-[11px] text-white/85">
          {isPhotoPost ? (
            <Images className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          ) : (
            <Music2 className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">
            {isPhotoPost
              ? isAr
                ? `وضع الصور (${photoSlides.length}) · ${video.authorName}`
                : `Photo Mode (${photoSlides.length}) · ${video.authorName}`
              : isAr
              ? `الصوت الأصلي - ${video.authorName}`
              : `Original Sound - ${video.authorName}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export const SocialCommunityModal: React.FC<SocialCommunityModalProps> = ({
  isOpen,
  onClose,
  lang,
  initialTab = 'videos',
  initialDmRecipientId = null,
  initialRoomId = null,
  onOpenProfile,
  onOpenNotifications,
}) => {
  const isAr = lang === 'ar';
  const [topTab, setTopTab] = useState<TopSectionId>('videos');
  const [chatFolder, setChatFolder] = useState<ChatFolderId>('all');
  const [openedTarget, setOpenedTarget] = useState<OpenedChatTarget>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialDmRecipientId) {
      setTopTab('chats');
      setChatFolder('all');
      setOpenedTarget({ kind: 'dm', id: initialDmRecipientId });
      return;
    }
    if (initialRoomId) {
      setTopTab('chats');
      setChatFolder('all');
      setOpenedTarget({ kind: 'room', id: initialRoomId });
      return;
    }
    if (initialTab === 'videos') {
      setTopTab('videos');
    } else if (initialTab === 'followers') {
      setTopTab('followers');
    } else {
      setTopTab('chats');
      setOpenedTarget(null);
      if (
        initialTab === 'messages' ||
        initialTab === 'channels' ||
        initialTab === 'groups' ||
        initialTab === 'people'
      ) {
        setChatFolder(initialTab);
      } else {
        setChatFolder('all');
      }
    }
  }, [isOpen, initialTab, initialDmRecipientId, initialRoomId]);

  const social = useSocial();
  const identity = social.identity;

  const notify = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setNotice({ text, tone });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  };

  // ---------------- TikTok Video & Photo Post State ----------------
  const [videoFilter, setVideoFilter] = useState<'all' | 'following' | 'mine'>('all');
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [reelsMuted, setReelsMuted] = useState(false);
  const [showPublishBox, setShowPublishBox] = useState(false);
  const [publishMediaType, setPublishMediaType] = useState<'video' | 'image'>('video');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoTagsRaw, setVideoTagsRaw] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ durationSec?: number; width?: number; height?: number }>({});
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [activePhotoPreviewIdx, setActivePhotoPreviewIdx] = useState(0);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishingVideo, setPublishingVideo] = useState(false);
  const [commentsSheetVideoId, setCommentsSheetVideoId] = useState<string | null>(null);
  const [shareSheetVideo, setShareSheetVideo] = useState<ClientSocialVideo | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const viewedVideosRef = useRef<Set<string>>(new Set());
  const reelContainerRef = useRef<HTMLDivElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  const localVideoPreviewUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : ''),
    [videoFile]
  );

  useEffect(() => {
    return () => {
      if (localVideoPreviewUrl) URL.revokeObjectURL(localVideoPreviewUrl);
    };
  }, [localVideoPreviewUrl]);

  const localPhotoPreviewUrls = useMemo(
    () => photoFiles.map((f) => URL.createObjectURL(f)),
    [photoFiles]
  );

  useEffect(() => {
    return () => {
      localPhotoPreviewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [localPhotoPreviewUrls]);

  useEffect(() => {
    if (activePhotoPreviewIdx >= photoFiles.length && photoFiles.length > 0) {
      setActivePhotoPreviewIdx(photoFiles.length - 1);
    }
  }, [photoFiles.length, activePhotoPreviewIdx]);

  // ---------------- Unified Chats / Channels / Groups / People Search State ----------------
  const [unifiedQuery, setUnifiedQuery] = useState('');
  const [searchingPeople, setSearchingPeople] = useState(false);

  // Full-screen DM Composer
  const [dmInput, setDmInput] = useState('');
  const [sendingDm, setSendingDm] = useState(false);
  const [showAttachVideoInDm, setShowAttachVideoInDm] = useState(false);
  const [replyingToDmMsg, setReplyingToDmMsg] = useState<ClientDmMessage | null>(null);
  const dmEndRef = useRef<HTMLDivElement | null>(null);

  // Full-screen Telegram Room Composer & Search
  const [inRoomSearchQuery, setInRoomSearchQuery] = useState('');
  const [showInRoomSearch, setShowInRoomSearch] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState<'channel' | 'group' | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomDraft, setRoomDraft] = useState('');
  const [roomVideoDraft, setRoomVideoDraft] = useState('');
  const [showRoomAttach, setShowRoomAttach] = useState(false);
  const [replyingToMsg, setReplyingToMsg] = useState<ClientRoomMessage | null>(null);
  const [reactPickerMsgId, setReactPickerMsgId] = useState<string | null>(null);
  const [sendingRoomMsg, setSendingRoomMsg] = useState(false);
  const roomMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // ---------------- TikTok Followers / Following / Friends State ----------------
  const [followersSubTab, setFollowersSubTab] = useState<'following' | 'followers' | 'friends'>('followers');
  const [followersFilterQuery, setFollowersFilterQuery] = useState('');

  // Server people search while typing in Unified Chats hub
  useEffect(() => {
    if (!isOpen || topTab !== 'chats' || openedTarget) return;
    const t = setTimeout(async () => {
      setSearchingPeople(true);
      try {
        await social.searchCreators(unifiedQuery.trim());
      } finally {
        setSearchingPeople(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [unifiedQuery, topTab, openedTarget, isOpen]);

  const creatorsById = useMemo(() => {
    const map = new Map<string, ClientSocialCreator>();
    for (const c of social.creators) map.set(c.uid, c);
    return map;
  }, [social.creators]);

  const videosById = useMemo(() => {
    const map = new Map<string, ClientSocialVideo>();
    for (const v of social.videos) map.set(v.id, v);
    return map;
  }, [social.videos]);

  const otherCreators = useMemo(
    () => social.creators.filter((c) => c.uid !== identity.uid),
    [social.creators, identity.uid]
  );

  const mutualFriendIds = useMemo(
    () => social.followerIds.filter((id) => social.followingIds.includes(id)),
    [social.followerIds, social.followingIds]
  );

  const totalMyVideoLikes = useMemo(
    () =>
      social.videos
        .filter((v) => v.authorId === identity.uid)
        .reduce((acc, v) => acc + (v.likesCount || 0), 0),
    [social.videos, identity.uid]
  );

  const filteredVideos = useMemo(() => {
    if (videoFilter === 'following') {
      return social.videos.filter(
        (v) => social.followingIds.includes(v.authorId) || v.authorId === identity.uid
      );
    }
    if (videoFilter === 'mine') {
      return social.videos.filter((v) => v.authorId === identity.uid);
    }
    return social.videos;
  }, [social.videos, videoFilter, social.followingIds, identity.uid]);

  useEffect(() => {
    if (!isOpen || topTab !== 'videos' || filteredVideos.length === 0) return;
    if (!activeReelId || !filteredVideos.some((v) => v.id === activeReelId)) {
      setActiveReelId(filteredVideos[0].id);
    }
    const root = reelContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const id = (entry.target as HTMLElement).dataset.reelId;
            if (id) setActiveReelId(id);
          }
        }
      },
      { root, threshold: 0.6 }
    );

    const slides = root.querySelectorAll('[data-reel-id]');
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [isOpen, topTab, filteredVideos]);

  const filteredThreads = useMemo(() => {
    const q = unifiedQuery.trim().toLowerCase();
    return social.dmThreads.filter((th) => {
      if (!q) return true;
      const peerId = th.participants.find((p) => p !== identity.uid) || th.participants[0];
      const peer = creatorsById.get(peerId);
      return (
        (peer?.displayName || peerId).toLowerCase().includes(q) ||
        (peer?.handle || '').toLowerCase().includes(q) ||
        th.lastMessage.toLowerCase().includes(q)
      );
    });
  }, [social.dmThreads, unifiedQuery, creatorsById, identity.uid]);

  const filteredChannels = useMemo(() => {
    const q = unifiedQuery.trim().toLowerCase();
    return social.rooms
      .filter((r) => r.kind === 'channel')
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [social.rooms, unifiedQuery]);

  const filteredGroups = useMemo(() => {
    const q = unifiedQuery.trim().toLowerCase();
    return social.rooms
      .filter((r) => r.kind === 'group')
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [social.rooms, unifiedQuery]);

  const filteredPeople = useMemo(() => {
    const q = unifiedQuery.trim().toLowerCase();
    return social.creators.filter((c) => {
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.specialties.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [social.creators, unifiedQuery]);

  const activeDmRecipientId = openedTarget?.kind === 'dm' ? openedTarget.id : null;
  const activeThread: ClientDmThread | null = useMemo(() => {
    if (!activeDmRecipientId) return null;
    const expected = [
      `dm_${[identity.uid, activeDmRecipientId].sort().join('__')}`,
      [identity.uid, activeDmRecipientId].sort().join('__'),
    ];
    return (
      social.dmThreads.find((t) => expected.includes(t.id)) || {
        id: expected[0],
        participants: [identity.uid, activeDmRecipientId].sort() as [string, string],
        lastMessage: '',
        updatedAt: Date.now(),
        messages: [],
      }
    );
  }, [activeDmRecipientId, social.dmThreads, identity.uid]);

  const activeRoom: ClientSocialRoom | null = useMemo(() => {
    if (openedTarget?.kind !== 'room') return null;
    return social.rooms.find((r) => r.id === openedTarget.id) || null;
  }, [openedTarget, social.rooms]);

  useEffect(() => {
    if (openedTarget?.kind === 'dm' && activeThread?.messages.length) {
      dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [openedTarget, activeThread?.messages.length]);

  useEffect(() => {
    setReplyingToMsg(null);
    setReplyingToDmMsg(null);
    setReactPickerMsgId(null);
    setShowInRoomSearch(false);
    setInRoomSearchQuery('');
    setShowAttachVideoInDm(false);
    setShowRoomAttach(false);
  }, [openedTarget?.kind, openedTarget?.id]);

  useEffect(() => {
    if (isOpen && topTab === 'chats' && openedTarget?.kind === 'dm' && activeThread?.id) {
      social.markNotificationRead({ threadId: activeThread.id });
    }
  }, [isOpen, topTab, openedTarget?.kind, activeThread?.id]);

  // Unified Chronological Items when chatFolder === 'all'
  const allUnifiedChatItems = useMemo(() => {
    const items: Array<
      | { type: 'dm'; updatedAt: number; thread: ClientDmThread }
      | { type: 'room'; updatedAt: number; room: ClientSocialRoom }
    > = [
      ...filteredThreads.map((thread) => ({ type: 'dm' as const, updatedAt: thread.updatedAt, thread })),
      ...filteredChannels.map((room) => ({ type: 'room' as const, updatedAt: room.updatedAt, room })),
      ...filteredGroups.map((room) => ({ type: 'room' as const, updatedAt: room.updatedAt, room })),
    ];
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filteredThreads, filteredChannels, filteredGroups]);

  if (!isOpen) return null;

  const openChatWith = (targetUid: string) => {
    setTopTab('chats');
    setOpenedTarget({ kind: 'dm', id: targetUid });
  };

  const openRoomFull = (roomId: string) => {
    setTopTab('chats');
    setOpenedTarget({ kind: 'room', id: roomId });
  };

  const jumpToVideoInFeed = (videoId: string) => {
    setVideoFilter('all');
    setActiveReelId(videoId);
    setTopTab('videos');
    setTimeout(() => {
      const el = reelContainerRef.current?.querySelector(`[data-reel-id="${videoId}"]`);
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const scrollReelStep = (dir: -1 | 1) => {
    const idx = filteredVideos.findIndex((v) => v.id === activeReelId);
    const nextIdx = Math.max(0, Math.min(filteredVideos.length - 1, (idx < 0 ? 0 : idx) + dir));
    const target = filteredVideos[nextIdx];
    if (!target) return;
    const el = reelContainerRef.current?.querySelector(`[data-reel-id="${target.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const applyPickedFiles = (incoming: FileList | File[]) => {
    const all = Array.from(incoming || []);
    if (all.length === 0) return;

    const images = all.filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|heic)$/i.test(f.name)
    );
    const videos = all.filter(
      (f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(f.name)
    );

    if (videos.length > 0 && (publishMediaType === 'video' || images.length === 0)) {
      const vid = videos[0];
      setPublishMediaType('video');
      setVideoFile(vid);
      setVideoMeta({});
      if (!videoTitle.trim()) {
        setVideoTitle(vid.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
      }
      return;
    }

    if (images.length > 0) {
      setPublishMediaType('image');
      setPhotoFiles((prev) => {
        const next = [...prev, ...images].slice(0, 10);
        setActivePhotoPreviewIdx(Math.max(0, next.length - 1));
        return next;
      });
      if (!videoTitle.trim()) {
        setVideoTitle(
          images.length > 1
            ? isAr
              ? 'ألبوم صور إبداعي'
              : 'Photo Carousel'
            : images[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80)
        );
      }
    } else {
      notify(
        isAr ? 'يرجى اختيار ملف فيديو أو صور مدعومة' : 'Please select a valid video or image file',
        'err'
      );
    }
  };

  const movePhotoFile = (fromIdx: number, dir: -1 | 1) => {
    const toIdx = fromIdx + dir;
    if (toIdx < 0 || toIdx >= photoFiles.length) return;
    setPhotoFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setActivePhotoPreviewIdx(toIdx);
  };

  const toggleQuickTag = (tag: string) => {
    const existing = videoTagsRaw
      .split(/[,،\s]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (existing.includes(tag)) {
      setVideoTagsRaw(existing.filter((t) => t !== tag).join(', '));
    } else {
      setVideoTagsRaw([...existing, tag].slice(0, 8).join(', '));
    }
  };

  const handlePublishVideo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (publishMediaType === 'video' && !videoFile) {
      notify(isAr ? 'اختر أو اسحب ملف فيديو أولاً' : 'Please select or drop a video file first', 'err');
      return;
    }
    if (publishMediaType === 'image' && photoFiles.length === 0) {
      notify(isAr ? 'اختر أو اسحب صورة واحدة على الأقل' : 'Please select or drop at least one photo', 'err');
      return;
    }

    const effectiveTitle =
      videoTitle.trim() ||
      (publishMediaType === 'video'
        ? videoFile?.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ') || (isAr ? 'فيديو جديد' : 'New Video')
        : isAr
        ? 'ألبوم صور جديد'
        : 'New Photo Post');

    setPublishingVideo(true);
    setUploadProgress(4);
    try {
      const tags = videoTagsRaw
        .split(/[,،\s]+/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 8);

      const created = await social.uploadAndPublishVideo({
        title: effectiveTitle.slice(0, 140),
        description: videoDesc.trim(),
        tags,
        mediaType: publishMediaType,
        file: publishMediaType === 'video' ? videoFile : undefined,
        files: publishMediaType === 'image' ? photoFiles : undefined,
        durationSec: videoMeta.durationSec,
        onProgress: (pct) => setUploadProgress(pct),
      });

      setVideoTitle('');
      setVideoDesc('');
      setVideoTagsRaw('');
      setVideoFile(null);
      setVideoMeta({});
      setPhotoFiles([]);
      setActivePhotoPreviewIdx(0);
      setUploadProgress(0);
      setShowPublishBox(false);
      setVideoFilter('all');
      if (created?.id) setActiveReelId(created.id);
      notify(
        publishMediaType === 'image'
          ? isAr
            ? 'تم نشر الصور للجميع بنجاح'
            : 'Photos published successfully'
          : isAr
          ? 'تم نشر الفيديو للجميع بنجاح'
          : 'Video published successfully'
      );
    } catch (err: any) {
      notify(err?.message || (isAr ? 'تعذر الرفع والنشر' : 'Failed to upload & publish'), 'err');
    } finally {
      setPublishingVideo(false);
      setUploadProgress(0);
    }
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDmRecipientId || !dmInput.trim() || sendingDm) return;
    const text = dmInput.trim();
    setSendingDm(true);
    try {
      await social.sendDirectMessage(
        activeDmRecipientId,
        text,
        undefined,
        replyingToDmMsg
          ? {
              id: replyingToDmMsg.id,
              senderName: replyingToDmMsg.senderName,
              text: replyingToDmMsg.text,
            }
          : undefined
      );
      setDmInput('');
      setReplyingToDmMsg(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      notify(msg || (isAr ? 'فشل إرسال الرسالة' : 'Failed to send message'), 'err');
    } finally {
      setSendingDm(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCreateRoom || !newRoomName.trim() || creatingRoom) return;
    setCreatingRoom(true);
    try {
      const created = await social.createRoom(showCreateRoom, newRoomName.trim(), newRoomDesc.trim());
      setShowCreateRoom(null);
      setNewRoomName('');
      setNewRoomDesc('');
      setOpenedTarget({ kind: 'room', id: created.id });
      notify(
        created.kind === 'channel'
          ? isAr
            ? 'تم إنشاء القناة'
            : 'Channel created'
          : isAr
          ? 'تم إنشاء المجموعة'
          : 'Group created'
      );
    } catch {
      notify(isAr ? 'تعذر الإنشاء' : 'Creation failed', 'err');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSendRoomMessage = async (room: ClientSocialRoom, e: React.FormEvent) => {
    e.preventDefault();
    if ((!roomDraft.trim() && !roomVideoDraft.trim()) || sendingRoomMsg) return;
    setSendingRoomMsg(true);
    try {
      await social.sendRoomMessage(
        room.id,
        roomDraft.trim(),
        roomVideoDraft.trim() || undefined,
        replyingToMsg
          ? {
              id: replyingToMsg.id,
              senderName: replyingToMsg.senderName,
              text: replyingToMsg.text || (replyingToMsg.videoUrl ? '🎬 Video' : ''),
            }
          : undefined
      );
      setRoomDraft('');
      setRoomVideoDraft('');
      setShowRoomAttach(false);
      setReplyingToMsg(null);
      setTimeout(() => {
        roomMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } catch (err: any) {
      notify(err?.message || (isAr ? 'فشل الإرسال' : 'Failed to send'), 'err');
    } finally {
      setSendingRoomMsg(false);
    }
  };

  const commentsSheetVideo = commentsSheetVideoId ? videosById.get(commentsSheetVideoId) || null : null;
  const totalChatsCount = social.dmThreads.length + social.rooms.length;

  const topTabs: Array<{ id: TopSectionId; ar: string; en: string; count?: number; icon: React.ReactNode }> = [
    {
      id: 'videos',
      ar: 'الفيديوهات',
      en: 'Videos',
      count: social.videos.length,
      icon: <Film className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'chats',
      ar: 'المحادثات',
      en: 'Chats',
      count: totalChatsCount,
      icon: <MessageCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'followers',
      ar: 'المتابعون',
      en: 'Followers',
      count: social.followerIds.length,
      icon: <UserPlus className="w-3.5 h-3.5 shrink-0" />,
    },
  ];

  // =========================================================================
  // FULL-SCREEN CONVERSATION RENDERER (NO SPLIT-PANE)
  // =========================================================================
  const renderFullScreenDm = (recipientId: string) => {
    const peer = creatorsById.get(recipientId);
    const isFollowingPeer = social.followingIds.includes(recipientId);
    const peerFollowsMe = social.followerIds.includes(recipientId);
    const isFriends = isFollowingPeer && peerFollowsMe;

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-[#0B0E16] overflow-hidden">
        {/* Full-Width Top Header with Back Button */}
        <div className="px-3 sm:px-4 py-3 border-b border-white/[0.08] bg-[#111622] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setOpenedTarget(null)}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer shrink-0"
              title={isAr ? 'العودة للقائمة' : 'Back to list'}
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>

            <CreatorAvatar
              photoURL={peer?.photoURL}
              name={peer?.displayName || recipientId}
              sizeClass="w-10 h-10"
              online={peer?.online}
            />
            <div className="min-w-0">
              <div className="text-sm font-black text-white truncate flex items-center gap-1.5">
                <span className="truncate">{peer?.displayName || recipientId}</span>
                {peer?.isPrivateAccount && (
                  <span title={isAr ? 'حساب خاص محمي' : 'Private account'} className="shrink-0 inline-flex">
                    <Lock className="w-3.5 h-3.5 text-amber-300" />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                @{peer?.handle || recipientId.slice(-6)}
                {peer?.online ? (isAr ? ' · متصل الآن' : ' · Active now') : ''}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => social.toggleFollow(recipientId)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer shrink-0 transition-colors ${
              isFollowingPeer
                ? 'bg-white/[0.08] text-slate-200 hover:bg-rose-500/20'
                : 'bg-[#FE2C55] text-white'
            }`}
          >
            {isFriends
              ? isAr
                ? 'أصدقاء'
                : 'Friends'
              : isFollowingPeer
              ? isAr
                ? 'تتابعه'
                : 'Following'
              : peerFollowsMe
              ? isAr
                ? 'رد المتابعة'
                : 'Follow back'
              : isAr
              ? 'متابعة'
              : 'Follow'}
          </button>
        </div>

        {/* Full-Width Messages Stream */}
        <div className="flex-1 min-h-0 p-4 sm:p-5 space-y-2.5 overflow-y-auto">
          {!activeThread || activeThread.messages.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-slate-500">
              <MessageCircle className="w-9 h-9 mb-2 text-slate-600" />
              <p className="text-xs font-bold text-slate-300">
                {isAr ? 'ابدأ المحادثة الخاصة الآن' : 'Say hi to start this chat'}
              </p>
            </div>
          ) : (
            activeThread.messages.map((m) => {
              const isMine = m.senderId === identity.uid;
              const attachedVideo = m.videoId ? videosById.get(m.videoId) : undefined;
              const attachedIsPhoto = attachedVideo
                ? attachedVideo.mediaType === 'image' || isImagePostUrl(attachedVideo.videoUrl)
                : false;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={ITEM_SPRING}
                  className={`flex group ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm space-y-2 ${
                      isMine
                        ? 'bg-[#FE2C55] text-white rounded-ee-sm'
                        : 'bg-[#191F2E] text-slate-100 rounded-es-sm border border-white/[0.06]'
                    }`}
                  >
                    {m.replyToId && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-black/25 border-s-2 border-white/60 text-[11px]">
                        <div className="font-bold opacity-90">
                          {m.replyToSender || (isAr ? 'رسالة' : 'Message')}
                        </div>
                        <div className="opacity-80 line-clamp-1">{m.replyToText || '...'}</div>
                      </div>
                    )}

                    {attachedVideo && (
                      <button
                        type="button"
                        onClick={() => jumpToVideoInFeed(attachedVideo.id)}
                        className="w-full p-2.5 rounded-xl bg-black/35 hover:bg-black/50 flex items-center gap-2.5 text-start cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-black/60 flex items-center justify-center shrink-0 overflow-hidden">
                          {attachedIsPhoto ? (
                            <img
                              src={attachedVideo.videoUrl}
                              alt={attachedVideo.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Play className="w-4 h-4 fill-white text-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">{attachedVideo.title}</div>
                          <div className="text-[10px] opacity-80 truncate">
                            @{attachedVideo.authorHandle} ·{' '}
                            {isAr ? 'اضغط للمشاهدة' : 'Tap to view'}
                          </div>
                        </div>
                      </button>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <span
                        className={`text-[10px] tabular-nums ${
                          isMine ? 'text-white/75' : 'text-slate-400'
                        }`}
                      >
                        {formatClockTime(m.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingToDmMsg(m)}
                        className={`p-1 rounded-md opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer ${
                          isMine ? 'hover:bg-black/20 text-white' : 'hover:bg-white/10 text-slate-300'
                        }`}
                        title={isAr ? 'رد على هذه الرسالة' : 'Reply to message'}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={dmEndRef} />
        </div>

        {/* Shared Video Picker */}
        {showAttachVideoInDm && social.videos.length > 0 && (
          <div className="px-4 py-2.5 border-t border-white/[0.08] bg-[#121622] flex gap-2 overflow-x-auto shrink-0">
            {social.videos.slice(0, 10).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={async () => {
                  try {
                    await social.sendDirectMessage(recipientId, `🎬 ${v.title}`, v.id);
                    setShowAttachVideoInDm(false);
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '';
                    notify(msg || (isAr ? 'فشل الإرسال' : 'Failed to send'), 'err');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-[#FE2C55] text-xs font-bold text-white whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span className="truncate max-w-[140px]">{v.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reply Quote Preview Bar */}
        {replyingToDmMsg && (
          <div className="px-4 py-2 bg-[#161B29] border-t border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0 border-s-2 border-[#FE2C55] ps-2.5">
              <div className="text-[11px] font-bold text-[#FE2C55]">
                {isAr ? `الرد على ${replyingToDmMsg.senderName}` : `Replying to ${replyingToDmMsg.senderName}`}
              </div>
              <div className="text-xs text-slate-300 truncate">{replyingToDmMsg.text}</div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToDmMsg(null)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSendDm}
          className="p-3 sm:p-4 border-t border-white/[0.08] bg-[#10141F] flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => setShowAttachVideoInDm((v) => !v)}
            className={`p-2.5 rounded-full cursor-pointer transition-colors ${
              showAttachVideoInDm
                ? 'bg-[#FE2C55] text-white'
                : 'bg-[#191F2E] text-slate-300 hover:text-white'
            }`}
            title={isAr ? 'مشاركة فيديو في المحادثة' : 'Send a video'}
          >
            <Film className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={dmInput}
            onChange={(e) => setDmInput(e.target.value)}
            placeholder={isAr ? 'أرسل رسالة...' : 'Send a message...'}
            className="flex-1 px-4 py-2.5 rounded-full bg-[#191F2E] text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sendingDm || !dmInput.trim()}
            className="w-10 h-10 rounded-full bg-[#FE2C55] hover:bg-[#e7244b] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  };

  const renderFullScreenTelegramRoom = (room: ClientSocialRoom) => {
    const isChannel = room.kind === 'channel';
    const isJoined = room.memberIds.includes(identity.uid);
    const isOwner = room.ownerId === identity.uid;
    const isOfficialStarter = room.ownerId === 'sq_studio_official';
    const canPost = isChannel ? isOwner || isOfficialStarter : isJoined || isOwner;

    const pinnedMsg = room.pinnedMessageId
      ? room.messages.find((m) => m.id === room.pinnedMessageId) || null
      : null;

    const visibleMessages = room.messages.filter((m) => {
      if (!inRoomSearchQuery.trim()) return true;
      const q = inRoomSearchQuery.trim().toLowerCase();
      return m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q);
    });

    const onlineInRoomCount = room.memberIds.filter(
      (id) => creatorsById.get(id)?.online || id === identity.uid
    ).length;

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-[#0E1621] overflow-hidden">
        {/* Full-Width Telegram Room Top Header with Back Button */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#17212B] border-b border-[#0B1219] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setOpenedTarget(null)}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer shrink-0"
              title={isAr ? 'العودة للقائمة' : 'Back to list'}
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>

            <div
              className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-black text-white text-sm ${
                isChannel
                  ? 'bg-gradient-to-br from-[#4D88C4] to-[#2C5B8F]'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-700'
              }`}
            >
              {room.name.slice(0, 1)}
            </div>

            <div className="min-w-0">
              <h4 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                {isChannel ? (
                  <Megaphone className="w-3.5 h-3.5 text-[#64B5F6] shrink-0" />
                ) : (
                  <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="truncate">{room.name}</span>
              </h4>
              <div className="text-[11px] text-[#7DA8D6] tabular-nums truncate">
                {isChannel
                  ? isAr
                    ? `${room.membersCount} مشترك`
                    : `${room.membersCount} subscribers`
                  : isAr
                  ? `${room.membersCount} عضو · ${onlineInRoomCount} متصل الآن`
                  : `${room.membersCount} members · ${onlineInRoomCount} online`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowInRoomSearch((v) => !v)}
              className={`p-2 rounded-lg cursor-pointer transition-colors ${
                showInRoomSearch ? 'bg-[#2B5278] text-white' : 'text-slate-300 hover:bg-white/[0.06]'
              }`}
              title={isAr ? 'بحث داخل المحادثة' : 'Search messages'}
            >
              <Search className="w-4 h-4" />
            </button>

            {!isOwner && (
              <button
                type="button"
                onClick={() => social.toggleJoinRoom(room.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  isJoined
                    ? 'bg-white/[0.08] text-slate-200 hover:bg-rose-500/20 hover:text-rose-200'
                    : 'bg-[#5288C1] hover:bg-[#6299D3] text-white'
                }`}
              >
                {isJoined
                  ? isChannel
                    ? isAr
                      ? 'مغادرة القناة'
                      : 'Leave'
                    : isAr
                    ? 'مغادرة'
                    : 'Leave'
                  : isChannel
                  ? isAr
                    ? 'اشتراك'
                    : 'Subscribe'
                  : isAr
                  ? 'انضمام'
                  : 'Join'}
              </button>
            )}
          </div>
        </div>

        {/* In-Room Search */}
        {showInRoomSearch && (
          <div className="px-4 py-2 bg-[#17212B]/95 border-b border-[#0B1219] flex items-center gap-2 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={inRoomSearchQuery}
              onChange={(e) => setInRoomSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث في الرسائل...' : 'Search in chat...'}
              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
            />
            {inRoomSearchQuery && (
              <button
                type="button"
                onClick={() => setInRoomSearchQuery('')}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Pinned Message Banner */}
        {pinnedMsg && (
          <div className="px-4 py-2 bg-[#17212B]/90 border-b border-[#0B1219] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 border-s-2 border-[#5288C1] ps-2.5">
              <Pin className="w-3.5 h-3.5 text-[#64B5F6] shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#64B5F6]">
                  {isAr ? 'رسالة مثبتة' : 'Pinned Message'}
                </div>
                <p className="text-xs text-slate-200 truncate">
                  {pinnedMsg.text || (pinnedMsg.videoUrl ? '🎬 Video' : '')}
                </p>
              </div>
            </div>
            {(isOwner || !isChannel) && (
              <button
                type="button"
                onClick={() => social.togglePinRoomMessage(room.id, pinnedMsg.id)}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
                title={isAr ? 'إلغاء التثبيت' : 'Unpin'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Full-Width Messages / Posts Canvas */}
        <div
          className="flex-1 min-h-0 p-3.5 sm:p-5 space-y-3 overflow-y-auto"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(82,136,193,0.06), transparent 45%), radial-gradient(circle at 80% 80%, rgba(43,82,120,0.08), transparent 50%)',
          }}
        >
          {room.description && (
            <div className="max-w-lg mx-auto my-1 px-4 py-2 rounded-xl bg-[#17212B]/85 border border-white/[0.06] text-center text-[11px] text-slate-300">
              {room.description}
            </div>
          )}

          {visibleMessages.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center">
              <p className="text-xs font-bold text-slate-300">
                {isChannel
                  ? isAr
                    ? 'لا توجد منشورات في القناة حتى الآن'
                    : 'No channel posts yet'
                  : isAr
                  ? 'لا توجد رسائل في المجموعة بعد'
                  : 'No messages in group yet'}
              </p>
            </div>
          ) : (
            visibleMessages.map((m) => {
              const isMine = m.senderId === identity.uid;
              const reactionsEntries = Object.entries(m.reactions || {});
              const isPinned = room.pinnedMessageId === m.id;
              const peerCreator = creatorsById.get(m.senderId);

              if (isChannel) {
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={ITEM_SPRING}
                    className="max-w-2xl bg-[#182533] border border-[#243447] rounded-2xl rounded-ss-sm p-4 space-y-2 shadow-sm group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#64B5F6]">{room.name}</span>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                        {(isOwner || isOfficialStarter) && (
                          <button
                            type="button"
                            onClick={() => social.togglePinRoomMessage(room.id, m.id)}
                            className={`p-1 rounded hover:bg-white/10 cursor-pointer ${
                              isPinned ? 'text-[#64B5F6]' : 'text-slate-400'
                            }`}
                            title={isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin') : isAr ? 'تثبيت' : 'Pin'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setReactPickerMsgId(reactPickerMsgId === m.id ? null : m.id)
                          }
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                          title={isAr ? 'تفاعل' : 'React'}
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {m.videoUrl && (
                      <div className="rounded-xl overflow-hidden bg-black border border-white/10">
                        {isImagePostUrl(m.videoUrl) ? (
                          <img
                            src={m.videoUrl}
                            alt={m.text || room.name}
                            className="w-full max-h-72 object-contain"
                          />
                        ) : (
                          <video
                            src={m.videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full max-h-72 object-contain"
                          />
                        )}
                      </div>
                    )}

                    {m.text && (
                      <p className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                        {m.text}
                      </p>
                    )}

                    {reactPickerMsgId === m.id && (
                      <div className="flex items-center gap-1.5 pt-1">
                        {['👍', '❤️', '🔥', '👏', '🤩'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              social.toggleRoomReaction(room.id, m.id, emoji);
                              setReactPickerMsgId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-[#0E1621] hover:bg-[#2B5278] text-sm cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {reactionsEntries.map(([emoji, uids]) => {
                          const reactedByMe = uids.includes(identity.uid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => social.toggleRoomReaction(room.id, m.id, emoji)}
                              className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                                reactedByMe
                                  ? 'bg-[#2B5278] text-white border border-[#64B5F6]/50'
                                  : 'bg-[#0E1621]/70 text-slate-200 hover:bg-[#243447]'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-mono tabular-nums">
                                {uids.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 tabular-nums ms-auto">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {Math.max(m.viewsCount || 1, room.membersCount || 1)}
                        </span>
                        <span>{m.senderName}</span>
                        <span>{formatClockTime(m.createdAt)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // TELEGRAM GROUP CHAT BUBBLE
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={ITEM_SPRING}
                  className={`flex items-end gap-2 group ${
                    isMine ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {!isMine && (
                    <CreatorAvatar
                      photoURL={peerCreator?.photoURL}
                      name={m.senderName}
                      sizeClass="w-8 h-8"
                      online={peerCreator?.online}
                    />
                  )}

                  <div
                    className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-3.5 py-2.5 space-y-1.5 shadow-sm ${
                      isMine
                        ? 'bg-[#2B5278] text-white rounded-ee-sm'
                        : 'bg-[#182533] text-slate-100 rounded-es-sm border border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {!isMine && (
                        <span className={`text-xs font-black ${getSenderColorClass(m.senderId)}`}>
                          {m.senderName}
                        </span>
                      )}
                      <div className="flex items-center gap-1 ms-auto opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setReplyingToMsg(m)}
                          className="p-1 rounded hover:bg-black/20 text-slate-200 cursor-pointer"
                          title={isAr ? 'رد' : 'Reply'}
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReactPickerMsgId(reactPickerMsgId === m.id ? null : m.id)
                          }
                          className="p-1 rounded hover:bg-black/20 text-slate-200 cursor-pointer"
                          title={isAr ? 'تفاعل' : 'React'}
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => social.togglePinRoomMessage(room.id, m.id)}
                          className={`p-1 rounded hover:bg-black/20 cursor-pointer ${
                            isPinned ? 'text-amber-300' : 'text-slate-200'
                          }`}
                          title={isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin') : isAr ? 'تثبيت' : 'Pin'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {m.replyToId && (
                      <div className="px-2.5 py-1 rounded-lg bg-black/25 border-s-2 border-[#64B5F6] text-[11px]">
                        <div className="font-bold text-[#64B5F6]">
                          {m.replyToSender || 'Message'}
                        </div>
                        <div className="text-slate-200/85 line-clamp-1">
                          {m.replyToText || '...'}
                        </div>
                      </div>
                    )}

                    {m.videoUrl && (
                      <div className="rounded-xl overflow-hidden bg-black border border-white/10">
                        {isImagePostUrl(m.videoUrl) ? (
                          <img
                            src={m.videoUrl}
                            alt={m.text || room.name}
                            className="w-full max-h-60 object-contain"
                          />
                        ) : (
                          <video
                            src={m.videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full max-h-60 object-contain"
                          />
                        )}
                      </div>
                    )}

                    {m.text && (
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                        {m.text}
                      </p>
                    )}

                    {reactPickerMsgId === m.id && (
                      <div className="flex items-center gap-1 pt-1">
                        {['👍', '❤️', '🔥', '😂', '👏'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              social.toggleRoomReaction(room.id, m.id, emoji);
                              setReactPickerMsgId(null);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-black/30 hover:bg-black/50 text-sm cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap gap-1">
                        {reactionsEntries.map(([emoji, uids]) => {
                          const reactedByMe = uids.includes(identity.uid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => social.toggleRoomReaction(room.id, m.id, emoji)}
                              className={`px-1.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 cursor-pointer ${
                                reactedByMe ? 'bg-white/20 text-white' : 'bg-black/25 text-slate-200'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-mono tabular-nums">
                                {uids.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-white/60 tabular-nums ms-auto">
                        {formatClockTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={roomMessagesEndRef} />
        </div>

        {/* Telegram Bottom Composer or Subscribe Bar */}
        {canPost ? (
          <form
            onSubmit={(e) => handleSendRoomMessage(room, e)}
            className="bg-[#17212B] border-t border-[#0B1219] p-3 sm:p-4 space-y-2 shrink-0"
          >
            {replyingToMsg && (
              <div className="px-3 py-1.5 rounded-xl bg-[#0E1621] border-s-2 border-[#64B5F6] flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-[#64B5F6]">
                    {isAr
                      ? `الرد على ${replyingToMsg.senderName}`
                      : `Reply to ${replyingToMsg.senderName}`}
                  </div>
                  <div className="text-slate-300 truncate">{replyingToMsg.text || '🎬'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMsg(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {showRoomAttach && (
              <input
                type="url"
                value={roomVideoDraft}
                onChange={(e) => setRoomVideoDraft(e.target.value)}
                placeholder={isAr ? 'أدخل رابط فيديو للإرفاق...' : 'Paste video URL to attach...'}
                className="w-full px-3 py-2 rounded-xl bg-[#0E1621] border border-white/10 text-xs text-white focus:outline-none focus:border-[#64B5F6]"
              />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRoomAttach((v) => !v)}
                className={`p-2.5 rounded-xl cursor-pointer transition-colors ${
                  showRoomAttach
                    ? 'bg-[#2B5278] text-white'
                    : 'bg-[#242F3D] text-slate-300 hover:text-white'
                }`}
                title={isAr ? 'إرفاق فيديو' : 'Attach video'}
              >
                <VideoIcon className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={roomDraft}
                onChange={(e) => setRoomDraft(e.target.value)}
                placeholder={
                  isChannel
                    ? isAr
                      ? 'انشر منشوراً في القناة...'
                      : 'Broadcast to channel...'
                    : isAr
                    ? 'اكتب رسالة...'
                    : 'Write a message...'
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#242F3D] text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendingRoomMsg || (!roomDraft.trim() && !roomVideoDraft.trim())}
                className="w-10 h-10 rounded-xl bg-[#5288C1] hover:bg-[#6198D2] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => social.toggleJoinRoom(room.id)}
            className="w-full py-3.5 bg-[#17212B] hover:bg-[#202C39] border-t border-[#0B1219] text-sm font-black text-[#64B5F6] tracking-wide cursor-pointer transition-colors shrink-0"
          >
            {isJoined
              ? isChannel
                ? isAr
                  ? 'مغادرة القناة / كتم الإشعارات'
                  : 'UNSUBSCRIBE'
                : isAr
                ? 'مغادرة المجموعة'
                : 'LEAVE GROUP'
              : isChannel
              ? isAr
                ? 'اشتراك في القناة'
                : 'JOIN CHANNEL'
              : isAr
              ? 'انضمام للمجموعة'
              : 'JOIN GROUP'}
          </button>
        )}
      </div>
    );
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
        className="fixed inset-0 z-[78] bg-black/86 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 lg:p-5 select-none overflow-hidden"
      >
        <AmbientModalGlow />

        <motion.div
          variants={centerModalVariants}
          onClick={(e) => e.stopPropagation()}
          dir={isAr ? 'rtl' : 'ltr'}
          className="relative w-full max-w-5xl h-full sm:h-[92vh] bg-[#090B10] border-0 sm:border sm:border-white/[0.09] sm:rounded-3xl shadow-[0_32px_90px_rgba(0,0,0,0.92)] overflow-hidden text-slate-100 flex flex-col font-['Cairo',sans-serif] gpu-layer"
        >
          <PanelRimSheen roundedClass="sm:rounded-t-3xl" />

          {/* Global Top Navigation Bar (3 Unified Hubs, Single Non-Wrapping Row) */}
          <header className="shrink-0 px-3 sm:px-5 py-2.5 border-b border-white/[0.08] bg-[#090B10]/95 flex items-center justify-between gap-2 relative z-20">
            <button
              type="button"
              onClick={() => onOpenProfile && onOpenProfile()}
              className="flex items-center gap-2 text-start cursor-pointer group min-w-0 shrink-0"
              title={isAr ? 'الملف الشخصي' : 'Profile'}
            >
              <CreatorAvatar
                photoURL={identity.photoURL}
                name={identity.displayName}
                sizeClass="w-8 h-8"
                online={social.wsConnected}
              />
              <div className="min-w-0 hidden md:block">
                <div className="text-xs font-black text-white truncate group-hover:underline">
                  {identity.displayName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  @{identity.handle} ·{' '}
                  {social.wsConnected ? (isAr ? 'متصل' : 'Live') : isAr ? 'غير متصل' : 'Offline'}
                </div>
              </div>
            </button>

            <nav className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-2xl border border-white/[0.07] min-w-0">
              {topTabs.map((tab) => {
                const active = topTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setTopTab(tab.id);
                      if (tab.id === 'chats') setOpenedTarget(null);
                    }}
                    className={`relative px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active ? 'text-[#090B10]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="socialTopTabPill"
                        transition={PILL_SPRING}
                        className="absolute inset-0 rounded-xl bg-white shadow-sm"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {tab.icon}
                      <span>{isAr ? tab.ar : tab.en}</span>
                      {typeof tab.count === 'number' && tab.count > 0 && (
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            active ? 'text-[#090B10]/70' : 'text-slate-500'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-1 shrink-0">
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  title={isAr ? 'الإشعارات والرد السريع' : 'Notifications'}
                  className="relative w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {social.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FE2C55] text-white text-[9px] font-black flex items-center justify-center font-mono tabular-nums">
                      {social.unreadCount > 9 ? '9+' : social.unreadCount}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => social.refreshAll()}
                title={isAr ? 'تحديث' : 'Refresh'}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${social.loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Notice Banner */}
          <AnimatePresence>
            {notice && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="px-4 py-2 shrink-0 bg-[#090B10] border-b border-white/[0.06]"
              >
                <div
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    notice.tone === 'err'
                      ? 'bg-rose-950/70 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{notice.text}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Tab Content (Flex-1 Full-Height Container Without Double Scroll) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={topTab}
              variants={viewTransitionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              {/* ============================================================== */}
              {/* SECTION 1: TIKTOK-STYLE VERTICAL VIDEO + PHOTO CAROUSEL FEED   */}
              {/* ============================================================== */}
              {topTab === 'videos' && (
                <div className="flex-1 min-h-0 w-full bg-[#05070B] flex items-center justify-center relative overflow-hidden">
                  {filteredVideos.length > 1 && (
                    <div className="hidden md:flex flex-col gap-2 absolute end-6 top-1/2 -translate-y-1/2 z-30">
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        transition={PILL_SPRING}
                        type="button"
                        onClick={() => scrollReelStep(-1)}
                        className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 flex items-center justify-center text-white cursor-pointer transition-colors"
                        title={isAr ? 'السابق' : 'Previous'}
                      >
                        <ChevronUp className="w-5 h-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        transition={PILL_SPRING}
                        type="button"
                        onClick={() => scrollReelStep(1)}
                        className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 flex items-center justify-center text-white cursor-pointer transition-colors"
                        title={isAr ? 'التالي' : 'Next'}
                      >
                        <ChevronDown className="w-5 h-5" />
                      </motion.button>
                    </div>
                  )}

                  <div className="relative w-full max-w-[460px] h-full bg-black sm:border-x sm:border-white/[0.08] flex flex-col overflow-hidden">
                    <div className="absolute top-0 inset-x-0 z-30 px-4 py-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-2">
                      <div className="flex items-center gap-4">
                        {(
                          [
                            { id: 'following', ar: 'أتابعهم', en: 'Following' },
                            { id: 'all', ar: 'لك', en: 'For You' },
                            { id: 'mine', ar: 'منشوراتي', en: 'Mine' },
                          ] as const
                        ).map((f) => {
                          const active = videoFilter === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setVideoFilter(f.id)}
                              className={`relative pb-1 text-sm font-black transition-colors cursor-pointer ${
                                active ? 'text-white' : 'text-white/55 hover:text-white/85'
                              }`}
                            >
                              <span>{isAr ? f.ar : f.en}</span>
                              {active && (
                                <motion.span
                                  layoutId="videoFilterLine"
                                  transition={PILL_SPRING}
                                  className="absolute bottom-0 inset-x-1 h-0.5 rounded-full bg-white"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={PILL_SPRING}
                        type="button"
                        onClick={() => setShowPublishBox(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#FE2C55] hover:bg-[#e7244b] text-white text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>{isAr ? 'نشر' : 'Create'}</span>
                      </motion.button>
                    </div>

                    {filteredVideos.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <Film className="w-10 h-10 text-slate-600 mb-3" />
                        <p className="text-sm font-black text-white">
                          {videoFilter === 'following'
                            ? isAr
                              ? 'لا توجد منشورات ممن تتابعهم بعد'
                              : 'No posts from followed creators yet'
                            : isAr
                            ? 'لا توجد فيديوهات أو صور منشورة حتى الآن'
                            : 'No videos or photos published yet'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">
                          {isAr
                            ? 'انقر على «نشر» بالأعلى لمشاركة فيديو أو ألبوم صور بأسلوب تيك توك.'
                            : 'Click "Create" above to post a video reel or photo carousel.'}
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                          transition={PILL_SPRING}
                          type="button"
                          onClick={() => setShowPublishBox(true)}
                          className="mt-4 px-5 py-2.5 rounded-xl bg-[#FE2C55] text-white text-xs font-black flex items-center gap-2 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{isAr ? 'انشر الآن (فيديو أو صور)' : 'Post Video or Photos'}</span>
                        </motion.button>
                      </div>
                    ) : (
                      <div
                        ref={reelContainerRef}
                        className="flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar"
                      >
                        {filteredVideos.map((v) => (
                          <TikTokReelSlide
                            key={v.id}
                            video={v}
                            isActive={activeReelId === v.id}
                            muted={reelsMuted}
                            onToggleMuted={() => setReelsMuted((m) => !m)}
                            isMine={v.authorId === identity.uid}
                            isFollowingAuthor={social.followingIds.includes(v.authorId)}
                            isLiked={v.likedBy.includes(identity.uid)}
                            authorOnline={creatorsById.get(v.authorId)?.online}
                            isAr={isAr}
                            onToggleFollow={() => social.toggleFollow(v.authorId)}
                            onToggleLike={() => social.toggleLikeVideo(v.id)}
                            onOpenComments={() => setCommentsSheetVideoId(v.id)}
                            onOpenShare={() => setShareSheetVideo(v)}
                            onOpenAuthorChat={() => openChatWith(v.authorId)}
                            onDelete={() => social.deleteVideo(v.id)}
                            onViewed={() => {
                              if (!viewedVideosRef.current.has(v.id)) {
                                viewedVideosRef.current.add(v.id);
                                social.registerVideoView(v.id);
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Bottom Sheet Comments */}
                    <AnimatePresence>
                      {commentsSheetVideo && (
                        <motion.div
                          variants={backdropVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => setCommentsSheetVideoId(null)}
                          className="absolute inset-0 z-40 bg-black/55 backdrop-blur-xs flex flex-col justify-end"
                        >
                          <motion.div
                            variants={bottomSheetVariants}
                            onClick={(e) => e.stopPropagation()}
                            className="relative h-[65%] bg-[#12141C] border-t border-white/15 rounded-t-3xl flex flex-col shadow-2xl overflow-hidden"
                          >
                            <PanelRimSheen roundedClass="rounded-t-3xl" />
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                          <span className="text-xs font-black text-white tabular-nums">
                            {commentsSheetVideo.comments.length} {isAr ? 'تعليق' : 'comments'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCommentsSheetVideoId(null)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {commentsSheetVideo.comments.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-500">
                              {isAr ? 'كن أول من يعلق على هذا الفيديو' : 'Be the first to comment'}
                            </div>
                          ) : (
                            commentsSheetVideo.comments.map((cm) => {
                              const cmCreator = creatorsById.get(cm.authorId);
                              return (
                                <div key={cm.id} className="flex items-start gap-2.5">
                                  <CreatorAvatar
                                    photoURL={cmCreator?.photoURL}
                                    name={cm.authorName}
                                    sizeClass="w-8 h-8"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-bold text-slate-400">
                                      {cm.authorName} · {formatRelativeTime(cm.createdAt, isAr)}
                                    </div>
                                    <p className="text-xs sm:text-sm text-white mt-0.5 leading-snug">
                                      {cm.text}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!commentDraft.trim()) return;
                            await social.addVideoComment(commentsSheetVideo.id, commentDraft.trim());
                            setCommentDraft('');
                          }}
                          className="p-3 border-t border-white/10 bg-[#0B0D13] flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder={isAr ? 'أضف تعليقاً...' : 'Add comment...'}
                            className="flex-1 px-3.5 py-2 rounded-full bg-[#191C26] text-xs text-white focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!commentDraft.trim()}
                            className="px-4 py-2 rounded-full bg-[#FE2C55] text-white text-xs font-black disabled:opacity-40 cursor-pointer"
                          >
                            {isAr ? 'نشر' : 'Post'}
                          </button>
                        </form>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Quick Share Sheet */}
                <AnimatePresence>
                  {shareSheetVideo && (
                    <motion.div
                      variants={backdropVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={() => setShareSheetVideo(null)}
                      className="absolute inset-0 z-40 bg-black/55 backdrop-blur-xs flex flex-col justify-end"
                    >
                      <motion.div
                        variants={bottomSheetVariants}
                        onClick={(e) => e.stopPropagation()}
                        className="relative h-[55%] bg-[#12141C] border-t border-white/15 rounded-t-3xl flex flex-col shadow-2xl p-4 space-y-3 overflow-hidden"
                      >
                        <PanelRimSheen roundedClass="rounded-t-3xl" />
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-white">
                            {isAr ? 'إرسال المنشور إلى...' : 'Send post to...'}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setShareSheetVideo(null)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                          {otherCreators.length > 0 && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-400 mb-2">
                                {isAr ? 'إرسال في رسالة خاصة' : 'Send via Direct Message'}
                              </div>
                              <div className="flex gap-3 overflow-x-auto pb-1">
                                {otherCreators.map((c) => (
                                  <button
                                    key={c.uid}
                                    type="button"
                                    onClick={async () => {
                                      await social.sendDirectMessage(
                                        c.uid,
                                        `${shareSheetVideo.mediaType === 'image' ? '🖼️' : '🎬'} ${shareSheetVideo.title}`,
                                        shareSheetVideo.id
                                      );
                                      setShareSheetVideo(null);
                                      notify(
                                        isAr
                                          ? `تم الإرسال إلى ${c.displayName}`
                                          : `Sent to ${c.displayName}`
                                      );
                                    }}
                                    className="flex flex-col items-center gap-1 w-16 shrink-0 cursor-pointer"
                                  >
                                    <CreatorAvatar
                                      photoURL={c.photoURL}
                                      name={c.displayName}
                                      sizeClass="w-12 h-12"
                                      online={c.online}
                                    />
                                    <span className="text-[11px] text-slate-200 truncate w-full text-center">
                                      {c.displayName}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {social.rooms.length > 0 && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-400 mb-2">
                                {isAr ? 'إرسال إلى قناة أو مجموعة' : 'Share to Channel or Group'}
                              </div>
                              <div className="space-y-1.5">
                                {social.rooms
                                  .filter((r) =>
                                    r.kind === 'group'
                                      ? r.memberIds.includes(identity.uid) || r.ownerId === identity.uid
                                      : r.ownerId === identity.uid || r.ownerId === 'sq_studio_official'
                                  )
                                  .map((r) => (
                                    <button
                                      key={r.id}
                                      type="button"
                                      onClick={async () => {
                                        await social.sendRoomMessage(
                                          r.id,
                                          `${shareSheetVideo.mediaType === 'image' ? '🖼️' : '🎬'} ${shareSheetVideo.title}`,
                                          shareSheetVideo.videoUrl
                                        );
                                        setShareSheetVideo(null);
                                        notify(isAr ? `تم النشر في ${r.name}` : `Shared to ${r.name}`);
                                      }}
                                      className="w-full px-3 py-2 rounded-xl bg-[#191E2A] hover:bg-[#232A3B] flex items-center justify-between text-xs font-bold text-white cursor-pointer"
                                    >
                                      <span>{r.name}</span>
                                      <Send className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* TikTok Creation Studio Modal (Direct Video OR Multi-Photo Carousel Upload) */}
                <AnimatePresence>
                  {showPublishBox && (
                    <motion.div
                      variants={backdropVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={() => !publishingVideo && setShowPublishBox(false)}
                      className="absolute inset-0 z-50 bg-black/88 backdrop-blur-md p-3 sm:p-5 overflow-y-auto flex items-center justify-center"
                    >
                      <motion.form
                        variants={centerModalVariants}
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handlePublishVideo}
                        className="relative w-full max-w-md p-4 sm:p-5 rounded-2xl bg-[#12151E] border border-white/12 space-y-3.5 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
                      >
                        <PanelRimSheen roundedClass="rounded-2xl" />

                        <div className="flex items-center justify-between relative z-10">
                          <div>
                            <h3 className="text-sm font-black text-white">
                              {isAr ? 'رفع ونشر فيديو أو صور' : 'Upload Video or Photos'}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {isAr
                                ? 'اسحب الملفات مباشرة أو اختر من معرض الجهاز'
                                : 'Drag & drop files or choose from your device'}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={publishingVideo}
                            onClick={() => setShowPublishBox(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer disabled:opacity-40"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Media Type Switch: Video vs Photo Carousel */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#090B10] border border-white/10">
                          {(
                            [
                              {
                                id: 'video' as const,
                                ar: 'فيديو ريلز',
                                en: 'Video Reel',
                                icon: <Film className="w-3.5 h-3.5" />,
                              },
                              {
                                id: 'image' as const,
                                ar: 'صور / ألبوم',
                                en: 'Photos / Carousel',
                                icon: <Images className="w-3.5 h-3.5" />,
                              },
                            ] as const
                          ).map((opt) => {
                            const active = publishMediaType === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={publishingVideo}
                                onClick={() => setPublishMediaType(opt.id)}
                                className={`relative py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                                  active ? 'text-white' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {active && (
                                  <motion.span
                                    layoutId="publishMediaTypePill"
                                    transition={PILL_SPRING}
                                    className="absolute inset-0 rounded-lg bg-[#FE2C55]"
                                  />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5">
                                  {opt.icon}
                                  <span>{isAr ? opt.ar : opt.en}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Hidden Native File Inputs */}
                        <input
                          ref={videoFileInputRef}
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            if (e.target.files?.length) applyPickedFiles(e.target.files);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                        <input
                          ref={photoFileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            if (e.target.files?.length) applyPickedFiles(e.target.files);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />

                        {/* Drag & Drop + Preview Canvas */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingMedia(true);
                          }}
                          onDragLeave={() => setIsDraggingMedia(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingMedia(false);
                            if (e.dataTransfer.files?.length) {
                              applyPickedFiles(e.dataTransfer.files);
                            }
                          }}
                          className={`rounded-2xl transition-colors ${
                            isDraggingMedia
                              ? 'ring-2 ring-[#FE2C55] bg-[#FE2C55]/10'
                              : ''
                          }`}
                        >
                          {publishMediaType === 'video' ? (
                            localVideoPreviewUrl ? (
                              <div className="relative rounded-2xl overflow-hidden bg-black border border-white/15 h-56 flex items-center justify-center group">
                                <video
                                  src={localVideoPreviewUrl}
                                  muted
                                  autoPlay
                                  loop
                                  controls
                                  playsInline
                                  onLoadedMetadata={(e) => {
                                    const vidEl = e.currentTarget;
                                    setVideoMeta({
                                      durationSec: Math.round(vidEl.duration || 0),
                                      width: vidEl.videoWidth,
                                      height: vidEl.videoHeight,
                                    });
                                  }}
                                  className="w-full h-full object-contain"
                                />
                                <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-2 pointer-events-none">
                                  <span className="px-2 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-mono text-white/90 tabular-nums border border-white/10">
                                    {videoMeta.width && videoMeta.height
                                      ? `${videoMeta.width}×${videoMeta.height} · `
                                      : ''}
                                    {videoMeta.durationSec ? `${videoMeta.durationSec}s · ` : ''}
                                    {videoFile
                                      ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB`
                                      : ''}
                                  </span>
                                  <div className="flex items-center gap-1.5 pointer-events-auto">
                                    <button
                                      type="button"
                                      onClick={() => videoFileInputRef.current?.click()}
                                      className="px-2.5 py-1 rounded-lg bg-black/80 hover:bg-white/20 text-[11px] font-bold text-white border border-white/15 cursor-pointer"
                                    >
                                      {isAr ? 'تغيير' : 'Replace'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVideoFile(null);
                                        setVideoMeta({});
                                      }}
                                      className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white cursor-pointer"
                                      title={isAr ? 'إزالة الفيديو' : 'Remove video'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => videoFileInputRef.current?.click()}
                                className="w-full py-7 px-4 rounded-2xl bg-[#181D2B] hover:bg-[#1F2638] border-2 border-dashed border-white/20 hover:border-[#FE2C55]/70 text-xs font-bold text-white flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                              >
                                <div className="w-11 h-11 rounded-2xl bg-[#FE2C55]/15 border border-[#FE2C55]/40 flex items-center justify-center text-[#FE2C55]">
                                  <Upload className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-black">
                                  {isAr
                                    ? 'اسحب الفيديو هنا أو اضغط للاختيار'
                                    : 'Drop video here or tap to browse'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {isAr
                                    ? 'يدعم MP4 و MOV و WebM حتى 150MB'
                                    : 'Supports MP4, MOV, WebM up to 150MB'}
                                </span>
                              </button>
                            )
                          ) : localPhotoPreviewUrls.length > 0 ? (
                            <div className="space-y-2.5 p-2.5 rounded-2xl bg-[#090B10] border border-white/10">
                              {/* Large Preview of Active Photo Slide */}
                              <div className="relative h-44 rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                                <img
                                  src={
                                    localPhotoPreviewUrls[activePhotoPreviewIdx] ||
                                    localPhotoPreviewUrls[0]
                                  }
                                  alt={`Preview ${activePhotoPreviewIdx + 1}`}
                                  className="w-full h-full object-contain"
                                />
                                <span className="absolute top-2 start-2 px-2 py-0.5 rounded-md bg-black/75 text-[11px] font-mono text-white tabular-nums">
                                  {activePhotoPreviewIdx + 1} / {localPhotoPreviewUrls.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPhotoFiles([])}
                                  className="absolute top-2 end-2 px-2 py-1 rounded-md bg-black/75 hover:bg-rose-600 text-[10px] font-bold text-white cursor-pointer"
                                >
                                  {isAr ? 'مسح الكل' : 'Clear all'}
                                </button>
                              </div>

                              {/* Reorderable Thumbnails Strip */}
                              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {localPhotoPreviewUrls.map((src, idx) => {
                                  const isSelected = idx === activePhotoPreviewIdx;
                                  return (
                                    <div
                                      key={`${src}_${idx}`}
                                      onClick={() => setActivePhotoPreviewIdx(idx)}
                                      className={`relative w-18 h-24 rounded-xl overflow-hidden border-2 bg-black shrink-0 cursor-pointer transition-all ${
                                        isSelected ? 'border-[#FE2C55]' : 'border-white/15 opacity-80 hover:opacity-100'
                                      }`}
                                    >
                                      <img
                                        src={src}
                                        alt={`Slide ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="absolute top-1 end-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center cursor-pointer hover:bg-rose-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-0.5">
                                        {idx > 0 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              movePhotoFile(idx, -1);
                                            }}
                                            className="w-5 h-5 rounded bg-black/75 text-white flex items-center justify-center cursor-pointer"
                                            title={isAr ? 'تقديم' : 'Move left'}
                                          >
                                            {isAr ? (
                                              <ChevronRight className="w-3 h-3" />
                                            ) : (
                                              <ChevronLeft className="w-3 h-3" />
                                            )}
                                          </button>
                                        ) : (
                                          <span className="w-5" />
                                        )}
                                        <span className="px-1 rounded bg-black/75 text-[9px] font-mono text-white">
                                          {idx + 1}
                                        </span>
                                        {idx < localPhotoPreviewUrls.length - 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              movePhotoFile(idx, 1);
                                            }}
                                            className="w-5 h-5 rounded bg-black/75 text-white flex items-center justify-center cursor-pointer"
                                            title={isAr ? 'تأخير' : 'Move right'}
                                          >
                                            {isAr ? (
                                              <ChevronLeft className="w-3 h-3" />
                                            ) : (
                                              <ChevronRight className="w-3 h-3" />
                                            )}
                                          </button>
                                        ) : (
                                          <span className="w-5" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {photoFiles.length < 10 && (
                                  <button
                                    type="button"
                                    onClick={() => photoFileInputRef.current?.click()}
                                    className="w-18 h-24 rounded-xl border border-dashed border-white/25 bg-white/[0.04] hover:bg-white/[0.09] flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-slate-200 shrink-0 cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4 text-amber-300" />
                                    <span>{isAr ? 'إضافة' : 'Add'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => photoFileInputRef.current?.click()}
                              className="w-full py-7 px-4 rounded-2xl bg-[#181D2B] hover:bg-[#1F2638] border-2 border-dashed border-white/20 hover:border-amber-400/70 text-xs font-bold text-white flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                            >
                              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                              <span className="text-sm font-black">
                                {isAr
                                  ? 'اسحب الصور هنا أو اختر من المعرض'
                                  : 'Drop photos here or tap to browse'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                {isAr
                                  ? 'صورة واحدة أو ألبوم حتى 10 صور (PNG, JPG, WebP, GIF)'
                                  : '1–10 photos supported (PNG, JPG, WebP, GIF)'}
                              </span>
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={videoTitle}
                          onChange={(e) => setVideoTitle(e.target.value)}
                          placeholder={
                            publishMediaType === 'image'
                              ? isAr
                                ? 'عنوان الصور (أو يُؤخذ تلقائياً)...'
                                : 'Photo post title...'
                              : isAr
                              ? 'عنوان الفيديو (أو يُؤخذ تلقائياً)...'
                              : 'Video title...'
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#090B10] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                        />

                        <textarea
                          rows={2}
                          value={videoDesc}
                          onChange={(e) => setVideoDesc(e.target.value)}
                          placeholder={isAr ? 'وصف المنشور...' : 'Caption...'}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#090B10] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FE2C55] resize-none"
                        />

                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={videoTagsRaw}
                            onChange={(e) => setVideoTagsRaw(e.target.value)}
                            placeholder={
                              isAr ? 'وسوم: موشن, 3D, تصميم' : 'Tags: motion, 3d, design'
                            }
                            className="w-full px-3.5 py-2 rounded-xl bg-[#090B10] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                          />
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(isAr
                              ? ['موشن', '3D', 'انتقالات', 'تصميم', 'ألوان']
                              : ['motion', '3d', 'transitions', 'design', 'reel']
                            ).map((chip) => {
                              const selected = videoTagsRaw.includes(chip);
                              return (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => toggleQuickTag(chip)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                    selected
                                      ? 'bg-[#FE2C55] text-white'
                                      : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]'
                                  }`}
                                >
                                  #{chip}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Upload Progress Bar when uploading */}
                        {publishingVideo && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 tabular-nums">
                              <span>{isAr ? 'جاري الرفع والمعالجة...' : 'Uploading media...'}</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(4, uploadProgress)}%` }}
                                transition={{ duration: 0.15 }}
                                className="h-full rounded-full bg-gradient-to-r from-[#FE2C55] to-[#25F4EE]"
                              />
                            </div>
                          </div>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.015 }}
                          whileTap={{ scale: 0.97 }}
                          transition={PILL_SPRING}
                          type="submit"
                          disabled={publishingVideo}
                          className="w-full py-2.5 rounded-xl bg-[#FE2C55] hover:bg-[#e7244b] text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {publishingVideo ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : publishMediaType === 'image' ? (
                            <Images className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 fill-white" />
                          )}
                          <span>
                            {publishingVideo
                              ? isAr
                                ? `جاري النشر ${uploadProgress}%`
                                : `Publishing ${uploadProgress}%`
                              : publishMediaType === 'image'
                              ? isAr
                                ? `نشر الصور (${photoFiles.length})`
                                : `Post Photos (${photoFiles.length})`
                              : isAr
                              ? 'نشر الفيديو الآن'
                              : 'Post Video'}
                          </span>
                        </motion.button>
                      </motion.form>
                    </motion.div>
                  )}
                </AnimatePresence>
                  </div>
                </div>
              )}

            {/* ============================================================== */}
            {/* SECTION 2: UNIFIED CHATS + CHANNELS + GROUPS + PEOPLE SEARCH   */}
            {/* (FULL-SCREEN CHAT VIEW WHEN OPENED, NEVER SPLIT-PANE)          */}
            {/* ============================================================== */}
            {topTab === 'chats' && (
              <AnimatePresence mode="wait">
                {openedTarget?.kind === 'dm' ? (
                  <motion.div
                    key={`dm_${openedTarget.id}`}
                    variants={viewTransitionVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 min-h-0 flex flex-col overflow-hidden"
                  >
                    {renderFullScreenDm(openedTarget.id)}
                  </motion.div>
                ) : openedTarget?.kind === 'room' && activeRoom ? (
                  <motion.div
                    key={`room_${activeRoom.id}`}
                    variants={viewTransitionVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 min-h-0 flex flex-col overflow-hidden"
                  >
                    {renderFullScreenTelegramRoom(activeRoom)}
                  </motion.div>
                ) : (
                  <motion.div
                    key="chats_hub_list"
                    variants={viewTransitionVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 min-h-0 flex flex-col bg-[#0D1018] overflow-hidden"
                  >
                    {/* Unified Top Search + Create Channel / Group Controls */}
                    <div className="p-3 sm:p-4 bg-[#121622] border-b border-white/[0.08] space-y-3 shrink-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#090B10] border border-white/[0.09] flex-1 min-w-[210px]">
                          <Search className="w-4 h-4 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={unifiedQuery}
                            onChange={(e) => setUnifiedQuery(e.target.value)}
                            placeholder={
                              isAr
                                ? 'ابحث عن شخص (@المعرف)، محادثة، قناة، أو مجموعة...'
                                : 'Search people (@handle), chats, channels, or groups...'
                            }
                            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
                          />
                          {searchingPeople && (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          )}
                          {unifiedQuery && (
                            <button
                              type="button"
                              onClick={() => setUnifiedQuery('')}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.94 }}
                            transition={PILL_SPRING}
                            type="button"
                            onClick={() =>
                              setShowCreateRoom(showCreateRoom === 'channel' ? null : 'channel')
                            }
                            className="px-3 py-2 rounded-xl bg-[#2B5278] hover:bg-[#356492] text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAr ? 'قناة' : 'Channel'}</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.94 }}
                            transition={PILL_SPRING}
                            type="button"
                            onClick={() =>
                              setShowCreateRoom(showCreateRoom === 'group' ? null : 'group')
                            }
                            className="px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAr ? 'مجموعة' : 'Group'}</span>
                          </motion.button>
                        </div>
                      </div>

                      {/* Inline Create Channel / Group Card */}
                      <AnimatePresence>
                        {showCreateRoom && (
                          <motion.form
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onSubmit={handleCreateRoom}
                            className="p-3.5 rounded-xl bg-[#090B10] border border-[#5288C1]/40 space-y-2.5"
                          >
                            <div className="text-xs font-black text-white">
                              {showCreateRoom === 'channel'
                                ? isAr
                                  ? 'إنشاء قناة بث جديدة (تلجرام)'
                                  : 'Create New Broadcast Channel'
                                : isAr
                                ? 'إنشاء مجموعة نقاش جديدة (تلجرام)'
                                : 'Create New Group Chat'}
                            </div>
                            <input
                              type="text"
                              value={newRoomName}
                              onChange={(e) => setNewRoomName(e.target.value)}
                              placeholder={
                                showCreateRoom === 'channel'
                                  ? isAr
                                    ? 'اسم القناة...'
                                    : 'Channel name...'
                                  : isAr
                                  ? 'اسم المجموعة...'
                                  : 'Group name...'
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#121622] border border-white/10 text-xs text-white focus:outline-none focus:border-[#5288C1]"
                            />
                            <textarea
                              rows={2}
                              value={newRoomDesc}
                              onChange={(e) => setNewRoomDesc(e.target.value)}
                              placeholder={isAr ? 'وصف مختصر (اختياري)...' : 'Description (optional)...'}
                              className="w-full px-3 py-2 rounded-lg bg-[#121622] border border-white/10 text-xs text-white focus:outline-none focus:border-[#5288C1] resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowCreateRoom(null)}
                                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                {isAr ? 'إلغاء' : 'Cancel'}
                              </button>
                              <button
                                type="submit"
                                disabled={creatingRoom || !newRoomName.trim()}
                                className="px-4 py-1.5 rounded-lg bg-[#5288C1] hover:bg-[#6198D2] text-white text-xs font-black disabled:opacity-50 cursor-pointer"
                              >
                                {creatingRoom ? '...' : isAr ? 'إنشاء وفتح' : 'Create & Open'}
                              </button>
                            </div>
                          </motion.form>
                        )}
                      </AnimatePresence>

                      {/* Telegram-Style Folder Filter Bar */}
                      <div className="flex items-center gap-4 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
                        {(
                          [
                            { id: 'all', ar: 'الكل', en: 'All', count: totalChatsCount },
                            {
                              id: 'messages',
                              ar: 'المراسلات',
                              en: 'DMs',
                              count: filteredThreads.length,
                            },
                            {
                              id: 'channels',
                              ar: 'القنوات',
                              en: 'Channels',
                              count: filteredChannels.length,
                            },
                            {
                              id: 'groups',
                              ar: 'المجموعات',
                              en: 'Groups',
                              count: filteredGroups.length,
                            },
                            {
                              id: 'people',
                              ar: 'الأشخاص',
                              en: 'People',
                              count: filteredPeople.length,
                            },
                          ] as const
                        ).map((f) => {
                          const active = chatFolder === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setChatFolder(f.id)}
                              className={`relative pb-2 text-xs font-black whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors ${
                                active ? 'text-[#64B5F6]' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span>{isAr ? f.ar : f.en}</span>
                              <span className="text-[10px] font-mono tabular-nums opacity-75">
                                {f.count}
                              </span>
                              {active && (
                                <motion.span
                                  layoutId="chatFolderLine"
                                  transition={PILL_SPRING}
                                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[#64B5F6] rounded-full"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Unified List Body */}
                    <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
                      {/* Horizontal Quick-Message Creators Strip (All & Messages when not typing search) */}
                      {(chatFolder === 'all' || chatFolder === 'messages') &&
                        otherCreators.length > 0 &&
                        !unifiedQuery.trim() && (
                          <div className="px-4 py-3 bg-[#0B0E16]">
                            <div className="text-[11px] font-black text-slate-400 mb-2">
                              {isAr ? 'مراسلة سريعة' : 'Quick Message'}
                            </div>
                            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                              {otherCreators.map((c) => (
                                <button
                                  key={c.uid}
                                  type="button"
                                  onClick={() => openChatWith(c.uid)}
                                  className="flex flex-col items-center gap-1 w-14 shrink-0 cursor-pointer group"
                                >
                                  <div
                                    className={`p-0.5 rounded-full ${
                                      c.online ? 'bg-emerald-400' : 'bg-white/15'
                                    }`}
                                  >
                                    <CreatorAvatar
                                      photoURL={c.photoURL}
                                      name={c.displayName}
                                      sizeClass="w-11 h-11"
                                      online={c.online}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-200 truncate w-full text-center group-hover:text-white">
                                    {c.displayName.split(' ')[0]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* ALL UNIFIED ITEMS */}
                      {chatFolder === 'all' && (
                        <>
                          {allUnifiedChatItems.map((entry) => {
                            if (entry.type === 'dm') {
                              const th = entry.thread;
                              const peerId =
                                th.participants.find((p) => p !== identity.uid) ||
                                th.participants[0];
                              const peer = creatorsById.get(peerId);
                              return (
                                <button
                                  key={`dm_${th.id}`}
                                  type="button"
                                  onClick={() => openChatWith(peerId)}
                                  className="w-full px-4 py-3 flex items-center gap-3 text-start hover:bg-white/[0.04] cursor-pointer transition-colors"
                                >
                                  <CreatorAvatar
                                    photoURL={peer?.photoURL}
                                    name={peer?.displayName || peerId}
                                    sizeClass="w-12 h-12"
                                    online={peer?.online}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-black text-white truncate">
                                        {peer?.displayName || peerId}
                                      </span>
                                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                        {formatRelativeTime(th.updatedAt, isAr)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-400 truncate mt-0.5">
                                      {th.lastMessage || (isAr ? 'محادثة خاصة' : 'Direct chat')}
                                    </div>
                                  </div>
                                </button>
                              );
                            }

                            const r = entry.room;
                            const isChannel = r.kind === 'channel';
                            const lastMsg = r.messages[r.messages.length - 1];
                            return (
                              <button
                                key={`room_${r.id}`}
                                type="button"
                                onClick={() => openRoomFull(r.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 text-start hover:bg-white/[0.04] cursor-pointer transition-colors"
                              >
                                <div
                                  className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-black text-white text-base ${
                                    isChannel
                                      ? 'bg-gradient-to-br from-[#4D88C4] to-[#2C5B8F]'
                                      : 'bg-gradient-to-br from-emerald-500 to-teal-700'
                                  }`}
                                >
                                  {r.name.slice(0, 1)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black text-white truncate flex items-center gap-1.5">
                                      {isChannel ? (
                                        <Megaphone className="w-3.5 h-3.5 text-[#64B5F6] shrink-0" />
                                      ) : (
                                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      )}
                                      <span className="truncate">{r.name}</span>
                                    </span>
                                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                      {formatRelativeTime(
                                        lastMsg ? lastMsg.createdAt : r.updatedAt,
                                        isAr
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <p className="text-xs text-slate-400 truncate">
                                      {lastMsg
                                        ? isChannel
                                          ? lastMsg.text || '🎬'
                                          : `${lastMsg.senderName}: ${lastMsg.text || '🎬'}`
                                        : r.description || r.ownerName}
                                    </p>
                                    <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                                      {r.membersCount}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                          {/* Matching People inside "All" view ONLY when user searches, else keep a crisp shortcut row */}
                          {unifiedQuery.trim() && filteredPeople.length > 0 && (
                            <div className="bg-[#0A0D14]">
                              <div className="px-4 py-2 text-[11px] font-black text-slate-400">
                                {isAr ? 'نتائج البحث في الأشخاص' : 'Matching People'}
                              </div>
                              {filteredPeople.map((person) => {
                                const isSelf = person.uid === identity.uid;
                                const isFollowing = social.followingIds.includes(person.uid);
                                const followsMe = social.followerIds.includes(person.uid);
                                return (
                                  <div
                                    key={`person_all_${person.uid}`}
                                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03]"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => !isSelf && openChatWith(person.uid)}
                                      className="flex items-center gap-3 min-w-0 text-start flex-1 cursor-pointer"
                                    >
                                      <CreatorAvatar
                                        photoURL={person.photoURL}
                                        name={person.displayName}
                                        sizeClass="w-11 h-11"
                                        online={person.online}
                                      />
                                      <div className="min-w-0">
                                        <div className="text-sm font-black text-white truncate flex items-center gap-1.5">
                                          <span className="truncate">{person.displayName}</span>
                                          {person.isPrivateAccount && (
                                            <span title={isAr ? 'حساب خاص' : 'Private'} className="shrink-0 inline-flex">
                                              <Lock className="w-3.5 h-3.5 text-amber-300" />
                                            </span>
                                          )}
                                          {isSelf && (
                                            <span className="text-[10px] text-emerald-400 shrink-0">
                                              ({isAr ? 'أنت' : 'You'})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-400 truncate">
                                          @{person.handle}
                                          {person.role ? ` · ${person.role}` : ''}
                                          {person.location ? ` · ${person.location}` : ''}
                                        </div>
                                      </div>
                                    </button>

                                    {!isSelf && (
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => social.toggleFollow(person.uid)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                                            isFollowing
                                              ? 'bg-white/[0.08] text-slate-200'
                                              : 'bg-[#FE2C55] text-white'
                                          }`}
                                        >
                                          {isFollowing
                                            ? isAr
                                              ? 'تتابعه'
                                              : 'Following'
                                            : followsMe
                                            ? isAr
                                              ? 'رد المتابعة'
                                              : 'Follow back'
                                            : isAr
                                            ? 'متابعة'
                                            : 'Follow'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openChatWith(person.uid)}
                                          className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 cursor-pointer"
                                          title={isAr ? 'مراسلة' : 'Message'}
                                        >
                                          <MessageCircle className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {allUnifiedChatItems.length === 0 && (!unifiedQuery.trim() || filteredPeople.length === 0) && (
                            <div className="py-16 px-4 text-center space-y-2">
                              <MessageCircle className="w-9 h-9 text-slate-600 mx-auto" />
                              <p className="text-xs font-bold text-slate-300">
                                {unifiedQuery.trim()
                                  ? isAr
                                    ? 'لا توجد نتائج مطابقة لبحثك'
                                    : 'No matching results found'
                                  : isAr
                                  ? 'لا توجد محادثات أو قنوات بعد'
                                  : 'No chats or channels yet'}
                              </p>
                              {!unifiedQuery.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setChatFolder('people')}
                                  className="px-4 py-2 rounded-xl bg-[#5288C1] text-white text-xs font-bold cursor-pointer"
                                >
                                  {isAr ? 'استعراض الأشخاص للبدء' : 'Browse People'}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* MESSAGES ONLY */}
                      {chatFolder === 'messages' &&
                        (filteredThreads.length === 0 ? (
                          <div className="py-16 text-center text-xs text-slate-400">
                            {isAr
                              ? 'لا توجد محادثات خاصة بعد — اختر شخصاً بالأعلى أو من تبويب الأشخاص'
                              : 'No direct messages yet — pick a creator above or in People'}
                          </div>
                        ) : (
                          filteredThreads.map((th) => {
                            const peerId =
                              th.participants.find((p) => p !== identity.uid) ||
                              th.participants[0];
                            const peer = creatorsById.get(peerId);
                            return (
                              <button
                                key={th.id}
                                type="button"
                                onClick={() => openChatWith(peerId)}
                                className="w-full px-4 py-3 flex items-center gap-3 text-start hover:bg-white/[0.04] cursor-pointer"
                              >
                                <CreatorAvatar
                                  photoURL={peer?.photoURL}
                                  name={peer?.displayName || peerId}
                                  sizeClass="w-12 h-12"
                                  online={peer?.online}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black text-white truncate">
                                      {peer?.displayName || peerId}
                                    </span>
                                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                      {formatRelativeTime(th.updatedAt, isAr)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 truncate mt-0.5">
                                    {th.lastMessage}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ))}

                      {/* CHANNELS ONLY */}
                      {chatFolder === 'channels' &&
                        (filteredChannels.length === 0 ? (
                          <div className="py-16 text-center text-xs text-slate-400">
                            {isAr ? 'لا توجد قنوات مطابقة' : 'No matching channels'}
                          </div>
                        ) : (
                          filteredChannels.map((r) => {
                            const lastMsg = r.messages[r.messages.length - 1];
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => openRoomFull(r.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 text-start hover:bg-white/[0.04] cursor-pointer"
                              >
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4D88C4] to-[#2C5B8F] shrink-0 flex items-center justify-center font-black text-white text-base">
                                  {r.name.slice(0, 1)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black text-white truncate flex items-center gap-1.5">
                                      <Megaphone className="w-3.5 h-3.5 text-[#64B5F6] shrink-0" />
                                      <span className="truncate">{r.name}</span>
                                    </span>
                                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                      {formatRelativeTime(
                                        lastMsg ? lastMsg.createdAt : r.updatedAt,
                                        isAr
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <p className="text-xs text-slate-400 truncate">
                                      {lastMsg ? lastMsg.text || '🎬' : r.description}
                                    </p>
                                    <span className="text-[11px] text-[#64B5F6] font-mono tabular-nums shrink-0">
                                      {r.membersCount} {isAr ? 'مشترك' : 'subs'}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ))}

                      {/* GROUPS ONLY */}
                      {chatFolder === 'groups' &&
                        (filteredGroups.length === 0 ? (
                          <div className="py-16 text-center text-xs text-slate-400">
                            {isAr ? 'لا توجد مجموعات مطابقة' : 'No matching groups'}
                          </div>
                        ) : (
                          filteredGroups.map((r) => {
                            const lastMsg = r.messages[r.messages.length - 1];
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => openRoomFull(r.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 text-start hover:bg-white/[0.04] cursor-pointer"
                              >
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 shrink-0 flex items-center justify-center font-black text-white text-base">
                                  {r.name.slice(0, 1)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black text-white truncate flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span className="truncate">{r.name}</span>
                                    </span>
                                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                      {formatRelativeTime(
                                        lastMsg ? lastMsg.createdAt : r.updatedAt,
                                        isAr
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <p className="text-xs text-slate-400 truncate">
                                      {lastMsg
                                        ? `${lastMsg.senderName}: ${lastMsg.text || '🎬'}`
                                        : r.description}
                                    </p>
                                    <span className="text-[11px] text-emerald-400 font-mono tabular-nums shrink-0">
                                      {r.membersCount} {isAr ? 'عضو' : 'members'}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ))}

                      {/* PEOPLE DIRECTORY ONLY */}
                      {chatFolder === 'people' &&
                        (filteredPeople.length === 0 ? (
                          <div className="py-16 text-center text-xs text-slate-400">
                            {isAr ? 'لا يوجد أشخاص مطابقون للبحث' : 'No matching creators'}
                          </div>
                        ) : (
                          filteredPeople.map((person) => {
                            const isSelf = person.uid === identity.uid;
                            const isFollowing = social.followingIds.includes(person.uid);
                            const followsMe = social.followerIds.includes(person.uid);
                            return (
                              <div
                                key={person.uid}
                                className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.03]"
                              >
                                <button
                                  type="button"
                                  onClick={() => !isSelf && openChatWith(person.uid)}
                                  className="flex items-start gap-3 min-w-0 text-start flex-1 cursor-pointer"
                                >
                                  <CreatorAvatar
                                    photoURL={person.photoURL}
                                    name={person.displayName}
                                    sizeClass="w-12 h-12"
                                    online={person.online}
                                  />
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="text-sm font-black text-white truncate flex items-center gap-1.5">
                                      <span className="truncate">{person.displayName}</span>
                                      {person.isPrivateAccount && (
                                        <span title={isAr ? 'حساب خاص' : 'Private'} className="shrink-0 inline-flex">
                                          <Lock className="w-3.5 h-3.5 text-amber-300" />
                                        </span>
                                      )}
                                      {isSelf && (
                                        <span className="text-[10px] text-emerald-400 shrink-0">
                                          ({isAr ? 'أنت' : 'You'})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate">
                                      @{person.handle}
                                      {person.role ? ` · ${person.role}` : ''}
                                      {person.location ? ` · ${person.location}` : ''}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                      {person.followersCount} {isAr ? 'متابع' : 'followers'} ·{' '}
                                      {person.videosCount} {isAr ? 'فيديو' : 'videos'}
                                    </div>
                                  </div>
                                </button>

                                {!isSelf && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => social.toggleFollow(person.uid)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                                        isFollowing
                                          ? 'bg-white/[0.08] text-white'
                                          : 'bg-[#FE2C55] text-white'
                                      }`}
                                    >
                                      {isFollowing ? (
                                        <UserCheck className="w-3.5 h-3.5" />
                                      ) : (
                                        <UserPlus className="w-3.5 h-3.5" />
                                      )}
                                      <span>
                                        {isFollowing
                                          ? isAr
                                            ? 'تتابعه'
                                            : 'Following'
                                          : followsMe
                                          ? isAr
                                            ? 'رد المتابعة'
                                            : 'Follow back'
                                          : isAr
                                          ? 'متابعة'
                                          : 'Follow'}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openChatWith(person.uid)}
                                      className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-slate-200 cursor-pointer"
                                      title={isAr ? 'مراسلة' : 'Message'}
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* ============================================================== */}
            {/* SECTION 3: TIKTOK-STYLE FOLLOWERS / FOLLOWING / FRIENDS        */}
            {/* ============================================================== */}
            {topTab === 'followers' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6">
                <div className="max-w-3xl mx-auto space-y-5">
                  <div className="p-5 rounded-2xl bg-[#0D1018] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <CreatorAvatar
                      photoURL={identity.photoURL}
                      name={identity.displayName}
                      sizeClass="w-14 h-14"
                      online={social.wsConnected}
                    />
                    <div>
                      <h3 className="text-base font-black text-white">{identity.displayName}</h3>
                      <div className="text-xs text-slate-400 font-mono">@{identity.handle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-center">
                    <button
                      type="button"
                      onClick={() => setFollowersSubTab('following')}
                      className="cursor-pointer group"
                    >
                      <div className="text-lg font-black text-white font-mono tabular-nums group-hover:text-[#FE2C55]">
                        {social.followingIds.length}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isAr ? 'أتابعهم' : 'Following'}
                      </div>
                    </button>
                    <div className="h-6 w-px bg-white/10" />
                    <button
                      type="button"
                      onClick={() => setFollowersSubTab('followers')}
                      className="cursor-pointer group"
                    >
                      <div className="text-lg font-black text-white font-mono tabular-nums group-hover:text-[#FE2C55]">
                        {social.followerIds.length}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isAr ? 'المتابعون' : 'Followers'}
                      </div>
                    </button>
                    <div className="h-6 w-px bg-white/10" />
                    <div>
                      <div className="text-lg font-black text-white font-mono tabular-nums">
                        {totalMyVideoLikes}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isAr ? 'الإعجابات' : 'Likes'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 border-b border-white/[0.08]">
                  {(
                    [
                      {
                        id: 'following' as const,
                        ar: `أتابعهم ${social.followingIds.length}`,
                        en: `Following ${social.followingIds.length}`,
                      },
                      {
                        id: 'followers' as const,
                        ar: `المتابعون ${social.followerIds.length}`,
                        en: `Followers ${social.followerIds.length}`,
                      },
                      {
                        id: 'friends' as const,
                        ar: `الأصدقاء ${mutualFriendIds.length}`,
                        en: `Friends ${mutualFriendIds.length}`,
                      },
                    ] as const
                  ).map((t) => {
                    const active = followersSubTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFollowersSubTab(t.id)}
                        className={`relative pb-2.5 text-xs sm:text-sm font-black cursor-pointer transition-colors ${
                          active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{isAr ? t.ar : t.en}</span>
                        {active && (
                          <motion.span
                            layoutId="followersTabUnderline"
                            transition={PILL_SPRING}
                            className="absolute bottom-0 inset-x-0 h-0.5 bg-[#FE2C55] rounded-full"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0D1018] border border-white/[0.08]">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={followersFilterQuery}
                    onChange={(e) => setFollowersFilterQuery(e.target.value)}
                    placeholder={isAr ? 'ابحث في القائمة...' : 'Filter users...'}
                    className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                  />
                </div>

                {(() => {
                  const baseIds =
                    followersSubTab === 'followers'
                      ? social.followerIds
                      : followersSubTab === 'following'
                      ? social.followingIds
                      : mutualFriendIds;

                  const filteredIds = baseIds.filter((uid) => {
                    const q = followersFilterQuery.trim().toLowerCase();
                    if (!q) return true;
                    const c = creatorsById.get(uid);
                    return (
                      uid.toLowerCase().includes(q) ||
                      (c?.displayName || '').toLowerCase().includes(q) ||
                      (c?.handle || '').toLowerCase().includes(q)
                    );
                  });

                  const suggestedCreators = otherCreators.filter(
                    (c) => !social.followingIds.includes(c.uid)
                  );

                  return (
                    <div className="space-y-5">
                      {filteredIds.length === 0 ? (
                        <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 bg-[#0D1018]/60">
                          <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-300">
                            {followersSubTab === 'followers'
                              ? isAr
                                ? 'لا يوجد متابعون حتى الآن'
                                : 'No followers yet'
                              : followersSubTab === 'following'
                              ? isAr
                                ? 'لا تتابع أي حساب حتى الآن'
                                : 'Not following anyone yet'
                              : isAr
                              ? 'لا يوجد أصدقاء (متابعة متبادلة) بعد'
                              : 'No mutual friends yet'}
                          </p>
                        </div>
                      ) : (
                        <motion.div
                          key={`${followersSubTab}_${followersFilterQuery}`}
                          variants={staggerFastContainerVariants}
                          initial="hidden"
                          animate="visible"
                          className="divide-y divide-white/[0.06] rounded-2xl bg-[#0D1018] border border-white/[0.08] overflow-hidden"
                        >
                          {filteredIds.map((uid) => {
                            const c = creatorsById.get(uid);
                            const name = c?.displayName || uid;
                            const isFollowing = social.followingIds.includes(uid);
                            const followsMe = social.followerIds.includes(uid);
                            const isMutual = isFollowing && followsMe;

                            return (
                              <motion.div
                                variants={staggerItemVariants}
                                key={uid}
                                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03]"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <CreatorAvatar
                                    photoURL={c?.photoURL}
                                    name={name}
                                    sizeClass="w-12 h-12"
                                    online={c?.online}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-sm font-black text-white truncate">
                                      {name}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate">
                                      @{c?.handle || uid.slice(-6)}
                                      {isMutual
                                        ? isAr
                                          ? ' · أصدقاء'
                                          : ' · Friends'
                                        : followsMe
                                        ? isAr
                                          ? ' · يتابعك'
                                          : ' · Follows you'
                                        : ''}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={PILL_SPRING}
                                    type="button"
                                    onClick={() => social.toggleFollow(uid)}
                                    className={`min-w-[96px] px-3.5 py-2 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                                      isFollowing
                                        ? 'bg-white/[0.1] text-white hover:bg-rose-500/20'
                                        : 'bg-[#FE2C55] hover:bg-[#e7244b] text-white'
                                    }`}
                                  >
                                    {isMutual
                                      ? isAr
                                        ? 'أصدقاء'
                                        : 'Friends'
                                      : isFollowing
                                      ? isAr
                                        ? 'تتابعه'
                                        : 'Following'
                                      : followsMe
                                      ? isAr
                                        ? 'رد المتابعة'
                                        : 'Follow back'
                                      : isAr
                                      ? 'متابعة'
                                      : 'Follow'}
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.9 }}
                                    transition={PILL_SPRING}
                                    type="button"
                                    onClick={() => openChatWith(uid)}
                                    className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 cursor-pointer"
                                    title={isAr ? 'رسالة' : 'Message'}
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </motion.button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      )}

                      {suggestedCreators.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-black text-slate-300">
                            {isAr ? 'حسابات مقترحة للمتابعة' : 'Suggested Accounts'}
                          </h4>
                          <motion.div
                            variants={staggerFastContainerVariants}
                            initial="hidden"
                            animate="visible"
                            className="divide-y divide-white/[0.06] rounded-2xl bg-[#0D1018] border border-white/[0.08] overflow-hidden"
                          >
                            {suggestedCreators.slice(0, 6).map((c) => {
                              const followsMe = social.followerIds.includes(c.uid);
                              return (
                                <motion.div
                                  variants={staggerItemVariants}
                                  key={c.uid}
                                  className="px-4 py-3 flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <CreatorAvatar
                                      photoURL={c.photoURL}
                                      name={c.displayName}
                                      sizeClass="w-11 h-11"
                                      online={c.online}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-white truncate">
                                        {c.displayName}
                                      </div>
                                      <div className="text-xs text-slate-400 truncate">
                                        @{c.handle} · {c.role}
                                      </div>
                                    </div>
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.94 }}
                                    transition={PILL_SPRING}
                                    type="button"
                                    onClick={() => social.toggleFollow(c.uid)}
                                    className="px-4 py-2 rounded-lg bg-[#FE2C55] hover:bg-[#e7244b] text-white text-xs font-black cursor-pointer shrink-0"
                                  >
                                    {followsMe
                                      ? isAr
                                        ? 'رد المتابعة'
                                        : 'Follow back'
                                      : isAr
                                      ? 'متابعة'
                                      : 'Follow'}
                                  </motion.button>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                </div>
              </div>
            )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
