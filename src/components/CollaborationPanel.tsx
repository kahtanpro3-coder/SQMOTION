import React, { useState } from 'react';
import {
  X,
  Users,
  Link2,
  Copy,
  Check,
  MessageSquare,
  Shield,
  Activity,
  LogOut,
  CheckCircle2,
  XCircle,
  Send,
  UserPlus,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  CollabComment,
  CollabMember,
  CollabPermissions,
  CollabRole,
  CollabSyncStatus,
  CollabWorkspaceState,
  Language,
  Layer,
  ProjectSettings,
} from '../types';

interface CollaborationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  projectLayers: Layer[];
  projectSettings: ProjectSettings;
  selectedLayer: Layer | null;
  currentFrame: number;
  localMemberId: string;
  localMemberName: string;
  workspace: CollabWorkspaceState | null;
  currentMember: CollabMember | null;
  syncStatus: CollabSyncStatus;
  errorMsg: string | null;
  pendingOpsCount: number;
  onCreateWorkspace: (params: {
    name: string;
    layers: Layer[];
    settings: ProjectSettings;
    memberName?: string;
  }) => Promise<CollabWorkspaceState>;
  onJoinWorkspace: (roomCode: string, customName?: string) => Promise<CollabWorkspaceState>;
  onLeaveWorkspace: () => void;
  onAddComment: (payload: {
    text: string;
    frame?: number;
    layerId?: string;
    layerName?: string;
    mentions?: string[];
  }) => void;
  onReplyToComment: (commentId: string, replyText: string, mentions?: string[]) => void;
  onSetCommentStatus: (commentId: string, status: CollabComment['status']) => void;
  onUpdateMemberRole: (targetMemberId: string, role: CollabRole, permissions?: CollabPermissions) => void;
  onRemoveMember: (targetMemberId: string) => void;
  onJumpToFrame: (frame: number, layerId?: string) => void;
}

