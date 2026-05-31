import { normalizeSceneObject } from './sceneState.js';

export const PROJECT_SAVE_VERSION = 1;
export const PROJECT_STORAGE_KEY = 'roomcraft:last-project';
const DB_NAME = 'roomcraft-projects';
const DB_VERSION = 1;
const DB_STORE = 'projects';

const PROJECT_FIELDS = [
  'currentView',
  'leftPanelTab',
  'chatSubTab',
  'activeTool',
  'viewMode',
  'perspective',
  'overlaysEnabled',
  'gravityEnabled',
  'collisionsEnabled',
  'floorEnabled',
  'exportRequestedAt',
  'selectedObjectId',
  'expandedNodes',
  'sceneObjectTransforms',
  'glbImportRequestId',
  'importedGlbFileName',
  'glbImportStatus',
  'glbImportError',
  'glbImportWarnings',
  'manifestFileName',
  'manifestStatus',
  'manifestWarnings',
  'vlmEstimateStatus',
  'sceneObjects',
  'assetSources',
  'generatedTasks',
  'highlightedObjectId',
  'sceneBackground',
  'backgroundGallery',
  'demoSceneUrl',
  'sourceImageUrl',
  'chatMessages',
];

export function serializeProjectState(state) {
  const project = {};

  for (const field of PROJECT_FIELDS) {
    if (field === 'sceneObjects') {
      project.sceneObjects = (state.sceneObjects ?? []).map(stripRuntimeObject);
    } else {
      project[field] = cloneJson(state[field]);
    }
  }

  return {
    version: PROJECT_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    project: {
      ...project,
      currentView: 'editor',
      assetSources: cloneJson(state.assetSources ?? []),
    },
  };
}

export function hydrateProjectSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const project = snapshot.project ?? {};
  const sceneObjects = (project.sceneObjects ?? []).map((object) =>
    normalizeSceneObject({
      ...stripRuntimeObject(object),
      restoredMetadataOnly: true,
    })
  );

  return {
    ...cloneJson(project),
    currentView: 'editor',
    floorEnabled: project.floorEnabled ?? true,
    backgroundGallery: cloneJson(project.backgroundGallery ?? []),
    sceneObjects,
    assetSources: cloneJson(project.assetSources ?? []),
    savedProjectUpdatedAt: snapshot.savedAt,
    restoredProjectNotice: sceneObjects.length
      ? 'Project metadata restored. Reloading saved GLB sources...'
      : 'Project restored.',
  };
}

export async function writeSavedProject(snapshot, storage = browserProjectStorage()) {
  validateSnapshot(snapshot);
  await storage.setProject(PROJECT_STORAGE_KEY, snapshot);
  return snapshot;
}

export async function readSavedProject(storage = browserProjectStorage()) {
  const snapshot = await storage.getProject(PROJECT_STORAGE_KEY);
  if (!snapshot) return null;
  validateSnapshot(snapshot);
  return snapshot;
}

export function createMemoryProjectStorage() {
  const values = new Map();
  return {
    async getProject(key) {
      return values.get(key) ?? null;
    },
    async setProject(key, snapshot) {
      values.set(key, snapshot);
    },
  };
}

export function createProjectAssetSource({ fileName, sourceUrl, dataUrl, type, mimeType, id }) {
  const sourceType = type ?? (dataUrl ? 'data-url' : 'url');
  return {
    id: id ?? uniqueAssetId(fileName ?? sourceUrl ?? 'asset'),
    type: sourceType,
    fileName: fileName ?? fileNameFromUrl(sourceUrl) ?? 'asset.glb',
    mimeType: mimeType ?? null,
    ...(sourceType === 'data-url' ? { dataUrl } : { url: sourceUrl }),
  };
}

export function browserProjectStorage() {
  const root = typeof window !== 'undefined' ? window : globalThis;
  let storage = null;

  if (root?.indexedDB && root?.localStorage) {
    storage = createHybridProjectStorage(
      createIndexedDbProjectStorage(root.indexedDB),
      createLocalStorageProjectStorage(root.localStorage, { compact: true })
    );
  } else if (root?.indexedDB) {
    storage = createIndexedDbProjectStorage(root.indexedDB);
  } else if (root?.localStorage) {
    storage = createLocalStorageProjectStorage(root.localStorage);
  }

  if (root?.fetch) {
    const remote = createRemoteProjectStorage({ fetchImpl: root.fetch.bind(root), compact: false });
    storage = storage ? createPrimaryProjectStorage(remote, storage) : remote;
  }

  if (storage) return storage;
  throw new Error('No browser project storage is available.');
}

