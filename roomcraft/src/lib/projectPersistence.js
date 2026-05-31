import { normalizeSceneObject } from './sceneState.js';

export const PROJECT_SAVE_VERSION = 1;
export const PROJECT_STORAGE_KEY = 'roomcraft:last-project';
export const DEFAULT_PROJECT_ID = 'roomcraft-demo';
const DB_NAME = 'roomcraft-projects';
const DB_VERSION = 1;
const DB_STORE = 'projects';

const PROJECT_FIELDS = [
  'currentView',
  'projectId',
  'projectName',
  'leftPanelTab',
  'chatSubTab',
  'activeTool',
  'viewMode',
  'perspective',
  'overlaysEnabled',
  'objectLabelsEnabled',
  'physicsXrayEnabled',
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
  'sceneBackground',
  'backgroundGallery',
  'demoSceneUrl',
  'sourceImageUrl',
  'chatMessages',
];

export function serializeProjectState(state, options = {}) {
  const project = {};
  const serializableState = state.showtimeEnabled && state.showtimeReturnState
    ? { ...state, ...state.showtimeReturnState }
    : state;
  const projectId = options.projectId ?? serializableState.projectId ?? DEFAULT_PROJECT_ID;
  const projectName = options.projectName ?? serializableState.projectName ?? 'RoomCraft Demo';

  for (const field of PROJECT_FIELDS) {
    if (field === 'sceneObjects') {
      project.sceneObjects = (serializableState.sceneObjects ?? []).map(stripRuntimeObject);
    } else {
      project[field] = cloneJson(serializableState[field]);
    }
  }

  return {
    version: PROJECT_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    project: {
      ...project,
      projectId,
      projectName,
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
    objectLabelsEnabled: project.objectLabelsEnabled ?? false,
    physicsXrayEnabled: project.physicsXrayEnabled ?? false,
    backgroundGallery: cloneJson(project.backgroundGallery ?? []),
    sceneObjects,
    selectedObjectId: selectableProjectObjectId(project.selectedObjectId, sceneObjects),
    assetSources: cloneJson(project.assetSources ?? []),
    savedProjectUpdatedAt: snapshot.savedAt,
    projectId: project.projectId ?? DEFAULT_PROJECT_ID,
    projectName: project.projectName ?? 'RoomCraft Demo',
    restoredProjectNotice: sceneObjects.length
      ? 'Project metadata restored. Reloading saved GLB sources...'
      : 'Project restored.',
  };
}

function selectableProjectObjectId(objectId, sceneObjects) {
  return sceneObjects.some((object) => object.id === objectId)
    ? objectId
    : sceneObjects[0]?.id ?? 'Room_Mesh';
}

export async function writeSavedProject(snapshot, storage = browserProjectStorage(), projectId = snapshot?.project?.projectId) {
  validateSnapshot(snapshot);
  await storage.setProject(projectStorageKey(projectId), snapshot);
  return snapshot;
}

export async function readSavedProject(storage = browserProjectStorage(), projectId = DEFAULT_PROJECT_ID) {
  const snapshot =
    (await storage.getProject(projectStorageKey(projectId))) ??
    (projectId === DEFAULT_PROJECT_ID ? await storage.getProject(PROJECT_STORAGE_KEY) : null);
  if (!snapshot) return null;
  validateSnapshot(snapshot);
  return snapshot;
}

export async function listSavedProjects(storage = browserProjectStorage()) {
  return storage.listProjects ? storage.listProjects() : [];
}

export function projectIdForName(name) {
  return safeProjectId(name);
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
    async listProjects() {
      return Array.from(values.entries()).map(([key, snapshot]) => projectSummaryFromSnapshot(key, snapshot));
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
      try {
        return (await primaryStorage.getProject(key)) ?? (await fallbackStorage.getProject(key));
      } catch {
        return fallbackStorage.getProject(key);
      }
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
    async listProjects() {
      const primaryProjects = primaryStorage.listProjects
        ? await primaryStorage.listProjects().catch(() => [])
        : [];
      const fallbackProjects = fallbackStorage.listProjects ? await fallbackStorage.listProjects() : [];
      return mergeProjectLists(primaryProjects, fallbackProjects);
    },
  };
}

export function createPrimaryProjectStorage(primaryStorage, mirrorStorage) {
  return {
    async getProject(key) {
      try {
        return (await primaryStorage.getProject(key)) ?? (await mirrorStorage.getProject(key));
      } catch {
        return mirrorStorage.getProject(key);
      }
    },
    async setProject(key, snapshot) {
      let primaryError = null;
      try {
        await primaryStorage.setProject(key, snapshot);
      } catch (error) {
        primaryError = error;
      }

      let mirrorError = null;
      try {
        await mirrorStorage.setProject(key, snapshot);
      } catch (error) {
        mirrorError = error;
      }

      if (primaryError && mirrorError) throw primaryError;
    },
    async listProjects() {
      const primaryProjects = primaryStorage.listProjects
        ? await primaryStorage.listProjects().catch(() => [])
        : [];
      const mirrorProjects = mirrorStorage.listProjects ? await mirrorStorage.listProjects() : [];
      return mergeProjectLists(primaryProjects, mirrorProjects);
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
    async listProjects() {
      const projects = [];
      if (typeof localStorageImpl.length === 'number' && typeof localStorageImpl.key === 'function') {
        for (let index = 0; index < localStorageImpl.length; index += 1) {
          const key = localStorageImpl.key(index);
          if (!isProjectStorageKey(key)) continue;
          const raw = localStorageImpl.getItem(key);
          if (!raw) continue;
          projects.push(projectSummaryFromSnapshot(key, JSON.parse(raw)));
        }
      }
      return projects;
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
    async getProject(key) {
      const response = await fetchImpl(`${baseUrl}/api/projects/${encodeURIComponent(projectIdFromStorageKey(key))}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Project load failed with status ${response.status}`);
      }
      return response.json();
    },
    async setProject(_key, snapshot) {
      const projectId = snapshot.project?.projectId ?? projectIdFromStorageKey(_key);
      const response = await fetchImpl(`${baseUrl}/api/projects/${encodeURIComponent(safeProjectId(projectId))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compact ? compactProjectSnapshot(snapshot) : snapshot),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Project save failed with status ${response.status}`);
      }
    },
    async listProjects() {
      const response = await fetchImpl(`${baseUrl}/api/projects`);
      if (response.status === 404) return [];
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Project list failed with status ${response.status}`);
      }
      const body = await response.json();
      return body.projects ?? [];
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
    async listProjects() {
      const db = await openProjectDb(indexedDBImpl);
      try {
        const values = await idbGetAll(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE));
        return values
          .map(({ key, value }) => projectSummaryFromSnapshot(key, value))
          .filter(Boolean);
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

function idbGetAll(objectStore) {
  return new Promise((resolve, reject) => {
    const request = objectStore.openCursor();
    const values = [];
    request.onerror = () => reject(request.error ?? new Error('Project storage cursor failed.'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(values);
        return;
      }
      values.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
  });
}

function projectStorageKey(projectId) {
  return projectId ? `roomcraft:project:${safeProjectId(projectId)}` : PROJECT_STORAGE_KEY;
}

function isProjectStorageKey(key) {
  return key === PROJECT_STORAGE_KEY || String(key ?? '').startsWith('roomcraft:project:');
}

function projectIdFromStorageKey(key) {
  if (!key || key === PROJECT_STORAGE_KEY) return 'last';
  return safeProjectId(String(key).replace(/^roomcraft:project:/, ''));
}

function safeProjectId(value) {
  const slug = String(value ?? DEFAULT_PROJECT_ID)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug && slug !== 'last' ? slug : DEFAULT_PROJECT_ID;
}

function projectSummaryFromSnapshot(key, snapshot) {
  if (!snapshot?.project) return null;
  const id = snapshot.project.projectId ?? projectIdFromStorageKey(key);
  return {
    id,
    name: snapshot.project.projectName ?? readableProjectName(id),
    savedAt: snapshot.savedAt,
    updatedAt: snapshot.savedAt,
    importedGlbFileName: snapshot.project.importedGlbFileName ?? null,
    objectCount: Array.isArray(snapshot.project.sceneObjects) ? snapshot.project.sceneObjects.length : 0,
  };
}

function readableProjectName(projectId) {
  return String(projectId ?? DEFAULT_PROJECT_ID)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function mergeProjectLists(primaryProjects, fallbackProjects) {
  const projectsById = new Map();
  for (const project of [...fallbackProjects, ...primaryProjects]) {
    if (project?.id) projectsById.set(project.id, project);
  }
  return Array.from(projectsById.values()).sort((a, b) =>
    String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? ''))
  );
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
