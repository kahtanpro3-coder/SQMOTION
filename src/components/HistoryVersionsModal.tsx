import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Undo2,
  Redo2,
  History,
  BookmarkPlus,
  Pin,
  Trash2,
  RotateCcw,
  GitCompare,
  Layers,
  Sparkles,
  Check,
  HardDrive,
  Edit3,
} from 'lucide-react';
import type {
  FrameHistoryState,
  HistoryDiffEntry,
  Language,
  ProjectVersion,
  RecoveryTarget,
} from '../types';
import {
  compareProjectStates,
  getVersionStorageStats,
  rehydrateStateSync,
} from '../engine/historyEngine';

interface HistoryVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentState: FrameHistoryState;
  historyEntries: HistoryDiffEntry[];
  historyCursor: number;
  versions: ProjectVersion[];
  onUndo: () => void;
  onRedo: () => void;
  onJumpToHistoryCursor: (cursor: number) => void;
  onCreateVersion: (name: string, description: string, pinned: boolean) => Promise<void>;
  onTogglePinVersion: (versionId: string) => Promise<void>;
  onRenameVersion: (versionId: string, name: string) => Promise<void>;
  onDeleteVersion: (versionId: string) => Promise<void>;
  onRecoverFromVersion: (version: ProjectVersion, target: RecoveryTarget) => Promise<void>;
  autoVersionEnabled: boolean;
  onToggleAutoVersion: (enabled: boolean) => void;
  maxUnpinnedVersions: number;
  onChangeMaxUnpinnedVersions: (limit: number) => void;
}

