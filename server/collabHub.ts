import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  CollabActivityItem,
  CollabComment,
  CollabMember,
  CollabOperation,
  CollabPermissions,
  CollabRole,
  CollabWorkspaceState,
  Layer,
  ProjectSettings,
} from '../src/types';

const DATA_DIR = path.join(process.cwd(), '.data');
const ROOMS_FILE = path.join(DATA_DIR, 'collab-rooms.json');

const AVATAR_PALETTE = [
  '#FF4D6D',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
];

export function defaultPermissionsForRole(role: CollabRole): CollabPermissions {
  switch (role) {
    case 'owner':
      return {
        canEditLayers: true,
        canDeleteLayers: true,
        canEditEffects: true,
        canEditSettings: true,
        canComment: true,
        canResolveComments: true,
        canApproveChanges: true,
        canManageTeam: true,
      };
    case 'admin':
      return {
        canEditLayers: true,
        canDeleteLayers: true,
        canEditEffects: true,
        canEditSettings: true,
        canComment: true,
        canResolveComments: true,
        canApproveChanges: true,
        canManageTeam: true,
      };
    case 'editor':
      return {
        canEditLayers: true,
        canDeleteLayers: true,
        canEditEffects: true,
        canEditSettings: false,
        canComment: true,
        canResolveComments: false,
        canApproveChanges: false,
        canManageTeam: false,
      };
    case 'reviewer':
      return {
        canEditLayers: false,
        canDeleteLayers: false,
        canEditEffects: false,
        canEditSettings: false,
        canComment: true,
        canResolveComments: true,
        canApproveChanges: true,
        canManageTeam: false,
      };
    case 'viewer':
    default:
      return {
        canEditLayers: false,
        canDeleteLayers: false,
        canEditEffects: false,
        canEditSettings: false,
        canComment: false,
        canResolveComments: false,
        canApproveChanges: false,
        canManageTeam: false,
      };
  }
}

interface RoomRecord extends CollabWorkspaceState {
  appliedOpIds: string[];
}

interface ClientSocketMeta {
  ws: WebSocket;
  roomCode: string;
  memberId: string;
}

