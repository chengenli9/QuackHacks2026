import { create } from 'zustand';
import {
  applySceneOperationToState,
  mergeObjectEstimate,
  normalizeSceneObject,
  updateObjectAppearance,
  updateObjectPhysics,
  updateObjectTransform,
} from '../lib/sceneState.js';

const useStore = create((set) => ({
  // App navigation
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),

  // Panel state
  leftPanelTab: 'import',
  chatSubTab: 'prompt',
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setChatSubTab: (tab) => set({ chatSubTab: tab }),

  // Viewport
  activeTool: 'select',
  viewMode: 'material',
  perspective: 'Perspective',
  overlaysEnabled: true,
  gravityEnabled: false,
  exportRequestedAt: null,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPerspective: (perspective) => set({ perspective }),
  toggleOverlays: () => set((state) => ({ overlaysEnabled: !state.overlaysEnabled })),
  setGravityEnabled: (gravityEnabled) => set({ gravityEnabled }),

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
      leftPanelTab: 'import',
    })),
  setGlbImportStatus: (status, error = null) =>
    set({ glbImportStatus: status, glbImportError: error }),
  setVlmEstimateStatus: (status) => set({ vlmEstimateStatus: status }),
  addGlbImportWarning: (warning) =>
    set((state) => ({ glbImportWarnings: [...state.glbImportWarnings, warning] })),
  setImportedScene: ({ fileName, objects, warnings = [] }) =>
    set((state) => ({
      importedGlbFileName: fileName,
      sceneObjects: objects.map(normalizeSceneObject),
      glbImportStatus: 'ready',
      glbImportError: null,
      glbImportWarnings: warnings,
      selectedObjectId: objects[0]?.id ?? state.selectedObjectId,
      expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
    })),
  addImportedScene: ({ fileName, objects, warnings = [] }) =>
    set((state) => ({
      importedGlbFileName: fileName,
      sceneObjects: [...state.sceneObjects, ...objects.map(normalizeSceneObject)],
      glbImportStatus: 'ready',
      glbImportError: null,
      glbImportWarnings: [...state.glbImportWarnings, ...warnings],
      selectedObjectId: objects[0]?.id ?? state.selectedObjectId,
      expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
    })),
  mergeSceneObjectEstimate: (objectId, estimate) =>
    set((state) => ({
      sceneObjects: mergeObjectEstimate(state.sceneObjects, objectId, estimate),
    })),
  updateSceneObjectTransform: (objectId, patch) =>
    set((state) => ({
      sceneObjects: updateObjectTransform(state.sceneObjects, objectId, patch),
    })),
  setSceneObjectRuntimeTransform: (objectId, patch) =>
    set((state) => ({
      sceneObjects: updateObjectTransform(state.sceneObjects, objectId, patch, { runtime: true }),
    })),
  updateSceneObjectAppearance: (objectId, patch) =>
    set((state) => ({
      sceneObjects: updateObjectAppearance(state.sceneObjects, objectId, patch),
    })),
  updateSceneObjectPhysics: (objectId, patch) =>
    set((state) => ({
      sceneObjects: updateObjectPhysics(state.sceneObjects, objectId, patch),
    })),
  applySceneOperation: (operation) =>
    set((state) => applySceneOperationToState(state, operation)),
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

  // Generated assets
  generatedTasks: [],
  upsertGeneratedTask: (task) =>
    set((state) => {
      const existing = state.generatedTasks.some((item) => item.taskId === task.taskId);
      return {
        generatedTasks: existing
          ? state.generatedTasks.map((item) => (item.taskId === task.taskId ? { ...item, ...task } : item))
          : [...state.generatedTasks, task],
      };
    }),

  // Chat
  chatMessages: [
    { id: 1, sender: 'ai', text: 'Import a GLB scene, then ask me to edit objects or add generated assets.' },
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
