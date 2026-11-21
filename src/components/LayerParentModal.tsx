import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AMBIENT_BACKDROP_STYLE,
  PanelRimSheen,
  backdropVariants,
  sideDrawerLeftVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';
import { Layer, Language } from '../types';
import {
  Plus,
  Check,
  Image,
  Camera,
  Shapes,
  Box,
  Layers,
} from 'lucide-react';

interface LayerParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLayer: Layer;
  layers: Layer[];
  lang: Language;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onAddLayer?: (type: Layer['type'], customConfig?: any) => void;
  onSelectLayer?: (layerId: string | null) => void;
}

export const LayerParentModal: React.FC<LayerParentModalProps> = ({
  isOpen,
  onClose,
  selectedLayer,
  layers,
  lang,
  onUpdateLayer,
  onAddLayer,
}) => {
  // Compute descendant IDs to prevent cyclic parent loops
  const getDescendants = (layerId: string): Set<string> => {
    const res = new Set<string>();
    const queue = [layerId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      layers.forEach((l) => {
        if (l.parentId === cur && !res.has(l.id)) {
          res.add(l.id);
          queue.push(l.id);
        }
      });
    }
    return res;
  };

  const descendants = getDescendants(selectedLayer.id);
  const validParentLayers = layers.filter(
    (l) => l.id !== selectedLayer.id && !descendants.has(l.id)
  );

  const handleSelectParent = (parentId: string | undefined) => {
    const copy: Layer = JSON.parse(JSON.stringify(selectedLayer));
    copy.parentId = parentId;
    onUpdateLayer(copy);
  };

  const handleCreateNewNull = () => {
    if (onAddLayer) {
      onAddLayer('null', { parentForLayerId: selectedLayer.id });
    }
  };

  const renderLayerThumbnail = (layer: Layer) => {
    if (layer.type === 'null') {
      return (
        <div className="w-6 h-6 border border-slate-400/80 rounded-sm relative flex items-center justify-center bg-transparent shrink-0">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-px bg-slate-400/40 rotate-45" />
          </div>
        </div>
      );
    }

    if (layer.type === 'text') {
      return (
        <div className="w-6 h-6 border border-amber-400/40 rounded-sm flex items-center justify-center bg-amber-500/10 text-[10px] font-bold text-amber-300 shrink-0">
          T
        </div>
      );
    }

    if (layer.type === 'vector' || layer.type === 'solid') {
      return (
        <div
          className="w-6 h-6 rounded-sm border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0"
          style={{ backgroundColor: layer.color || 'rgba(6, 182, 212, 0.2)' }}
        >
          <Shapes className="w-3.5 h-3.5 opacity-80" />
        </div>
      );
    }

    if (layer.type === 'image') {
      return layer.mediaUrl ? (
        <img
          src={layer.mediaUrl}
          alt=""
          className="w-6 h-6 rounded-sm object-cover border border-white/20 shrink-0"
        />
      ) : (
        <div className="w-6 h-6 rounded-sm border border-emerald-400/40 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
          <Image className="w-3.5 h-3.5" />
        </div>
      );
    }

    if (layer.type === 'camera') {
      return (
        <div className="w-6 h-6 rounded-sm border border-sky-400/40 bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
          <Camera className="w-3.5 h-3.5" />
        </div>
      );
    }

    return (
      <div className="w-6 h-6 rounded-sm border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
        <Box className="w-3.5 h-3.5" />
      </div>
    );
  };

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dimmed backdrop with ambient blur */}
          <motion.div
            key="parent-drawer-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={AMBIENT_BACKDROP_STYLE}
            className="fixed inset-0 z-[70] backdrop-blur-sm opacity-75 gpu-layer"
            onClick={onClose}
          />

          {/* Side Drawer with 240Hz Spring & Top Light Sweep */}
          <motion.div
            key="parent-drawer-panel"
            variants={sideDrawerLeftVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              willChange: 'transform, opacity',
              transform: 'translate3d(0,0,0)',
              boxShadow: '8px 0 40px rgba(0,0,0,0.85), 0 0 24px rgba(var(--app-accent-rgb), 0.08)',
            }}
            className="fixed top-12 left-0 bottom-0 z-[80] w-64 sm:w-72 bg-[#111217]/[0.99] border-r border-white/15 flex flex-col text-slate-200 select-none overflow-hidden gpu-layer"
            onClick={(e) => e.stopPropagation()}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <PanelRimSheen roundedClass="rounded-none" />

            {/* Top Item: "لا شيء" (None) */}
            <button
              onClick={() => {
                handleSelectParent(undefined);
              }}
              className={`relative z-10 w-full h-12 px-4 flex items-center justify-between border-b border-white/[0.08] transition-colors cursor-pointer shrink-0 ${
                !selectedLayer.parentId
                  ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] font-bold'
                  : 'hover:bg-[#1B1D24] text-slate-200'
              }`}
            >
              <span className="text-sm font-medium">
                {lang === 'ar' ? 'لا شيء' : 'None'}
              </span>

              <div className="w-6 h-6 rounded-full border-2 border-slate-300/80 relative flex items-center justify-center shrink-0">
                <div className="w-full h-0.5 bg-slate-300/80 rotate-45 absolute" />
              </div>
            </button>

            {/* Scrollable Staggered List of Available Layers */}
            <motion.div
              variants={staggerFastContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin scrollbar-thumb-slate-700 relative z-10"
            >
              {validParentLayers.map((layer) => {
                const isCurrentParent = selectedLayer.parentId === layer.id;

                return (
                  <motion.button
                    key={layer.id}
                    variants={staggerItemVariants}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleSelectParent(isCurrentParent ? undefined : layer.id);
                    }}
                    className={`w-full min-h-[46px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isCurrentParent
                        ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] font-bold border-l-2 border-[var(--app-accent-bright)]'
                        : 'hover:bg-[#1B1D24] text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm truncate">
                        {layer.name}
                      </span>
                      {isCurrentParent && (
                        <Check className="w-3.5 h-3.5 text-[var(--app-accent-bright)] shrink-0" />
                      )}
                    </div>

                    <div className="shrink-0">
                      {renderLayerThumbnail(layer)}
                    </div>
                  </motion.button>
                );
              })}

              {validParentLayers.length === 0 && (
                <motion.div
                  variants={staggerItemVariants}
                  className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2"
                >
                  <Layers className="w-8 h-8 text-slate-600" />
                  <p>
                    {lang === 'ar'
                      ? 'لا توجد طبقات أخرى متاحة للربط'
                      : 'No candidate layers available'}
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* Bottom Bar with Quick "+ إنشاء نول جديد" Button */}
            {onAddLayer && (
              <div className="p-2.5 bg-[#0E0F14] border-t border-white/10 shrink-0 relative z-10">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCreateNewNull}
                  className="w-full py-2 px-3 rounded-lg bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[var(--app-accent-border)] text-[var(--app-accent-light)] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
                  <span>
                    {lang === 'ar' ? '+ إنشاء فارغ (Null) وربطه' : '+ Create & Link Null'}
                  </span>
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : drawerContent;
};
