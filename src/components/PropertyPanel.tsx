import React from 'react';
import { Project, Language, Layer } from '../types';
import { Layers } from 'lucide-react';
import { AlightSelectedInspector, SelectedSubView } from './AlightSelectedInspector';

interface PropertyPanelProps {
  project: Project;
  lang: Language;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onUpdateLayers?: (updatedLayers: Layer[]) => void;
  onAddKeyframe: (layerId: string, propertyPath: string) => void;
  onSetCurrentFrame?: (frame: number) => void;
  onOpenGraphEditor?: () => void;
  onDeleteLayer?: (layerId: string) => void;
  onSplitLayer?: (layerId: string, frame: number) => void;
  onTrimStart?: (layerId: string, frame: number) => void;
  onTrimEnd?: (layerId: string, frame: number) => void;
  onCloseInspector?: () => void;
  onAddLayer?: (type: Layer['type'], customConfig?: any) => void;
  onAddDualNull?: (targetLayerId?: string) => void;
  onSelectLayer?: (layerId: string | null) => void;
  onSubViewChange?: (subView: SelectedSubView) => void;
  requestedSubView?: { view: SelectedSubView; token: number } | null;
  onOpenCopyPasteProps?: () => void;
  onGroupAction?: (action: 'ungroup' | 'select_children' | 'duplicate_group' | 'delete_with_children') => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  project,
  lang,
  onUpdateLayer,
  onUpdateLayers,
  onAddKeyframe,
  onSetCurrentFrame,
  onOpenGraphEditor,
  onDeleteLayer,
  onSplitLayer,
  onTrimStart,
  onTrimEnd,
  onCloseInspector,
  onAddLayer,
  onSelectLayer,
  onSubViewChange,
  requestedSubView,
  onOpenCopyPasteProps,
  onGroupAction,
}) => {
  const selectedLayer = project.layers.find((l) => l.id === project.selectedLayerId);

  if (!selectedLayer) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-slate-500 text-xs select-none min-h-[140px]">
        <div className="w-10 h-10 rounded-xl bg-[#222326] border border-white/[0.06] text-[var(--app-accent-bright)] flex items-center justify-center mb-2">
          <Layers className="w-5 h-5" />
        </div>
        <p className="text-center font-medium text-slate-400">
          {lang === 'ar' ? 'حدد أي عنصر في المشهد لإظهار أدوات التعديل' : 'Select any layer to inspect motion & controls'}
        </p>
      </div>
    );
  }

  return (
    <AlightSelectedInspector
      project={project}
      lang={lang}
      onUpdateLayer={onUpdateLayer}
      onUpdateLayers={onUpdateLayers}
      onAddKeyframe={onAddKeyframe}
      onSetCurrentFrame={onSetCurrentFrame}
      onDeleteLayer={onDeleteLayer || (() => {})}
      onSplitLayer={onSplitLayer || (() => {})}
      onTrimStart={onTrimStart || (() => {})}
      onTrimEnd={onTrimEnd || (() => {})}
      onCloseInspector={onCloseInspector || (() => {})}
      onOpenGraphEditor={onOpenGraphEditor}
      onAddLayer={onAddLayer}
      onSelectLayer={onSelectLayer}
      onSubViewChange={onSubViewChange}
      requestedSubView={requestedSubView}
      onOpenCopyPasteProps={onOpenCopyPasteProps}
      onGroupAction={onGroupAction}
    />
  );
};