export function createHybridProjectStorage(primaryStorage, fallbackStorage) {
  return {
    async getProject(key) {
      return (await primaryStorage.getProject(key)) ?? (await fallbackStorage.getProject(key));
    },
    async setProject(key, snapshot) {
      let primaryError = null;
      let fallbackError = null;

      try {
        await primaryStorage.setProject(key, snapshot);
      } catch (error) {
        primaryError = error;
      }

      try {
        await fallbackStorage.setProject(key, snapshot);
      } catch (error) {
        fallbackError = error;
      }

      if (primaryError && fallbackError) throw primaryError;
    },
  };
}

export function createPrimaryProjectStorage(primaryStorage, mirrorStorage) {
  return {
    async getProject(key) {
      return (await primaryStorage.getProject(key)) ?? (await mirrorStorage.getProject(key));
    },
    async setProject(key, snapshot) {
      await primaryStorage.setProject(key, snapshot);
      try {
        await mirrorStorage.setProject(key, snapshot);
      } catch {
        // The authoritative project was saved; local mirrors are best-effort.
      }
    },
  };
}

export function createLocalStorageProjectStorage(localStorageImpl, options = {}) {
  return {
    async getProject(key) {
      const raw = localStorageImpl.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    async setProject(key, snapshot) {
      const value = options.compact ? compactProjectSnapshot(snapshot) : snapshot;
      localStorageImpl.setItem(key, JSON.stringify(value));
    },
  };
}

export function createRemoteProjectStorage({
  apiBaseUrl = 'http://127.0.0.1:8787',
  fetchImpl = globalThis.fetch,
  compact = false,
} = {}) {
  const baseUrl = apiBaseUrl.trim().replace(/\/+$/, '');

  return {
    async getProject() {
      const response = await fetchImpl(`${baseUrl}/api/projects/last`);
      if (response.status === 404) return null;
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Project load failed with status ${response.status}`);
      }
      return response.json();
    },
    async setProject(_key, snapshot) {
      const response = await fetchImpl(`${baseUrl}/api/projects/last`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compact ? compactProjectSnapshot(snapshot) : snapshot),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Project save failed with status ${response.status}`);
      }
    },
  };
}

export function createIndexedDbProjectStorage(indexedDBImpl) {
  return {
    async getProject(key) {
      const db = await openProjectDb(indexedDBImpl);
      try {
        return await idbRequest(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key));
      } finally {
        db.close();
      }
    },
    async setProject(key, snapshot) {
      const db = await openProjectDb(indexedDBImpl);
      try {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(snapshot, key);
        await idbTransaction(tx);
      } finally {
        db.close();
      }
    },
  };
}

function stripRuntimeObject(object = {}) {
  const serializable = { ...object };
  delete serializable.object3d;
  return cloneJson(serializable);
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== PROJECT_SAVE_VERSION || !snapshot.project) {
    throw new Error('Saved project is missing or uses an unsupported format.');
  }
}

function compactProjectSnapshot(snapshot) {
  return {
    ...snapshot,
    project: {
      ...snapshot.project,
      assetSources: (snapshot.project.assetSources ?? []).map((asset) => {
        if (asset.type !== 'data-url') return asset;
        const compactAsset = { ...asset };
        delete compactAsset.dataUrl;
        return {
          ...compactAsset,
          dataUrlUnavailable: true,
        };
      }),
    },
  };
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function openProjectDb(indexedDBImpl) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open project database.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Project storage request failed.'));
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

function idbTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error ?? new Error('Project storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Project storage transaction was aborted.'));
    transaction.oncomplete = () => resolve();
  });
}

function uniqueAssetId(input) {
  const suffix = Math.random().toString(36).slice(2, 9);
  const slug = String(input)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `asset_${Date.now().toString(36)}_${slug || 'glb'}_${suffix}`;
}

function fileNameFromUrl(url) {
  if (!url) return null;
  return String(url).split('/').pop()?.split('?')[0] || null;
}
