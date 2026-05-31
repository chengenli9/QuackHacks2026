import { create } from 'zustand';

const DEFAULT_TRANSFORMS = {
  Room_Mesh: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Floor: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Walls: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Ceiling: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Lights: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Ambient: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Sun: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Camera: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  Scene: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  ChaoMan: { position: [0, 0.85, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
};

const useStore = create((set) => ({
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

  // Hierarchy
  selectedObjectId: 'Room_Mesh',
  expandedNodes: ['Scene', 'Room_Mesh', 'Lights'],
  setSelectedObject: (id) => set({ selectedObjectId: id }),
  toggleNode: (id) =>
    set((state) => ({
      expandedNodes: state.expandedNodes.includes(id)
        ? state.expandedNodes.filter((nodeId) => nodeId !== id)
        : [...state.expandedNodes, id],
    })),

  // Transform state for all objects (virtual + real)
  sceneObjectTransforms: { ...DEFAULT_TRANSFORMS },

  initObjectTransform: (id, position, rotation, scale) =>
    set((state) => {
      if (state.sceneObjectTransforms[id]) return state;
      return {
        sceneObjectTransforms: {
          ...state.sceneObjectTransforms,
          [id]: { position, rotation, scale },
        },
      };
    }),

  updateObjectTransform: (id, partial) =>
    set((state) => {
      const current = state.sceneObjectTransforms[id] || {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      const next = { ...current };
      if (partial.position !== undefined) next.position = [...partial.position];
      if (partial.rotation !== undefined) next.rotation = [...partial.rotation];
      if (partial.scale !== undefined) next.scale = [...partial.scale];
      return {
        sceneObjectTransforms: {
          ...state.sceneObjectTransforms,
          [id]: next,
        },
      };
    }),

  batchInitObjectTransforms: (entries) =>
    set((state) => {
      const next = { ...state.sceneObjectTransforms };
      for (const [id, transform] of Object.entries(entries)) {
        if (!next[id]) {
          next[id] = transform;
        }
      }
      return { sceneObjectTransforms: next };
    }),

  // Imported GLB scene
  glbImportRequestId: 0,
  importedGlbFileName: null,
  glbImportStatus: 'idle',
  glbImportError: null,
  glbImportWarnings: [],
  vlmEstimateStatus: 'idle',
  sceneObjects: [],
  requestGlbImport: () =>
    set((state) => ({
      glbImportRequestId: state.glbImportRequestId + 1,
      leftPanelTab: 'video',
    })),
  setGlbImportStatus: (status, error = null) =>
    set({ glbImportStatus: status, glbImportError: error }),
  setVlmEstimateStatus: (status) => set({ vlmEstimateStatus: status }),
  addGlbImportWarning: (warning) =>
    set((state) => ({ glbImportWarnings: [...state.glbImportWarnings, warning] })),
  setImportedScene: ({ fileName, objects, warnings = [] }) =>
    set((state) => {
      const newTransforms = { ...state.sceneObjectTransforms };
      for (const obj of objects) {
        newTransforms[obj.id] = {
          position: obj.center ? [...obj.center] : [0, 0, 0],
          rotation: [0, 0, 0],
          scale: obj.dimensions ? obj.dimensions.map((d) => (d > 0.001 ? d : 1)) : [1, 1, 1],
        };
      }
      return {
        importedGlbFileName: fileName,
        sceneObjects: objects,
        glbImportStatus: 'ready',
        glbImportError: null,
        glbImportWarnings: warnings,
        selectedObjectId: objects[0]?.id ?? state.selectedObjectId,
        expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
        sceneObjectTransforms: newTransforms,
      };
    }),
  addImportedScene: ({ fileName, objects, warnings = [] }) =>
    set((state) => {
      const newTransforms = { ...state.sceneObjectTransforms };
      for (const obj of objects) {
        newTransforms[obj.id] = {
          position: obj.center ? [...obj.center] : [0, 0, 0],
          rotation: [0, 0, 0],
          scale: obj.dimensions ? obj.dimensions.map((d) => (d > 0.001 ? d : 1)) : [1, 1, 1],
        };
      }
      return {
        importedGlbFileName: fileName,
        sceneObjects: [...state.sceneObjects, ...objects],
        glbImportStatus: 'ready',
        glbImportError: null,
        glbImportWarnings: [...state.glbImportWarnings, ...warnings],
        selectedObjectId: objects[0]?.id ?? state.selectedObjectId,
        expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
        sceneObjectTransforms: newTransforms,
      };
    }),
  mergeSceneObjectEstimate: (objectId, estimate) =>
    set((state) => ({
      sceneObjects: state.sceneObjects.map((object) =>
        object.id === objectId
          ? {
              ...object,
              label: estimate.label || object.label,
              physics: {
                ...object.physics,
                ...estimate,
                needsVisualEstimate: false,
                source: 'vlm',
              },
            }
          : object
      ),
    })),
  clearImportedScene: () =>
    set({
      importedGlbFileName: null,
      glbImportStatus: 'idle',
      glbImportError: null,
      glbImportWarnings: [],
      vlmEstimateStatus: 'idle',
      sceneObjects: [],
      selectedObjectId: 'Room_Mesh',
    }),

  // Upload (mock)
  uploadedVideoName: null,
  uploadedVideoDuration: null,
  setUploadedVideo: (name, duration) =>
    set({ uploadedVideoName: name, uploadedVideoDuration: duration }),

  // Chat (mock)
  chatMessages: [
    { id: 1, sender: 'ai', text: 'Upload an image or describe an asset to generate a 3D model.' },
    { id: 2, sender: 'user', text: 'A wooden chair with a cushion.' },
    { id: 3, sender: 'ai', text: 'Generating a wooden chair mesh... This may take a moment.', loading: false },
    { id: 4, sender: 'ai', text: 'Asset ready - wooden_chair.glb added to your scene.' },
  ],
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateLastMessage: (msg) =>
    set((state) => {
      const msgs = [...state.chatMessages];
      msgs[msgs.length - 1] = msg;
      return { chatMessages: msgs };
    }),
}));

export default useStore;