class CollabHub {
  private rooms = new Map<string, RoomRecord>();
  private clients = new Map<string, Set<ClientSocketMeta>>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(ROOMS_FILE)) return;
      const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, RoomRecord>;
      for (const [code, room] of Object.entries(parsed)) {
        // Reset online flags on cold server start
        room.members = (room.members || []).map((m) => ({ ...m, online: false }));
        room.appliedOpIds = Array.isArray(room.appliedOpIds) ? room.appliedOpIds : [];
        this.rooms.set(code, room);
      }
    } catch (err) {
      console.warn('[CollabHub] Failed to load persisted rooms:', err);
    }
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const obj: Record<string, RoomRecord> = {};
        for (const [code, room] of this.rooms.entries()) {
          obj[code] = {
            ...room,
            appliedOpIds: room.appliedOpIds.slice(-300),
          };
        }
        const tmpFile = `${ROOMS_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(obj), 'utf-8');
        fs.renameSync(tmpFile, ROOMS_FILE);
      } catch (err) {
        console.warn('[CollabHub] Failed to persist rooms:', err);
      }
    }, 350);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (this.rooms.has(code)) return this.generateRoomCode();
    return code;
  }

  private pickAvatarColor(index: number): string {
    return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  }

  private toPublicState(room: RoomRecord): CollabWorkspaceState {
    return {
      roomCode: room.roomCode,
      name: room.name,
      ownerId: room.ownerId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lamport: room.lamport,
      members: room.members,
      comments: room.comments,
      activity: room.activity.slice(-100),
      projectSnapshot: room.projectSnapshot,
    };
  }

  private pushActivity(room: RoomRecord, actor: CollabMember, action: string, detail: string) {
    const item: CollabActivityItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      actorId: actor.id,
      actorName: actor.name,
      actorColor: actor.avatarColor,
      action,
      detail,
      createdAt: Date.now(),
    };
    room.activity.push(item);
    if (room.activity.length > 120) {
      room.activity = room.activity.slice(-120);
    }
    return item;
  }

  public createRoom(params: {
    name: string;
    ownerId: string;
    ownerName: string;
    ownerEmail?: string;
    layers: Layer[];
    settings: ProjectSettings;
  }): CollabWorkspaceState {
    const roomCode = this.generateRoomCode();
    const now = Date.now();
    const owner: CollabMember = {
      id: params.ownerId,
      name: params.ownerName || 'Owner',
      email: params.ownerEmail,
      avatarColor: this.pickAvatarColor(0),
      role: 'owner',
      permissions: defaultPermissionsForRole('owner'),
      online: false,
      lastSeenAt: now,
      selectedLayerId: null,
      currentFrame: 0,
    };

    const room: RoomRecord = {
      roomCode,
      name: params.name || params.settings.name || 'Shared Project',
      ownerId: owner.id,
      createdAt: now,
      updatedAt: now,
      lamport: 1,
      members: [owner],
      comments: [],
      activity: [
        {
          id: `act_${now}`,
          actorId: owner.id,
          actorName: owner.name,
          actorColor: owner.avatarColor,
          action: 'workspace:created',
          detail: `Created shared workspace "${params.name || params.settings.name}"`,
          createdAt: now,
        },
      ],
      projectSnapshot: {
        layers: params.layers || [],
        settings: params.settings,
      },
      appliedOpIds: [],
    };

    this.rooms.set(roomCode, room);
    this.schedulePersist();
    return this.toPublicState(room);
  }

  public joinRoom(params: {
    roomCode: string;
    memberId: string;
    memberName: string;
    memberEmail?: string;
    requestedRole?: CollabRole;
  }): CollabWorkspaceState | null {
    const code = params.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return null;

    const now = Date.now();
    let member = room.members.find((m) => m.id === params.memberId);
    if (!member) {
      const role: CollabRole =
        params.requestedRole && params.requestedRole !== 'owner'
          ? params.requestedRole
          : 'editor';
      member = {
        id: params.memberId,
        name: params.memberName || `Editor ${room.members.length + 1}`,
        email: params.memberEmail,
        avatarColor: this.pickAvatarColor(room.members.length),
        role,
        permissions: defaultPermissionsForRole(role),
        online: false,
        lastSeenAt: now,
        selectedLayerId: null,
        currentFrame: 0,
      };
      room.members.push(member);
      this.pushActivity(room, member, 'member:joined', `${member.name} joined as ${role}`);
    } else {
      member.name = params.memberName || member.name;
      if (params.memberEmail) member.email = params.memberEmail;
      member.lastSeenAt = now;
    }

    room.updatedAt = now;
    this.schedulePersist();
    this.broadcastRoomState(code, {
      type: 'members:updated',
      members: room.members,
      activity: room.activity.slice(-15),
    });
    return this.toPublicState(room);
  }

  public getRoom(roomCode: string): CollabWorkspaceState | null {
    const room = this.rooms.get(roomCode.trim().toUpperCase());
    return room ? this.toPublicState(room) : null;
  }

  private broadcastRoomState(roomCode: string, payload: Record<string, unknown>, excludeSocket?: WebSocket) {
    const roomClients = this.clients.get(roomCode);
    if (!roomClients) return;
    const message = JSON.stringify(payload);
    for (const client of roomClients) {
      if (excludeSocket && client.ws === excludeSocket) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  private handleOperation(room: RoomRecord, member: CollabMember, op: CollabOperation, senderWs: WebSocket) {
    // Idempotency guard
    if (room.appliedOpIds.includes(op.opId)) {
      return;
    }

    // RBAC check
    if (op.type === 'settings:update') {
      if (!member.permissions.canEditSettings && !member.permissions.canEditLayers) {
        senderWs.send(JSON.stringify({ type: 'error', reason: 'Permission denied: cannot edit settings' }));
        return;
      }
    } else if (op.type === 'layer:delete') {
      if (!member.permissions.canDeleteLayers) {
        senderWs.send(JSON.stringify({ type: 'error', reason: 'Permission denied: cannot delete layers' }));
        return;
      }
    } else {
      if (!member.permissions.canEditLayers && !member.permissions.canEditEffects) {
        senderWs.send(JSON.stringify({ type: 'error', reason: 'Permission denied: read-only role' }));
        return;
      }
    }

    room.appliedOpIds.push(op.opId);
    if (room.appliedOpIds.length > 400) {
      room.appliedOpIds = room.appliedOpIds.slice(-300);
    }

    room.lamport = Math.max(room.lamport, op.lamport || 0) + 1;
    room.updatedAt = Date.now();

    if (op.type === 'layer:upsert' && op.layer) {
      const idx = room.projectSnapshot.layers.findIndex((l) => l.id === op.layer!.id);
      if (idx >= 0) {
        room.projectSnapshot.layers[idx] = op.layer;
      } else {
        room.projectSnapshot.layers.unshift(op.layer);
      }
    } else if (op.type === 'layer:delete' && op.layerId) {
      room.projectSnapshot.layers = room.projectSnapshot.layers.filter((l) => l.id !== op.layerId);
    } else if (op.type === 'layers:replace' && Array.isArray(op.layers)) {
      room.projectSnapshot.layers = op.layers;
    } else if (op.type === 'settings:update' && op.settings) {
      room.projectSnapshot.settings = op.settings;
    } else if (op.type === 'project:sync') {
      if (Array.isArray(op.layers)) room.projectSnapshot.layers = op.layers;
      if (op.settings) room.projectSnapshot.settings = op.settings;
    }

    let activityItem: CollabActivityItem | null = null;
    if (op.summary) {
      activityItem = this.pushActivity(room, member, op.type, op.summary);
    }

    this.schedulePersist();

    const serverOp: CollabOperation = {
      ...op,
      lamport: room.lamport,
      actorId: member.id,
    };

    this.broadcastRoomState(
      room.roomCode,
      {
        type: 'op:applied',
        op: serverOp,
        activityItem,
      },
      senderWs
    );

    // Acknowledge to sender with authoritative lamport clock
    if (senderWs.readyState === WebSocket.OPEN) {
      senderWs.send(
        JSON.stringify({
          type: 'op:ack',
          opId: op.opId,
          lamport: room.lamport,
          activityItem,
        })
      );
    }
  }

  public attachWebSocketServer(server: http.Server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      try {
        const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
        if (url.pathname !== '/ws/collab') {
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch {
        socket.destroy();
      }
    });

    wss.on('connection', (ws, request) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
      const memberId = (url.searchParams.get('memberId') || '').trim();
      const memberName = (url.searchParams.get('name') || 'Editor').trim();

      const room = this.rooms.get(roomCode);
      if (!room || !memberId) {
        ws.send(JSON.stringify({ type: 'error', reason: 'Workspace not found or invalid member ID' }));
        ws.close();
        return;
      }

      let member = room.members.find((m) => m.id === memberId);
      if (!member) {
        member = {
          id: memberId,
          name: memberName,
          avatarColor: this.pickAvatarColor(room.members.length),
          role: 'editor',
          permissions: defaultPermissionsForRole('editor'),
          online: true,
          lastSeenAt: Date.now(),
          selectedLayerId: null,
          currentFrame: 0,
        };
        room.members.push(member);
      } else {
        member.online = true;
        member.lastSeenAt = Date.now();
        if (memberName) member.name = memberName;
      }

      const meta: ClientSocketMeta = { ws, roomCode, memberId };
      if (!this.clients.has(roomCode)) {
        this.clients.set(roomCode, new Set());
      }
      this.clients.get(roomCode)!.add(meta);

      // Send authoritative initial sync
      ws.send(
        JSON.stringify({
          type: 'room:init',
          state: this.toPublicState(room),
        })
      );

      this.broadcastRoomState(
        roomCode,
        {
          type: 'members:updated',
          members: room.members,
        },
        ws
      );

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type: string;
            op?: CollabOperation;
            selectedLayerId?: string | null;
            currentFrame?: number;
            comment?: { text: string; frame?: number; layerId?: string; layerName?: string; mentions?: string[] };
            commentId?: string;
            replyText?: string;
            mentions?: string[];
            status?: CollabComment['status'];
            targetMemberId?: string;
            role?: CollabRole;
            permissions?: CollabPermissions;
            workspaceName?: string;
          };

          const currentMember = room.members.find((m) => m.id === memberId);
          if (!currentMember) return;

          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
            return;
          }

          if (msg.type === 'presence:update') {
            currentMember.selectedLayerId = msg.selectedLayerId ?? null;
            if (typeof msg.currentFrame === 'number') {
              currentMember.currentFrame = msg.currentFrame;
            }
            currentMember.lastSeenAt = Date.now();
            this.broadcastRoomState(
              roomCode,
              {
                type: 'presence:sync',
                memberId: currentMember.id,
                selectedLayerId: currentMember.selectedLayerId,
                currentFrame: currentMember.currentFrame,
              },
              ws
            );
            return;
          }

          if (msg.type === 'op:send' && msg.op) {
            this.handleOperation(room, currentMember, msg.op, ws);
            return;
          }

          if (msg.type === 'comment:add' && msg.comment) {
            if (!currentMember.permissions.canComment) {
              ws.send(JSON.stringify({ type: 'error', reason: 'Permission denied: cannot comment' }));
              return;
            }
            const now = Date.now();
            const comment: CollabComment = {
              id: `cmt_${now}_${Math.random().toString(36).slice(2, 7)}`,
              authorId: currentMember.id,
              authorName: currentMember.name,
              authorColor: currentMember.avatarColor,
              text: msg.comment.text,
              mentions: msg.comment.mentions || [],
              frame: msg.comment.frame,
              layerId: msg.comment.layerId,
              layerName: msg.comment.layerName,
              status: 'open',
              createdAt: now,
              updatedAt: now,
              replies: [],
            };
            room.comments.unshift(comment);
            const act = this.pushActivity(
              room,
              currentMember,
              'comment:add',
              `Commented${comment.frame !== undefined ? ` at F${comment.frame}` : ''}: "${comment.text.slice(0, 48)}"`
            );
            this.schedulePersist();
            this.broadcastRoomState(roomCode, {
              type: 'comments:updated',
              comments: room.comments,
              activityItem: act,
            });
            return;
          }

          if (msg.type === 'comment:reply' && msg.commentId && msg.replyText) {
            if (!currentMember.permissions.canComment) return;
            const target = room.comments.find((c) => c.id === msg.commentId);
            if (!target) return;
            const now = Date.now();
            target.replies.push({
              id: `rep_${now}_${Math.random().toString(36).slice(2, 6)}`,
              authorId: currentMember.id,
              authorName: currentMember.name,
              authorColor: currentMember.avatarColor,
              text: msg.replyText,
              mentions: msg.mentions || [],
              createdAt: now,
            });
            target.updatedAt = now;
            this.schedulePersist();
            this.broadcastRoomState(roomCode, {
              type: 'comments:updated',
              comments: room.comments,
            });
            return;
          }

          if (msg.type === 'comment:status' && msg.commentId && msg.status) {
            const isApproval = msg.status === 'approved' || msg.status === 'rejected';
            if (isApproval && !currentMember.permissions.canApproveChanges) {
              ws.send(JSON.stringify({ type: 'error', reason: 'Permission denied: cannot approve/reject' }));
              return;
            }
            if (!isApproval && !currentMember.permissions.canResolveComments) {
              ws.send(JSON.stringify({ type: 'error', reason: 'Permission denied: cannot resolve comments' }));
              return;
            }
            const target = room.comments.find((c) => c.id === msg.commentId);
            if (!target) return;
            target.status = msg.status;
            target.updatedAt = Date.now();
            const act = this.pushActivity(
              room,
              currentMember,
              'comment:status',
              `Marked thread "${target.text.slice(0, 32)}" as ${msg.status}`
            );
            this.schedulePersist();
            this.broadcastRoomState(roomCode, {
              type: 'comments:updated',
              comments: room.comments,
              activityItem: act,
            });
            return;
          }

          if (msg.type === 'member:role' && msg.targetMemberId && msg.role) {
            if (!currentMember.permissions.canManageTeam) {
              ws.send(JSON.stringify({ type: 'error', reason: 'Permission denied: cannot manage team' }));
              return;
            }
            const target = room.members.find((m) => m.id === msg.targetMemberId);
            if (!target || target.id === room.ownerId) return;
            target.role = msg.role;
            target.permissions = msg.permissions || defaultPermissionsForRole(msg.role);
            const act = this.pushActivity(
              room,
              currentMember,
              'member:role',
              `Updated ${target.name}'s role to ${msg.role}`
            );
            this.schedulePersist();
            this.broadcastRoomState(roomCode, {
              type: 'members:updated',
              members: room.members,
              activityItem: act,
            });
            return;
          }

          if (msg.type === 'member:remove' && msg.targetMemberId) {
            if (!currentMember.permissions.canManageTeam && msg.targetMemberId !== currentMember.id) return;
            if (msg.targetMemberId === room.ownerId) return;
            const removed = room.members.find((m) => m.id === msg.targetMemberId);
            room.members = room.members.filter((m) => m.id !== msg.targetMemberId);
            if (removed) {
              const act = this.pushActivity(room, currentMember, 'member:removed', `${removed.name} left workspace`);
              this.schedulePersist();
              this.broadcastRoomState(roomCode, {
                type: 'members:updated',
                members: room.members,
                removedMemberId: msg.targetMemberId,
                activityItem: act,
              });
            }
            return;
          }

          if (msg.type === 'workspace:rename' && msg.workspaceName) {
            if (!currentMember.permissions.canManageTeam && currentMember.role !== 'owner') return;
            room.name = msg.workspaceName.trim();
            const act = this.pushActivity(room, currentMember, 'workspace:rename', `Renamed workspace to "${room.name}"`);
            this.schedulePersist();
            this.broadcastRoomState(roomCode, {
              type: 'workspace:meta',
              name: room.name,
              activityItem: act,
            });
          }
        } catch (err) {
          console.warn('[CollabHub] Socket message parse error:', err);
        }
      });

      ws.on('close', () => {
        const roomClients = this.clients.get(roomCode);
        if (roomClients) {
          roomClients.delete(meta);
          const stillConnected = Array.from(roomClients).some((c) => c.memberId === memberId);
          if (!stillConnected) {
            const m = room.members.find((item) => item.id === memberId);
            if (m) {
              m.online = false;
              m.lastSeenAt = Date.now();
              this.broadcastRoomState(roomCode, {
                type: 'members:updated',
                members: room.members,
              });
            }
          }
        }
      });
    });
  }

  public registerRoutes(app: Express) {
    app.post('/api/collab/rooms', (req: Request, res: Response) => {
      try {
        const { name, ownerId, ownerName, ownerEmail, layers, settings } = req.body || {};
        if (!ownerId || !settings) {
          res.status(400).json({ error: 'ownerId and settings are required' });
          return;
        }
        const created = this.createRoom({
          name: name || settings.name || 'Shared Project',
          ownerId,
          ownerName: ownerName || 'Creator',
          ownerEmail,
          layers: Array.isArray(layers) ? layers : [],
          settings,
        });
        res.json({ workspace: created });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create workspace' });
      }
    });

    app.get('/api/collab/rooms/:code', (req: Request, res: Response) => {
      const state = this.getRoom(req.params.code);
      if (!state) {
        res.status(404).json({ error: 'Workspace not found' });
        return;
      }
      res.json({ workspace: state });
    });

    app.post('/api/collab/rooms/:code/join', (req: Request, res: Response) => {
      const { memberId, memberName, memberEmail, requestedRole } = req.body || {};
      if (!memberId) {
        res.status(400).json({ error: 'memberId is required' });
        return;
      }
      const state = this.joinRoom({
        roomCode: req.params.code,
        memberId,
        memberName: memberName || 'Editor',
        memberEmail,
        requestedRole,
      });
      if (!state) {
        res.status(404).json({ error: 'Workspace not found' });
        return;
      }
      res.json({ workspace: state });
    });
  }
}

export const collabHub = new CollabHub();
