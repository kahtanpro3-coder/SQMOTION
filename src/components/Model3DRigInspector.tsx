import React, { useState } from 'react';
import { Layer, Language, BoneControl, CreatureRigType, Model3DConfig } from '../types';
import {
  Bone,
  RotateCw,
  Sparkles,
  Zap,
  Sliders,
  Palette,
  Eye,
  Play,
  Pause,
  RefreshCw,
  User,
  Dog,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Box,
} from 'lucide-react';
import { autoRigLayerModel } from '../engine/model3dLoader';
import { PrecisionRulerScrubber } from './PrecisionRulerScrubber';
import { useAppTheme } from '../utils/appSettings';

interface Model3DRigInspectorProps {
  layer: Layer;
  lang: Language;
  onUpdateLayer: (updatedLayer: Layer) => void;
}

export const Model3DRigInspector: React.FC<Model3DRigInspectorProps> = ({
  layer,
  lang,
  onUpdateLayer,
}) => {
  const { palette } = useAppTheme();
  const [activeTab, setActiveTab] = useState<'limbs' | 'rigging' | 'materials' | 'animations'>('limbs');
  const [selectedCategory, setSelectedCategory] = useState<BoneControl['category']>('head');
  const [selectedBoneName, setSelectedBoneName] = useState<string>('');
  const [riggingType, setRiggingType] = useState<CreatureRigType>('biped');

  const modelConfig = layer.model3dConfig || {
    hasBones: false,
    bones: [],
    creatureType: 'none',
  };

  const bones = modelConfig.bones || [];
  const hasBones = modelConfig.hasBones || bones.length > 0;

  // Filter bones by selected category
  const categoryBones = bones.filter((b) => b.category === selectedCategory);
  const activeBone = bones.find((b) => b.name === selectedBoneName) || categoryBones[0] || bones[0];

  const updateBoneRotation = (boneName: string, axis: 'x' | 'y' | 'z', value: number) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    if (!copy.model3dConfig) {
      copy.model3dConfig = { hasBones: true, bones: [] };
    }
    if (!copy.model3dConfig.bones) {
      copy.model3dConfig.bones = [];
    }

    let b = copy.model3dConfig.bones.find((item) => item.name === boneName);
    if (!b) {
      b = {
        name: boneName,
        labelAr: boneName,
        labelEn: boneName,
        category: 'other',
        rotation: { x: 0, y: 0, z: 0 },
      };
      copy.model3dConfig.bones.push(b);
    }
    b.rotation[axis] = value;
    onUpdateLayer(copy);
  };

  const resetAllBones = () => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    if (copy.model3dConfig?.bones) {
      copy.model3dConfig.bones.forEach((b) => {
        b.rotation = { x: 0, y: 0, z: 0 };
      });
      onUpdateLayer(copy);
    }
  };

  // Preset poses for Humans & Animals
  const applyPosePreset = (presetName: string) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    if (!copy.model3dConfig?.bones) return;

    // Reset first
    copy.model3dConfig.bones.forEach((b) => {
      b.rotation = { x: 0, y: 0, z: 0 };
    });

    const setRot = (boneSubstr: string, rot: { x: number; y: number; z: number }) => {
      const target = copy.model3dConfig!.bones!.find((b) =>
        b.name.toLowerCase().includes(boneSubstr.toLowerCase())
      );
      if (target) {
        target.rotation = { ...rot };
      }
    };

    if (presetName === 't_pose') {
      // Natural T-pose
      setRot('arm_left', { x: 0, y: 0, z: 80 });
      setRot('arm_right', { x: 0, y: 0, z: -80 });
    } else if (presetName === 'walk') {
      setRot('leg_left', { x: 35, y: 0, z: 0 });
      setRot('leg_right', { x: -30, y: 0, z: 0 });
      setRot('arm_left', { x: -28, y: 0, z: 0 });
      setRot('arm_right', { x: 32, y: 0, z: 0 });
      setRot('head', { x: 5, y: 0, z: 0 });
    } else if (presetName === 'run') {
      setRot('leg_left', { x: 65, y: 0, z: 0 });
      setRot('leg_right', { x: -55, y: 0, z: 0 });
      setRot('arm_left', { x: -60, y: 0, z: 20 });
      setRot('arm_right', { x: 55, y: 0, z: -20 });
      setRot('spine', { x: 18, y: 0, z: 0 });
    } else if (presetName === 'wave') {
      setRot('arm_right_shoulder', { x: -30, y: 0, z: -110 });
      setRot('arm_right_elbow', { x: -45, y: 0, z: -35 });
      setRot('head', { x: -5, y: -15, z: 5 });
    } else if (presetName === 'sit_animal') {
      setRot('back_left_hip', { x: -50, y: 0, z: 0 });
      setRot('back_right_hip', { x: -50, y: 0, z: 0 });
      setRot('back_left_knee', { x: 70, y: 0, z: 0 });
      setRot('back_right_knee', { x: 70, y: 0, z: 0 });
      setRot('spine', { x: -25, y: 0, z: 0 });
      setRot('head', { x: 15, y: 0, z: 0 });
    } else if (presetName === 'pounce_animal') {
      setRot('front_left', { x: -35, y: 0, z: 0 });
      setRot('front_right', { x: -35, y: 0, z: 0 });
      setRot('back_left', { x: 45, y: 0, z: 0 });
      setRot('back_right', { x: 45, y: 0, z: 0 });
      setRot('tail', { x: 40, y: 0, z: 0 });
    }

    onUpdateLayer(copy);
  };

  const handleGenerateBones = (type: CreatureRigType) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    const rigged = autoRigLayerModel(layer.id, type);

    copy.model3dConfig = {
      ...copy.model3dConfig,
      hasBones: rigged.hasBones,
      autoRigged: rigged.hasBones,
      creatureType: type,
      bones: rigged.bones,
      animationClips: copy.model3dConfig?.animationClips || [],
      activeClipIndex: 0,
      animationSpeed: 1,
      format: copy.model3dConfig?.format || 'glb',
    };
    onUpdateLayer(copy);
    setActiveTab('limbs');
  };

  const updateMaterialProperty = (key: keyof Model3DConfig, value: any) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    if (!copy.model3dConfig) {
      copy.model3dConfig = {};
    }
    (copy.model3dConfig as any)[key] = value;
    onUpdateLayer(copy);
  };

  return (
    <div className="bg-[#0A0D14] border border-[#1F2837] rounded-2xl p-3 space-y-3 text-slate-200">
      {/* Top Header Badge & Model Status */}
      <div className="flex items-center justify-between border-b border-[#1A2232] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--app-accent-surface)] border border-[var(--app-accent-border)] flex items-center justify-center text-[var(--app-accent-bright)]">
            <Box className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white">
                {layer.model3dConfig?.fileName || layer.name || '3D Model'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)] uppercase">
                {layer.model3dConfig?.format || '3D'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {hasBones
                ? lang === 'ar'
                  ? `هيكل عظمي مفعّل (${bones.length} مفصل)`
                  : `Skeleton Active (${bones.length} joints)`
                : lang === 'ar'
                ? 'مجسم صلب بدون عظام'
                : 'Static Model (No Bones)'}
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-[#121622] p-1 rounded-xl border border-[#1F2738] text-[10px] font-bold">
          <button
            onClick={() => setActiveTab('limbs')}
            style={activeTab === 'limbs' ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeTab === 'limbs'
                ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {lang === 'ar' ? 'الأطراف' : 'Limbs'}
          </button>
          <button
            onClick={() => setActiveTab('rigging')}
            style={activeTab === 'rigging' ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeTab === 'rigging'
                ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {lang === 'ar' ? 'صنع عظام' : 'Auto-Rig'}
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            style={activeTab === 'materials' ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeTab === 'materials'
                ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {lang === 'ar' ? 'الخامات والضوء' : 'PBR Light'}
          </button>
          {modelConfig.animationClips && modelConfig.animationClips.length > 0 && (
            <button
              onClick={() => setActiveTab('animations')}
              style={activeTab === 'animations' ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'animations'
                  ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'ar' ? 'الحركات' : 'Motion'}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: LIMBS & BONES POSER */}
      {activeTab === 'limbs' && (
        <div className="space-y-3">
          {!hasBones ? (
            <div className="bg-[#121622] border border-amber-500/30 rounded-xl p-3 text-center space-y-2">
              <Bone className="w-8 h-8 text-amber-400 mx-auto opacity-80" />
              <div className="text-xs font-bold text-slate-200">
                {lang === 'ar'
                  ? 'المجسم الحالي لا يمتلك مفاصل أو عظام'
                  : 'This 3D model does not contain a skeleton'}
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                {lang === 'ar'
                  ? 'هل هذا المجسم كائن حي (إنسان أو حيوان)؟ استخدم نظام صنع العظام التلقائي لتحريك أطرافه فوراً!'
                  : 'Is this a creature (human or animal)? Generate procedural bones to animate its limbs!'}
              </p>
              <button
                onClick={() => setActiveTab('rigging')}
                className="px-4 py-1.5 rounded-lg bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-extrabold text-xs shadow-md active:scale-95 transition-all"
              >
                {lang === 'ar' ? '⚡ إنشاء هيكل عظمي ذكي الآن' : '⚡ Generate Skeleton Now'}
              </button>
            </div>
          ) : (
            <>
              {/* Category Filter Pills (Head, Arm L, Arm R, Spine, Leg L, Leg R, Tail) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                {[
                  { id: 'head', labelAr: '👤 الرأس والرقبة', labelEn: 'Head' },
                  { id: 'spine', labelAr: '🦴 العمود والقفص', labelEn: 'Spine' },
                  { id: 'arm_left', labelAr: '💪 الذراع الأيسر', labelEn: 'Left Arm' },
                  { id: 'arm_right', labelAr: '💪 الذراع الأيمن', labelEn: 'Right Arm' },
                  { id: 'leg_left', labelAr: '🦵 الساق اليسرى', labelEn: 'Left Leg' },
                  { id: 'leg_right', labelAr: '🦵 الساق اليمنى', labelEn: 'Right Leg' },
                  { id: 'tail', labelAr: '🐕 الذيل', labelEn: 'Tail' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id as BoneControl['category']);
                      const firstInCat = bones.find((b) => b.category === cat.id);
                      if (firstInCat) setSelectedBoneName(firstInCat.name);
                    }}
                    style={selectedCategory === cat.id ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap text-[11px] transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)]'
                        : 'bg-[#121622] text-slate-400 hover:text-slate-200 border border-[#1F2738]'
                    }`}
                  >
                    {lang === 'ar' ? cat.labelAr : cat.labelEn}
                  </button>
                ))}
              </div>

              {/* Sub-Bones in category */}
              {categoryBones.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {categoryBones.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => setSelectedBoneName(b.name)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        activeBone?.name === b.name
                          ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] border-[var(--app-accent-bright)]'
                          : 'bg-[#151C28] text-slate-300 border-[#232C3E]'
                      }`}
                    >
                      {lang === 'ar' ? b.labelAr : b.labelEn}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Bone Rotation Sliders (Pitch X, Yaw Y, Roll Z) */}
              {activeBone && (
                <div className="bg-[#121622] border border-[#1F2738] rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-[var(--app-accent-bright)] flex items-center gap-1.5">
                      <Bone className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? activeBone.labelAr : activeBone.labelEn}</span>
                    </span>
                    <button
                      onClick={() => {
                        updateBoneRotation(activeBone.name, 'x', 0);
                        updateBoneRotation(activeBone.name, 'y', 0);
                        updateBoneRotation(activeBone.name, 'z', 0);
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>{lang === 'ar' ? 'تصفير الزوايا' : 'Reset'}</span>
                    </button>
                  </div>

                  {/* Pitch X */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-rose-400 font-bold">X (ميلان أمامي / خلفي Pitch)</span>
                      <span className="font-mono text-slate-300 font-bold">{(activeBone.rotation?.x || 0).toFixed(1)}°</span>
                    </div>
                    <PrecisionRulerScrubber
                      value={activeBone.rotation?.x || 0}
                      min={-120}
                      max={120}
                      step={0.5}
                      decimals={1}
                      unit="°"
                      defaultValue={0}
                      accentColor="#FB7185"
                      ariaLabel="Bone Pitch X"
                      onChange={(val) => updateBoneRotation(activeBone.name, 'x', val)}
                    />
                  </div>

                  {/* Yaw Y */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-emerald-400 font-bold">Y (التواء جانبي Yaw)</span>
                      <span className="font-mono text-slate-300 font-bold">{(activeBone.rotation?.y || 0).toFixed(1)}°</span>
                    </div>
                    <PrecisionRulerScrubber
                      value={activeBone.rotation?.y || 0}
                      min={-120}
                      max={120}
                      step={0.5}
                      decimals={1}
                      unit="°"
                      defaultValue={0}
                      accentColor="#5EEB9A"
                      ariaLabel="Bone Yaw Y"
                      onChange={(val) => updateBoneRotation(activeBone.name, 'y', val)}
                    />
                  </div>

                  {/* Roll Z */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-sky-400 font-bold">Z (دوران محوري Roll)</span>
                      <span className="font-mono text-slate-300 font-bold">{(activeBone.rotation?.z || 0).toFixed(1)}°</span>
                    </div>
                    <PrecisionRulerScrubber
                      value={activeBone.rotation?.z || 0}
                      min={-120}
                      max={120}
                      step={0.5}
                      decimals={1}
                      unit="°"
                      defaultValue={0}
                      accentColor="#38BDF8"
                      ariaLabel="Bone Roll Z"
                      onChange={(val) => updateBoneRotation(activeBone.name, 'z', val)}
                    />
                  </div>
                </div>
              )}

              {/* Instant Pose Presets */}
              <div className="bg-[#121622] border border-[#1F2738] rounded-xl p-2.5 space-y-1.5">
                <span className="text-[10px] font-extrabold text-[var(--app-accent-light)] block">
                  {lang === 'ar' ? 'وضعيات جاهزة بضغطة واحدة (Pose Presets):' : 'Pose Presets:'}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => applyPosePreset('t_pose')}
                    className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222C40] text-[10px] font-bold text-slate-200 border border-[#232C3E] truncate"
                  >
                    🧍 {lang === 'ar' ? 'وقوف مستقيم T' : 'T-Pose'}
                  </button>
                  <button
                    onClick={() => applyPosePreset('walk')}
                    className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222C40] text-[10px] font-bold text-slate-200 border border-[#232C3E] truncate"
                  >
                    🚶 {lang === 'ar' ? 'خطوة مشي' : 'Walk Step'}
                  </button>
                  <button
                    onClick={() => applyPosePreset('run')}
                    className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222C40] text-[10px] font-bold text-slate-200 border border-[#232C3E] truncate"
                  >
                    🏃 {lang === 'ar' ? 'ركض سريع' : 'Sprint'}
                  </button>
                  <button
                    onClick={() => applyPosePreset('wave')}
                    className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222C40] text-[10px] font-bold text-slate-200 border border-[#232C3E] truncate"
                  >
                    👋 {lang === 'ar' ? 'تحية ولوحة' : 'Wave'}
                  </button>
                  <button
                    onClick={() => applyPosePreset('sit_animal')}
                    className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222C40] text-[10px] font-bold text-slate-200 border border-[#232C3E] truncate"
                  >
                    🐕 {lang === 'ar' ? 'جلوس حيوان' : 'Sit Animal'}
                  </button>
                  <button
                    onClick={() => applyPosePreset('pounce_animal')}
                    className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222C40] text-[10px] font-bold text-slate-200 border border-[#232C3E] truncate"
                  >
                    🐆 {lang === 'ar' ? 'انقضاض حيوان' : 'Pounce'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: PROCEDURAL AUTO-RIGGING FOR LIVING CREATURES ONLY */}
      {activeTab === 'rigging' && (
        <div className="space-y-3">
          <div className="p-3 bg-[var(--app-accent-surface)] border border-[var(--app-accent-border)] rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Zap className="w-4 h-4 text-[var(--app-accent-bright)]" />
              <span>
                {lang === 'ar'
                  ? 'نظام صنع عظام ذكي للمجسمات الحية (Auto-Rigging)'
                  : 'Procedural Creature Auto-Rigging'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'مخصص فقط للمجسمات الحية (بشر أو حيوانات). يقوم النظام آلياً بإنشاء مفاصل الأذرع والأرجل والرأس والذيل مع ربط أوزان الجلد السلسة (Skin Weights) لتحريك المجسم بالكامل!'
                : 'Designed for living models (humans or animals). Automatically generates limb armatures and binds vertex skin weights!'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Biped Humanoid Rig */}
            <button
              onClick={() => handleGenerateBones('biped')}
              style={
                modelConfig.creatureType === 'biped'
                  ? { boxShadow: '0 0 12px var(--app-accent-glow)' }
                  : undefined
              }
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center group ${
                modelConfig.creatureType === 'biped'
                  ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-bright)]'
                  : 'bg-[#121622] border-[#1F2837] hover:border-[var(--app-accent-border)]'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(var(--app-accent-rgb),0.14)] border border-[rgba(var(--app-accent-rgb),0.28)] flex items-center justify-center text-[var(--app-accent-bright)] group-hover:scale-110 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs text-white">
                {lang === 'ar' ? 'كائن بشري (Biped)' : 'Humanoid Biped'}
              </span>
              <span className="text-[10px] text-slate-400">
                {lang === 'ar' ? 'رأس، صدر، ذراعين، ساقين، حوض' : 'Head, Spine, Arms, Legs'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--app-accent-surface)] text-[var(--app-accent-light)]">
                {lang === 'ar' ? 'توليد عظام بشرية' : 'Build Human Rig'}
              </span>
            </button>

            {/* Quadruped Animal Rig */}
            <button
              onClick={() => handleGenerateBones('quadruped')}
              style={
                modelConfig.creatureType === 'quadruped'
                  ? { boxShadow: '0 0 12px var(--app-accent-glow)' }
                  : undefined
              }
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center group ${
                modelConfig.creatureType === 'quadruped'
                  ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-bright)]'
                  : 'bg-[#121622] border-[#1F2837] hover:border-[var(--app-accent-border)]'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(var(--app-accent-rgb),0.14)] border border-[rgba(var(--app-accent-rgb),0.28)] flex items-center justify-center text-[var(--app-accent-bright)] group-hover:scale-110 transition-transform">
                <Dog className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs text-white">
                {lang === 'ar' ? 'حيوان رباعي (Quadruped)' : 'Animal Quadruped'}
              </span>
              <span className="text-[10px] text-slate-400">
                {lang === 'ar' ? '4 قوائم، ذيل، عنق، ظهر ممتد' : '4 Legs, Tail, Neck, Spine'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--app-accent-surface)] text-[var(--app-accent-light)]">
                {lang === 'ar' ? 'توليد عظام حيوان' : 'Build Animal Rig'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: MATERIALS, PBR & LIGHTING (Real details preserved!) */}
      {activeTab === 'materials' && (
        <div className="space-y-3 bg-[#121622] p-3 rounded-xl border border-[#1F2837]">
          <span className="text-xs font-black text-[var(--app-accent-bright)] flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إعدادات الإضاءة والتجسيم الواقعي PBR' : 'PBR Materials & Lighting'}</span>
          </span>

          {/* Roughness */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">{lang === 'ar' ? 'الخشونة (Roughness)' : 'Roughness'}</span>
              <span className="font-mono text-cyan-300">
                {Math.round((modelConfig.roughness ?? 0.4) * 100)}%
              </span>
            </div>
            <PrecisionRulerScrubber
              value={modelConfig.roughness ?? 0.4}
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              defaultValue={0.4}
              accentColor="#38BDF8"
              ariaLabel="Roughness"
              onChange={(val) => updateMaterialProperty('roughness', val)}
            />
          </div>

          {/* Metalness */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">{lang === 'ar' ? 'المعدنية واللمعان (Metalness)' : 'Metallic'}</span>
              <span className="font-mono text-amber-300">
                {Math.round((modelConfig.metallic ?? 0.2) * 100)}%
              </span>
            </div>
            <PrecisionRulerScrubber
              value={modelConfig.metallic ?? 0.2}
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              defaultValue={0.2}
              accentColor="#FBBF24"
              ariaLabel="Metallic"
              onChange={(val) => updateMaterialProperty('metallic', val)}
            />
          </div>

          {/* Light Angle */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">{lang === 'ar' ? 'زاوية مصدر الضوء' : 'Light Angle'}</span>
              <span className="font-mono text-white">{(modelConfig.lightAngle ?? 45).toFixed(0)}°</span>
            </div>
            <PrecisionRulerScrubber
              value={modelConfig.lightAngle ?? 45}
              min={0}
              max={360}
              step={1}
              decimals={0}
              unit="°"
              defaultValue={45}
              ariaLabel="Light Angle"
              onChange={(val) => updateMaterialProperty('lightAngle', val)}
            />
          </div>

          {/* Floor Shadow Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-[#1F2837]">
            <span className="text-[11px] font-bold text-slate-300">
              {lang === 'ar' ? 'ظل حقيقي على الأرضية (Floor Shadow)' : 'Real Ground Shadow'}
            </span>
            <button
              onClick={() => updateMaterialProperty('castFloorShadow', !(modelConfig.castFloorShadow !== false))}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                modelConfig.castFloorShadow !== false
                  ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border-[var(--app-accent-border)]'
                  : 'bg-[#182030] text-slate-400 border-[#232C3E]'
              }`}
            >
              {modelConfig.castFloorShadow !== false ? 'مفعل' : 'معطل'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ANIMATION CLIPS (Walk, Run, Idle, Dance) */}
      {activeTab === 'animations' && (
        <div className="space-y-2.5 bg-[#121622] p-3 rounded-xl border border-[#1F2837]">
          <span className="text-xs font-black text-[var(--app-accent-light)] flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'الحركات الجاهزة المدمجة في المجسم' : 'Embedded Animations'}</span>
          </span>

          <div className="grid grid-cols-2 gap-2">
            {(modelConfig.animationClips || []).map((clipName, idx) => (
              <button
                key={clipName}
                onClick={() => updateMaterialProperty('activeClipIndex', idx)}
                style={(modelConfig.activeClipIndex ?? 0) === idx ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
                className={`p-2 rounded-xl text-xs font-bold border text-left truncate transition-all ${
                  (modelConfig.activeClipIndex ?? 0) === idx
                    ? 'bg-[var(--app-accent-surface)] text-white border-[var(--app-accent-bright)]'
                    : 'bg-[#151C28] text-slate-400 border-[#232C3E] hover:text-white'
                }`}
              >
                🎬 {clipName}
              </button>
            ))}
          </div>

          {/* Playback speed */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">{lang === 'ar' ? 'سرعة الحركة' : 'Playback Speed'}</span>
              <span className="font-mono text-[var(--app-accent-light)] font-bold">{(modelConfig.animationSpeed ?? 1).toFixed(2)}x</span>
            </div>
            <PrecisionRulerScrubber
              value={modelConfig.animationSpeed ?? 1}
              min={0.1}
              max={2.5}
              step={0.05}
              decimals={2}
              unit="x"
              defaultValue={1}
              accentColor={palette.bright}
              ariaLabel="Playback Speed"
              onChange={(val) => updateMaterialProperty('animationSpeed', val)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
