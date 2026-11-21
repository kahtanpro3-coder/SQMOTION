import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Star,
  Pin,
  Search,
  LayoutGrid,
  List,
  FolderPlus,
  Download,
  Upload,
  Clock,
  TrendingUp,
  Zap,
  AlertCircle,
  Edit3,
  Trash2,
} from 'lucide-react';
import type { FavoriteItem, FavoritesState, Language, Layer } from '../types';
import {
  checkItemCompatibility,
  createFavoriteFolder,
  exportFavoritesJSON,
  importFavoritesJSON,
  moveFavoriteToFolder,
  renameFavoriteItem,
  reorderFavoriteItems,
  toggleFavoriteItem,
  togglePinFavorite,
} from '../engine/favoritesStore';

interface QuickAccessPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  favorites: FavoritesState;
  onUpdateFavorites: (next: FavoritesState) => void;
  selectedLayer: Layer | null;
  onApplyFavoriteItem: (item: FavoriteItem) => void;
  onOpenQuickTool: (tool: 'search' | 'history' | 'copy_props' | 'collab' | 'group_selected') => void;
}

export const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  isOpen,
  onClose,
  lang,
  favorites,
  onUpdateFavorites,
  selectedLayer,
  onApplyFavoriteItem,
  onOpenQuickTool,
}) => {
  const isAr = lang === 'ar';
  const [section, setSection] = useState<'favorites' | 'recent' | 'frequent' | 'tools'>('favorites');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [previewSize, setPreviewSize] = useState<number>(1); // 0=sm, 1=md, 2=lg
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const visibleItems = useMemo(() => {
    let base = [...favorites.items];

    if (section === 'recent') {
      const idxMap = new Map<string, number>(favorites.recentIds.map((id, i) => [id, i]));
      base = base
        .filter((i) => idxMap.has(i.id) || i.lastUsedAt)
        .sort((a, b) => (idxMap.get(a.id) ?? 999) - (idxMap.get(b.id) ?? 999));
    } else if (section === 'frequent') {
      base = base.filter((i) => i.useCount > 0).sort((a, b) => b.useCount - a.useCount);
    } else {
      if (selectedFolderId !== 'all') {
        base = base.filter((i) => i.folderId === selectedFolderId);
      }
      base.sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return a.order - b.order;
      });
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      base = base.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.titleAr.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q) ||
          (i.subtitle || '').toLowerCase().includes(q)
      );
    }
    return base;
  }, [favorites, section, selectedFolderId, query]);

  if (!isOpen) return null;

  const handleExport = () => {
    const json = exportFavoritesJSON(favorites);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sqmotion-favorites-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const res = importFavoritesJSON(favorites, raw);
    onUpdateFavorites(res.state);
    e.target.value = '';
  };

  const sizeClass =
    previewSize === 0 ? 'p-2 text-[11px]' : previewSize === 2 ? 'p-4 text-sm' : 'p-3 text-xs';

  return (
    <aside
      dir={isAr ? 'rtl' : 'ltr'}
      className={`fixed top-0 bottom-0 ${isAr ? 'left-0 border-r' : 'right-0 border-l'} z-40 w-full sm:w-[380px] bg-[#141417]/95 backdrop-blur-md border-zinc-800 shadow-2xl flex flex-col text-zinc-100`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800 bg-[#18181c]">
        <div className="flex items-center gap-2 min-w-0">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
          <h3 className="text-sm font-semibold truncate">
            {isAr ? 'المفضلة والوصول السريع' : 'Favorites & Quick Access'}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button
            onClick={() => importRef.current?.click()}
            title={isAr ? 'استيراد المفضلة' : 'Import Favorites'}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExport}
            title={isAr ? 'تصدير المفضلة' : 'Export Favorites'}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1.5 bg-zinc-900/70 border-b border-zinc-800 text-[11px]">
        <button
          onClick={() => setSection('favorites')}
          className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 whitespace-nowrap ${
            section === 'favorites' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Star className="w-3 h-3" />
          <span>{isAr ? 'المفضلة' : 'Favs'}</span>
        </button>
        <button
          onClick={() => setSection('recent')}
          className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 whitespace-nowrap ${
            section === 'recent' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>{isAr ? 'الأخيرة' : 'Recent'}</span>
        </button>
        <button
          onClick={() => setSection('frequent')}
          className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 whitespace-nowrap ${
            section === 'frequent' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          <span>{isAr ? 'الأكثر' : 'Top'}</span>
        </button>
        <button
          onClick={() => setSection('tools')}
          className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 whitespace-nowrap ${
            section === 'tools' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>{isAr ? 'الأدوات' : 'Tools'}</span>
        </button>
      </div>

      {section !== 'tools' && (
        <div className="px-3 py-2.5 border-b border-zinc-800 space-y-2">
          {/* Search + Layout controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute top-1/2 -translate-y-1/2 start-2.5" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? 'ابحث في المفضلة...' : 'Filter quick access...'}
                className="w-full ps-8 pe-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
            <button
              onClick={() => setViewLayout((v) => (v === 'grid' ? 'list' : 'grid'))}
              title={isAr ? 'تبديل العرض' : 'Toggle Grid/List'}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              {viewLayout === 'grid' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={2}
              value={previewSize}
              onChange={(e) => setPreviewSize(Number(e.target.value))}
              title={isAr ? 'حجم المعاينة' : 'Preview Size'}
              className="w-12 accent-rose-500"
            />
          </div>

          {/* Folder Chips */}
          {section === 'favorites' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {favorites.folders.map((fld) => (
                <button
                  key={fld.id}
                  onClick={() => setSelectedFolderId(fld.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                    selectedFolderId === fld.id
                      ? 'bg-zinc-800 text-white border border-zinc-600'
                      : 'bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {isAr ? fld.nameAr : fld.name}
                </button>
              ))}
              <button
                onClick={() => setShowNewFolder((v) => !v)}
                className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-[11px] flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
            </div>
          )}

          {showNewFolder && (
            <div className="flex gap-1.5">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={isAr ? 'اسم المجلد الجديد...' : 'New folder name...'}
                className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
              />
              <button
                onClick={() => {
                  onUpdateFavorites(createFavoriteFolder(favorites, newFolderName));
                  setNewFolderName('');
                  setShowNewFolder(false);
                }}
                className="px-3 py-1 rounded-lg bg-rose-500 text-white text-xs font-medium"
              >
                {isAr ? 'إنشاء' : 'Add'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {section === 'tools' ? (
          <div className="space-y-2">
            {[
              {
                key: 'search' as const,
                title: isAr ? 'البحث المتقدم في المشروع' : 'Advanced Project Search',
                desc: isAr ? 'ابحث عن الطبقات، المؤثرات، النصوص، الإطارات المفقودة' : 'Search layers, effects, text, keyframes & missing assets',
              },
              {
                key: 'copy_props' as const,
                title: isAr ? 'نسخ ولصق الخصائص والقوالب' : 'Copy & Paste Layer Properties',
                desc: isAr ? 'نقل التحويلات، المنحنيات، المؤثرات والأقنعة بين الطبقات' : 'Selective transfer & presets across compatible layers',
              },
              {
                key: 'group_selected' as const,
                title: isAr ? 'تجميع الطبقات النشطة' : 'Create Layer Group',
                desc: isAr ? 'إنشاء مجموعة هرمية للطبقة الحالية أو الطبقات المحددة' : 'Wrap selected layers in a transformable Group',
              },
              {
                key: 'history' as const,
                title: isAr ? 'سجل التعديلات والإصدارات' : 'History & Version Control',
                desc: isAr ? 'تراجع متعدد الخطوات، مقارنة الإصدارات والاستعادة الجزئية' : 'Multi-step Undo, Version Diffs & Granular Recovery',
              },
              {
                key: 'collab' as const,
                title: isAr ? 'التحرير التعاوني والمراجعة' : 'Collaborative Editing & Review',
                desc: isAr ? 'مشاركة مساحة العمل، تعليقات مرتبطة بالإطارات وصلاحيات الفريق' : 'Live sync, presence cursors, comments & permissions',
              },
            ].map((tool) => (
              <button
                key={tool.key}
                onClick={() => onOpenQuickTool(tool.key)}
                className="w-full p-3.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800 text-start transition-colors space-y-0.5"
              >
                <div className="text-xs font-semibold text-zinc-100">{tool.title}</div>
                <div className="text-[11px] text-zinc-400">{tool.desc}</div>
              </button>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-12 text-xs text-zinc-500">
            {isAr
              ? 'لا توجد عناصر مطابقة هنا. اضغط على أيقونة النجمة بجانب أي تأثير أو منحنى أو قالب لإضافته.'
              : 'No items match this filter. Star any effect, preset, easing curve, or template to add it here.'}
          </div>
        ) : (
          <div className={viewLayout === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
            {visibleItems.map((item) => {
              const compat = checkItemCompatibility(item, selectedLayer?.type);
              const canApply = compat.status === 'compatible';
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedId && draggedId !== item.id) {
                      onUpdateFavorites(reorderFavoriteItems(favorites, draggedId, item.id));
                    }
                    setDraggedId(null);
                  }}
                  className={`${sizeClass} rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-2 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      {editingId === item.id ? (
                        <div className="flex gap-1">
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-xs"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              onUpdateFavorites(renameFavoriteItem(favorites, item.id, editingTitle));
                              setEditingId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px]"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="font-semibold text-zinc-100 truncate">
                          {isAr ? item.titleAr : item.title}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-500 truncate">
                        {item.type} · {item.useCount}×
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => onUpdateFavorites(togglePinFavorite(favorites, item.id))}
                        className={`p-1 rounded ${item.pinned ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-200'}`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingTitle(isAr ? item.titleAr : item.title);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateFavorites(
                            toggleFavoriteItem(favorites, {
                              refId: item.refId,
                              type: item.type,
                              title: item.title,
                              titleAr: item.titleAr,
                              folderId: item.folderId,
                            })
                          )
                        }
                        className="p-1 rounded text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Folder selector + 1-click Apply */}
                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-800/70">
                    <select
                      value={item.folderId}
                      onChange={(e) => onUpdateFavorites(moveFavoriteToFolder(favorites, item.id, e.target.value))}
                      className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 max-w-[90px] truncate"
                    >
                      {favorites.folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {isAr ? f.nameAr : f.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => onApplyFavoriteItem(item)}
                      disabled={!canApply}
                      title={
                        compat.status === 'needs_layer'
                          ? isAr ? 'اختر طبقة أولاً' : 'Select a layer first'
                          : compat.status === 'incompatible'
                            ? isAr ? 'غير متوافق مع نوع الطبقة' : 'Incompatible with selected layer'
                            : isAr ? 'تطبيق فوري' : 'Apply'
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap flex items-center gap-1 ${
                        canApply
                          ? 'bg-rose-500 hover:bg-rose-600 text-white'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {!canApply && <AlertCircle className="w-3 h-3" />}
                      <span>{isAr ? 'تطبيق' : 'Apply'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