const ROLE_LABELS: Record<CollabRole, { en: string; ar: string }> = {
  owner: { en: 'Owner', ar: 'مالك المشروع' },
  admin: { en: 'Admin', ar: 'مشرف' },
  editor: { en: 'Editor', ar: 'محرر' },
  reviewer: { en: 'Reviewer', ar: 'مراجع' },
  viewer: { en: 'Viewer', ar: 'مشاهد فقط' },
};

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  isOpen,
  onClose,
  lang,
  projectLayers,
  projectSettings,
  selectedLayer,
  currentFrame,
  localMemberId,
  localMemberName,
  workspace,
  currentMember,
  syncStatus,
  errorMsg,
  pendingOpsCount,
  onCreateWorkspace,
  onJoinWorkspace,
  onLeaveWorkspace,
  onAddComment,
  onReplyToComment,
  onSetCommentStatus,
  onUpdateMemberRole,
  onRemoveMember,
  onJumpToFrame,
}) => {
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<'team' | 'comments' | 'activity'>('comments');
  const [displayName, setDisplayName] = useState(localMemberName);
  const [workspaceName, setWorkspaceName] = useState(projectSettings.name || 'Shared Project');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [linkToFrame, setLinkToFrame] = useState(true);
  const [linkToLayer, setLinkToLayer] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@([^\s@]+)/g);
    return matches ? matches.map((m) => m.slice(1)) : [];
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreateWorkspace({
        name: workspaceName.trim() || projectSettings.name,
        layers: projectLayers,
        settings: projectSettings,
        memberName: displayName,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      await onJoinWorkspace(joinCode.trim(), displayName);
    } finally {
      setBusy(false);
    }
  };

  const copyInviteLink = () => {
    if (!workspace) return;
    const url = `${window.location.origin}${window.location.pathname}?collab=${workspace.roomCode}`;
    navigator.clipboard?.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment({
      text: commentText.trim(),
      frame: linkToFrame ? currentFrame : undefined,
      layerId: linkToLayer && selectedLayer ? selectedLayer.id : undefined,
      layerName: linkToLayer && selectedLayer ? selectedLayer.name : undefined,
      mentions: extractMentions(commentText),
    });
    setCommentText('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800 bg-[#18181c]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold truncate">
                {workspace
                  ? workspace.name
                  : isAr ? 'التحرير التعاوني المباشر' : 'Real-Time Collaborative Workspace'}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                {syncStatus === 'synced' || syncStatus === 'syncing' ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Wifi className="w-3 h-3" />
                    <span>{syncStatus === 'syncing' ? (isAr ? 'جاري المزامنة...' : 'Syncing...') : (isAr ? 'متصل ومتزامن' : 'Live Synced')}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <WifiOff className="w-3 h-3" />
                    <span>
                      {pendingOpsCount > 0
                        ? isAr ? `${pendingOpsCount} تعديل بانتظار الاتصال` : `${pendingOpsCount} queued offline`
                        : isAr ? 'غير متصل بغرفة تعاون' : 'Not connected'}
                    </span>
                  </span>
                )}
                {workspace && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{workspace.roomCode}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {workspace && (
              <>
                <button
                  onClick={copyInviteLink}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{copiedInvite ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ رابط الدعوة' : 'Copy Invite Link')}</span>
                </button>
                <button
                  onClick={onLeaveWorkspace}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مغادرة' : 'Leave'}</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="px-5 py-2 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {!workspace ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
              <label className="block text-xs font-medium text-zinc-300">
                {isAr ? 'اسمك الظاهر للفريق' : 'Your Display Name'}
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Create Shared Workspace */}
              <form
                onSubmit={handleCreate}
                className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-rose-400" />
                  <span>{isAr ? 'إنشاء مساحة عمل تعاونية' : 'Create Shared Workspace'}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  {isAr
                    ? 'شارك المشروع الحالي مع فريقك عبر رابط مباشر مع مزامنة فورية للطبقات والإطارات والتعليقات.'
                    : 'Share the current project with your team via invite code & real-time WebSocket sync.'}
                </p>
                <input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={isAr ? 'اسم مساحة العمل...' : 'Workspace name...'}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  {busy ? '...' : isAr ? 'إنشاء وبدء المشاركة' : 'Create & Start Syncing'}
                </button>
              </form>

              {/* Join Existing Workspace */}
              <form
                onSubmit={handleJoin}
                className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Copy className="w-4 h-4 text-sky-400" />
                  <span>{isAr ? 'الانضمام برمز الدعوة' : 'Join Existing Workspace'}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  {isAr
                    ? 'أدخل رمز الغرفة المكون من 6 أحرف للانضمام والمزامنة الفورية مع المشروع المشترك.'
                    : 'Enter the 6-character workspace invite code to sync with the shared session.'}
                </p>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={isAr ? 'مثال: AB12CD' : 'e.g. AB12CD'}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono uppercase tracking-widest"
                />
                <button
                  type="submit"
                  disabled={busy || joinCode.trim().length < 4}
                  className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  {busy ? '...' : isAr ? 'انضمام للمشروع' : 'Join Workspace'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {/* Connected Tabs */}
            <div className="flex items-center gap-1 px-5 py-2.5 border-b border-zinc-800 bg-[#141417]">
              <button
                onClick={() => setTab('comments')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                  tab === 'comments' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isAr ? `التعليقات والمراجعة (${workspace.comments.length})` : `Comments & Review (${workspace.comments.length})`}</span>
              </button>
              <button
                onClick={() => setTab('team')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                  tab === 'team' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isAr ? `الأعضاء والصلاحيات (${workspace.members.length})` : `Team & Roles (${workspace.members.length})`}</span>
              </button>
              <button
                onClick={() => setTab('activity')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                  tab === 'activity' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{isAr ? `سجل النشاط (${workspace.activity.length})` : `Activity Log (${workspace.activity.length})`}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'comments' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleSubmitComment}
                    className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5"
                  >
                    <textarea
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        isAr
                          ? 'اكتب تعليقاً أو ملاحظة مراجعة... استخدم @الاسم للإشارة لعضو'
                          : 'Write a review comment... use @Name to mention a teammate'
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-zinc-400">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkToFrame}
                            onChange={(e) => setLinkToFrame(e.target.checked)}
                            className="accent-rose-500"
                          />
                          <span className="font-mono">F{currentFrame}</span>
                        </label>
                        {selectedLayer && (
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkToLayer}
                              onChange={(e) => setLinkToLayer(e.target.checked)}
                              className="accent-rose-500"
                            />
                            <span className="truncate max-w-[140px]">{selectedLayer.name}</span>
                          </label>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!commentText.trim() || !currentMember?.permissions.canComment}
                        className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إرسال التعليق' : 'Post Comment'}</span>
                      </button>
                    </div>
                  </form>

                  {workspace.comments.length === 0 ? (
                    <div className="text-center py-10 text-xs text-zinc-500">
                      {isAr ? 'لا توجد تعليقات بعد.' : 'No comments yet. Pin feedback to any frame or layer.'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {workspace.comments.map((cmt) => (
                        <div
                          key={cmt.id}
                          className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: cmt.authorColor }}
                              >
                                {cmt.authorName.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate">{cmt.authorName}</div>
                                <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-mono">
                                  <span>{new Date(cmt.createdAt).toLocaleTimeString()}</span>
                                  {cmt.frame !== undefined && (
                                    <button
                                      onClick={() => {
                                        onJumpToFrame(cmt.frame!, cmt.layerId);
                                        onClose();
                                      }}
                                      className="text-rose-400 hover:underline"
                                    >
                                      @F{cmt.frame}
                                    </button>
                                  )}
                                  {cmt.layerName && <span>· {cmt.layerName}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                  cmt.status === 'approved'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : cmt.status === 'rejected'
                                      ? 'bg-red-500/15 text-red-400'
                                      : cmt.status === 'resolved'
                                        ? 'bg-zinc-800 text-zinc-400'
                                        : 'bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {cmt.status}
                              </span>

                              {currentMember?.permissions.canApproveChanges && (
                                <>
                                  <button
                                    onClick={() => onSetCommentStatus(cmt.id, 'approved')}
                                    title={isAr ? 'موافقة' : 'Approve'}
                                    className="p-1 text-zinc-400 hover:text-emerald-400"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => onSetCommentStatus(cmt.id, 'rejected')}
                                    title={isAr ? 'رفض' : 'Reject'}
                                    className="p-1 text-zinc-400 hover:text-red-400"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {currentMember?.permissions.canResolveComments && cmt.status !== 'resolved' && (
                                <button
                                  onClick={() => onSetCommentStatus(cmt.id, 'resolved')}
                                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300"
                                >
                                  {isAr ? 'إغلاق' : 'Resolve'}
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-zinc-200 whitespace-pre-wrap">{cmt.text}</p>

                          {cmt.replies.length > 0 && (
                            <div className="ps-4 border-s border-zinc-800 space-y-1.5 pt-1">
                              {cmt.replies.map((rep) => (
                                <div key={rep.id} className="text-[11px] text-zinc-300">
                                  <span className="font-semibold text-white">{rep.authorName}: </span>
                                  <span>{rep.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {currentMember?.permissions.canComment && (
                            <div className="flex gap-1.5 pt-1">
                              <input
                                value={replyDrafts[cmt.id] || ''}
                                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [cmt.id]: e.target.value }))}
                                placeholder={isAr ? 'رد سريع...' : 'Write a reply...'}
                                className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px]"
                              />
                              <button
                                onClick={() => {
                                  const txt = (replyDrafts[cmt.id] || '').trim();
                                  if (!txt) return;
                                  onReplyToComment(cmt.id, txt, extractMentions(txt));
                                  setReplyDrafts((prev) => ({ ...prev, [cmt.id]: '' }));
                                }}
                                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px]"
                              >
                                {isAr ? 'رد' : 'Reply'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'team' && (
                <div className="space-y-2.5">
                  {workspace.members.map((m) => {
                    const isSelf = m.id === localMemberId;
                    const canManage = currentMember?.permissions.canManageTeam && m.id !== workspace.ownerId;
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: m.avatarColor }}
                            >
                              {m.name.slice(0, 1).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#141417] ${
                                m.online ? 'bg-emerald-400' : 'bg-zinc-600'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">
                              {m.name} {isSelf ? (isAr ? '(أنت)' : '(You)') : ''}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {m.online ? (isAr ? 'متصل الآن' : 'Online') : (isAr ? 'غير متصل' : 'Offline')}
                              {m.online && m.currentFrame !== undefined ? ` · F${m.currentFrame}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canManage ? (
                            <select
                              value={m.role}
                              onChange={(e) => onUpdateMemberRole(m.id, e.target.value as CollabRole)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                            >
                              {(['admin', 'editor', 'reviewer', 'viewer'] as CollabRole[]).map((r) => (
                                <option key={r} value={r}>
                                  {isAr ? ROLE_LABELS[r].ar : ROLE_LABELS[r].en}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-zinc-300 font-medium">
                              {isAr ? ROLE_LABELS[m.role].ar : ROLE_LABELS[m.role].en}
                            </span>
                          )}

                          {canManage && (
                            <button
                              onClick={() => onRemoveMember(m.id)}
                              className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white text-xs"
                            >
                              {isAr ? 'إزالة' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'activity' && (
                <div className="space-y-1.5">
                  {workspace.activity.length === 0 ? (
                    <div className="text-center py-10 text-xs text-zinc-500">
                      {isAr ? 'لا يوجد نشاط مسجل بعد.' : 'No workspace activity recorded yet.'}
                    </div>
                  ) : (
                    [...workspace.activity].reverse().map((act) => (
                      <div
                        key={act.id}
                        className="px-3.5 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: act.actorColor }}
                          />
                          <div className="min-w-0 truncate">
                            <span className="font-semibold text-white">{act.actorName} </span>
                            <span className="text-zinc-300">{act.detail}</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono tabular-nums shrink-0">
                          {new Date(act.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
