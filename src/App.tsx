import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { PANEL_SPRING, PanelRimSheen, viewTransitionVariants } from './components/MotionPrimitives';
import {
  Project,
  Language,
  Layer,
  FrameHistoryState,
  CopiedPropertiesBundle,
  FavoritesState,
  FavoriteItem,
  ProjectVersion,
  RecoveryTarget,
  PropertyTransferMode,
} from './types';
import { STARTER_TEMPLATES } from './engine/templates';
import { downloadProjectSQ } from './engine/exporter';
import { evaluateProperty } from './engine/interpolator';
import { retimeProjectForFps } from './utils/projectTiming';
import {
  ProjectUndoStack,
  listProjectVersions,
  createProjectVersion,
  updateProjectVersionMeta,
  deleteProjectVersion,
  pruneUnpinnedVersions,
  applyVersionRecovery,
} from './engine/historyEngine';
import { applyPropertiesToLayer } from './engine/propertyTransfer';
import {
  createGroupFromLayers,
  ungroupLayer,
  duplicateGroupDeep,
  deleteGroup,
  getDescendantLayerIds,
} from './engine/groupUtils';
import {
  loadFavoritesState,
  saveFavoritesState,
  recordFavoriteUsage,
  toggleFavoriteItem,
  setActiveFavoritesUid,
} from './engine/favoritesStore';
import { MOTION_PRESETS } from './engine/presets';
import { ALIGHT_EFFECTS_FULL_CATALOG } from './data/alightEffectsCatalog';
import { copyCurveToClipboard } from './engine/curveClipboard';
import { useCollabSession } from './engine/collabClient';
import {
  syncFavoritesToCloud,
  loadFavoritesFromCloud,
  syncProjectToCloud,
  loadCloudProjects,
  deleteProjectFromCloud,
  getScopedProjectsStorageKey,
  onAuthStateChanged,
  FirebaseUser,
  auth,
} from './lib/firebase';
import { SocialProvider, useSocial } from './context/SocialContext';
import { Header } from './components/Header';
import { CanvasViewport } from './components/CanvasViewport';
import { Timeline } from './components/Timeline';
import { PropertyPanel } from './components/PropertyPanel';
import { SelectedSubView } from './components/AlightSelectedInspector';
import { GraphEditor } from './components/GraphEditor';
import { PresetLibrary } from './components/PresetLibrary';
import { ExportModal } from './components/ExportModal';
import { TemplateModal } from './components/TemplateModal';
import { AlightAddModal } from './components/AlightAddModal';
import { MediaSyncManager } from './components/MediaSyncManager';
import { HomeScreen } from './components/HomeScreen';
import { HistoryVersionsModal } from './components/HistoryVersionsModal';
import { CopyPastePropertiesModal } from './components/CopyPastePropertiesModal';
import { QuickAccessPanel } from './components/QuickAccessPanel';
import { ProjectSearchModal } from './components/ProjectSearchModal';
import { CollaborationPanel } from './components/CollaborationPanel';
import { CloudAccountModal } from './components/CloudAccountModal';
import { CreatorProfileModal } from './components/CreatorProfileModal';
import { SocialCommunityModal, type SocialTabId } from './components/SocialCommunityModal';
import { WelcomeAuthGate } from './components/WelcomeAuthGate';
import { LiveNotificationBanner } from './components/LiveNotificationBanner';
import { NotificationsCenterModal } from './components/NotificationsCenterModal';
import { getNextLayerName } from './utils/layerNaming';
import { getNextProjectName } from './utils/projectNaming';
import { loadAppSettings, applyThemeToDocument, AppSettings } from './utils/appSettings';
import { ensureGoogleFontLoaded } from './utils/onlineFonts';
import { BUILTIN_MEDIA_GALLERY, BUILTIN_AUDIO_TRACKS, getBuiltinAudioUrl } from './utils/synthAudio';
import { Loader2, Plus } from 'lucide-react';

