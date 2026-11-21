import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CollabActivityItem,
  CollabComment,
  CollabMember,
  CollabOperation,
  CollabPermissions,
  CollabRole,
  CollabSyncStatus,
  CollabWorkspaceState,
  Layer,
  ProjectSettings,
} from '../types';

const MEMBER_ID_KEY = 'sqmotion_collab_member_id';
const MEMBER_NAME_KEY = 'sqmotion_collab_member_name';
const ACTIVE_ROOM_KEY = 'sqmotion_collab_active_room';
const OFFLINE_QUEUE_KEY = 'sqmotion_collab_offline_queue_v1';

export function getOrCreateLocalMemberIdentity(): { memberId: string; memberName: string } {
  let memberId = '';
  let memberName = '';
  try {
    memberId = localStorage.getItem(MEMBER_ID_KEY) || '';
    if (!memberId) {
      memberId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem(MEMBER_ID_KEY, memberId);
    }
    memberName = localStorage.getItem(MEMBER_NAME_KEY) || '';
    if (!memberName) {
      memberName = `Designer ${memberId.slice(-4).toUpperCase()}`;
      localStorage.setItem(MEMBER_NAME_KEY, memberName);
    }
  } catch {
    memberId = `usr_${Math.random().toString(36).slice(2, 8)}`;
    memberName = 'Creator';
  }
  return { memberId, memberName };
}

export function setLocalMemberName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(MEMBER_NAME_KEY, name.trim());
  } catch {
    // Ignore
  }
}

interface UseCollabSessionParams {
  onApplyRemoteLayers: (layers: Layer[]) => void;
  onApplyRemoteLayerUpsert: (layer: Layer) => void;
  onApplyRemoteLayerDelete: (layerId: string) => void;
  onApplyRemoteSettings: (settings: ProjectSettings) => void;
  onApplyRemoteFullState: (layers: Layer[], settings: ProjectSettings) => void;
}

