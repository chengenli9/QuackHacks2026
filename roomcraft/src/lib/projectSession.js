import useStore from '../store/useStore.js';
import { restoreSceneObjectsFromAssets } from './projectRestore.js';

export async function openSavedProjectFromStorage(storage) {
  try {
    const snapshot = await useStore.getState().loadSavedProject(storage);
    if (!snapshot) return null;

    useStore.getState().setSavedProjectStatus('restoring', null);
    const result = await restoreSceneObjectsFromAssets(snapshot.project);
    useStore.getState().restoreProjectSceneObjects(result);
    return { snapshot, ...result };
  } catch (error) {
    useStore.getState().setSavedProjectStatus(
      'error',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