function createFreshDefaultProject(): Project {
  const starter = JSON.parse(JSON.stringify(STARTER_TEMPLATES[0].project)) as Project;
  return {
    ...starter,
    id: `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    settings: {
      ...starter.settings,
      name: 'مشروع 1',
    },
    updatedAt: Date.now(),
    isPlaying: false,
    selectedLayerId: null,
  };
}

function loadScopedProjects(uid?: string): Project[] {
  if (!uid) return [];
  const key = getScopedProjectsStorageKey(uid);
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  const initial = [createFreshDefaultProject()];
  try {
    localStorage.setItem(key, JSON.stringify(initial));
  } catch {
    // ignore quota errors
  }
  return initial;
}

const HomeWithNotifications: React.FC<
  React.ComponentProps<typeof HomeScreen>
> = (props) => {
  const social = useSocial();
  return <HomeScreen {...props} unreadNotificationsCount={social.unreadCount} />;
};

export default function App() {
  const [viewMode, setViewMode] = useState<'home' | 'editor'>('home');
  const [lang, setLang] = useState<Language>('ar');
  const [inspectorSubView, setInspectorSubView] = useState<SelectedSubView>('menu');
  const [requestedSubView, setRequestedSubView] = useState<{ view: SelectedSubView; token: number } | null>(null);
  const [isSideToolsOpen, setIsSideToolsOpen] = useState<boolean>(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());

  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail;
      if (detail) setAppSettings(detail);
    };
    window.addEventListener('sqmotion-settings-changed', onSettingsChanged);
    return () => window.removeEventListener('sqmotion-settings-changed', onSettingsChanged);
  }, []);

  useEffect(() => {
    applyThemeToDocument(appSettings.theme);
  }, [appSettings.theme]);

  useEffect(() => {
    const scaleMap: Record<AppSettings['editorUiScale'], string> = {
      compact: '14px',
      normal: '16px',
      large: '17.5px',
    };
    document.documentElement.style.fontSize =
      viewMode === 'editor' ? scaleMap[appSettings.editorUiScale] || '16px' : '16px';
  }, [appSettings.editorUiScale, viewMode]);

  const [savedProjects, setSavedProjects] = useState<Project[]>(() =>
    loadScopedProjects(auth.currentUser?.uid)
  );

  const savedProjectsRef = useRef<Project[]>(savedProjects);
  savedProjectsRef.current = savedProjects;

  // Keep saved projects strictly isolated per user UID in localStorage
  const persistProjectsList = (projectsList: Project[]) => {
    savedProjectsRef.current = projectsList;
    setSavedProjects(projectsList);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      localStorage.setItem(getScopedProjectsStorageKey(uid), JSON.stringify(projectsList));
    } catch (e) {
      console.error('Failed to persist projects to localStorage', e);
    }
  };

  const syncProjectToStorageSilent = (projToSync: Project) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const prev = savedProjectsRef.current;
    const updatedItem: Project = {
      ...projToSync,
      updatedAt: Date.now(),
    };
    const existingIdx = prev.findIndex((p) => p.id === projToSync.id);
    let updatedList: Project[];
    if (existingIdx >= 0) {
      updatedList = [...prev];
      updatedList[existingIdx] = updatedItem;
    } else {
      updatedList = [updatedItem, ...prev];
    }
    savedProjectsRef.current = updatedList;
    try {
      localStorage.setItem(getScopedProjectsStorageKey(uid), JSON.stringify(updatedList));
    } catch (e) {
      console.error('Failed to sync project to storage', e);
    }
    syncProjectToCloud(updatedItem).catch(() => {});
  };

  const [project, setProject] = useState<Project>(() => {
    const initial = loadScopedProjects(auth.currentUser?.uid);
    if (initial.length > 0) {
      return { ...initial[0], isPlaying: false, selectedLayerId: null };
    }
    return createFreshDefaultProject();
  });

  // Automatically sync current project to storage silently in editor mode (debounced 900ms, zero extra React re-render)
  useEffect(() => {
    if (!project || !project.id) return;
    if (viewMode !== 'editor') return;

    const timer = setTimeout(() => {
      syncProjectToStorageSilent(project);
    }, 900);

    return () => clearTimeout(timer);
  }, [project.layers, project.settings, project.id, viewMode]);

  // Incremental Undo / Redo Stack (250 steps + diff coalescing) & Versions
  const undoStackRef = useRef<ProjectUndoStack>(new ProjectUndoStack());
  const lastCommittedStateRef = useRef<FrameHistoryState>({
    layers: JSON.parse(JSON.stringify(project.layers)),
    settings: JSON.parse(JSON.stringify(project.settings)),
  });
  const [historyTick, setHistoryTick] = useState<number>(0);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [autoVersionEnabled, setAutoVersionEnabled] = useState<boolean>(true);
  const [maxUnpinnedVersions, setMaxUnpinnedVersions] = useState<number>(15);
  const editsSinceAutoVerRef = useRef<number>(0);

  // Integrated Workspace System States
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showCopyPasteModal, setShowCopyPasteModal] = useState<boolean>(false);
  const [showQuickAccess, setShowQuickAccess] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showCollabModal, setShowCollabModal] = useState<boolean>(false);
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showSocialModal, setShowSocialModal] = useState<boolean>(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [socialInitialTab, setSocialInitialTab] = useState<SocialTabId>('videos');
  const [socialTargetDmId, setSocialTargetDmId] = useState<string | null>(null);
  const [socialTargetRoomId, setSocialTargetRoomId] = useState<string | null>(null);
  const [cloudUser, setCloudUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const [copiedBundle, setCopiedBundle] = useState<CopiedPropertiesBundle | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [favoritesState, setFavoritesState] = useState<FavoritesState>(() =>
    loadFavoritesState(auth.currentUser?.uid)
  );
  const [appToast, setAppToast] = useState<string | null>(null);
  const appToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = React.useCallback((msg: string) => {
    setAppToast(msg);
    if (appToastTimerRef.current) clearTimeout(appToastTimerRef.current);
    appToastTimerRef.current = setTimeout(() => setAppToast(null), 2600);
  }, []);

  const handleOpenDmFromNotif = React.useCallback((senderId: string) => {
    setSocialTargetRoomId(null);
    setSocialTargetDmId(senderId);
    setSocialInitialTab('chats');
    setShowNotificationsModal(false);
    setShowProfileModal(false);
    setShowCloudModal(false);
    setShowSocialModal(true);
  }, []);

  const handleOpenRoomFromNotif = React.useCallback((roomId: string) => {
    setSocialTargetDmId(null);
    setSocialTargetRoomId(roomId);
    setSocialInitialTab('chats');
    setShowNotificationsModal(false);
    setShowProfileModal(false);
    setShowCloudModal(false);
    setShowSocialModal(true);
  }, []);

  const handleOpenVideosFromNotif = React.useCallback(() => {
    setSocialTargetDmId(null);
    setSocialTargetRoomId(null);
    setSocialInitialTab('videos');
    setShowNotificationsModal(false);
    setShowSocialModal(true);
  }, []);

  // Collaborative Editing Session (Server-Authoritative WebSocket)
  const isRemoteUpdateRef = useRef<boolean>(false);
  const projectRef = useRef<Project>(project);
  projectRef.current = project;

  const collab = useCollabSession({
    onApplyRemoteLayers: (remoteLayers) => {
      isRemoteUpdateRef.current = true;
      setProject((prev) => ({ ...prev, layers: JSON.parse(JSON.stringify(remoteLayers)) }));
      lastCommittedStateRef.current = {
        ...lastCommittedStateRef.current,
        layers: JSON.parse(JSON.stringify(remoteLayers)),
      };
      requestAnimationFrame(() => {
        isRemoteUpdateRef.current = false;
      });
    },
    onApplyRemoteLayerUpsert: (remoteLayer) => {
      isRemoteUpdateRef.current = true;
      setProject((prev) => {
        const exists = prev.layers.some((l) => l.id === remoteLayer.id);
        const nextLayers = exists
          ? prev.layers.map((l) => (l.id === remoteLayer.id ? JSON.parse(JSON.stringify(remoteLayer)) : l))
          : [...prev.layers, JSON.parse(JSON.stringify(remoteLayer))];
        lastCommittedStateRef.current = {
          ...lastCommittedStateRef.current,
          layers: JSON.parse(JSON.stringify(nextLayers)),
        };
        return { ...prev, layers: nextLayers };
      });
      requestAnimationFrame(() => {
        isRemoteUpdateRef.current = false;
      });
    },
    onApplyRemoteLayerDelete: (layerId) => {
      isRemoteUpdateRef.current = true;
      setProject((prev) => {
        const nextLayers = prev.layers.filter((l) => l.id !== layerId);
        lastCommittedStateRef.current = {
          ...lastCommittedStateRef.current,
          layers: JSON.parse(JSON.stringify(nextLayers)),
        };
        return {
          ...prev,
          layers: nextLayers,
          selectedLayerId: prev.selectedLayerId === layerId ? null : prev.selectedLayerId,
        };
      });
      requestAnimationFrame(() => {
        isRemoteUpdateRef.current = false;
      });
    },
    onApplyRemoteSettings: (remoteSettings) => {
      isRemoteUpdateRef.current = true;
      setProject((prev) => ({ ...prev, settings: JSON.parse(JSON.stringify(remoteSettings)) }));
      lastCommittedStateRef.current = {
        ...lastCommittedStateRef.current,
        settings: JSON.parse(JSON.stringify(remoteSettings)),
      };
      requestAnimationFrame(() => {
        isRemoteUpdateRef.current = false;
      });
    },
    onApplyRemoteFullState: (remoteLayers, remoteSettings) => {
      isRemoteUpdateRef.current = true;
      setProject((prev) => ({
        ...prev,
        layers: JSON.parse(JSON.stringify(remoteLayers)),
        settings: JSON.parse(JSON.stringify(remoteSettings)),
      }));
      lastCommittedStateRef.current = {
        layers: JSON.parse(JSON.stringify(remoteLayers)),
        settings: JSON.parse(JSON.stringify(remoteSettings)),
      };
      requestAnimationFrame(() => {
        isRemoteUpdateRef.current = false;
      });
    },
  });

  // Auto-join shared workspace from URL (?collab=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('collab');
    if (code && code.trim().length >= 4) {
      setViewMode('editor');
      setShowCollabModal(true);
      collab.joinWorkspace(code.trim().toUpperCase()).catch(() => {});
    }
  }, []);

  // Broadcast local presence (playhead + selected layer) to collaborators
  useEffect(() => {
    if (collab.workspace) {
      collab.sendPresence(project.selectedLayerId || null, project.currentFrame);
    }
  }, [collab.workspace?.roomCode, project.currentFrame, project.selectedLayerId]);

  // Listen to global Favorites changes from EffectsStudio / PresetLibrary / BezierGraph / TemplateModal
  useEffect(() => {
    const onFavChanged = () => {
      const uid = auth.currentUser?.uid;
      const latest = loadFavoritesState(uid);
      setFavoritesState(latest);
      if (uid) {
        syncFavoritesToCloud(latest).catch(() => {});
      }
    };
    window.addEventListener('sqmotion:favoritesChanged', onFavChanged);
    return () => window.removeEventListener('sqmotion:favoritesChanged', onFavChanged);
  }, []);

  const mergeCloudProjectsList = React.useCallback((cloudList: Project[]) => {
    if (!Array.isArray(cloudList) || cloudList.length === 0) return;
    const byId = new Map<string, Project>();
    for (const localProj of savedProjectsRef.current) {
      byId.set(localProj.id, localProj);
    }
    for (const cloudProj of cloudList) {
      const existing = byId.get(cloudProj.id);
      if (!existing || (cloudProj.updatedAt || 0) > (existing.updatedAt || 0)) {
        byId.set(cloudProj.id, cloudProj);
      }
    }
    const merged = Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    persistProjectsList(merged);
  }, []);

  // Listen to Firebase Auth state & strictly isolate projects + favorites + modals per user UID
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCloudUser(u);
      setAuthReady(true);

      if (!u) {
        setActiveFavoritesUid(undefined);
        savedProjectsRef.current = [];
        setSavedProjects([]);
        const blankProj = createFreshDefaultProject();
        setProject(blankProj);
        setViewMode('home');
        setShowProfileModal(false);
        setShowCloudModal(false);
        setShowSocialModal(false);
        setShowNotificationsModal(false);
        setShowCollabModal(false);
        setSocialTargetDmId(null);
        setSocialTargetRoomId(null);
        return;
      }

      const signedUid = u.uid;
      setActiveFavoritesUid(signedUid);
      const scopedProjects = loadScopedProjects(signedUid);
      savedProjectsRef.current = scopedProjects;
      setSavedProjects(scopedProjects);

      const firstProj = scopedProjects[0]
        ? { ...scopedProjects[0], isPlaying: false, selectedLayerId: null }
        : createFreshDefaultProject();
      setProject(firstProj);
      setViewMode('home');
      setShowInspector(false);
      undoStackRef.current.reset();
      lastCommittedStateRef.current = {
        layers: JSON.parse(JSON.stringify(firstProj.layers)),
        settings: JSON.parse(JSON.stringify(firstProj.settings)),
      };
      setFavoritesState(loadFavoritesState(signedUid));

      try {
        const [cloudProjects, cloudFavs] = await Promise.all([
          loadCloudProjects(),
          loadFavoritesFromCloud(),
        ]);
        if (auth.currentUser?.uid !== signedUid) return;

        if (cloudProjects.length > 0) {
          mergeCloudProjectsList(cloudProjects);
        }
        if (cloudFavs && Array.isArray((cloudFavs as { items?: unknown[] }).items)) {
          const localFavs = loadFavoritesState(signedUid);
          const mergedItemsMap = new Map<string, FavoriteItem>();
          for (const item of localFavs.items) {
            mergedItemsMap.set(`${item.type}:${item.refId}`, item);
          }
          for (const item of (cloudFavs as { items: FavoriteItem[] }).items) {
            const key = `${item.type}:${item.refId}`;
            if (!mergedItemsMap.has(key)) mergedItemsMap.set(key, item);
          }
          const nextFavs: FavoritesState = {
            ...localFavs,
            items: Array.from(mergedItemsMap.values()),
            updatedAt: Date.now(),
          };
          saveFavoritesState(nextFavs, signedUid);
          setFavoritesState(nextFavs);
        }
      } catch {
        // ignore network errors silently
      }
    });
    return () => unsub();
  }, [mergeCloudProjectsList]);

  // Load saved versions for active project
  useEffect(() => {
    let cancelled = false;
    listProjectVersions(project.id).then((list) => {
      if (!cancelled) setVersions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Periodic Auto-Versioning every 2 minutes when edits happened
  useEffect(() => {
    if (!autoVersionEnabled || viewMode !== 'editor') return;
    const timer = setInterval(() => {
      if (editsSinceAutoVerRef.current > 0) {
        editsSinceAutoVerRef.current = 0;
        const p = projectRef.current;
        createProjectVersion({
          projectId: p.id,
          state: { layers: p.layers, settings: p.settings },
          name: `${lang === 'ar' ? 'حفظ تلقائي' : 'Auto-Save'} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          isAuto: true,
          maxUnpinned: maxUnpinnedVersions,
        }).then(() => listProjectVersions(p.id).then(setVersions));
      }
    }, 120000);
    return () => clearInterval(timer);
  }, [autoVersionEnabled, viewMode, maxUnpinnedVersions, lang]);

  // Preload any Google Fonts used by text layers over HTTPS
  useEffect(() => {
    for (const l of project.layers) {
      if (l.type === 'text' && l.textConfig?.fontFamily) {
        const cleanFamily = l.textConfig.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
        if (cleanFamily && cleanFamily !== 'sans-serif' && cleanFamily !== 'serif') {
          ensureGoogleFontLoaded(cleanFamily).catch(() => {});
        }
      }
    }
  }, [project.id, project.layers]);

  const prevSelectedLayerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (project.selectedLayerId && project.selectedLayerId !== prevSelectedLayerIdRef.current) {
      setShowInspector(true);
      setInspectorSubView('menu');
    } else if (!project.selectedLayerId) {
      setShowInspector(false);
    }
    prevSelectedLayerIdRef.current = project.selectedLayerId;
  }, [project.selectedLayerId]);

  // Animation frame loop refs & history debounce ref
  const animationFrameRef = useRef<number | null>(null);
  const playAnchorTimeRef = useRef<number>(performance.now());
  const playAnchorFrameRef = useRef<number>(0);
  const lastLoopFrameRef = useRef<number>(-1);
  const currentFrameRef = useRef<number>(project.currentFrame);
  currentFrameRef.current = project.currentFrame;

  const activeLoopEndFrame = Math.max(
    1,
    Math.min(
      project.settings.durationFrames,
      project.layers.length > 0
        ? Math.max(...project.layers.map((l) => l.startFrame + l.durationFrames))
        : project.settings.durationFrames
    )
  );
  const loopEndFrameRef = useRef<number>(activeLoopEndFrame);
  loopEndFrameRef.current = activeLoopEndFrame;

  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collabDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitCollabProjectState = (nextProject: Project, immediate = false) => {
    if (!collab.workspace || isRemoteUpdateRef.current) return;
    if (collab.currentMember && !collab.currentMember.permissions.canEditLayers) return;
    const send = () => {
      collab.broadcastOp({
        kind: 'layers:replace',
        layers: JSON.parse(JSON.stringify(nextProject.layers)),
        summary: `${nextProject.layers.length} layers`,
      });
    };
    if (collabDebounceRef.current) clearTimeout(collabDebounceRef.current);
    if (immediate) {
      send();
    } else {
      collabDebounceRef.current = setTimeout(send, 160);
    }
  };

  // Save state to incremental undo stack immediately or debounced
  const pushHistoryImmediate = (newProject: Project, label?: string, batchKey?: string) => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    const nextState: FrameHistoryState = {
      layers: JSON.parse(JSON.stringify(newProject.layers)),
      settings: JSON.parse(JSON.stringify(newProject.settings)),
    };
    const pushed = undoStackRef.current.push(lastCommittedStateRef.current, nextState, {
      label,
      batchKey,
    });
    lastCommittedStateRef.current = nextState;
    if (pushed) {
      setHistoryTick((t) => t + 1);
      editsSinceAutoVerRef.current += 1;
      if (autoVersionEnabled && editsSinceAutoVerRef.current >= 18) {
        editsSinceAutoVerRef.current = 0;
        createProjectVersion({
          projectId: newProject.id,
          state: nextState,
          name: `${lang === 'ar' ? 'نقطة تلقائية' : 'Auto Snapshot'} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          isAuto: true,
          maxUnpinned: maxUnpinnedVersions,
        }).then(() => listProjectVersions(newProject.id).then(setVersions));
      }
    }
    emitCollabProjectState(newProject, true);
  };

  const pushHistoryDebounced = (newProject: Project, batchKey?: string) => {
    emitCollabProjectState(newProject, false);
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
    }
    historyDebounceRef.current = setTimeout(() => {
      pushHistoryImmediate(newProject, undefined, batchKey);
    }, 480);
  };

  const handleUndo = () => {
    const curState: FrameHistoryState = {
      layers: projectRef.current.layers,
      settings: projectRef.current.settings,
    };
    const res = undoStackRef.current.undo(curState);
    if (res) {
      lastCommittedStateRef.current = JSON.parse(JSON.stringify(res.nextState));
      const nextProj: Project = {
        ...projectRef.current,
        layers: JSON.parse(JSON.stringify(res.nextState.layers)),
        settings: JSON.parse(JSON.stringify(res.nextState.settings)),
      };
      setProject(nextProj);
      setHistoryTick((t) => t + 1);
      emitCollabProjectState(nextProj, true);
    }
  };

  const handleRedo = () => {
    const curState: FrameHistoryState = {
      layers: projectRef.current.layers,
      settings: projectRef.current.settings,
    };
    const res = undoStackRef.current.redo(curState);
    if (res) {
      lastCommittedStateRef.current = JSON.parse(JSON.stringify(res.nextState));
      const nextProj: Project = {
        ...projectRef.current,
        layers: JSON.parse(JSON.stringify(res.nextState.layers)),
        settings: JSON.parse(JSON.stringify(res.nextState.settings)),
      };
      setProject(nextProj);
      setHistoryTick((t) => t + 1);
      emitCollabProjectState(nextProj, true);
    }
  };

  const handleJumpToHistoryCursor = (targetCursor: number) => {
    const curState: FrameHistoryState = {
      layers: projectRef.current.layers,
      settings: projectRef.current.settings,
    };
    const targetState = undoStackRef.current.jumpToCursor(curState, targetCursor);
    lastCommittedStateRef.current = JSON.parse(JSON.stringify(targetState));
    const nextProj: Project = {
      ...projectRef.current,
      layers: JSON.parse(JSON.stringify(targetState.layers)),
      settings: JSON.parse(JSON.stringify(targetState.settings)),
    };
    setProject(nextProj);
    setHistoryTick((t) => t + 1);
    emitCollabProjectState(nextProj, true);
  };

  const canUndo = undoStackRef.current.canUndo();
  const canRedo = undoStackRef.current.canRedo();
  void historyTick;

  // Real-time Wall-Clock Playback Loop (locked 1.0x speed regardless of monitor Hz or project FPS)
  useEffect(() => {
    if (project.isPlaying) {
      playAnchorTimeRef.current = performance.now();
      playAnchorFrameRef.current = currentFrameRef.current;
      lastLoopFrameRef.current = currentFrameRef.current;

      const updateLoop = (now: number) => {
        const loopEnd = loopEndFrameRef.current;
        const fps = project.settings.fps || 30;

        // Detect external frame jump (e.g. Rewind or scrubbing while playing) and re-anchor clock
        if (lastLoopFrameRef.current !== -1 && currentFrameRef.current !== lastLoopFrameRef.current) {
          playAnchorTimeRef.current = now;
          playAnchorFrameRef.current = currentFrameRef.current;
        }

        const elapsedSec = Math.max(0, (now - playAnchorTimeRef.current) / 1000);
        let nextFrame = playAnchorFrameRef.current + Math.floor(elapsedSec * fps);

        if (nextFrame >= loopEnd) {
          nextFrame = nextFrame % loopEnd;
          playAnchorTimeRef.current = now;
          playAnchorFrameRef.current = nextFrame;
        }

        if (nextFrame !== currentFrameRef.current) {
          lastLoopFrameRef.current = nextFrame;
          currentFrameRef.current = nextFrame;
          setProject((prev) =>
            prev.currentFrame === nextFrame ? prev : { ...prev, currentFrame: nextFrame }
          );
        } else {
          lastLoopFrameRef.current = nextFrame;
        }

        animationFrameRef.current = requestAnimationFrame(updateLoop);
      };

      animationFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      lastLoopFrameRef.current = -1;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [project.isPlaying, project.settings.fps]);

  const guardCollabEdit = () => {
    if (
      collab.workspace &&
      collab.currentMember &&
      !collab.currentMember.permissions.canEditLayers
    ) {
      showNotice(
        lang === 'ar'
          ? 'صلاحيتك الحالية للعرض/المراجعة فقط — لا يمكن تعديل الطبقات'
          : 'Your role is View/Review only — layer editing is disabled'
      );
      return false;
    }
    return true;
  };

  // Project update helpers (functional updates guarantee zero dropped frames at 60fps)
  const handleUpdateLayer = (updatedLayer: Layer, immediateHistory = false) => {
    if (!guardCollabEdit()) return;
    setProject((prev) => {
      const newLayers = prev.layers.map((l) => (l.id === updatedLayer.id ? updatedLayer : l));
      const newProject = { ...prev, layers: newLayers };
      if (immediateHistory) {
        pushHistoryImmediate(newProject);
      } else {
        pushHistoryDebounced(newProject);
      }
      return newProject;
    });
  };

  const handleUpdateLayers = (updatedLayers: Layer[], immediateHistory = false) => {
    if (!guardCollabEdit()) return;
    setProject((prev) => {
      const newProject = { ...prev, layers: updatedLayers };
      if (immediateHistory) {
        pushHistoryImmediate(newProject);
      } else {
        pushHistoryDebounced(newProject);
      }
      return newProject;
    });
  };

  const handleUpdateLayerTransform = (layerId: string, position: { x: number; y: number; z: number }) => {
    if (!guardCollabEdit()) return;
    setProject((prev) => {
      const newLayers = prev.layers.map((l) => {
        if (l.id === layerId) {
          const copy: Layer = {
            ...l,
            transform: {
              ...l.transform,
              position: {
                ...l.transform.position,
                value: position,
              },
            },
          };
          // Update keyframe at current frame or auto-create one if property is keyframed or on a Null layer
          const relFrame = prev.currentFrame - copy.startFrame;
          if (!copy.transform.position.keyframes) {
            copy.transform.position.keyframes = [];
          } else {
            copy.transform.position.keyframes = [...copy.transform.position.keyframes];
          }

          if (copy.transform.position.keyframes.length > 0) {
            const kfIdx = copy.transform.position.keyframes.findIndex((k) => Math.abs(k.frame - relFrame) < 0.5);
            if (kfIdx >= 0) {
              copy.transform.position.keyframes[kfIdx] = {
                ...copy.transform.position.keyframes[kfIdx],
                value: { ...position },
              };
            } else {
              copy.transform.position.keyframes.push({
                id: `kf-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                frame: relFrame,
                value: { ...position },
                easing: 'linear',
              });
              copy.transform.position.keyframes.sort((a, b) => a.frame - b.frame);
            }
          } else if (relFrame > 0 && l.type === 'null') {
            // Auto-seed keyframe 0 and current frame keyframe for seamless multi-movements on Null
            copy.transform.position.keyframes.push({
              id: `kf-${Date.now()}-0`,
              frame: 0,
              value: { ...l.transform.position.value },
              easing: 'linear',
            });
            copy.transform.position.keyframes.push({
              id: `kf-${Date.now()}-1`,
              frame: relFrame,
              value: { ...position },
              easing: 'linear',
            });
            copy.transform.position.keyframes.sort((a, b) => a.frame - b.frame);
          }
          return copy;
        }
        return l;
      });
      const newProject = { ...prev, layers: newLayers };
      pushHistoryDebounced(newProject);
      return newProject;
    });
  };

  const handleAddLayer = (type: Layer['type'], customConfig?: any): string => {
    if (!guardCollabEdit()) return '';
    const id = customConfig?.id || `layer-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    setProject((prev) => {
      const layerName = getNextLayerName(type, prev.layers, customConfig?.name, lang);
      const fps = prev.settings.fps || 30;
      const layerDuration =
        customConfig?.durationSeconds && Number.isFinite(customConfig.durationSeconds) && customConfig.durationSeconds > 0
          ? Math.max(1, Math.round(customConfig.durationSeconds * fps))
          : customConfig?.durationFrames && customConfig.durationFrames > 0
          ? customConfig.durationFrames
          : prev.settings.durationFrames;

      const newLayer: Layer = {
        id,
        name: layerName,
        type,
        visible: true,
        locked: false,
        color: '#00E676',
        startFrame: 0,
        durationFrames: layerDuration,
        blendMode: 'normal',
        parentId: customConfig?.parentId,
        transform: {
          position: {
            value: customConfig?.position || { x: prev.settings.width / 2, y: prev.settings.height / 2, z: 0 },
            keyframes: [],
          },
          scale: { value: customConfig?.scale || { x: 100, y: 100, z: 100 }, keyframes: [] },
          rotation: { value: customConfig?.rotation || { x: 0, y: 0, z: 0 }, keyframes: [] },
          opacity: { value: 100, keyframes: [] },
          anchorPoint: { value: { x: 0, y: 0, z: 0 }, keyframes: [] },
        },
        effects: [],
      };

      if (customConfig?.name) {
        newLayer.name = customConfig.name;
      }
      if (customConfig?.effects && Array.isArray(customConfig.effects)) {
        newLayer.effects = customConfig.effects;
      }
      if (customConfig?.mediaUrl) {
        newLayer.mediaUrl = customConfig.mediaUrl;
      }
      if (customConfig?.audioConfig) {
        newLayer.audioConfig = customConfig.audioConfig;
      }

      if (type === 'image' && !newLayer.mediaUrl) {
        newLayer.mediaUrl = BUILTIN_MEDIA_GALLERY[0].url;
      } else if (type === 'video' && !newLayer.mediaUrl) {
        newLayer.mediaUrl = BUILTIN_MEDIA_GALLERY[0].url;
      } else if (type === 'audio' && !newLayer.audioConfig) {
        newLayer.audioConfig = {
          src: getBuiltinAudioUrl(BUILTIN_AUDIO_TRACKS[0]),
          volume: 1,
          muted: false,
        };
      } else if (type === 'text') {
        newLayer.textConfig = customConfig?.textConfig || (customConfig?.text ? customConfig : {
          text: 'نص إبداعي احترافي',
          fontSize: 48,
          fontFamily: 'Cairo',
          fill: '#ffffff',
          stroke: '#00E676',
          strokeWidth: 0,
          letterSpacing: 0,
          lineHeight: 1.2,
          align: 'center',
          animator: { enabled: false, unit: 'word', effect: 'fade-slide', staggerFrames: 3 },
        });
      } else if (type === 'vector') {
        const defaultDim = Math.max(320, Math.round(Math.min(prev.settings.width, prev.settings.height) * 0.4));
        const requestedWidth = customConfig?.width || defaultDim;
        const requestedHeight = customConfig?.height || defaultDim;

        newLayer.vectorConfig = {
          type: 'star',
          fill: '#00E676',
          stroke: '#00FF87',
          strokeWidth: 4,
          sides: 5,
          innerRadiusRatio: 0.5,
          width: requestedWidth,
          height: requestedHeight,
          ...(customConfig?.vectorConfig || (customConfig?.type && customConfig.type !== 'vector' ? customConfig : {})),
        };
        if (!newLayer.vectorConfig.width || newLayer.vectorConfig.width < 50) {
          newLayer.vectorConfig.width = requestedWidth;
        }
        if (!newLayer.vectorConfig.height || newLayer.vectorConfig.height < 50) {
          newLayer.vectorConfig.height = requestedHeight;
        }
      } else if (type === 'particle') {
        newLayer.particleConfig = customConfig?.particleConfig || (customConfig?.count ? customConfig : {
          count: 50,
          speed: 2,
          size: 4,
          sizeVariation: 2,
          color: '#00E676',
          secondaryColor: '#00E5FF',
          spreadAngle: 360,
          lifetime: 40,
          gravity: 0,
          wind: 0,
          shape: 'spark',
        });
      } else if (type === 'solid') {
        newLayer.solidColor = customConfig?.solidColor || '#1e293b';
      } else if (type === 'model3d') {
        newLayer.is3D = true;
        newLayer.fixedIn3D = false;
        newLayer.model3dConfig = customConfig?.model3dConfig || {
          format: customConfig?.format || 'glb',
          hasBones: customConfig?.hasBones ?? false,
          autoRigged: customConfig?.autoRigged ?? false,
          creatureType: customConfig?.creatureType || 'none',
          bones: customConfig?.bones || [],
          animationClips: customConfig?.animationClips || [],
          activeClipIndex: 0,
          animationSpeed: 1,
          castFloorShadow: true,
          ambientIntensity: 0.75,
          directionalIntensity: 1.5,
        };
      }

      if (customConfig?.is3dText) {
        newLayer.is3D = true;
        newLayer.fixedIn3D = false;
        newLayer.mesh3dConfig = {
          enabled: true,
          type: 'extrusion',
          depth: customConfig?.depth ?? 45,
          bevel: customConfig?.bevel ?? 5,
          material: customConfig?.material || 'gold',
          roughness: 0.2,
          metalness: 0.85,
          specular: 1.4,
          lightAngle: 45,
          lightElevation: 35,
          ambientIntensity: 0.45,
          diffuseIntensity: 0.8,
          castFloorShadow: true,
          castFloorReflection: false,
        };
      }

      if (customConfig?.mesh3dConfig) {
        newLayer.mesh3dConfig = { ...newLayer.mesh3dConfig, ...customConfig.mesh3dConfig };
      }
      if (customConfig?.is3D !== undefined) {
        newLayer.is3D = customConfig.is3D;
      }
      if (customConfig?.fixedIn3D !== undefined) {
        newLayer.fixedIn3D = customConfig.fixedIn3D;
      }

      let updatedLayers = [...prev.layers];
      if (customConfig?.parentForLayerId) {
        updatedLayers = updatedLayers.map((l) =>
          l.id === customConfig.parentForLayerId ? { ...l, parentId: id } : l
        );
      }

      const maxDuration = Math.max(prev.settings.durationFrames, layerDuration);
      const newProject = {
        ...prev,
        settings: {
          ...prev.settings,
          durationFrames: maxDuration,
        },
        layers: [...updatedLayers, newLayer],
        selectedLayerId: id,
      };
      pushHistoryDebounced(newProject);
      return newProject;
    });

    setShowInspector(true);
    setInspectorSubView('menu');
    setShowAddModal(false);
    return id;
  };

  const handleUpdateLayerDuration = (layerId: string, durationSeconds: number) => {
    if (!guardCollabEdit()) return;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    setProject((prev) => {
      const fps = prev.settings.fps || 30;
      const targetFrames = Math.max(1, Math.round(durationSeconds * fps));
      let found = false;
      const updatedLayers = prev.layers.map((l) => {
        if (l.id !== layerId) return l;
        found = true;
        return { ...l, durationFrames: targetFrames };
      });
      if (!found) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          durationFrames: Math.max(prev.settings.durationFrames, targetFrames),
        },
        layers: updatedLayers,
      };
    });
  };

  const handleAddDualNullRig = (targetLayerId?: string) => {
    if (!guardCollabEdit()) return;
    const idNull1 = `layer-null1-${Date.now()}`;
    const idNull2 = `layer-null2-${Date.now() + 1}`;
    const duration = project.settings.durationFrames || 90;
    const cx = project.settings.width / 2;
    const cy = project.settings.height / 2;

    const null2: Layer = {
      id: idNull2,
      name: lang === 'ar' ? '🚀 Null 2 (موضع وانتقال)' : '🚀 Null 2 (Global Pan)',
      type: 'null',
      visible: true,
      locked: false,
      color: '#F59E0B',
      startFrame: 0,
      durationFrames: duration,
      blendMode: 'normal',
      effects: [],
      transform: {
        position: {
          value: { x: cx, y: cy, z: 0 },
          keyframes: [
            {
              id: `kf-n2-pos-0`,
              frame: 0,
              value: { x: cx, y: cy, z: 0 },
              easing: 'bezier',
              bezierHandle: { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 },
            },
          ],
        },
        scale: {
          value: { x: 100, y: 100, z: 100 },
          keyframes: [],
        },
        rotation: {
          value: { x: 0, y: 0, z: 0 },
          keyframes: [],
        },
        opacity: {
          value: 100,
          keyframes: [],
        },
        anchorPoint: {
          value: { x: 0, y: 0, z: 0 },
          keyframes: [],
        },
      },
    };

    const null1: Layer = {
      id: idNull1,
      name: lang === 'ar' ? '🎯 Null 1 (حركة فرعية/دوران وتكبير)' : '🎯 Null 1 (Local Zoom/Spin)',
      type: 'null',
      visible: true,
      locked: false,
      color: '#A855F7',
      startFrame: 0,
      durationFrames: duration,
      parentId: idNull2, // Null 1 is linked to Null 2
      blendMode: 'normal',
      effects: [],
      transform: {
        position: {
          value: { x: cx, y: cy, z: 0 },
          keyframes: [],
        },
        scale: {
          value: { x: 100, y: 100, z: 100 },
          keyframes: [],
        },
        rotation: {
          value: { x: 0, y: 0, z: 0 },
          keyframes: [],
        },
        opacity: {
          value: 100,
          keyframes: [],
        },
        anchorPoint: {
          value: { x: 0, y: 0, z: 0 },
          keyframes: [],
        },
      },
    };

    let updatedLayers = [...project.layers];
    if (targetLayerId) {
      updatedLayers = updatedLayers.map((l) =>
        l.id === targetLayerId ? { ...l, parentId: idNull1 } : l
      );
    }

    const newProject = {
      ...project,
      layers: [...updatedLayers, null2, null1],
      selectedLayerId: idNull1,
    };
    setProject(newProject);
    setShowInspector(true);
    pushHistoryImmediate(newProject);
  };

  const handleDeleteLayer = (id: string) => {
    if (!guardCollabEdit()) return;
    const newLayers = project.layers.filter((l) => l.id !== id);
    const wasSelected = project.selectedLayerId === id;
    const newProject = {
      ...project,
      layers: newLayers,
      selectedLayerId: wasSelected ? null : project.selectedLayerId,
    };
    setProject(newProject);
    if (wasSelected) {
      setShowInspector(false);
    }
    pushHistoryImmediate(newProject);
  };

  const handleDuplicateLayer = (id: string) => {
    if (!guardCollabEdit()) return;
    const layerToDup = project.layers.find((l) => l.id === id);
    if (!layerToDup) return;
    const copy: Layer = JSON.parse(JSON.stringify(layerToDup));
    copy.id = `layer-${Date.now()}`;
    copy.name = `${layerToDup.name} (Copy)`;
    copy.transform.position.value.x += 20;
    copy.transform.position.value.y += 20;

    const newProject = {
      ...project,
      layers: [...project.layers, copy],
      selectedLayerId: copy.id,
    };
    setProject(newProject);
    setShowInspector(true);
    setInspectorSubView('menu');
    pushHistoryImmediate(newProject);
  };

  const handleAddKeyframe = (layerId: string, propertyPath: string) => {
    if (!guardCollabEdit()) return;
    const copyLayers: Layer[] = JSON.parse(JSON.stringify(project.layers));
    const target = copyLayers.find((l) => l.id === layerId);
    if (!target) return;

    const relFrame = project.currentFrame - target.startFrame;

    let targetProp: any = null;
    if (propertyPath === 'transform.position') targetProp = target.transform.position;
    else if (propertyPath === 'transform.scale') targetProp = target.transform.scale;
    else if (propertyPath === 'transform.rotation') targetProp = target.transform.rotation;
    else if (propertyPath === 'transform.opacity') targetProp = target.transform.opacity;

    if (targetProp) {
      if (!targetProp.keyframes) targetProp.keyframes = [];
      const existingIdx = targetProp.keyframes.findIndex((k: any) => Math.abs(k.frame - relFrame) < 0.5);
      if (existingIdx >= 0) {
        // Toggle off if keyframe exists at current frame
        targetProp.keyframes.splice(existingIdx, 1);
      } else {
        // Evaluate the exact current value at project.currentFrame
        const currentVal = evaluateProperty(targetProp, project.currentFrame, project.settings.fps, target.startFrame);
        const valToStore = JSON.parse(JSON.stringify(currentVal ?? targetProp.value));
        targetProp.value = JSON.parse(JSON.stringify(valToStore));

        // If property had no keyframes and we are at frame > 0, also seed keyframe 0 with initial state
        if (targetProp.keyframes.length === 0 && relFrame > 0) {
          const initialValAt0 = evaluateProperty(targetProp, target.startFrame, project.settings.fps, target.startFrame);
          targetProp.keyframes.push({
            id: `kf-${Date.now()}-0`,
            frame: 0,
            value: JSON.parse(JSON.stringify(initialValAt0 ?? targetProp.value)),
            easing: 'linear',
          });
        }

        // Add new keyframe with linear (normal/regular) easing by default
        targetProp.keyframes.push({
          id: `kf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          frame: relFrame,
          value: valToStore,
          easing: 'linear',
        });
        targetProp.keyframes.sort((a: any, b: any) => a.frame - b.frame);
      }
    }

    const newProject = { ...project, layers: copyLayers };
    setProject(newProject);
    pushHistoryImmediate(newProject);
  };

  const handleSplitLayer = (layerId: string, currentFrame?: number) => {
    if (!guardCollabEdit()) return;
    const target = project.layers.find((l) => l.id === layerId);
    if (!target) return;

    const currentF = currentFrame !== undefined ? currentFrame : project.currentFrame;
    if (currentF <= target.startFrame || currentF >= target.startFrame + target.durationFrames) return;

    const copy1: Layer = JSON.parse(JSON.stringify(target));
    const copy2: Layer = JSON.parse(JSON.stringify(target));

    const splitOffset = currentF - target.startFrame;
    const originalEnd = target.startFrame + target.durationFrames;

    // Part 1: from target.startFrame to currentF (duration reduced)
    copy1.durationFrames = splitOffset;

    const filterPart1Keyframes = (prop: any) => {
      if (prop && Array.isArray(prop.keyframes)) {
        prop.keyframes = prop.keyframes.filter((k: any) => k.frame <= splitOffset);
      }
    };
    filterPart1Keyframes(copy1.transform.position);
    filterPart1Keyframes(copy1.transform.scale);
    filterPart1Keyframes(copy1.transform.rotation);
    filterPart1Keyframes(copy1.transform.opacity);

    // Part 2: from currentF to originalEnd
    copy2.id = `layer-${Date.now()}`;
    copy2.name = `${target.name} (Part 2)`;
    copy2.startFrame = currentF;
    copy2.durationFrames = originalEnd - currentF;

    const shiftPart2Keyframes = (prop: any) => {
      if (prop && Array.isArray(prop.keyframes)) {
        prop.keyframes = prop.keyframes
          .map((k: any) => ({ ...k, frame: k.frame - splitOffset }))
          .filter((k: any) => k.frame >= 0 && k.frame <= copy2.durationFrames);
      }
    };
    shiftPart2Keyframes(copy2.transform.position);
    shiftPart2Keyframes(copy2.transform.scale);
    shiftPart2Keyframes(copy2.transform.rotation);
    shiftPart2Keyframes(copy2.transform.opacity);

    const newLayers = project.layers.map((l) => (l.id === layerId ? copy1 : l));
    newLayers.push(copy2);

    const newProject = { ...project, layers: newLayers, selectedLayerId: copy2.id };
    setProject(newProject);
    setShowInspector(true);
    setInspectorSubView('menu');
    pushHistoryImmediate(newProject);
  };

  const handleTrimStart = (layerId: string, currentFrame: number) => {
    if (!guardCollabEdit()) return;
    const copyLayers: Layer[] = JSON.parse(JSON.stringify(project.layers));
    const target = copyLayers.find((l) => l.id === layerId);
    if (!target) return;

    const originalStart = target.startFrame;
    const originalEnd = target.startFrame + target.durationFrames;

    if (currentFrame > originalStart && currentFrame < originalEnd) {
      const diff = currentFrame - originalStart;
      target.startFrame = currentFrame;
      target.durationFrames = originalEnd - currentFrame;

      // Adjust relative keyframes so their absolute time in project is preserved
      const shiftKeyframes = (prop: any) => {
        if (prop && Array.isArray(prop.keyframes)) {
          prop.keyframes = prop.keyframes
            .map((k: any) => ({ ...k, frame: k.frame - diff }))
            .filter((k: any) => k.frame >= 0 && k.frame <= target.durationFrames);
        }
      };

      shiftKeyframes(target.transform.position);
      shiftKeyframes(target.transform.scale);
      shiftKeyframes(target.transform.rotation);
      shiftKeyframes(target.transform.opacity);

      const maxLayerEnd = Math.max(...copyLayers.map((l) => l.startFrame + l.durationFrames), 1);
      const newSettings = {
        ...project.settings,
        durationFrames: Math.max(maxLayerEnd, 15),
      };

      const newProject = {
        ...project,
        layers: copyLayers,
        settings: newSettings,
        currentFrame: target.startFrame,
        isPlaying: false,
      };
      setProject(newProject);
      pushHistoryImmediate(newProject);
    }
  };

  const handleTrimEnd = (layerId: string, currentFrame: number) => {
    if (!guardCollabEdit()) return;
    const copyLayers: Layer[] = JSON.parse(JSON.stringify(project.layers));
    const target = copyLayers.find((l) => l.id === layerId);
    if (!target) return;

    const originalStart = target.startFrame;
    const originalEnd = target.startFrame + target.durationFrames;

    if (currentFrame > originalStart && currentFrame < originalEnd) {
      const newDuration = currentFrame - originalStart;
      target.durationFrames = newDuration;

      // Filter out keyframes beyond new duration
      const filterKeyframes = (prop: any) => {
        if (prop && Array.isArray(prop.keyframes)) {
          prop.keyframes = prop.keyframes.filter((k: any) => k.frame <= newDuration);
        }
      };

      filterKeyframes(target.transform.position);
      filterKeyframes(target.transform.scale);
      filterKeyframes(target.transform.rotation);
      filterKeyframes(target.transform.opacity);

      // Recalculate duration of project to match trimmed content without dead void
      const maxLayerEnd = Math.max(...copyLayers.map((l) => l.startFrame + l.durationFrames), 1);
      const newSettings = {
        ...project.settings,
        durationFrames: Math.max(maxLayerEnd, 15),
      };

      const newProject = {
        ...project,
        layers: copyLayers,
        settings: newSettings,
        currentFrame: Math.min(project.currentFrame, maxLayerEnd),
        isPlaying: false, // Stop/pause playback when trimmed
      };
      setProject(newProject);
      pushHistoryImmediate(newProject);
    }
  };

  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.name.toLowerCase().endsWith('.sq')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedProject: Project = JSON.parse(event.target?.result as string);
        if (!loadedProject || !loadedProject.settings || !Array.isArray(loadedProject.layers)) {
          throw new Error('Invalid .sq project');
        }
        undoStackRef.current.reset();
        lastCommittedStateRef.current = {
          layers: JSON.parse(JSON.stringify(loadedProject.layers)),
          settings: JSON.parse(JSON.stringify(loadedProject.settings)),
        };
        setProject(loadedProject);
        setHistoryTick((t) => t + 1);
        setViewMode('editor');
      } catch (err) {
        console.error('Invalid .sq project file:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleCreateNewProject = (settings: {
    name: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    backgroundColor: string;
  }) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      settings: {
        name: settings.name?.trim() || getNextProjectName(savedProjects, lang),
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        durationFrames: settings.fps * (settings.duration || 5),
        backgroundColor: settings.backgroundColor,
      },
      layers: [],
      currentFrame: 0,
      isPlaying: false,
      selectedLayerId: null,
      zoomLevel: 1,
      activeTab: 'properties',
      updatedAt: Date.now(),
    };
    const updated = [newProj, ...savedProjects.filter((p) => p.id !== newProj.id)];
    persistProjectsList(updated);
    undoStackRef.current.reset();
    lastCommittedStateRef.current = {
      layers: [],
      settings: JSON.parse(JSON.stringify(newProj.settings)),
    };
    setProject(newProj);
    setHistoryTick((t) => t + 1);
    setViewMode('editor');
  };

  const handleOpenProject = (proj: Project) => {
    // Open project exactly from where user left off
    const loadedProj: Project = {
      ...proj,
      isPlaying: false,
      selectedLayerId: null,
      updatedAt: Date.now(),
    };
    undoStackRef.current.reset();
    lastCommittedStateRef.current = {
      layers: JSON.parse(JSON.stringify(loadedProj.layers)),
      settings: JSON.parse(JSON.stringify(loadedProj.settings)),
    };
    setProject(loadedProj);
    setHistoryTick((t) => t + 1);
    setViewMode('editor');
  };

  const handleDeleteProject = (projectId: string) => {
    const remaining = savedProjects.filter((p) => p.id !== projectId);
    persistProjectsList(remaining);
    if (auth?.currentUser) {
      deleteProjectFromCloud(projectId).catch(() => {});
    }
    if (project.id === projectId) {
      if (remaining.length > 0) {
        setProject({
          ...remaining[0],
          isPlaying: false,
          selectedLayerId: null,
        });
      } else {
        const starter: Project = {
          ...STARTER_TEMPLATES[0].project,
          id: `proj-${Date.now()}`,
          settings: {
            ...STARTER_TEMPLATES[0].project.settings,
            name: getNextProjectName([], lang),
          },
          layers: [],
          updatedAt: Date.now(),
          selectedLayerId: null,
        };
        setProject(starter);
      }
      setViewMode('home');
    }
  };

  const handleDuplicateProject = (proj: Project) => {
    const duplicated: Project = {
      ...JSON.parse(JSON.stringify(proj)),
      id: `proj-${Date.now()}`,
      settings: {
        ...proj.settings,
        name: `${proj.settings.name} (${lang === 'ar' ? 'نسخة' : 'Copy'})`,
      },
      updatedAt: Date.now(),
    };
    const updated = [duplicated, ...savedProjects];
    persistProjectsList(updated);
  };

  const handleImportProject = (importedProj: Project) => {
    const updated = [importedProj, ...savedProjects.filter((p) => p.id !== importedProj.id)];
    persistProjectsList(updated);
    undoStackRef.current.reset();
    lastCommittedStateRef.current = {
      layers: JSON.parse(JSON.stringify(importedProj.layers)),
      settings: JSON.parse(JSON.stringify(importedProj.settings)),
    };
    setProject(importedProj);
    setHistoryTick((t) => t + 1);
    setViewMode('editor');
  };

  // ==================== SYSTEM 03: LAYER GROUP HANDLERS ====================
  const handleGroupSelected = () => {
    if (!guardCollabEdit()) return;
    const ids =
      multiSelectedIds.length > 0
        ? multiSelectedIds
        : project.selectedLayerId
        ? [project.selectedLayerId]
        : [];
    if (ids.length === 0) {
      showNotice(lang === 'ar' ? 'حدد طبقة أو أكثر (Shift+Click) للتجميع' : 'Select one or more layers (Shift+Click) to group');
      return;
    }
    const { layers: nextLayers, groupLayer } = createGroupFromLayers(project.layers, ids, {
      name: lang === 'ar' ? `مجموعة (${ids.length})` : `Group (${ids.length})`,
      color: '#38BDF8',
      canvasWidth: project.settings.width,
      canvasHeight: project.settings.height,
    });
    const nextProj: Project = {
      ...project,
      layers: nextLayers,
      selectedLayerId: groupLayer.id,
    };
    setProject(nextProj);
    setMultiSelectedIds([]);
    setShowInspector(true);
    pushHistoryImmediate(nextProj, lang === 'ar' ? 'إنشاء مجموعة طبقات' : 'Create Layer Group');
    showNotice(lang === 'ar' ? `تم تجميع ${ids.length} طبقة في ${groupLayer.name}` : `Grouped ${ids.length} layer(s)`);
  };

  const handleGroupAction = (action: 'ungroup' | 'select_children' | 'duplicate_group' | 'delete_with_children') => {
    const sel = project.layers.find((l) => l.id === project.selectedLayerId);
    if (!sel || sel.type !== 'group') return;

    if (action === 'select_children') {
      const descendants = getDescendantLayerIds(sel.id, project.layers);
      setMultiSelectedIds(descendants);
      return;
    }
    if (!guardCollabEdit()) return;
    if (action === 'ungroup') {
      const nextLayers = ungroupLayer(project.layers, sel.id);
      const nextProj: Project = { ...project, layers: nextLayers, selectedLayerId: null };
      setProject(nextProj);
      setShowInspector(false);
      pushHistoryImmediate(nextProj, lang === 'ar' ? 'فك المجموعة' : 'Ungroup Layers');
      return;
    }
    if (action === 'duplicate_group') {
      const { layers: nextLayers, newGroupId } = duplicateGroupDeep(project.layers, sel.id, lang === 'ar' ? 'نسخة' : 'Copy');
      const nextProj: Project = { ...project, layers: nextLayers, selectedLayerId: newGroupId };
      setProject(nextProj);
      pushHistoryImmediate(nextProj, lang === 'ar' ? 'تكرار المجموعة' : 'Duplicate Group');
      return;
    }
    if (action === 'delete_with_children') {
      const nextLayers = deleteGroup(project.layers, sel.id, true);
      const nextProj: Project = { ...project, layers: nextLayers, selectedLayerId: null };
      setProject(nextProj);
      setShowInspector(false);
      pushHistoryImmediate(nextProj, lang === 'ar' ? 'حذف المجموعة ومحتوياتها' : 'Delete Group & Contents');
    }
  };

  // ==================== SYSTEM 02: COPY & PASTE PROPERTIES ====================
  const handlePasteProperties = (
    bundle: CopiedPropertiesBundle,
    targetLayerIds: string[],
    mode: PropertyTransferMode
  ) => {
    if (!guardCollabEdit()) return;
    if (targetLayerIds.length === 0) return;
    const idSet = new Set(targetLayerIds);
    const nextLayers = project.layers.map((layer) =>
      idSet.has(layer.id) ? applyPropertiesToLayer(layer, bundle, mode) : layer
    );
    const nextProj: Project = { ...project, layers: nextLayers };
    setProject(nextProj);
    pushHistoryImmediate(nextProj, lang === 'ar' ? 'لصق خصائص الطبقة' : 'Paste Layer Properties');
    showNotice(
      lang === 'ar'
        ? `تم لصق الخصائص على ${targetLayerIds.length} طبقة`
        : `Pasted properties onto ${targetLayerIds.length} layer(s)`
    );
  };

  // ==================== SYSTEM 01: VERSION RECOVERY ====================
  const handleRecoverFromVersion = async (version: ProjectVersion, target: RecoveryTarget) => {
    if (!guardCollabEdit()) return;
    const curState: FrameHistoryState = {
      layers: JSON.parse(JSON.stringify(project.layers)),
      settings: JSON.parse(JSON.stringify(project.settings)),
    };
    // Automatic safety backup before destructive recovery
    await createProjectVersion({
      projectId: project.id,
      state: curState,
      name: `${lang === 'ar' ? 'نسخة أمان قبل الاستعادة' : 'Pre-Restore Backup'} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      description: `Backup created before restoring "${version.name}"`,
      isAuto: true,
      maxUnpinned: maxUnpinnedVersions,
    });

    const recoveredState = await applyVersionRecovery(curState, version, target);
    const nextProj: Project = {
      ...project,
      layers: recoveredState.layers,
      settings: recoveredState.settings,
      selectedLayerId: null,
    };
    setProject(nextProj);
    setShowInspector(false);
    pushHistoryImmediate(nextProj, lang === 'ar' ? `استعادة: ${version.name}` : `Restore: ${version.name}`);
    const latestVersions = await listProjectVersions(project.id);
    setVersions(latestVersions);
    showNotice(lang === 'ar' ? `تمت الاستعادة من "${version.name}" (مع نسخة أمان)` : `Restored from "${version.name}"`);
  };

  // ==================== SYSTEM 04: FAVORITES APPLY ====================
  const handleApplyFavoriteItem = (item: FavoriteItem) => {
    const nextFav = recordFavoriteUsage(favoritesState, item.id);
    saveFavoritesState(nextFav, cloudUser?.uid);
    setFavoritesState(nextFav);
    if (auth?.currentUser) syncFavoritesToCloud(nextFav).catch(() => {});

    const selected = project.layers.find((l) => l.id === project.selectedLayerId);

    if (item.type === 'effect' || item.type === 'lut') {
      if (!selected) {
        showNotice(lang === 'ar' ? 'حدد طبقة أولاً لتطبيق التأثير' : 'Select a layer first to apply effect');
        return;
      }
      const effectType = String(item.payload?.effectType || item.refId);
      const effDef = ALIGHT_EFFECTS_FULL_CATALOG.find((x) => x.id === effectType);
      const nextLayer: Layer = {
        ...JSON.parse(JSON.stringify(selected)),
        effects: [
          ...(selected.effects || []),
          {
            id: `eff-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: effectType as any,
            name: lang === 'ar' ? (item.titleAr || effDef?.nameAr || item.title) : (effDef?.nameEn || item.title),
            enabled: true,
            params: { ...(effDef?.defaultParams || {}), ...((item.payload?.params as Record<string, unknown>) || {}) },
          },
        ],
      };
      handleUpdateLayer(nextLayer, true);
      showNotice(lang === 'ar' ? `تمت إضافة تأثير: ${item.titleAr || item.title}` : `Applied effect: ${item.title}`);
      return;
    }

    if (item.type === 'preset' || item.type === 'animation' || item.type === 'transition') {
      if (!selected) {
        showNotice(lang === 'ar' ? 'حدد طبقة أولاً لتطبيق الحركة' : 'Select a layer first to apply preset');
        return;
      }
      if (item.payload?.bundle) {
        handlePasteProperties(item.payload.bundle as CopiedPropertiesBundle, [selected.id], 'replace');
        return;
      }
      const presetId = String(item.payload?.presetId || item.refId);
      const preset = MOTION_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        const updated = preset.apply(selected);
        handleUpdateLayer(updated, true);
        showNotice(lang === 'ar' ? `تم تطبيق: ${preset.nameAr}` : `Applied: ${preset.name}`);
      }
      return;
    }

    if (item.type === 'easing') {
      const handle = (item.payload?.bezierHandle as any) || { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 };
      const easing = (item.payload?.easing as any) || 'bezier';
      copyCurveToClipboard(handle, easing, item.title);
      showNotice(lang === 'ar' ? `تم نسخ المنحنى "${item.title}" للحافظة` : `Copied curve "${item.title}" to clipboard`);
      return;
    }

    if (item.type === 'font') {
      const fontFamily = String(item.payload?.fontFamily || item.refId || 'Cairo');
      if (selected && selected.type === 'text' && selected.textConfig) {
        const nextLayer: Layer = {
          ...JSON.parse(JSON.stringify(selected)),
          textConfig: {
            ...selected.textConfig,
            fontFamily,
          },
        };
        handleUpdateLayer(nextLayer, true);
      } else {
        handleAddLayer('text', {
          name: lang === 'ar' ? item.titleAr || item.title : item.title,
          textConfig: {
            text: lang === 'ar' ? 'عنوان مفضل' : 'Favorite Title',
            fontSize: 64,
            fontFamily,
            fill: '#ffffff',
            stroke: '#00E676',
            strokeWidth: 0,
            letterSpacing: 0,
            lineHeight: 1.2,
            align: 'center',
          },
        });
      }
      return;
    }

    if (item.type === 'palette') {
      if (!selected) {
        showNotice(lang === 'ar' ? 'حدد طبقة لتطبيق لوحة الألوان' : 'Select a layer to apply color palette');
        return;
      }
      const fill = String(item.payload?.fill || '#FF4D6D');
      const stroke = String(item.payload?.stroke || '#F59E0B');
      const nextLayer: Layer = JSON.parse(JSON.stringify(selected));
      if (nextLayer.type === 'text' && nextLayer.textConfig) {
        nextLayer.textConfig.fill = fill;
        nextLayer.textConfig.stroke = stroke;
      } else if (nextLayer.type === 'vector' && nextLayer.vectorConfig) {
        nextLayer.vectorConfig.fill = fill;
        nextLayer.vectorConfig.stroke = stroke;
      } else if (nextLayer.type === 'solid') {
        nextLayer.solidColor = fill;
      }
      handleUpdateLayer(nextLayer, true);
      showNotice(lang === 'ar' ? `تم تطبيق لوحة الألوان: ${item.titleAr || item.title}` : `Applied palette: ${item.title}`);
      return;
    }

    if (item.type === 'shape' || item.type === 'sticker' || item.type === 'brush') {
      handleAddLayer('vector', {
        name: lang === 'ar' ? item.titleAr || item.title : item.title,
        vectorConfig: {
          type: (item.payload?.shapeType as string) || 'star',
          fill: (item.payload?.fill as string) || '#00E676',
          stroke: '#00FF87',
          strokeWidth: 4,
          width: 340,
          height: 340,
          ...(item.payload as any),
        },
      });
      return;
    }

    if (item.type === 'template') {
      const tmplId = String(item.payload?.templateId || item.refId);
      const foundTmpl = STARTER_TEMPLATES.find((t) => t.id === tmplId);
      if (foundTmpl) {
        const cloned = JSON.parse(JSON.stringify(foundTmpl.project)) as Project;
        setProject({ ...cloned, id: project.id, selectedLayerId: null });
        pushHistoryImmediate(cloned, `Template: ${foundTmpl.name}`);
      }
      return;
    }
  };

  // Global Editor Keyboard Shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+K, Ctrl+G, Ctrl+Shift+G, Ctrl+Shift+C)
  useEffect(() => {
    if (viewMode !== 'editor') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((v) => !v);
        return;
      }
      if (inInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) handleGroupAction('ungroup');
        else handleGroupSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        if (projectRef.current.selectedLayerId) {
          e.preventDefault();
          setShowCopyPasteModal(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, project.layers, project.selectedLayerId, multiSelectedIds]);

  if (!authReady) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="h-[100dvh] w-screen bg-[#05060A] flex flex-col items-center justify-center gap-3 text-slate-300 font-['Cairo',sans-serif]">
          <Loader2 className="w-7 h-7 animate-spin text-[#8B5CF6]" />
          <span className="text-xs font-bold">
            {lang === 'ar' ? 'جاري التحقق من حماية حسابك...' : 'Verifying protected session...'}
          </span>
        </div>
      </MotionConfig>
    );
  }

  if (!cloudUser) {
    return (
      <MotionConfig reducedMotion="user">
        <WelcomeAuthGate lang={lang} onSetLang={setLang} />
      </MotionConfig>
    );
  }

  // Render Authenticated & Protected Workspace inside SocialProvider
  return (
    <MotionConfig reducedMotion="user">
      <SocialProvider user={cloudUser} lang={lang}>
        <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#05060A]">
        <LiveNotificationBanner
          lang={lang}
          onOpenDmChat={handleOpenDmFromNotif}
          onOpenRoomChat={handleOpenRoomFromNotif}
          onOpenVideos={handleOpenVideosFromNotif}
        />
        <AnimatePresence initial={false}>
          {viewMode === 'home' ? (
            <motion.div
              key="view-home"
              variants={viewTransitionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`fixed inset-0 h-[100dvh] w-screen overflow-hidden gpu-layer ${viewMode === 'home' ? 'z-20' : 'z-10'}`}
            >
              <HomeWithNotifications
                lang={lang}
                onSetLang={setLang}
                onOpenProject={handleOpenProject}
                onCreateNewProject={handleCreateNewProject}
                onImportProject={handleImportProject}
                savedProjects={savedProjects}
                onDeleteProject={handleDeleteProject}
                onDuplicateProject={handleDuplicateProject}
                cloudUser={cloudUser}
                onOpenNotifications={() => setShowNotificationsModal(true)}
                onOpenCloudSync={() => setShowCloudModal(true)}
                onOpenProfile={() => setShowProfileModal(true)}
                onOpenSocial={(tab) => {
                  setSocialTargetDmId(null);
                  setSocialTargetRoomId(null);
                  setSocialInitialTab(tab || 'videos');
                  setShowSocialModal(true);
                }}
              />
            </motion.div>
          ) : (
          <motion.div
            key="view-editor"
            variants={viewTransitionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`fixed inset-0 h-[100dvh] w-screen flex flex-col bg-[#161719] font-sans antialiased text-slate-100 overflow-hidden gpu-layer ${
              viewMode !== 'home' ? 'z-20' : 'z-10'
            } ${
              lang === 'ar' ? 'rtl' : 'ltr'
            }`}
          >
          {/* Audio & Video Sound Synchronization Manager */}
          <MediaSyncManager project={project} />

      {/* Top Header matching Alight Motion top bar */}
      <Header
        project={project}
        lang={lang}
        onSetLang={setLang}
        onTogglePlay={() =>
          setProject((prev) => {
            const maxLayerEnd =
              prev.layers.length > 0
                ? Math.max(...prev.layers.map((l) => l.startFrame + l.durationFrames))
                : prev.settings.durationFrames;
            const boundary = Math.max(1, Math.min(prev.settings.durationFrames, maxLayerEnd));
            let nextFrame = prev.currentFrame;
            if (!prev.isPlaying && prev.currentFrame >= boundary - 1) {
              nextFrame = 0;
            }
            return {
              ...prev,
              isPlaying: !prev.isPlaying,
              currentFrame: nextFrame,
            };
          })
        }
        onRewind={() => setProject({ ...project, currentFrame: 0 })}
        onOpenExport={() => setShowExportModal(true)}
        onOpenTemplates={() => setShowTemplateModal(true)}
        onSaveJSON={() => downloadProjectSQ(project)}
        onLoadJSON={handleLoadJSON}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddLayer={handleAddLayer}
        onUpdateLayer={handleUpdateLayer}
        onOpenAddModal={() => setShowAddModal(true)}
        onUpdateSettings={(newSettings) => {
          const prevProj = projectRef.current;
          const nextFps = Math.max(1, Number(newSettings.fps) || prevProj.settings.fps || 60);
          const fpsChanged = nextFps !== prevProj.settings.fps;
          const nextProj = fpsChanged
            ? retimeProjectForFps(prevProj, nextFps, newSettings)
            : { ...prevProj, settings: newSettings };
          projectRef.current = nextProj;
          setProject(nextProj);
          pushHistoryDebounced(nextProj, 'project-settings');
          if (collab.workspace && !isRemoteUpdateRef.current) {
            if (fpsChanged) {
              collab.broadcastOp({
                kind: 'project:sync',
                layers: nextProj.layers,
                settings: nextProj.settings,
                summary: `Project FPS changed to ${nextProj.settings.fps}`,
              });
            } else {
              collab.broadcastOp({
                kind: 'settings:update',
                settings: nextProj.settings,
                summary: 'Project settings updated',
              });
            }
          }
        }}
        onToggleInspector={() => setShowInspector(!showInspector)}
        showInspector={showInspector}
        onSelectLayer={(id) => {
          setProject((prev) => ({ ...prev, selectedLayerId: id }));
          setShowInspector(!!id);
        }}
        onDeleteLayer={handleDeleteLayer}
        onDuplicateLayer={handleDuplicateLayer}
        onBackToHome={() => {
          syncProjectToStorageSilent(project);
          setSavedProjects([...savedProjectsRef.current]);
          setViewMode('home');
        }}
        onDeleteProject={() => handleDeleteProject(project.id)}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onToggleQuickAccess={() => setShowQuickAccess((v) => !v)}
        isQuickAccessOpen={showQuickAccess}
        onOpenCollab={() => setShowCollabModal(true)}
        collabOnlineCount={collab.workspace?.members.filter((m) => m.isOnline).length || 0}
        collabSyncStatus={
          collab.syncStatus === 'synced'
            ? 'synced'
            : collab.syncStatus === 'syncing'
            ? 'syncing'
            : collab.syncStatus === 'connecting'
            ? 'connecting'
            : collab.syncStatus === 'error'
            ? 'error'
            : 'offline'
        }
        onOpenCopyPasteProps={() => setShowCopyPasteModal(true)}
        cloudUser={cloudUser}
        onOpenCloudSync={() => setShowCloudModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSocial={() => setShowSocialModal(true)}
      />

      {/* Global Toast Notice */}
      <AnimatePresence>
        {appToast && (
          <motion.div
            key="app-global-toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-[120] px-3.5 py-1.5 rounded-full bg-[#12141B]/95 border border-[var(--app-accent-border)] text-[var(--app-accent-bright)] text-xs font-bold shadow-xl pointer-events-none"
          >
            {appToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Canvas Center */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <CanvasViewport
          project={project}
          lang={lang}
          onSelectLayer={(id) => {
            setProject((prev) => ({ ...prev, selectedLayerId: id }));
            setShowInspector(!!id);
          }}
          onUpdateLayerTransform={handleUpdateLayerTransform}
          onUpdateLayer={handleUpdateLayer}
          onOpenAddModal={() => setShowAddModal(true)}
          onAddLayer={handleAddLayer}
          onChangeCameraViewMode={(mode) =>
            setProject((prev) => ({ ...prev, cameraViewMode: mode }))
          }
          onUpdateOrbitSettings={(orbit) =>
            setProject((prev) => ({ ...prev, orbitSettings: orbit }))
          }
          onChangeAspectRatio={(width, height) =>
            setProject((prev) => ({
              ...prev,
              settings: { ...prev.settings, width, height },
            }))
          }
          isSideToolsOpen={isSideToolsOpen}
          onToggleSideTools={() => setIsSideToolsOpen(!isSideToolsOpen)}
          collabMembers={collab.workspace?.members || []}
          localMemberId={collab.localMemberId}
        />

        {/* Quick Access Slide-Over Favorites Panel (System 04) */}
        <QuickAccessPanel
          isOpen={showQuickAccess}
          onClose={() => setShowQuickAccess(false)}
          lang={lang}
          favorites={favoritesState}
          onUpdateFavorites={(next) => {
            saveFavoritesState(next, cloudUser?.uid);
            setFavoritesState(next);
            if (auth?.currentUser) syncFavoritesToCloud(next).catch(() => {});
          }}
          selectedLayer={project.layers.find((l) => l.id === project.selectedLayerId) || null}
          onApplyFavoriteItem={handleApplyFavoriteItem}
          onOpenQuickTool={(tool) => {
            if (tool === 'search') setShowSearchModal(true);
            else if (tool === 'history') setShowHistoryModal(true);
            else if (tool === 'copy_props') setShowCopyPasteModal(true);
            else if (tool === 'collab') setShowCollabModal(true);
            else if (tool === 'group_selected') handleGroupSelected();
          }}
        />
      </div>

      {/* Bottom Timeline with Transport Controls & Emerald Playhead */}
      <Timeline
        project={project}
        lang={lang}
        onSelectLayer={(id) => {
          setProject((prev) => ({ ...prev, selectedLayerId: id }));
          setShowInspector(!!id);
        }}
        onSetCurrentFrame={(frame) => setProject((prev) => ({ ...prev, currentFrame: frame }))}
        onUpdateLayer={handleUpdateLayer}
        onUpdateLayers={handleUpdateLayers}
        onDeleteLayer={handleDeleteLayer}
        onDuplicateLayer={handleDuplicateLayer}
        onAddKeyframe={handleAddKeyframe}
        onDeleteKeyframe={() => {}}
        onSplitLayer={handleSplitLayer}
        onTrimStart={handleTrimStart}
        onTrimEnd={handleTrimEnd}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isSideToolsOpen={isSideToolsOpen}
        onToggleSideTools={() => setIsSideToolsOpen(!isSideToolsOpen)}
        showAddModal={showAddModal}
        onCloseAddModal={() => setShowAddModal(false)}
        onAddLayer={handleAddLayer}
        onOpenAddModal={() => setShowAddModal(true)}
        onOpenTemplates={() => setShowTemplateModal(true)}
        onTogglePlay={() => {
          setProject((prev) => {
            const maxLayerEnd = prev.layers.length > 0
              ? Math.max(...prev.layers.map((l) => l.startFrame + l.durationFrames))
              : prev.settings.durationFrames;
            const boundary = Math.max(1, Math.min(prev.settings.durationFrames, maxLayerEnd));

            let nextFrame = prev.currentFrame;
            if (!prev.isPlaying && prev.currentFrame >= boundary - 1) {
              nextFrame = 0;
            }
            return {
              ...prev,
              isPlaying: !prev.isPlaying,
              currentFrame: nextFrame,
            };
          });
        }}
        isSubViewOpen={Boolean(showInspector && project.selectedLayerId)}
        multiSelectedIds={multiSelectedIds}
        onToggleMultiSelect={(id) =>
          setMultiSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onClearMultiSelect={() => setMultiSelectedIds([])}
        onGroupSelected={handleGroupSelected}
        collabMembers={collab.workspace?.members || []}
        localMemberId={collab.localMemberId}
      />

      {/* Docked Matte Layer Toolbar Sheet */}
      <AnimatePresence>
        {showInspector && project.selectedLayerId && (
          <motion.div
            key="docked-inspector-sheet"
            initial={{ y: '100%', opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '100%', opacity: 0, scale: 0.98 }}
            transition={PANEL_SPRING}
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
            className={`absolute bottom-0 inset-x-0 bg-[#141517] border-t border-white/[0.1] shadow-[0_-15px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(var(--app-accent-rgb),0.06)] z-30 flex flex-col overflow-hidden gpu-layer ${
              project.activeTab === 'graph' || project.activeTab === 'presets' || inspectorSubView !== 'menu'
                ? 'h-[314px] sm:h-[330px] max-h-[45dvh]'
                : 'max-h-[214px]'
            }`}
          >
            <PanelRimSheen roundedClass="rounded-none" />
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative z-10">
              {project.activeTab === 'properties' && (
                <PropertyPanel
                  project={project}
                  lang={lang}
                  onUpdateLayer={handleUpdateLayer}
                  onAddKeyframe={handleAddKeyframe}
                  onSetCurrentFrame={(frame) => setProject({ ...project, currentFrame: frame })}
                  onOpenGraphEditor={() => setProject({ ...project, activeTab: 'graph' })}
                  onDeleteLayer={handleDeleteLayer}
                  onSplitLayer={handleSplitLayer}
                  onTrimStart={handleTrimStart}
                  onTrimEnd={handleTrimEnd}
                  onAddLayer={handleAddLayer}
                  onAddDualNull={handleAddDualNullRig}
                  onUpdateLayers={(updatedLayers) => {
                    const newProj = { ...project, layers: updatedLayers };
                    setProject(newProj);
                    pushHistoryImmediate(newProj);
                  }}
                  onSelectLayer={(id) => {
                    setProject((prev) => ({ ...prev, selectedLayerId: id }));
                    setShowInspector(!!id);
                  }}
                  onCloseInspector={() => {
                    setShowInspector(false);
                    setProject((prev) => ({ ...prev, selectedLayerId: null }));
                  }}
                  onSubViewChange={setInspectorSubView}
                  requestedSubView={requestedSubView}
                  onOpenCopyPasteProps={() => setShowCopyPasteModal(true)}
                  onGroupAction={handleGroupAction}
                />
              )}

              {project.activeTab === 'presets' && (
                <PresetLibrary project={project} lang={lang} onUpdateLayer={handleUpdateLayer} />
              )}

              {project.activeTab === 'graph' && (
                <GraphEditor project={project} lang={lang} onUpdateLayer={handleUpdateLayer} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Add Sheet matching Home Screen NewProjectModal animation & screenshot */}
      <AlightAddModal
        isOpen={showAddModal}
        lang={lang}
        onClose={() => setShowAddModal(false)}
        onAddLayer={handleAddLayer}
        onUpdateLayerDuration={handleUpdateLayerDuration}
        onOpenTemplates={() => setShowTemplateModal(true)}
      />

      {/* Floating Bottom-Right + / Mint-Green × FAB Button matching screenshot */}
      <AnimatePresence>
        {(!project.selectedLayerId || showAddModal) && (
          <motion.button
            key="editor-add-fab"
            type="button"
            initial={{ scale: 0.7, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 12 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 450, damping: 24 }}
            onClick={() => setShowAddModal(!showAddModal)}
            className={`fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 group cursor-pointer ${
              showAddModal
                ? 'bg-[var(--app-accent-bright)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] shadow-[0_6px_26px_rgba(var(--app-accent-bright-rgb),0.45)]'
                : 'bg-[#0B0E0D] hover:bg-[#14171D] text-white border-[2px] border-[var(--app-accent-solid)] shadow-[0_6px_22px_rgba(0,0,0,0.8),0_0_14px_rgba(var(--app-accent-rgb),0.25)]'
            }`}
            title={lang === 'ar' ? (showAddModal ? 'إغلاق القائمة' : 'إضافة عنصر') : (showAddModal ? 'Close' : 'Add Element')}
          >
            <motion.span
              animate={{ rotate: showAddModal ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="flex items-center justify-center leading-none"
            >
              <Plus className={`w-6 h-6 ${showAddModal ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            key="export-modal"
            project={project}
            lang={lang}
            appSettings={appSettings}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <TemplateModal
            key="template-modal"
            lang={lang}
            onSelectTemplate={(tmplProj) => {
              undoStackRef.current.reset();
              lastCommittedStateRef.current = {
                layers: JSON.parse(JSON.stringify(tmplProj.layers)),
                settings: JSON.parse(JSON.stringify(tmplProj.settings)),
              };
              setProject({ ...tmplProj, selectedLayerId: null });
              setHistoryTick((t) => t + 1);
              setShowInspector(false);
              setShowTemplateModal(false);
            }}
            onClose={() => setShowTemplateModal(false)}
          />
        )}
      </AnimatePresence>

      {/* SYSTEM 01: Project History & Version Control Modal */}
      <HistoryVersionsModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        lang={lang}
        currentState={{ layers: project.layers, settings: project.settings }}
        historyEntries={undoStackRef.current.entries}
        historyCursor={undoStackRef.current.cursor}
        versions={versions}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onJumpToHistoryCursor={handleJumpToHistoryCursor}
        onCreateVersion={async (name, description, pinned) => {
          await createProjectVersion({
            projectId: project.id,
            state: { layers: project.layers, settings: project.settings },
            name,
            description,
            isAuto: false,
            pinned,
            maxUnpinned: maxUnpinnedVersions,
          });
          setVersions(await listProjectVersions(project.id));
        }}
        onTogglePinVersion={async (versionId) => {
          const target = versions.find((v) => v.id === versionId);
          if (!target) return;
          setVersions(await updateProjectVersionMeta(project.id, versionId, { pinned: !target.pinned }));
        }}
        onRenameVersion={async (versionId, name) => {
          setVersions(await updateProjectVersionMeta(project.id, versionId, { name }));
        }}
        onDeleteVersion={async (versionId) => {
          setVersions(await deleteProjectVersion(project.id, versionId));
        }}
        onRecoverFromVersion={handleRecoverFromVersion}
        autoVersionEnabled={autoVersionEnabled}
        onToggleAutoVersion={setAutoVersionEnabled}
        maxUnpinnedVersions={maxUnpinnedVersions}
        onChangeMaxUnpinnedVersions={async (limit) => {
          setMaxUnpinnedVersions(limit);
          await pruneUnpinnedVersions(project.id, limit);
          setVersions(await listProjectVersions(project.id));
        }}
      />

      {/* SYSTEM 02: Copy & Paste Properties Modal */}
      <CopyPastePropertiesModal
        isOpen={showCopyPasteModal}
        onClose={() => setShowCopyPasteModal(false)}
        lang={lang}
        sourceLayer={project.layers.find((l) => l.id === project.selectedLayerId) || null}
        allLayers={project.layers}
        preselectedTargetIds={multiSelectedIds}
        copiedBundle={copiedBundle}
        onCopyBundle={(bundle) => {
          setCopiedBundle(bundle);
          showNotice(lang === 'ar' ? `تم نسخ خصائص "${bundle.sourceLayerName}"` : `Copied properties from "${bundle.sourceLayerName}"`);
        }}
        onPasteToLayers={handlePasteProperties}
      />

      {/* SYSTEM 05: Advanced Project Search Modal */}
      <ProjectSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        lang={lang}
        project={project}
        onSelectLayer={(layerId) => {
          setProject((prev) => ({ ...prev, selectedLayerId: layerId }));
          setShowInspector(true);
        }}
        onJumpToFrame={(frame, layerId) => {
          setProject((prev) => ({
            ...prev,
            currentFrame: frame,
            selectedLayerId: layerId ?? prev.selectedLayerId,
          }));
          if (layerId) setShowInspector(true);
        }}
        onOpenInspectorForLayer={(layerId, tab) => {
          setProject((prev) => ({
            ...prev,
            selectedLayerId: layerId,
            activeTab: tab === 'graph' ? 'graph' : 'properties',
          }));
          setShowInspector(true);
          if (tab === 'effects') {
            setRequestedSubView({ view: 'effects', token: Date.now() });
          }
        }}
        onUnhideLayer={(layerId) => {
          const target = project.layers.find((l) => l.id === layerId);
          if (target) handleUpdateLayer({ ...target, visible: true }, true);
        }}
        onRenameLayer={(layerId, newName) => {
          const target = project.layers.find((l) => l.id === layerId);
          if (target) handleUpdateLayer({ ...target, name: newName }, true);
        }}
        onDuplicateLayer={handleDuplicateLayer}
        onDeleteLayer={handleDeleteLayer}
        onFavoriteEffect={(effectType, name) => {
          const effDef = ALIGHT_EFFECTS_FULL_CATALOG.find((x) => x.id === effectType);
          const next = toggleFavoriteItem(favoritesState, {
            type: 'effect',
            refId: effectType,
            title: effDef?.nameEn || name,
            titleAr: effDef?.nameAr || name,
            folderId: 'fx',
            payload: { effectType, params: effDef?.defaultParams || {} },
          });
          setFavoritesState(next);
        }}
      />

      {/* SYSTEM 06: Collaborative Editing Panel */}
      <CollaborationPanel
        isOpen={showCollabModal}
        onClose={() => setShowCollabModal(false)}
        lang={lang}
        projectLayers={project.layers}
        projectSettings={project.settings}
        selectedLayer={project.layers.find((l) => l.id === project.selectedLayerId) || null}
        currentFrame={project.currentFrame}
        localMemberId={collab.localMemberId}
        localMemberName={collab.localMemberName}
        workspace={collab.workspace}
        currentMember={collab.currentMember}
        syncStatus={collab.syncStatus}
        errorMsg={collab.errorMsg}
        pendingOpsCount={collab.pendingOpsCount}
        onCreateWorkspace={async (params) =>
          collab.createWorkspace({
            name: params.name,
            layers: params.layers,
            settings: params.settings,
            memberName: params.memberName,
          })
        }
        onJoinWorkspace={async (code, customName) => collab.joinWorkspace(code, customName)}
        onLeaveWorkspace={collab.leaveWorkspace}
        onAddComment={collab.addComment}
        onReplyToComment={collab.replyToComment}
        onSetCommentStatus={collab.setCommentStatus}
        onUpdateMemberRole={collab.updateMemberRole}
        onRemoveMember={collab.removeMember}
        onJumpToFrame={(frame, layerId) => {
          setProject((prev) => ({
            ...prev,
            currentFrame: frame,
            selectedLayerId: layerId ?? prev.selectedLayerId,
          }));
          if (layerId) setShowInspector(true);
        }}
      />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Cloud Account, Sync & Online Community Modal */}
      <CloudAccountModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        lang={lang}
        user={cloudUser}
        activeProject={viewMode === 'editor' ? project : null}
        savedProjects={savedProjects}
        onMergeCloudProjects={mergeCloudProjectsList}
        onOpenProject={(proj) => {
          setShowCloudModal(false);
          handleOpenProject(proj);
        }}
        onOpenCollab={() => {
          setShowCloudModal(false);
          if (viewMode === 'home') {
            setViewMode('editor');
          }
          setShowCollabModal(true);
        }}
        onOpenProfile={() => {
          setShowCloudModal(false);
          setShowProfileModal(true);
        }}
      />

      {/* Global Studio Creator Profile UI */}
      <CreatorProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        lang={lang}
        user={cloudUser}
        activeProject={viewMode === 'editor' ? project : null}
        savedProjects={savedProjects}
        onMergeCloudProjects={mergeCloudProjectsList}
        onOpenProject={(proj) => {
          setShowProfileModal(false);
          handleOpenProject(proj);
        }}
        onOpenCollab={() => {
          setShowProfileModal(false);
          if (viewMode === 'home') {
            setViewMode('editor');
          }
          setShowCollabModal(true);
        }}
        onOpenSocial={() => {
          setShowProfileModal(false);
          setShowSocialModal(true);
        }}
      />

      {/* Global Social Network: People Search, DMs, Channels, Groups, Followers & Videos */}
      <SocialCommunityModal
        isOpen={showSocialModal}
        onClose={() => {
          setShowSocialModal(false);
          setSocialTargetDmId(null);
          setSocialTargetRoomId(null);
        }}
        lang={lang}
        user={cloudUser}
        initialTab={socialInitialTab}
        initialDmRecipientId={socialTargetDmId}
        initialRoomId={socialTargetRoomId}
        onOpenProfile={() => {
          setShowSocialModal(false);
          setShowProfileModal(true);
        }}
        onOpenNotifications={() => setShowNotificationsModal(true)}
      />

      {/* Real-Time Notifications Inbox & Quick Reply */}
      <NotificationsCenterModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        lang={lang}
        onOpenDmChat={handleOpenDmFromNotif}
        onOpenRoomChat={handleOpenRoomFromNotif}
        onOpenVideos={handleOpenVideosFromNotif}
      />
      </div>
      </SocialProvider>
    </MotionConfig>
  );
}
