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
import {
  hydrateProjectSnapshot,
  readSavedProject,
  serializeProjectState,
  writeSavedProject,
} from '../lib/projectPersistence.js';

const DEFAULT_CHAT_MESSAGES = [
  { id: 1, sender: 'ai', text: 'Import a GLB scene, then ask me to edit objects or add generated assets.' },
];

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
  sceneObjectTransforms: { ...DEFAULT_TRANSFORMS },
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
  assetSources: [],
  generatedTasks: [],
  highlightedObjectId: null,
  sceneBackground: {
    prompt: null,
    imageDataUrl: null,
    status: 'idle',
    error: null,
    model: null,
  },
  demoSceneUrl: '/chaoman.glb',
  sourceImageUrl: null,
  chatMessages: DEFAULT_CHAT_MESSAGES,
  savedProjectStatus: 'idle',
  savedProjectError: null,
  savedProjectUpdatedAt: null,
  restoredProjectNotice: null,
});

function transformMapForObjects(objects) {
  return Object.fromEntries(
    objects.map((object) => [
      object.id,
      {
        position: [...(object.transform?.position ?? object.center ?? [0, 0, 0])],
        rotation: [...(object.transform?.rotation ?? [0, 0, 0])],
        scale: [...(object.transform?.scale ?? [1, 1, 1])],
      },
    ])
  );
}

