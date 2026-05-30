import { create } from 'zustand';

// Seed placeholder room objects
const SEED_OBJECTS = {
  floor: {
    id: 'floor',
    label: 'Floor',
    type: 'placeholder',
    visible: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#2e2e2e',
    physics: { massKg: 0, friction: 0.8, restitution: 0.2 },
    meshInfo: null,
  },
  back_wall: {
    id: 'back_wall',
    label: 'Back Wall',
    type: 'placeholder',
    visible: true,
    position: [0, 2, -4],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#3a3a3a',
    physics: { massKg: 0, friction: 0.8, restitution: 0.2 },
    meshInfo: null,
  },
  front_wall: {
    id: 'front_wall',
    label: 'Front Wall',
    type: 'placeholder',
    visible: false,
    position: [0, 2, 4],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#3a3a3a',
    physics: { massKg: 0, friction: 0.8, restitution: 0.2 },
    meshInfo: null,
  },
  left_wall: {
    id: 'left_wall',
    label: 'Left Wall',
    type: 'placeholder',
    visible: true,
    position: [-4, 2, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#3a3a3a',
    physics: { massKg: 0, friction: 0.8, restitution: 0.2 },
    meshInfo: null,
  },
  right_wall: {
    id: 'right_wall',
    label: 'Right Wall',
    type: 'placeholder',
    visible: false,
    position: [4, 2, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#3a3a3a',
    physics: { massKg: 0, friction: 0.8, restitution: 0.2 },
    meshInfo: null,
  },
  coffee_table_01: {
    id: 'coffee_table_01',
    label: 'Coffee Table',
    type: 'placeholder',
    visible: true,
    position: [-1.5, 0.35, 1],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#5c4a30',
    physics: { massKg: 5, friction: 0.6, restitution: 0.1 },
    meshInfo: null,
  },
  box_01: {
    id: 'box_01',
    label: 'Box',
    type: 'placeholder',
    visible: true,
    position: [1.5, 0.4, -1],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#4a3c2a',
    physics: { massKg: 2, friction: 0.7, restitution: 0.1 },
    meshInfo: null,
  },
};

const useStore = create((set, get) => ({
  // App navigation
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),

  // Panel state
  leftPanelTab: 'video',
  chatSubTab: 'image',
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setChatSubTab: (tab) => set({ chatSubTab: tab }),

  // Viewport
  activeTool: 'select',
  viewMode: 'solid',
  setActiveTool: (tool) => set({ activeTool: tool }),
  setViewMode: (mode) => set({ viewMode: mode }),

  // Scene objects — keyed by id
  sceneObjects: { ...SEED_OBJECTS },

  // Selected object
  selectedObjectId: 'coffee_table_01',
  setSelectedObject: (id) => set({ selectedObjectId: id }),

  // Gravity
  gravityEnabled: false,
  setGravityEnabled: (v) => set({ gravityEnabled: v }),
  toggleGravity: () => set((s) => ({ gravityEnabled: !s.gravityEnabled })),

  // Active generation tasks { taskId -> { objectId, status, progress } }
  generatedTasks: {},

  // Scene object actions
  addSceneObject: (obj) =>
    set((s) => ({ sceneObjects: { ...s.sceneObjects, [obj.id]: obj } })),

  removeSceneObject: (id) =>
    set((s) => {
      const next = { ...s.sceneObjects };
      delete next[id];
      return {
        sceneObjects: next,
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
      };
    }),

  updateSceneObject: (id, patch) =>
    set((s) => ({
      sceneObjects: {
        ...s.sceneObjects,
        [id]: { ...s.sceneObjects[id], ...patch },
      },
    })),

  setObjectVisibility: (id, visible) =>
    set((s) => ({
      sceneObjects: {
        ...s.sceneObjects,
        [id]: { ...s.sceneObjects[id], visible },
      },
    })),

  setObjectTransform: (id, position, rotation, scale) =>
    set((s) => ({
      sceneObjects: {
        ...s.sceneObjects,
        [id]: {
          ...s.sceneObjects[id],
          ...(position !== undefined && { position }),
          ...(rotation !== undefined && { rotation }),
          ...(scale !== undefined && { scale }),
        },
      },
    })),

  setObjectPhysics: (id, physics) =>
    set((s) => ({
      sceneObjects: {
        ...s.sceneObjects,
        [id]: {
          ...s.sceneObjects[id],
          physics: { ...s.sceneObjects[id]?.physics, ...physics },
        },
      },
    })),

  setObjectMeshInfo: (id, meshInfo) =>
    set((s) => ({
      sceneObjects: {
        ...s.sceneObjects,
        [id]: { ...s.sceneObjects[id], meshInfo },
      },
    })),

  addGeneratedTask: (taskId, objectId) =>
    set((s) => ({
      generatedTasks: {
        ...s.generatedTasks,
        [taskId]: { objectId, status: 'pending', progress: 0 },
      },
    })),

  updateGeneratedTask: (taskId, patch) =>
    set((s) => ({
      generatedTasks: {
        ...s.generatedTasks,
        [taskId]: { ...s.generatedTasks[taskId], ...patch },
      },
    })),

  removeGeneratedTask: (taskId) =>
    set((s) => {
      const next = { ...s.generatedTasks };
      delete next[taskId];
      return { generatedTasks: next };
    }),

  // Returns scene context for /api/command
  getSceneContext: () => {
    const s = get();
    const objects = Object.values(s.sceneObjects).map((o) => ({
      id: o.id,
      label: o.label,
      type: o.type,
      position: o.position,
      glbUrl: o.glbUrl || null,
    }));
    return { objects, gravityEnabled: s.gravityEnabled };
  },

  // Hierarchy (expanded nodes kept for backward compat)
  expandedNodes: ['Scene'],
  toggleNode: (id) =>
    set((state) => ({
      expandedNodes: state.expandedNodes.includes(id)
        ? state.expandedNodes.filter((n) => n !== id)
        : [...state.expandedNodes, id],
    })),

  // Upload (mock)
  uploadedVideoName: null,
  uploadedVideoDuration: null,
  setUploadedVideo: (name, duration) =>
    set({ uploadedVideoName: name, uploadedVideoDuration: duration }),

  // Chat
  chatMessages: [
    { id: 1, sender: 'ai', text: 'Welcome to RoomCraft! Describe an asset to generate, or ask me to place objects in the scene.' },
  ],
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateChatMessage: (id, patch) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  updateLastMessage: (msg) =>
    set((state) => {
      const msgs = [...state.chatMessages];
      msgs[msgs.length - 1] = msg;
      return { chatMessages: msgs };
    }),
}));

export default useStore;
