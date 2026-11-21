import React from 'react';
import { Layer, Language, Mesh3DConfig, Mesh3DMaterial } from '../types';
import { Type, Sparkles, Sliders, Sun, Shield, Layers, Box } from 'lucide-react';
import { PrecisionRulerScrubber } from './PrecisionRulerScrubber';

interface Text3DInspectorProps {
  layer: Layer;
  lang: Language;
  onUpdateLayer: (updatedLayer: Layer) => void;
}

export const Text3DInspector: React.FC<Text3DInspectorProps> = ({
  layer,
  lang,
  onUpdateLayer,
}) => {
  const meshConfig: Mesh3DConfig = layer.mesh3dConfig || {
    enabled: true,
    type: 'extrusion',
    depth: 45,
    bevel: 5,
    material: 'gold',
    roughness: 0.2,
    metalness: 0.85,
    specular: 1.4,
    lightAngle: 45,
    lightElevation: 35,
    ambientIntensity: 0.45,
    diffuseIntensity: 0.8,
    castFloorShadow: true,
  };

  const updateMeshProp = (key: keyof Mesh3DConfig, val: any) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    copy.is3D = true;
    copy.fixedIn3D = false;
    if (!copy.mesh3dConfig) {
      copy.mesh3dConfig = { enabled: true, type: 'extrusion', depth: 45, bevel: 5, material: 'gold' };
    }
    (copy.mesh3dConfig as any)[key] = val;
    onUpdateLayer(copy);
  };

  const updateTextProp = (key: string, val: any) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    if (!copy.textConfig) {
      copy.textConfig = {
        text: 'نص ثلاثي الأبعاد',
        fontSize: 54,
        fontFamily: 'Cairo',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 0,
        letterSpacing: 0,
        lineHeight: 1.2,
        align: 'center',
      };
    }
    (copy.textConfig as any)[key] = val;
    onUpdateLayer(copy);
  };

  const materialsList: { id: Mesh3DMaterial; labelAr: string; labelEn: string; icon: string; previewColor: string }[] = [
    { id: 'gold', labelAr: 'ذهب عيار 24', labelEn: '24K Gold', icon: '👑', previewColor: '#F59E0B' },
    { id: 'chrome', labelAr: 'كروم مصقول', labelEn: 'Chrome', icon: '💎', previewColor: '#38BDF8' },
    { id: 'neon', labelAr: 'نيون أزرق كهربائي', labelEn: 'Neon Glow', icon: '⚡', previewColor: '#00E5FF' },
    { id: 'glass', labelAr: 'زجاج كريستالي', labelEn: 'Crystal Glass', icon: '🔮', previewColor: '#C084FC' },
    { id: 'dark', labelAr: 'تيتانيوم أسود', labelEn: 'Dark Titanium', icon: '🖤', previewColor: '#475569' },
    { id: 'white', labelAr: 'أبيض لؤلؤي', labelEn: 'Glossy White', icon: '⚪', previewColor: '#FFFFFF' },
  ];

  return (
    <div className="bg-[#0A0D14] border border-[#1F2837] rounded-2xl p-3 space-y-3 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A2232] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Type className="w-4 h-4 font-black" />
          </div>
          <div>
            <span className="text-xs font-black text-white block">
              {lang === 'ar' ? 'تحكم في النص ثلاثي الأبعاد (3D Text)' : '3D Text Controls'}
            </span>
            <span className="text-[10px] text-slate-400">
              {lang === 'ar' ? 'عمق حقيقي وتأثر بالإضاءة والظلال' : 'True depth, bevel chamfer & lighting'}
            </span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          3D EXTRUDE
        </span>
      </div>

      {/* Text String Editor */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-slate-300 block">
          {lang === 'ar' ? 'محتوى النص:' : 'Text Content:'}
        </span>
        <input
          type="text"
          value={layer.textConfig?.text || ''}
          onChange={(e) => updateTextProp('text', e.target.value)}
          placeholder={lang === 'ar' ? 'اكتب نصك ثلاثي الأبعاد هنا...' : 'Enter your 3D text...'}
          className="w-full bg-[#121622] border border-[#1F2837] px-3 py-2 rounded-xl text-xs text-white font-bold focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* Material Selector Grid */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-amber-400 block">
          {lang === 'ar' ? 'خامة ولمعان المعدن 3D:' : '3D Material & Surface:'}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {materialsList.map((m) => (
            <button
              key={m.id}
              onClick={() => updateMeshProp('material', m.id)}
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                meshConfig.material === m.id
                  ? 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-[#121622] border-[#1F2837] hover:border-slate-600'
              }`}
            >
              <span className="text-base">{m.icon}</span>
              <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                {lang === 'ar' ? m.labelAr : m.labelEn}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sliders: Depth & Bevel */}
      <div className="bg-[#121622] p-2.5 rounded-xl border border-[#1F2837] space-y-2.5">
        {/* Extrusion Depth */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-300 font-bold">{lang === 'ar' ? 'عمق التجسيم (Extrusion Depth)' : 'Extrusion Depth'}</span>
            <span className="font-mono text-amber-400 font-bold">{(meshConfig.depth ?? 45).toFixed(0)}px</span>
          </div>
          <PrecisionRulerScrubber
            value={meshConfig.depth ?? 45}
            min={5}
            max={180}
            step={1}
            decimals={0}
            unit="px"
            defaultValue={45}
            accentColor="#FBBF24"
            ariaLabel="Extrusion Depth"
            onChange={(val) => updateMeshProp('depth', val)}
          />
        </div>

        {/* Bevel Radius */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-300 font-bold">{lang === 'ar' ? 'حواف وشطف الحروف (Bevel Chamfer)' : 'Bevel Chamfer'}</span>
            <span className="font-mono text-cyan-400 font-bold">{(meshConfig.bevel ?? 5).toFixed(1)}px</span>
          </div>
          <PrecisionRulerScrubber
            value={meshConfig.bevel ?? 5}
            min={0}
            max={20}
            step={0.5}
            decimals={1}
            unit="px"
            defaultValue={5}
            accentColor="#38BDF8"
            ariaLabel="Bevel Chamfer"
            onChange={(val) => updateMeshProp('bevel', val)}
          />
        </div>
      </div>

      {/* Reactive 3D Lighting Controls */}
      <div className="bg-[#121622] p-2.5 rounded-xl border border-[#1F2837] space-y-2.5">
        <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
          <Sun className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'الإضاءة التفاعلية والظلال:' : 'Dynamic 3D Lighting:'}</span>
        </span>

        {/* Light Angle */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">{lang === 'ar' ? 'اتجاه زاوية مصدر الضوء' : 'Light Angle'}</span>
            <span className="font-mono text-white">{(meshConfig.lightAngle ?? 45).toFixed(0)}°</span>
          </div>
          <PrecisionRulerScrubber
            value={meshConfig.lightAngle ?? 45}
            min={0}
            max={360}
            step={1}
            decimals={0}
            unit="°"
            defaultValue={45}
            ariaLabel="Light Angle"
            onChange={(val) => updateMeshProp('lightAngle', val)}
          />
        </div>

        {/* Specular Shine */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">{lang === 'ar' ? 'شدة لمعان السطح (Specular)' : 'Specular Intensity'}</span>
            <span className="font-mono text-purple-400">{Math.round((meshConfig.specular ?? 1.4) * 100)}%</span>
          </div>
          <PrecisionRulerScrubber
            value={meshConfig.specular ?? 1.4}
            min={0.2}
            max={2.5}
            step={0.05}
            decimals={2}
            defaultValue={1.4}
            accentColor="#C084FC"
            ariaLabel="Specular Intensity"
            onChange={(val) => updateMeshProp('specular', val)}
          />
        </div>

        {/* Floor Shadow Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1F2837]">
          <span className="text-[10px] font-bold text-slate-300">
            {lang === 'ar' ? 'إسقاط ظل أرضي ثلاثي الأبعاد' : 'Cast Floor Shadow'}
          </span>
          <button
            onClick={() => updateMeshProp('castFloorShadow', !(meshConfig.castFloorShadow !== false))}
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
              meshConfig.castFloorShadow !== false
                ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border-[var(--app-accent-border)]'
                : 'bg-[#182030] text-slate-400 border-[#232C3E]'
            }`}
          >
            {meshConfig.castFloorShadow !== false ? 'مفعل ✓' : 'معطل'}
          </button>
        </div>
      </div>
    </div>
  );
};