export const HistoryVersionsModal: React.FC<HistoryVersionsModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentState,
  historyEntries,
  historyCursor,
  versions,
  onUndo,
  onRedo,
  onJumpToHistoryCursor,
  onCreateVersion,
  onTogglePinVersion,
  onRenameVersion,
  onDeleteVersion,
  onRecoverFromVersion,
  autoVersionEnabled,
  onToggleAutoVersion,
  maxUnpinnedVersions,
  onChangeMaxUnpinnedVersions,
}) => {
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<'timeline' | 'versions' | 'compare'>('timeline');
  const [newVerName, setNewVerName] = useState('');
  const [newVerDesc, setNewVerDesc] = useState('');
  const [newVerPinned, setNewVerPinned] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [compareOldId, setCompareOldId] = useState<string>('');
  const [compareNewId, setCompareNewId] = useState<string>('current');
  const [splitRatio, setSplitRatio] = useState(50);

  const [selectedRecoverVersionId, setSelectedRecoverVersionId] = useState<string>('');
  const [recoverStatusMsg, setRecoverStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (versions.length > 0 && !compareOldId) {
      setCompareOldId(versions[0].id);
    }
    if (versions.length > 0 && !selectedRecoverVersionId) {
      setSelectedRecoverVersionId(versions[0].id);
    }
  }, [versions, compareOldId, selectedRecoverVersionId]);

  const storageStats = useMemo(() => getVersionStorageStats(versions), [versions]);

  const oldCompareState = useMemo(() => {
    const v = versions.find((item) => item.id === compareOldId);
    if (!v) return null;
    return {
      label: v.name,
      state: rehydrateStateSync(v.dehydratedState),
    };
  }, [versions, compareOldId]);

  const newCompareState = useMemo(() => {
    if (compareNewId === 'current') {
      return {
        label: isAr ? 'المشروع الحالي' : 'Current Project',
        state: currentState,
      };
    }
    const v = versions.find((item) => item.id === compareNewId);
    if (!v) return null;
    return {
      label: v.name,
      state: rehydrateStateSync(v.dehydratedState),
    };
  }, [versions, compareNewId, currentState, isAr]);

  const diffSummary = useMemo(() => {
    if (!oldCompareState || !newCompareState) return null;
    return compareProjectStates(
      oldCompareState.state,
      newCompareState.state,
      oldCompareState.label,
      newCompareState.label
    );
  }, [oldCompareState, newCompareState]);

  const recoverSource = useMemo(() => {
    const v = versions.find((item) => item.id === selectedRecoverVersionId);
    if (!v) return null;
    return {
      version: v,
      state: rehydrateStateSync(v.dehydratedState),
    };
  }, [versions, selectedRecoverVersionId]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVersion(true);
    try {
      const title =
        newVerName.trim() ||
        (isAr ? `إصدار ${versions.length + 1}` : `Version ${versions.length + 1}`);
      await onCreateVersion(title, newVerDesc.trim(), newVerPinned);
      setNewVerName('');
      setNewVerDesc('');
      setNewVerPinned(false);
    } finally {
      setSavingVersion(false);
    }
  };

  const handleGranularRecover = async (version: ProjectVersion, target: RecoveryTarget, label: string) => {
    await onRecoverFromVersion(version, target);
    setRecoverStatusMsg(
      isAr
        ? `تمت استعادة ${label} بنجاح مع إنشاء نسخة احتياطية تلقائية`
        : `Recovered ${label} cleanly (safety backup created)`
    );
    setTimeout(() => setRecoverStatusMsg(null), 3500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-800 bg-[#18181c]">
          <div className="flex items-center gap-2.5 min-w-0">
            <History className="w-5 h-5 text-rose-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold truncate">
              {isAr ? 'سجل المشروع وإدارة الإصدارات' : 'Project History & Version Control'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onUndo}
              disabled={historyCursor < 0}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'تراجع' : 'Undo'}</span>
            </button>
            <button
              onClick={onRedo}
              disabled={historyCursor >= historyEntries.length - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'إعادة' : 'Redo'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b border-zinc-800 bg-[#141417] overflow-x-auto">
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800 shrink-0">
            <button
              onClick={() => setTab('timeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                tab === 'timeline' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isAr ? `الخط الزمني للتعديلات (${historyEntries.length})` : `Action History (${historyEntries.length})`}
            </button>
            <button
              onClick={() => setTab('versions')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                tab === 'versions' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isAr ? `الإصدارات والاستعادة (${versions.length})` : `Versions & Recovery (${versions.length})`}
            </button>
            <button
              onClick={() => setTab('compare')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                tab === 'compare' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isAr ? 'مقارنة الإصدارات' : 'Compare Versions'}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums shrink-0">
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>{formatBytes(storageStats.totalBytes)}</span>
            <span aria-hidden="true">·</span>
            <span>{storageStats.dedupedMediaCount} {isAr ? 'وسائط مفهرسة' : 'deduped assets'}</span>
          </div>
        </div>

        {recoverStatusMsg && (
          <div className="px-5 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{recoverStatusMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'timeline' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800/70">
                <span>
                  {isAr
                    ? 'انقر على أي خطوة للقفز الفوري إليها (يستخدم لقطات تفاضلية خفيفة)'
                    : 'Click any step to jump directly to that state (stored via incremental diffs)'}
                </span>
                <span className="font-mono tabular-nums">
                  {historyCursor + 1} / {historyEntries.length}
                </span>
              </div>

              <button
                onClick={() => onJumpToHistoryCursor(-1)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-start transition-colors ${
                  historyCursor === -1
                    ? 'bg-rose-500/15 border-rose-500/50 text-white'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-zinc-500 tabular-nums">#00</span>
                  <span className="text-xs font-medium truncate">
                    {isAr ? 'نقطة بداية الجلسة' : 'Session Base State'}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                  {historyCursor === -1 ? (isAr ? 'نشط الآن' : 'Active') : ''}
                </span>
              </button>

              {historyEntries.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">
                  {isAr
                    ? 'لم يتم تسجيل تعديلات بعد. كل تعديل على الطبقات أو التأثيرات أو الإطارات سيظهر هنا.'
                    : 'No edits recorded yet. Every layer, effect, keyframe, mask, or project change appears here.'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...historyEntries].reverse().map((entry, revIdx) => {
                    const realIdx = historyEntries.length - 1 - revIdx;
                    const isCurrent = realIdx === historyCursor;
                    const isFuture = realIdx > historyCursor;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => onJumpToHistoryCursor(realIdx)}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-start transition-colors ${
                          isCurrent
                            ? 'bg-rose-500/15 border-rose-500/60 text-white'
                            : isFuture
                              ? 'bg-zinc-900/30 border-zinc-800/60 text-zinc-500 hover:text-zinc-300'
                              : 'bg-zinc-900/70 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-zinc-500 tabular-nums shrink-0">
                            #{String(realIdx + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">
                              {isAr ? entry.labelAr : entry.labelEn}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                              <span>{entry.category}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{formatTime(entry.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                          {entry.layerPatches.length} {isAr ? 'تغيير' : 'patch'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'versions' && (
            <div className="space-y-5">
              {/* Create Manual Version + Auto-version Settings */}
              <form
                onSubmit={handleSaveVersion}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <BookmarkPlus className="w-4 h-4 text-rose-400" />
                    <span>{isAr ? 'إنشاء إصدار يدوي جديد' : 'Create Manual Version Snapshot'}</span>
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoVersionEnabled}
                        onChange={(e) => onToggleAutoVersion(e.target.checked)}
                        className="accent-rose-500 w-4 h-4"
                      />
                      <span>{isAr ? 'حفظ تلقائي دوري' : 'Auto-Versioning'}</span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span>{isAr ? 'الحد الأقصى:' : 'Max:'}</span>
                      <select
                        value={maxUnpinnedVersions}
                        onChange={(e) => onChangeMaxUnpinnedVersions(Number(e.target.value))}
                        className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    value={newVerName}
                    onChange={(e) => setNewVerName(e.target.value)}
                    placeholder={isAr ? 'اسم الإصدار (مثلاً: قبل دمج المؤثرات)' : 'Version name (e.g. Before color grade)'}
                    className="sm:col-span-4 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs focus:outline-none focus:border-rose-500"
                  />
                  <input
                    type="text"
                    value={newVerDesc}
                    onChange={(e) => setNewVerDesc(e.target.value)}
                    placeholder={isAr ? 'وصف اختياري للإصدار...' : 'Optional description...'}
                    className="sm:col-span-5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs focus:outline-none focus:border-rose-500"
                  />
                  <div className="sm:col-span-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewVerPinned((v) => !v)}
                      className={`px-3 py-2 min-h-[38px] rounded-lg border text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        newVerPinned
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تثبيت' : 'Pin'}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={savingVersion}
                      className="flex-1 px-4 py-2 min-h-[38px] rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      {savingVersion ? '...' : isAr ? 'حفظ الإصدار' : 'Save Version'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Version List + Granular Recovery */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 space-y-2">
                  <div className="text-xs font-medium text-zinc-400">
                    {isAr ? 'الإصدارات المحفوظة' : 'Saved Versions'}
                  </div>
                  {versions.length === 0 ? (
                    <div className="p-6 rounded-xl border border-zinc-800 text-center text-xs text-zinc-500">
                      {isAr ? 'لا توجد إصدارات محفوظة بعد.' : 'No saved versions yet.'}
                    </div>
                  ) : (
                    versions.map((ver) => (
                      <div
                        key={ver.id}
                        onClick={() => setSelectedRecoverVersionId(ver.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedRecoverVersionId === ver.id
                            ? 'bg-zinc-800/80 border-rose-500/60'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {editingVersionId === ver.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-xs w-full"
                                  autoFocus
                                />
                                <button
                                  onClick={async () => {
                                    await onRenameVersion(ver.id, editingName);
                                    setEditingVersionId(null);
                                  }}
                                  className="px-2.5 py-1 rounded bg-rose-500 text-white text-xs whitespace-nowrap"
                                >
                                  {isAr ? 'حفظ' : 'Save'}
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-zinc-100 truncate">
                                {ver.name}
                              </div>
                            )}
                            {ver.description && (
                              <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{ver.description}</p>
                            )}
                            <div className="text-[11px] text-zinc-500 mt-1 flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                              <span>{new Date(ver.createdAt).toLocaleString()}</span>
                              <span aria-hidden="true">·</span>
                              <span>{ver.layerCount} {isAr ? 'طبقات' : 'layers'}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatBytes(ver.byteSize)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{ver.isAuto ? (isAr ? 'تلقائي' : 'Auto') : (isAr ? 'يدوي' : 'Manual')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onTogglePinVersion(ver.id)}
                              title={isAr ? 'تثبيت الإصدار' : 'Pin version'}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg border ${
                                ver.pinned
                                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                                  : 'border-zinc-800 text-zinc-400 hover:text-white'
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingVersionId(ver.id);
                                setEditingName(ver.name);
                              }}
                              title={isAr ? 'إعادة تسمية' : 'Rename'}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleGranularRecover(ver, { scope: 'project' }, ver.name)}
                              title={isAr ? 'استعادة المشروع كاملاً' : 'Restore full project'}
                              className="px-2.5 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-[11px] font-medium flex items-center gap-1 whitespace-nowrap"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{isAr ? 'استعادة' : 'Restore'}</span>
                            </button>
                            {!ver.pinned && (
                              <button
                                onClick={() => onDeleteVersion(ver.id)}
                                title={isAr ? 'حذف الإصدار' : 'Delete version'}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Granular Layer / Effect / Property Recovery Inspector */}
                <div className="lg:col-span-5 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3 h-fit">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-rose-400" />
                      <span>{isAr ? 'استعادة جزئية متقدمة' : 'Granular Recovery'}</span>
                    </h4>
                  </div>

                  {!recoverSource ? (
                    <p className="text-xs text-zinc-500">
                      {isAr
                        ? 'اختر إصداراً من القائمة لاستعادة طبقة أو تأثير أو خصائص محددة منه.'
                        : 'Select a version from the list to recover a single layer, effect, or property group.'}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="text-[11px] text-zinc-400 pb-2 border-b border-zinc-800">
                        {isAr ? 'المصدر:' : 'Source:'}{' '}
                        <span className="text-zinc-200 font-medium">{recoverSource.version.name}</span>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {recoverSource.state.layers.map((layer) => (
                          <div key={layer.id} className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{layer.name}</div>
                                <div className="text-[10px] text-zinc-500 uppercase">{layer.type}</div>
                              </div>
                              <button
                                onClick={() =>
                                  handleGranularRecover(
                                    recoverSource.version,
                                    { scope: 'layer', layerId: layer.id },
                                    layer.name
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-rose-500 text-zinc-200 hover:text-white text-[11px] whitespace-nowrap shrink-0"
                              >
                                {isAr ? 'استعادة الطبقة' : 'Restore Layer'}
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() =>
                                  handleGranularRecover(
                                    recoverSource.version,
                                    { scope: 'properties', layerId: layer.id, paths: ['transform'] },
                                    `${layer.name} Transform`
                                  )
                                }
                                className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-[10px] text-zinc-300"
                              >
                                {isAr ? 'التحويل فقط' : 'Transform Only'}
                              </button>
                              {layer.mask && (
                                <button
                                  onClick={() =>
                                    handleGranularRecover(
                                      recoverSource.version,
                                      { scope: 'properties', layerId: layer.id, paths: ['mask'] },
                                      `${layer.name} Mask`
                                    )
                                  }
                                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-[10px] text-zinc-300"
                                >
                                  {isAr ? 'القناع فقط' : 'Mask Only'}
                                </button>
                              )}
                              {layer.effects.map((fx) => (
                                <button
                                  key={fx.id}
                                  onClick={() =>
                                    handleGranularRecover(
                                      recoverSource.version,
                                      { scope: 'effect', layerId: layer.id, effectId: fx.id },
                                      fx.name || fx.type
                                    )
                                  }
                                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-rose-500/60 text-[10px] text-zinc-300 flex items-center gap-1"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                                  <span>{fx.name || fx.type}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'compare' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isAr ? 'الإصدار الأقدم (المرجع)' : 'Base / Older Version'}
                  </label>
                  <select
                    value={compareOldId}
                    onChange={(e) => setCompareOldId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    {versions.length === 0 && <option value="">{isAr ? 'لا توجد إصدارات' : 'No saved versions'}</option>}
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({new Date(v.createdAt).toLocaleTimeString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isAr ? 'الإصدار الأحدث (المقارَن)' : 'Newer / Target Version'}
                  </label>
                  <select
                    value={compareNewId}
                    onChange={(e) => setCompareNewId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <option value="current">{isAr ? 'المشروع الحالي (الآن)' : 'Current Live Project'}</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({new Date(v.createdAt).toLocaleTimeString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!diffSummary || !oldCompareState || !newCompareState ? (
                <div className="p-8 rounded-xl border border-zinc-800 text-center text-xs text-zinc-500">
                  {isAr
                    ? 'قم بحفظ إصدار واحد على الأقل من تبويب الإصدارات لتتمكن من المقارنة جنباً إلى جنب.'
                    : 'Save at least one version snapshot to compare changes side-by-side.'}
                </div>
              ) : (
                <>
                  {/* Split View Slider */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <GitCompare className="w-4 h-4 text-rose-400" />
                        <span>{isAr ? 'معاينة الانقسام (Split View)' : 'Side-by-Side & Split View'}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400 font-mono tabular-nums">{splitRatio}%</span>
                        <input
                          type="range"
                          min={15}
                          max={85}
                          value={splitRatio}
                          onChange={(e) => setSplitRatio(Number(e.target.value))}
                          className="w-28 accent-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div
                        className="md:col-span-6 p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5"
                        style={{ opacity: Math.max(0.45, splitRatio / 100 + 0.25) }}
                      >
                        <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                          <span>{oldCompareState.label}</span>
                          <span className="font-mono text-[11px] text-zinc-500">
                            {oldCompareState.state.layers.length} {isAr ? 'طبقات' : 'layers'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {oldCompareState.state.settings.width}×{oldCompareState.state.settings.height} ·{' '}
                          {oldCompareState.state.settings.fps}fps · {oldCompareState.state.settings.durationFrames}f
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pt-1">
                          {oldCompareState.state.layers.map((l) => (
                            <div key={l.id} className="text-[11px] text-zinc-400 flex items-center justify-between">
                              <span className="truncate">{l.name}</span>
                              <span className="font-mono text-[10px] text-zinc-600">{l.effects.length}fx</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div
                        className="md:col-span-6 p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5"
                        style={{ opacity: Math.max(0.45, (100 - splitRatio) / 100 + 0.25) }}
                      >
                        <div className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                          <span>{newCompareState.label}</span>
                          <span className="font-mono text-[11px] text-zinc-500">
                            {newCompareState.state.layers.length} {isAr ? 'طبقات' : 'layers'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {newCompareState.state.settings.width}×{newCompareState.state.settings.height} ·{' '}
                          {newCompareState.state.settings.fps}fps · {newCompareState.state.settings.durationFrames}f
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pt-1">
                          {newCompareState.state.layers.map((l) => (
                            <div key={l.id} className="text-[11px] text-zinc-300 flex items-center justify-between">
                              <span className="truncate">{l.name}</span>
                              <span className="font-mono text-[10px] text-zinc-500">{l.effects.length}fx</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diff Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <div className="text-base font-bold font-mono tabular-nums text-emerald-400">
                        +{diffSummary.addedLayers}
                      </div>
                      <div className="text-[11px] text-zinc-400">{isAr ? 'طبقات مضافة' : 'Added Layers'}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="text-base font-bold font-mono tabular-nums text-red-400">
                        -{diffSummary.removedLayers}
                      </div>
                      <div className="text-[11px] text-zinc-400">{isAr ? 'طبقات محذوفة' : 'Removed Layers'}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="text-base font-bold font-mono tabular-nums text-amber-400">
                        {diffSummary.modifiedLayers}
                      </div>
                      <div className="text-[11px] text-zinc-400">{isAr ? 'طبقات معدّلة' : 'Modified'}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30">
                      <div className="text-base font-bold font-mono tabular-nums text-sky-400">
                        {diffSummary.settingsChanges.length}
                      </div>
                      <div className="text-[11px] text-zinc-400">{isAr ? 'تغييرات الإعدادات' : 'Settings Diffs'}</div>
                    </div>
                  </div>

                  {/* Detailed Layer & Settings Diffs */}
                  <div className="space-y-1.5">
                    {diffSummary.layerDiffs.length === 0 && diffSummary.settingsChanges.length === 0 ? (
                      <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-400">
                        {isAr ? 'الإصداران متطابقان تماماً.' : 'No differences detected between these two versions.'}
                      </div>
                    ) : (
                      <>
                        {diffSummary.settingsChanges.map((sc) => (
                          <div
                            key={sc.key}
                            className="px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs flex items-center justify-between"
                          >
                            <span className="font-medium text-sky-300">
                              {isAr ? 'إعداد المشروع:' : 'Setting:'} {sc.key}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-300">
                              {String(sc.before)} → {String(sc.after)}
                            </span>
                          </div>
                        ))}
                        {diffSummary.layerDiffs.map((ld) => (
                          <div
                            key={ld.layerId}
                            className="px-3.5 py-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-zinc-100 truncate">{ld.layerName}</div>
                              <div className="text-[11px] text-zinc-400">
                                {ld.changedPaths.join(' · ')}
                                {ld.keyframeChanges > 0 ? ` · ${ld.keyframeChanges} keyframes` : ''}
                                {ld.effectChanges > 0 ? ` · ${ld.effectChanges} effects` : ''}
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-medium whitespace-nowrap ${
                                ld.status === 'added'
                                  ? 'text-emerald-400'
                                  : ld.status === 'removed'
                                    ? 'text-red-400'
                                    : ld.status === 'modified'
                                      ? 'text-amber-400'
                                      : 'text-sky-400'
                              }`}
                            >
                              {ld.status}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
