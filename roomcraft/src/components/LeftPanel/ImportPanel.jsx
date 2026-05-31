import { useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Box, Sparkles, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { requestFallbackAsset } from '../../lib/apiClient';
import { loadGlbIntoScene } from '../../lib/glbImport';
import styles from './LeftPanel.module.css';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function statusLabel(status) {
  switch (status) {
    case 'loading':
      return 'Loading';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

function vlmStatusLabel(status) {
  switch (status) {
    case 'estimating':
      return 'VLM estimating';
    case 'complete':
      return 'VLM complete';
    case 'unavailable':
      return 'VLM unavailable';
    case 'error':
      return 'VLM error';
    default:
      return 'VLM idle';
  }
}

export default function ImportPanel() {
  const {
    importedGlbFileName,
    glbImportRequestId,
    sceneObjects,
    glbImportStatus,
    glbImportError,
    glbImportWarnings,
    vlmEstimateStatus,
    generatedTasks,
    setGlbImportStatus,
    setVlmEstimateStatus,
    addImportedScene,
    mergeSceneObjectEstimate,
    addGlbImportWarning,
    clearImportedScene,
    upsertGeneratedTask,
  } = useStore();
  const lastHandledGlbImportRequest = useRef(0);

  const importFromUrl = useCallback(async ({ url, fileName, sourcePrompt, placement }) => {
    try {
      await loadGlbIntoScene({
        sourceUrl: url,
        fileName,
        sceneObjects: useStore.getState().sceneObjects,
        addImportedScene,
        setGlbImportStatus,
        setVlmEstimateStatus,
        mergeSceneObjectEstimate,
        addGlbImportWarning,
        sourcePrompt,
        placement,
      });
    } catch (error) {
      setGlbImportStatus('error', errorMessage(error));
      setVlmEstimateStatus('error');
    }
  }, [
    addGlbImportWarning,
    addImportedScene,
    mergeSceneObjectEstimate,
    setGlbImportStatus,
    setVlmEstimateStatus,
  ]);

  const importFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    try {
      await importFromUrl({ url, fileName: file.name });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [importFromUrl]);

  const onGlbDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    void importFile(accepted[0]);
  }, [importFile]);

  const glbDropzone = useDropzone({
    onDrop: onGlbDrop,
    accept: { 'model/gltf-binary': ['.glb'], 'application/octet-stream': ['.glb'] },
    multiple: false,
  });

  useEffect(() => {
    if (glbImportRequestId > lastHandledGlbImportRequest.current) {
      lastHandledGlbImportRequest.current = glbImportRequestId;
      glbDropzone.open();
    }
  }, [glbDropzone, glbImportRequestId]);

  const handleFallbackAsset = async (task) => {
    try {
      upsertGeneratedTask({ ...task, status: 'loading-fallback' });
      const asset = await requestFallbackAsset({
        fallbackAssetKey: task.fallbackAssetKey,
        sourcePrompt: task.prompt,
      });
      upsertGeneratedTask({ ...task, ...asset, status: 'fallback-ready' });
      await importFromUrl({
        url: asset.glbUrl,
        fileName: `${asset.id}.glb`,
        sourcePrompt: asset.sourcePrompt,
        placement: task.placement,
      });
    } catch (error) {
      upsertGeneratedTask({ ...task, status: 'fallback-error', error: errorMessage(error) });
    }
  };

  return (
    <div className={styles.importPanel}>
      <span className={styles.sectionLabel}>GLB Scene</span>

      <div
        {...glbDropzone.getRootProps()}
        className={`${styles.dropzone} ${glbDropzone.isDragActive ? styles.dragOver : ''}`}
      >
        <input {...glbDropzone.getInputProps()} />
        <Box size={20} className={styles.dropzoneIcon} />
        <span className={styles.dropzoneText}>
          Drop .glb scene<br />or click to browse
        </span>
      </div>

      {glbImportStatus === 'loading' && (
        <div className={styles.importNotice}>
          <Sparkles size={14} />
          <span>Loading GLB nodes...</span>
        </div>
      )}

      {glbImportError && (
        <div className={`${styles.importNotice} ${styles.errorNotice}`}>
          <AlertTriangle size={14} />
          <span>{glbImportError}</span>
        </div>
      )}

      {importedGlbFileName && (
        <div className={styles.importSummary}>
          <button className={styles.clearImportBtn} title="Clear imported GLB" onClick={clearImportedScene}>
            <X size={12} />
          </button>
          <div className={styles.importName}>{importedGlbFileName}</div>
          <div className={styles.importMetaRow}>
            <span>{sceneObjects.length} objects</span>
            <span>{statusLabel(glbImportStatus)}</span>
          </div>
          <div className={styles.importMetaRow}>
            <span>{sceneObjects.filter((object) => object.physics.needsVisualEstimate).length} need VLM</span>
            <span>{vlmStatusLabel(vlmEstimateStatus)}</span>
          </div>
        </div>
      )}

      {generatedTasks.length > 0 && (
        <>
          <div className={styles.panelDivider} />
          <span className={styles.sectionLabel}>Generated Assets</span>
          {generatedTasks.map((task) => (
            <div key={task.taskId ?? task.prompt} className={styles.importSummary}>
              <div className={styles.importName}>{task.prompt}</div>
              <div className={styles.importMetaRow}>
                <span>{task.provider ?? 'meshy'}</span>
                <span>{task.status}</span>
              </div>
              {task.error && <div className={styles.importMetaRow}>{task.error}</div>}
              {task.status === 'failed' && task.fallbackAssetKey && (
                <button className={styles.processBtn} onClick={() => void handleFallbackAsset(task)}>
                  Use fallback asset
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {glbImportWarnings.map((warning) => (
        <div key={warning} className={styles.importNotice}>
          <AlertTriangle size={14} />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}
