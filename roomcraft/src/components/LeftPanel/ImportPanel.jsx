import { useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Box, Sparkles, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { requestFallbackAsset } from '../../lib/apiClient';
import { generatedTaskDisplayStatus } from '../../lib/generatedTaskState';
import { loadGlbIntoScene } from '../../lib/glbImport';
import { createProjectAssetSource } from '../../lib/projectPersistence';
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function ImportPanel() {
  const {
    importedGlbFileName,
    glbImportRequestId,
    sceneObjects,
    manifestFileName,
    manifestStatus,
    manifestWarnings,
    glbImportStatus,
    glbImportError,
    glbImportWarnings,
    vlmEstimateStatus,
    generatedTasks,
    savedProjectStatus,
    savedProjectError,
    restoredProjectNotice,
    demoSceneUrl,
    setGlbImportStatus,
    setVlmEstimateStatus,
    addImportedScene,
    mergeSceneObjectEstimate,
    addGlbImportWarning,
    mergeManifestMetadata,
    setManifestStatus,
    clearImportedScene,
    upsertGeneratedTask,
  } = useStore();
  const lastHandledGlbImportRequest = useRef(0);

  const importFromUrl = useCallback(async ({ url, fileName, sourcePrompt, placement, manifest, assetSource }) => {
    try {
      return await loadGlbIntoScene({
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
        manifest,
        assetSource,
      });
    } catch (error) {
      setGlbImportStatus('error', errorMessage(error));
      setVlmEstimateStatus('error');
      return [];
    }
  }, [
    addGlbImportWarning,
    addImportedScene,
    mergeSceneObjectEstimate,
    setGlbImportStatus,
    setVlmEstimateStatus,
  ]);

  const importFile = useCallback(async (file, manifest) => {
    const dataUrl = await fileToDataUrl(file);
    const assetSource = createProjectAssetSource({
      fileName: file.name,
      dataUrl,
      mimeType: file.type || 'model/gltf-binary',
    });
    await importFromUrl({ url: dataUrl, fileName: file.name, manifest, assetSource });
  }, [importFromUrl]);

  const readManifestFile = useCallback(async (file) => {
    setManifestStatus('loading');
    try {
      const manifest = JSON.parse(await file.text());
      setManifestStatus('ready', [], file.name);
      return manifest;
    } catch (error) {
      setManifestStatus('error', [`Could not parse manifest.json: ${errorMessage(error)}`], file.name);
      return null;
    }
  }, [setManifestStatus]);

  const onGlbDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    void (async () => {
      const manifestFile = accepted.find((file) => file.name.toLowerCase().endsWith('.json'));
      const glbFile = accepted.find((file) => file.name.toLowerCase().endsWith('.glb'));
      const manifest = manifestFile ? await readManifestFile(manifestFile) : null;

      if (glbFile) {
        await importFile(glbFile, manifest);
      } else if (manifestFile && manifest) {
        mergeManifestMetadata({ fileName: manifestFile.name, manifest });
      }
    })();
  }, [importFile, mergeManifestMetadata, readManifestFile]);

  const glbDropzone = useDropzone({
    onDrop: onGlbDrop,
    accept: {
      'model/gltf-binary': ['.glb'],
      'application/octet-stream': ['.glb'],
      'application/json': ['.json'],
    },
    multiple: true,
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
      const assetSource = createProjectAssetSource({
        fileName: `${asset.id}.glb`,
        sourceUrl: asset.glbUrl,
        type: 'url',
      });
      await importFromUrl({
        url: asset.glbUrl,
        fileName: `${asset.id}.glb`,
        sourcePrompt: asset.sourcePrompt,
        placement: task.placement,
        assetSource,
      });
      upsertGeneratedTask({ ...task, ...asset, status: 'ready' });
    } catch (error) {
      upsertGeneratedTask({ ...task, status: 'fallback-error', error: errorMessage(error) });
    }
  };

  const handleDemoScene = () => {
    const fileName = demoSceneUrl.split('/').pop() || 'demo-scene.glb';
    const assetSource = createProjectAssetSource({
      fileName,
      sourceUrl: demoSceneUrl,
      type: 'url',
    });
    void importFromUrl({ url: demoSceneUrl, fileName, assetSource });
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
          Drop .glb scene and optional manifest.json<br />or click to browse
        </span>
      </div>

      <button className={styles.processBtn} onClick={handleDemoScene}>
        Load Demo Scene
      </button>

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

      {(restoredProjectNotice || savedProjectError) && (
        <div className={`${styles.importNotice} ${savedProjectStatus === 'error' ? styles.errorNotice : ''}`}>
          <Sparkles size={14} />
          <span>{savedProjectError ?? restoredProjectNotice}</span>
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
            <span>{sceneObjects.filter((object) => object.physics?.needsVisualEstimate).length} need VLM</span>
            <span>{vlmStatusLabel(vlmEstimateStatus)}</span>
          </div>
          {sceneObjects.some((object) => object.restoredMetadataOnly) && (
            <div className={styles.importMetaRow}>
              <span>Some meshes need reimport</span>
            </div>
          )}
        </div>
      )}

      {(manifestFileName || manifestStatus !== 'idle') && (
        <div className={styles.importSummary}>
          <div className={styles.importName}>{manifestFileName ?? 'manifest.json'}</div>
          <div className={styles.importMetaRow}>
            <span>Manifest</span>
            <span>{manifestStatus}</span>
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
                <span>{generatedTaskDisplayStatus(task)}</span>
              </div>
              {Number.isFinite(task.progress) && (
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${task.progress}%` }} />
                </div>
              )}
              {task.error && <div className={styles.importMetaRow}>{task.error}</div>}
              {(task.status === 'failed' || task.status === 'fallback_available') && task.fallbackAssetKey && (
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

      {manifestWarnings.map((warning) => (
        <div key={warning} className={styles.importNotice}>
          <AlertTriangle size={14} />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}
