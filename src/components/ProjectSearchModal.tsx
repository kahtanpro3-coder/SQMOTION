import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Eye,
  Play,
  Copy,
  Trash2,
  Star,
  SlidersHorizontal,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import type {
  Language,
  LayerType,
  Project,
  ProjectSearchFilters,
  ProjectSearchResult,
  SearchEntityType,
} from '../types';
import { ProjectSearchIndex } from '../engine/projectSearchIndex';

interface ProjectSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  project: Project;
  onSelectLayer: (layerId: string) => void;
  onJumpToFrame: (frame: number, layerId?: string) => void;
  onOpenInspectorForLayer: (layerId: string, tab?: 'properties' | 'effects' | 'graph') => void;
  onUnhideLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onFavoriteEffect: (effectType: string, name: string) => void;
}

const DEFAULT_FILTERS: ProjectSearchFilters = {
  entityTypes: [],
  layerTypes: [],
  visibility: 'all',
  lockState: 'all',
  onlyMissing: false,
};

export const ProjectSearchModal: React.FC<ProjectSearchModalProps> = ({
  isOpen,
  onClose,
  lang,
  project,
  onSelectLayer,
  onJumpToFrame,
  onOpenInspectorForLayer,
  onUnhideLayer,
  onRenameLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onFavoriteEffect,
}) => {
  const isAr = lang === 'ar';
  const indexRef = useMemo(() => new ProjectSearchIndex(), []);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ProjectSearchFilters>(DEFAULT_FILTERS);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const suggestions = useMemo(() => indexRef.getSuggestions(project), [indexRef, project]);
  const results = useMemo(() => indexRef.search(project, query, filters), [indexRef, project, query, filters]);

  const groups = useMemo(() => project.layers.filter((l) => l.type === 'group'), [project.layers]);

  if (!isOpen) return null;

  const toggleEntityType = (et: SearchEntityType) => {
    setFilters((prev) => ({
      ...prev,
      entityTypes: prev.entityTypes.includes(et)
        ? prev.entityTypes.filter((x) => x !== et)
        : [...prev.entityTypes, et],
    }));
  };

  const toggleLayerType = (lt: LayerType) => {
    setFilters((prev) => ({
      ...prev,
      layerTypes: prev.layerTypes.includes(lt)
        ? prev.layerTypes.filter((x) => x !== lt)
        : [...prev.layerTypes, lt],
    }));
  };

  const handlePrimaryPick = (res: ProjectSearchResult) => {
    if (res.frame !== undefined) {
      onJumpToFrame(res.frame, res.layerId);
    } else if (res.layerId) {
      onSelectLayer(res.layerId);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-6 sm:pt-12 p-2 sm:p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-[#18181c]">
          <Search className="w-5 h-5 text-rose-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAr
                ? 'ابحث عن الطبقات، المؤثرات، النصوص، الخطوط، الإطارات المفتاحية، الملفات المفقودة...'
                : 'Search layers, effects, text content, fonts, keyframes, masks, missing files...'
            }
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1"
            >
              {isAr ? 'مسح' : 'Clear'}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Strip */}
        <div className="px-4 py-2.5 border-b border-zinc-800 bg-[#141417] space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {([
              ['layer', isAr ? 'طبقات' : 'Layers'],
              ['group', isAr ? 'مجموعات' : 'Groups'],
              ['effect', isAr ? 'تأثيرات' : 'Effects'],
              ['text', isAr ? 'نصوص' : 'Text'],
              ['font', isAr ? 'خطوط' : 'Fonts'],
              ['keyframe', isAr ? 'مفاتيح حركة' : 'Keyframes'],
              ['mask', isAr ? 'أقنعة' : 'Masks'],
              ['audio', isAr ? 'صوت' : 'Audio'],
              ['missing', isAr ? 'ملفات مفقودة' : 'Missing'],
            ] as Array<[SearchEntityType, string]>).map(([et, label]) => (
              <button
                key={et}
                onClick={() => toggleEntityType(et)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                  filters.entityTypes.includes(et)
                    ? 'bg-rose-500 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <select
              value={filters.visibility || 'all'}
              onChange={(e) =>
                setFilters((f) => ({ ...f, visibility: e.target.value as ProjectSearchFilters['visibility'] }))
              }
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              <option value="all">{isAr ? 'الظهور: الكل' : 'Visibility: All'}</option>
              <option value="visible">{isAr ? 'الظاهرة فقط' : 'Visible Only'}</option>
              <option value="hidden">{isAr ? 'المخفية فقط' : 'Hidden Only'}</option>
            </select>

            <select
              value={filters.lockState || 'all'}
              onChange={(e) =>
                setFilters((f) => ({ ...f, lockState: e.target.value as ProjectSearchFilters['lockState'] }))
              }
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              <option value="all">{isAr ? 'القفل: الكل' : 'Lock: All'}</option>
              <option value="locked">{isAr ? 'المقفولة' : 'Locked'}</option>
              <option value="unlocked">{isAr ? 'غير المقفولة' : 'Unlocked'}</option>
            </select>

            {groups.length > 0 && (
              <select
                value={filters.groupId || ''}
                onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value || undefined }))}
                className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
              >
                <option value="">{isAr ? 'كل المجموعات' : 'All Groups'}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1 text-zinc-400">
              <span>{isAr ? 'إطار:' : 'Frames:'}</span>
              <input
                type="number"
                placeholder="0"
                value={filters.frameRangeStart ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    frameRangeStart: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                className="w-14 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono"
              />
              <span>–</span>
              <input
                type="number"
                placeholder={String(project.settings.durationFrames)}
                value={filters.frameRangeEnd ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    frameRangeEnd: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                className="w-14 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono"
              />
            </div>

            {(['text', 'image', 'video', 'vector', 'model3d'] as LayerType[]).map((lt) => (
              <button
                key={lt}
                onClick={() => toggleLayerType(lt)}
                className={`px-2 py-0.5 rounded border ${
                  filters.layerTypes.includes(lt)
                    ? 'bg-zinc-700 border-zinc-500 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}
              >
                {lt}
              </button>
            ))}

            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="ms-auto text-rose-400 hover:underline"
            >
              {isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
            </button>
          </div>

          {!query && suggestions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-zinc-500">
              <span className="shrink-0">{isAr ? 'اقتراحات:' : 'Suggestions:'}</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 whitespace-nowrap shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-[11px] text-zinc-500 font-mono tabular-nums pb-1">
            {results.length} {isAr ? 'نتيجة مطابقة' : 'matching items'}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-500">
              {isAr
                ? 'لا توجد نتائج مطابقة للبحث والفلاتر الحالية.'
                : 'No items matched your search query and filters.'}
            </div>
          ) : (
            results.map((res) => (
              <div
                key={res.id}
                className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handlePrimaryPick(res)}>
                  <div className="flex items-center gap-2">
                    {res.isMissingAsset && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {renamingLayerId === res.layerId && res.entityType === 'layer' ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            if (res.layerId) onRenameLayer(res.layerId, renameText);
                            setRenamingLayerId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-rose-500 text-white text-[11px]"
                        >
                          {isAr ? 'حفظ' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-100 truncate">{res.title}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">{res.subtitle}</div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {res.frame !== undefined && (
                    <button
                      onClick={() => {
                        onJumpToFrame(res.frame!, res.layerId);
                        onClose();
                      }}
                      title={isAr ? 'انتقال للإطار' : 'Jump to Frame'}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500 text-zinc-200 hover:text-white text-[11px] flex items-center gap-1 whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      <span className="font-mono">F{res.frame}</span>
                    </button>
                  )}

                  {res.layerId && (
                    <>
                      <button
                        onClick={() => {
                          onOpenInspectorForLayer(
                            res.layerId!,
                            res.entityType === 'effect' ? 'effects' : 'properties'
                          );
                          onClose();
                        }}
                        title={isAr ? 'فتح الخصائص' : 'Open Inspector'}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {res.isHidden && (
                        <button
                          onClick={() => onUnhideLayer(res.layerId!)}
                          title={isAr ? 'إظهار الطبقة المخفية' : 'Reveal Hidden Layer'}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setRenamingLayerId(res.layerId!);
                          setRenameText(res.layerName || res.title);
                        }}
                        title={isAr ? 'إعادة تسمية' : 'Rename'}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDuplicateLayer(res.layerId!)}
                        title={isAr ? 'تكرار' : 'Duplicate'}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {confirmDeleteId === res.layerId ? (
                        <button
                          onClick={() => {
                            onDeleteLayer(res.layerId!);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-medium whitespace-nowrap"
                        >
                          {isAr ? 'تأكيد الحذف' : 'Confirm'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(res.layerId!)}
                          title={isAr ? 'حذف' : 'Delete'}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}

                  {res.entityType === 'effect' && (
                    <button
                      onClick={() => onFavoriteEffect(res.title, res.title)}
                      title={isAr ? 'إضافة للمفضلة' : 'Add to Favorites'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-amber-400"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
