import { useState, useEffect, useCallback } from 'react';

export type EffectPrecisionMode = 'micro' | 'fine' | 'normal' | 'macro';

export interface EffectControlSettings {
  precisionMode: EffectPrecisionMode;
  unboundedRange: boolean;
  showStepButtons: boolean;
}

const STORAGE_KEY = 'sqmotion_effect_control_settings_v1';
const SETTINGS_EVENT = 'sqmotion:effectControlSettingsChanged';

const DEFAULT_SETTINGS: EffectControlSettings = {
  precisionMode: 'fine',
  unboundedRange: true,
  showStepButtons: true,
};

export function loadEffectControlSettings(): EffectControlSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      precisionMode:
        parsed.precisionMode === 'micro' ||
        parsed.precisionMode === 'fine' ||
        parsed.precisionMode === 'normal' ||
        parsed.precisionMode === 'macro'
          ? parsed.precisionMode
          : DEFAULT_SETTINGS.precisionMode,
      unboundedRange:
        typeof parsed.unboundedRange === 'boolean'
          ? parsed.unboundedRange
          : DEFAULT_SETTINGS.unboundedRange,
      showStepButtons:
        typeof parsed.showStepButtons === 'boolean'
          ? parsed.showStepButtons
          : DEFAULT_SETTINGS.showStepButtons,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveEffectControlSettings(next: EffectControlSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
  } catch {
    // Ignore quota errors
  }
}

export function useEffectControlSettings(): [
  EffectControlSettings,
  (patch: Partial<EffectControlSettings>) => void
] {
  const [settings, setSettings] = useState<EffectControlSettings>(() => loadEffectControlSettings());

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<EffectControlSettings>;
      if (ce.detail) {
        setSettings(ce.detail);
      } else {
        setSettings(loadEffectControlSettings());
      }
    };
    window.addEventListener(SETTINGS_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_EVENT, handler);
  }, []);

  const updateSettings = useCallback((patch: Partial<EffectControlSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveEffectControlSettings(next);
      return next;
    });
  }, []);

  return [settings, updateSettings];
}

export interface PrecisionMultipliers {
  stepFactor: number;
  sensitivityScale: number;
  minStep: number;
  extraDecimals: number;
}

export function getPrecisionMultipliers(mode: EffectPrecisionMode): PrecisionMultipliers {
  switch (mode) {
    case 'micro':
      return {
        stepFactor: 0.02,
        sensitivityScale: 0.08,
        minStep: 0.001,
        extraDecimals: 2,
      };
    case 'fine':
      return {
        stepFactor: 0.2,
        sensitivityScale: 0.35,
        minStep: 0.01,
        extraDecimals: 1,
      };
    case 'macro':
      return {
        stepFactor: 2.5,
        sensitivityScale: 2.6,
        minStep: 0.1,
        extraDecimals: 0,
      };
    case 'normal':
    default:
      return {
        stepFactor: 1,
        sensitivityScale: 1,
        minStep: 0.01,
        extraDecimals: 0,
      };
  }
}
