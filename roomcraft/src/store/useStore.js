import { create } from 'zustand';
import {
  applySceneOperationToState,
  mergeObjectEstimate,
  normalizeSceneObject,
  updateObjectAppearance,
  updateObjectPhysics,
  updateObjectTransform,
} from '../lib/sceneState.js';
import { applyManifestToSceneObjects } from '../lib/manifestImport.js';

const DEFAULT_CHAT_MESSAGES = [
  { id: 1, sender: 'ai', text: 'Import a GLB scene, then ask me to edit objects or add generated assets.' },
];

const resettableProjectState = () => ({
  leftPanelTab: 'import',
  chatSubTab: 'prompt',
  activeTool: 'select',
  viewMode: 'material',
  perspective: 'Perspective',
  overlaysEnabled: true,
  gravityEnabled: false,
  collisionsEnabled: true,
  exportRequestedAt: null,
  selectedObjectId: 'Room_Mesh',
  expandedNodes: ['Scene', 'Room_Mesh', 'Lights'],
  glbImportRequestId: 0,
  importedGlbFileName: null,
  glbImportStatus: 'idle',
  glbImportError: null,
  glbImportWarnings: [],
  manifestFileName: null,
  manifestStatus: 'idle',
  manifestWarnings: [],
  vlmEstimateStatus: 'idle',
  sceneObjects: [],
  generatedTasks: [],
  highlightedObjectId: null,
  demoSceneUrl: '/chaoman.glb',
  sourceImageUrl: null,
  chatMessages: DEFAULT_CHAT_MESSAGES,
});

const useStore = create((set) => ({
  // App navigation
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),

  ...resettableProjectState(),

  // Panel state
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setChatSubTab: (tab) => set({ chatSubTab: tab }),

  // Viewport
  setActiveTool: (tool) => set({ activeTool: tool }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPerspective: (perspective) => set({ perspective }),
  toggleOverlays: () => set((state) => ({ overlaysEnabled: !state.overlaysEnabled })),
  setGravityEnabled: (gravityEnabled) => set({ gravityEnabled }),
  setCollisionsEnabled: (collisionsEnabled) => set({ collisionsEnabled }),
  requestSceneExport: () =>
    set((state) => ({ exportRequestedAt: (state.exportRequestedAt ?? 0) + 1 })),

  // Hierarchy
  setSelectedObject: (id) => set({ selectedObjectId: id }),
  setHighlightedObject: (id) => set({ highlightedObjectId: id }),
  toggleNode: (id) =>
    set((state) => ({
      expandedNodes: state.expandedNodes.includes(id)
        ? state.expandedNodes.filter((nodeId) => nodeId !== id)
        : [...state.expandedNodes, id],
    })),

  // Imported GLB scene
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
      highlightedObjectId: objects[0]?.id ?? state.highlightedObjectId,
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
      highlightedObjectId: objects[0]?.id ?? state.highlightedObjectId,
      expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
    })),
  mergeManifestMetadata: ({ fileName, manifest }) =>
    set((state) => {
      const result = applyManifestToSceneObjects(state.sceneObjects, manifest);
      return {
        sceneObjects: result.objects.map(normalizeSceneObject),
        manifestFileName: fileName,
        manifestStatus: 'ready',
        manifestWarnings: result.warnings,
      };
    }),
  setManifestStatus: (status, warnings = [], fileName = null) =>
    set((state) => ({
      manifestStatus: status,
      manifestWarnings: warnings,
      manifestFileName: fileName ?? state.manifestFileName,
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
      manifestFileName: null,
      manifestStatus: 'idle',
      manifestWarnings: [],
      vlmEstimateStatus: 'idle',
      sceneObjects: [],
      selectedObjectId: 'Room_Mesh',
      highlightedObjectId: null,
    }),

  // Generated assets
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
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateLastMessage: (msg) =>
    set((state) => {
      const msgs = [...state.chatMessages];
      msgs[msgs.length - 1] = msg;
      return { chatMessages: msgs };
    }),
  resetProject: () =>
    set((state) => ({
      currentView: state.currentView === 'landing' ? 'landing' : 'editor',
      ...resettableProjectState(),
      glbImportRequestId: state.glbImportRequestId,
    })),
}));

export default useStore;