function updateTransformMap(sceneObjectTransforms, id, partial) {
  const current = sceneObjectTransforms[id] || {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  return {
    ...sceneObjectTransforms,
    [id]: {
      position: partial.position ? [...partial.position] : current.position,
      rotation: partial.rotation ? [...partial.rotation] : current.rotation,
      scale: partial.scale ? [...partial.scale] : current.scale,
    },
  };
}

function upsertAssetSource(assetSources, assetSource) {
  if (!assetSource?.id) return assetSources;
  const exists = assetSources.some((asset) => asset.id === assetSource.id);
  return exists
    ? assetSources.map((asset) => (asset.id === assetSource.id ? { ...asset, ...assetSource } : asset))
    : [...assetSources, assetSource];
}

const useStore = create((set, get) => ({
  // App navigation
  currentView: 'landing',
  openSavedProjectRequestId: 0,
  setCurrentView: (view) => set({ currentView: view }),
  requestOpenSavedProject: () =>
    set((state) => ({
      currentView: 'editor',
      openSavedProjectRequestId: state.openSavedProjectRequestId + 1,
      restoredProjectNotice: 'Opening saved project...',
      savedProjectError: null,
    })),

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
  setSelectedObject: (id) => set({ selectedObjectId: id, highlightedObjectId: null }),
  setHighlightedObject: (id) => set({ highlightedObjectId: id }),
  setSceneBackgroundStatus: (status, error = null) =>
    set((state) => ({
      sceneBackground: {
        ...(state.sceneBackground ?? {}),
        status,
        error,
      },
    })),
  setSceneBackground: (background) =>
    set({
      sceneBackground: {
        prompt: background.prompt,
        imageDataUrl: background.imageDataUrl,
        status: 'ready',
        error: null,
        model: background.model ?? null,
      },
    }),
  toggleNode: (id) =>
    set((state) => ({
      expandedNodes: state.expandedNodes.includes(id)
        ? state.expandedNodes.filter((nodeId) => nodeId !== id)
        : [...state.expandedNodes, id],
    })),

  // Compatibility with main's transient transform map. Scene objects remain authoritative.
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
    set((state) => ({
      sceneObjectTransforms: updateTransformMap(state.sceneObjectTransforms, id, partial),
      sceneObjects: updateObjectTransform(state.sceneObjects, id, partial),
    })),
  batchInitObjectTransforms: (entries) =>
    set((state) => {
      const next = { ...state.sceneObjectTransforms };
      for (const [id, transform] of Object.entries(entries)) {
        if (!next[id]) next[id] = transform;
      }
      return { sceneObjectTransforms: next };
    }),

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
  setImportedScene: ({ fileName, objects, warnings = [], assetSource = null }) =>
    set((state) => {
      const normalizedObjects = objects.map(normalizeSceneObject);
      return {
        importedGlbFileName: fileName,
        sceneObjects: normalizedObjects,
        assetSources: assetSource ? [assetSource] : state.assetSources,
        glbImportStatus: 'ready',
        glbImportError: null,
        glbImportWarnings: warnings,
        selectedObjectId: objects[0]?.id ?? state.selectedObjectId,
        highlightedObjectId: objects[0]?.id ?? state.highlightedObjectId,
        expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
        sceneObjectTransforms: {
          ...state.sceneObjectTransforms,
          ...transformMapForObjects(normalizedObjects),
        },
      };
    }),
  addImportedScene: ({ fileName, objects, warnings = [], assetSource = null }) =>
    set((state) => {
      const normalizedObjects = objects.map(normalizeSceneObject);
      return {
        importedGlbFileName: fileName,
        sceneObjects: [...state.sceneObjects, ...normalizedObjects],
        assetSources: upsertAssetSource(state.assetSources, assetSource),
        glbImportStatus: 'ready',
        glbImportError: null,
        glbImportWarnings: [...state.glbImportWarnings, ...warnings],
        selectedObjectId: objects[0]?.id ?? state.selectedObjectId,
        highlightedObjectId: objects[0]?.id ?? state.highlightedObjectId,
        expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
        sceneObjectTransforms: {
          ...state.sceneObjectTransforms,
          ...transformMapForObjects(normalizedObjects),
        },
      };
    }),
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
      sceneObjectTransforms: updateTransformMap(state.sceneObjectTransforms, objectId, patch),
    })),
  setSceneObjectRuntimeTransform: (objectId, patch) =>
    set((state) => ({
      sceneObjects: updateObjectTransform(state.sceneObjects, objectId, patch, { runtime: true }),
      sceneObjectTransforms: updateTransformMap(state.sceneObjectTransforms, objectId, patch),
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
      assetSources: [],
      selectedObjectId: 'Room_Mesh',
      highlightedObjectId: null,
      sceneBackground: {
        prompt: null,
        imageDataUrl: null,
        status: 'idle',
        error: null,
        model: null,
      },
    }),

  // Project persistence
  saveProject: async (storage) => {
    try {
      const snapshot = serializeProjectState(get());
      await writeSavedProject(snapshot, storage);
      set({
        savedProjectStatus: 'saved',
        savedProjectError: null,
        savedProjectUpdatedAt: snapshot.savedAt,
        restoredProjectNotice: 'Project saved locally.',
      });
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        savedProjectStatus: 'error',
        savedProjectError: message,
        restoredProjectNotice: null,
      });
      throw error;
    }
  },
  loadSavedProject: async (storage) => {
    try {
      const snapshot = await readSavedProject(storage);
      if (!snapshot) {
        set({
          currentView: 'editor',
          savedProjectStatus: 'not_found',
          savedProjectError: 'No saved project was found in this browser.',
          restoredProjectNotice: null,
        });
        return null;
      }

      set({
        ...hydrateProjectSnapshot(snapshot),
        savedProjectStatus: 'loaded',
        savedProjectError: null,
      });
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        currentView: 'editor',
        savedProjectStatus: 'error',
        savedProjectError: message,
        restoredProjectNotice: null,
      });
      throw error;
    }
  },
  setSavedProjectStatus: (status, error = null) =>
    set({ savedProjectStatus: status, savedProjectError: error }),
  restoreProjectSceneObjects: ({ objects = [], warnings = [] }) =>
    set((state) => {
      const normalizedObjects = objects.map(normalizeSceneObject);
      return {
        sceneObjects: normalizedObjects,
        sceneObjectTransforms: {
          ...state.sceneObjectTransforms,
          ...transformMapForObjects(normalizedObjects),
        },
        glbImportStatus: normalizedObjects.length > 0 ? 'ready' : state.glbImportStatus,
        glbImportWarnings: [...state.glbImportWarnings, ...warnings],
        selectedObjectId: normalizedObjects.some((object) => object.id === state.selectedObjectId)
          ? state.selectedObjectId
          : normalizedObjects[0]?.id ?? 'Room_Mesh',
        highlightedObjectId: normalizedObjects[0]?.id ?? null,
        expandedNodes: Array.from(new Set([...state.expandedNodes, 'Scene', 'Imported_GLB'])),
        savedProjectStatus: warnings.length > 0 ? 'restored_with_warnings' : 'restored',
        restoredProjectNotice: warnings.length > 0
          ? 'Project restored with warnings.'
          : 'Project restored.',
      };
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