export function useCollabSession({
  onApplyRemoteLayers,
  onApplyRemoteLayerUpsert,
  onApplyRemoteLayerDelete,
  onApplyRemoteSettings,
  onApplyRemoteFullState,
}: UseCollabSessionParams) {
  const identity = useRef(getOrCreateLocalMemberIdentity());
  const [memberName, setMemberNameState] = useState(identity.current.memberName);
  const [workspace, setWorkspace] = useState<CollabWorkspaceState | null>(null);
  const [syncStatus, setSyncStatus] = useState<CollabSyncStatus>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingOpsCount, setPendingOpsCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lamportRef = useRef(1);
  const activeRoomRef = useRef<string | null>(null);
  const offlineQueueRef = useRef<CollabOperation[]>([]);

  // Load any persisted offline queue
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CollabOperation[];
        if (Array.isArray(parsed)) {
          offlineQueueRef.current = parsed;
          setPendingOpsCount(parsed.length);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const persistOfflineQueue = useCallback((queue: CollabOperation[]) => {
    offlineQueueRef.current = queue;
    setPendingOpsCount(queue.length);
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore
    }
  }, []);

  const callbacksRef = useRef({
    onApplyRemoteLayers,
    onApplyRemoteLayerUpsert,
    onApplyRemoteLayerDelete,
    onApplyRemoteSettings,
    onApplyRemoteFullState,
  });
  callbacksRef.current = {
    onApplyRemoteLayers,
    onApplyRemoteLayerUpsert,
    onApplyRemoteLayerDelete,
    onApplyRemoteSettings,
    onApplyRemoteFullState,
  };

  const flushOfflineQueue = useCallback((ws: WebSocket, roomCode: string) => {
    const remaining: CollabOperation[] = [];
    for (const op of offlineQueueRef.current) {
      if (op.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'op:send', op }));
      } else {
        remaining.push(op);
      }
    }
    persistOfflineQueue(remaining);
  }, [persistOfflineQueue]);

  const connectWebSocket = useCallback((roomCode: string, nameOverride?: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const code = roomCode.trim().toUpperCase();
    activeRoomRef.current = code;
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, code);
    } catch {
      // Ignore
    }

    setSyncStatus('connecting');
    setErrorMsg(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const displayName = nameOverride || identity.current.memberName;
    const wsUrl = `${protocol}//${window.location.host}/ws/collab?room=${encodeURIComponent(code)}&memberId=${encodeURIComponent(identity.current.memberId)}&name=${encodeURIComponent(displayName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setSyncStatus('synced');
      flushOfflineQueue(ws, code);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          reason?: string;
          state?: CollabWorkspaceState;
          members?: CollabMember[];
          comments?: CollabComment[];
          activity?: CollabActivityItem[];
          activityItem?: CollabActivityItem;
          op?: CollabOperation;
          lamport?: number;
          memberId?: string;
          selectedLayerId?: string | null;
          currentFrame?: number;
          name?: string;
          removedMemberId?: string;
        };

        if (msg.type === 'error' && msg.reason) {
          setErrorMsg(msg.reason);
          return;
        }

        if (msg.type === 'room:init' && msg.state) {
          lamportRef.current = Math.max(lamportRef.current, msg.state.lamport || 1);
          setWorkspace(msg.state);
          setSyncStatus('synced');
          if (msg.state.projectSnapshot) {
            callbacksRef.current.onApplyRemoteFullState(
              msg.state.projectSnapshot.layers,
              msg.state.projectSnapshot.settings
            );
          }
          return;
        }

        if (msg.type === 'members:updated' && msg.members) {
          if (msg.removedMemberId === identity.current.memberId) {
            // Current user was removed or left
            activeRoomRef.current = null;
            setWorkspace(null);
            setSyncStatus('disconnected');
            ws.close();
            return;
          }
          setWorkspace((prev) =>
            prev
              ? {
                  ...prev,
                  members: msg.members!,
                  activity: msg.activityItem
                    ? [...prev.activity, msg.activityItem].slice(-100)
                    : msg.activity || prev.activity,
                }
              : prev
          );
          return;
        }

        if (msg.type === 'presence:sync' && msg.memberId) {
          setWorkspace((prev) =>
            prev
              ? {
                  ...prev,
                  members: prev.members.map((m) =>
                    m.id === msg.memberId
                      ? {
                          ...m,
                          online: true,
                          selectedLayerId: msg.selectedLayerId ?? null,
                          currentFrame: msg.currentFrame ?? m.currentFrame,
                        }
                      : m
                  ),
                }
              : prev
          );
          return;
        }

        if (msg.type === 'comments:updated' && msg.comments) {
          setWorkspace((prev) =>
            prev
              ? {
                  ...prev,
                  comments: msg.comments!,
                  activity: msg.activityItem ? [...prev.activity, msg.activityItem].slice(-100) : prev.activity,
                }
              : prev
          );
          return;
        }

        if (msg.type === 'workspace:meta' && msg.name) {
          setWorkspace((prev) =>
            prev
              ? {
                  ...prev,
                  name: msg.name!,
                  activity: msg.activityItem ? [...prev.activity, msg.activityItem].slice(-100) : prev.activity,
                }
              : prev
          );
          return;
        }

        if (msg.type === 'op:ack') {
          if (msg.lamport) lamportRef.current = Math.max(lamportRef.current, msg.lamport);
          setSyncStatus(offlineQueueRef.current.length > 0 ? 'offline_queued' : 'synced');
          if (msg.activityItem) {
            setWorkspace((prev) =>
              prev ? { ...prev, activity: [...prev.activity, msg.activityItem!].slice(-100) } : prev
            );
          }
          return;
        }

        if (msg.type === 'op:applied' && msg.op) {
          const op = msg.op;
          lamportRef.current = Math.max(lamportRef.current, op.lamport || 1);
          if (op.type === 'layer:upsert' && op.layer) {
            callbacksRef.current.onApplyRemoteLayerUpsert(op.layer);
          } else if (op.type === 'layer:delete' && op.layerId) {
            callbacksRef.current.onApplyRemoteLayerDelete(op.layerId);
          } else if (op.type === 'layers:replace' && op.layers) {
            callbacksRef.current.onApplyRemoteLayers(op.layers);
          } else if (op.type === 'settings:update' && op.settings) {
            callbacksRef.current.onApplyRemoteSettings(op.settings);
          } else if (op.type === 'project:sync' && op.layers && op.settings) {
            callbacksRef.current.onApplyRemoteFullState(op.layers, op.settings);
          }

          if (msg.activityItem) {
            setWorkspace((prev) =>
              prev ? { ...prev, activity: [...prev.activity, msg.activityItem!].slice(-100) } : prev
            );
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (activeRoomRef.current === code) {
        setSyncStatus(offlineQueueRef.current.length > 0 ? 'offline_queued' : 'connecting');
        reconnectTimerRef.current = setTimeout(() => {
          if (activeRoomRef.current === code) {
            connectWebSocket(code);
          }
        }, 2500);
      } else {
        setSyncStatus('disconnected');
      }
    };

    ws.onerror = () => {
      setSyncStatus('offline_queued');
    };
  }, [flushOfflineQueue]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      activeRoomRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const createWorkspace = useCallback(
    async (params: { name: string; layers: Layer[]; settings: ProjectSettings; memberName?: string; email?: string }) => {
      setErrorMsg(null);
      const displayName = (params.memberName || memberName).trim() || 'Owner';
      setLocalMemberName(displayName);
      setMemberNameState(displayName);
      identity.current.memberName = displayName;

      const res = await fetch('/api/collab/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          ownerId: identity.current.memberId,
          ownerName: displayName,
          ownerEmail: params.email,
          layers: params.layers,
          settings: params.settings,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.workspace) {
        const msg = data.error || 'Failed to create collaborative workspace';
        setErrorMsg(msg);
        throw new Error(msg);
      }
      setWorkspace(data.workspace);
      connectWebSocket(data.workspace.roomCode, displayName);
      return data.workspace as CollabWorkspaceState;
    },
    [connectWebSocket, memberName]
  );

  const joinWorkspace = useCallback(
    async (roomCode: string, customName?: string, email?: string) => {
      setErrorMsg(null);
      const code = roomCode.trim().toUpperCase();
      const displayName = (customName || memberName).trim() || 'Editor';
      setLocalMemberName(displayName);
      setMemberNameState(displayName);
      identity.current.memberName = displayName;

      const res = await fetch(`/api/collab/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: identity.current.memberId,
          memberName: displayName,
          memberEmail: email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.workspace) {
        const msg = data.error || 'Workspace not found';
        setErrorMsg(msg);
        throw new Error(msg);
      }
      setWorkspace(data.workspace);
      connectWebSocket(code, displayName);
      return data.workspace as CollabWorkspaceState;
    },
    [connectWebSocket, memberName]
  );

  const leaveWorkspace = useCallback(() => {
    const code = activeRoomRef.current;
    activeRoomRef.current = null;
    try {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
    } catch {
      // Ignore
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN && code) {
        wsRef.current.send(
          JSON.stringify({
            type: 'member:remove',
            targetMemberId: identity.current.memberId,
          })
        );
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setWorkspace(null);
    setSyncStatus('disconnected');
  }, []);

  const broadcastOp = useCallback(
    (partialOp: Omit<CollabOperation, 'opId' | 'roomCode' | 'actorId' | 'lamport' | 'timestamp'>) => {
      const code = activeRoomRef.current;
      if (!code) return;
      lamportRef.current += 1;
      const op: CollabOperation = {
        ...partialOp,
        opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        roomCode: code,
        actorId: identity.current.memberId,
        lamport: lamportRef.current,
        timestamp: Date.now(),
      };

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        setSyncStatus('syncing');
        ws.send(JSON.stringify({ type: 'op:send', op }));
      } else {
        setSyncStatus('offline_queued');
        persistOfflineQueue([...offlineQueueRef.current.slice(-49), op]);
      }
    },
    [persistOfflineQueue]
  );

  const sendPresence = useCallback((selectedLayerId: string | null, currentFrame: number) => {
    if (!activeRoomRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    presenceTimerRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'presence:update',
            selectedLayerId,
            currentFrame,
          })
        );
      }
    }, 60);
  }, []);

  const addComment = useCallback(
    (payload: { text: string; frame?: number; layerId?: string; layerName?: string; mentions?: string[] }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'comment:add', comment: payload }));
      }
    },
    []
  );

  const replyToComment = useCallback((commentId: string, replyText: string, mentions?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'comment:reply', commentId, replyText, mentions }));
    }
  }, []);

  const setCommentStatus = useCallback((commentId: string, status: CollabComment['status']) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'comment:status', commentId, status }));
    }
  }, []);

  const updateMemberRole = useCallback((targetMemberId: string, role: CollabRole, permissions?: CollabPermissions) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'member:role', targetMemberId, role, permissions }));
    }
  }, []);

  const removeMember = useCallback((targetMemberId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'member:remove', targetMemberId }));
    }
  }, []);

  const renameWorkspace = useCallback((workspaceName: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'workspace:rename', workspaceName }));
    }
  }, []);

  const currentMember = workspace?.members.find((m) => m.id === identity.current.memberId) || null;

  return {
    localMemberId: identity.current.memberId,
    localMemberName: memberName,
    workspace,
    currentMember,
    syncStatus,
    errorMsg,
    pendingOpsCount,
    createWorkspace,
    joinWorkspace,
    leaveWorkspace,
    broadcastOp,
    sendPresence,
    addComment,
    replyToComment,
    setCommentStatus,
    updateMemberRole,
    removeMember,
    renameWorkspace,
  };
}
