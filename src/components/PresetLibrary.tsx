import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Project, Language, Layer } from '../types';
import { MOTION_PRESETS } from '../engine/presets';
import { loadFavoritesState, toggleFavoriteItem, isItemFavorited } from '../engine/favoritesStore';
import { Sparkles, Play, Flame, Star } from 'lucide-react';
import {
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface PresetLibraryProps {
  project: Project;
  lang: Language;
  onUpdateLayer: (layer: Layer) => void;
}

export const PresetLibrary: React.FC<PresetLibraryProps> = ({ project, lang, onUpdateLayer }) => {
  const selectedLayer = project.layers.find((l) => l.id === project.selectedLayerId);
  const [favVersion, setFavVersion] = useState(0);

  useEffect(() => {
    const onFav = () => setFavVersion((v) => v + 1);
    window.addEventListener('sqmotion:favoritesChanged', onFav);
    return () => window.removeEventListener('sqmotion:favoritesChanged', onFav);
  }, []);

  const favState = React.useMemo(() => loadFavoritesState(), [favVersion]);

  const handleApplyPreset = (presetId: string) => {
    if (!selectedLayer) return;
    const preset = MOTION_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const updatedLayer = preset.apply(selectedLayer);
      onUpdateLayer(updatedLayer);
    }
  };

  return (
    <motion.div
      variants={staggerFastContainerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 bg-slate-900 text-slate-200 text-xs space-y-4 overflow-y-auto flex-1 min-h-0"
    >
      <motion.div variants={staggerItemVariants} className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {lang === 'ar' ? 'مكتبة الحركات الجاهزة (Motion Presets)' : 'Motion Presets Library'}
        </span>
      </motion.div>

      {!selectedLayer ? (
        <motion.p variants={staggerItemVariants} className="text-slate-500 italic text-center py-4">
          {lang === 'ar' ? 'حدد طبقة لتطبيق الحركة عليها بنقرة واحدة' : 'Select a layer to apply motion presets'}
        </motion.p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {MOTION_PRESETS.map((preset) => {
            const isFav = isItemFavorited(favState, 'preset', preset.id);
            return (
              <motion.div
                key={preset.id}
                variants={staggerItemVariants}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleApplyPreset(preset.id)}
                className="p-3 bg-slate-950 hover:bg-[var(--app-accent-surface)] border border-slate-800 hover:border-[var(--app-accent-border)] rounded-lg cursor-pointer transition-colors group flex items-start justify-between gap-2"
              >
                <div className="space-y-1 pr-2 min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200 group-hover:text-[var(--app-accent-light)]">
                    <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{lang === 'ar' ? preset.nameAr : preset.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{preset.description}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteItem(favState, {
                        type: 'preset',
                        refId: preset.id,
                        title: preset.name,
                        titleAr: preset.nameAr,
                        folderId: 'motion',
                        payload: { presetId: preset.id },
                      });
                      window.dispatchEvent(new CustomEvent('sqmotion:favoritesChanged'));
                    }}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      isFav ? 'text-amber-400 bg-amber-500/15' : 'text-slate-500 hover:text-amber-300 bg-white/5'
                    }`}
                    title={lang === 'ar' ? 'إضافة للمفضلة' : 'Toggle Favorite'}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 bg-[var(--app-accent-surface)] group-hover:bg-[var(--app-accent-solid)] text-[var(--app-accent-bright)] group-hover:text-[var(--app-accent-contrast)] rounded-md transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
