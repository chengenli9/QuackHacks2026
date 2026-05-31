import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Box, ImagePlus, Sparkles, Wand2, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { requestBackgroundImage, requestFallbackAsset } from '../../lib/apiClient';
import {
  buildSceneGenImagePrompt,
  configuredSceneGenBaseUrl,
  dataUrlToImageFile,
  downloadSceneGenGlb,
  pollSceneGenJob,
  submitSceneGenJob,
} from '../../lib/sceneGenClient';
import { generatedTaskDisplayStatus } from '../../lib/generatedTaskState';
import { loadGlbIntoScene } from '../../lib/glbImport';
import { createProjectAssetSource } from '../../lib/projectPersistence';
import styles from './LeftPanel.module.css';

const SCENEGEN_IDLE = { phase: 'idle', message: '', error: '' };
const SCENEGEN_PHOTO_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|avif|jxl)$/i;

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

  const [sceneGenImage, setSceneGenImage] = useState(null);
  const [sceneGenOptions, setSceneGenOptions] = useState({
    segmentationMode: 'hybrid',
    maxInstances: 12,
    textureSize: 1024,
  });
  const [sceneGenState, setSceneGenState] = useState(SCENEGEN_IDLE);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageGenState, setImageGenState] = useState({ phase: 'idle', error: '' });
  const sceneGenAbortRef = useRef(null);

  const sceneGenPreviewUrl = useMemo(
    () => (sceneGenImage ? URL.createObjectURL(sceneGenImage) : null),
    [sceneGenImage],
  );

  useEffect(() => {
    if (!sceneGenPreviewUrl) return undefined;
    return () => URL.revokeObjectURL(sceneGenPreviewUrl);
  }, [sceneGenPreviewUrl]);

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

  const onSceneGenDrop = useCallback((accepted) => {
    const image = accepted.find((file) =>
      file.type.startsWith('image/') || SCENEGEN_PHOTO_EXTENSIONS.test(file.name)
    ) ?? accepted[0];
    if (image) {
      setSceneGenImage(image);
      setSceneGenState(SCENEGEN_IDLE);
    }
  }, []);

  const sceneGenDropzone = useDropzone({
    onDrop: onSceneGenDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.bmp', '.avif', '.jxl'],
      'application/octet-stream': ['.heic', '.heif'],
    },
    multiple: false,
    noKeyboard: true,
  });

  const runSceneGenPipeline = useCallback(async () => {
    if (!sceneGenImage) return;
    const controller = new AbortController();
    sceneGenAbortRef.current = controller;

    try {
      setSceneGenState({ phase: 'submitting', message: 'Uploading photo to SceneGen...', error: '' });
      const job = await submitSceneGenJob({
        image: sceneGenImage,
        segmentationMode: sceneGenOptions.segmentationMode,
        maxInstances: sceneGenOptions.maxInstances,
        textureSize: sceneGenOptions.textureSize,
      });

      setSceneGenState({ phase: 'processing', message: `Job ${job.jobId} queued...`, error: '' });
      await pollSceneGenJob({
        jobId: job.jobId,
        signal: controller.signal,
        onUpdate: (payload) => {
          const stage = payload?.stage ?? payload?.status ?? 'processing';
          const progress = Number.isFinite(payload?.progress) ? ` (${Math.round(payload.progress)}%)` : '';
          setSceneGenState({ phase: 'processing', message: `${stage}${progress}`, error: '' });
        },
      });

      setSceneGenState({ phase: 'downloading', message: 'Downloading generated GLB...', error: '' });
      const glbFile = await downloadSceneGenGlb({ jobId: job.jobId });

      setSceneGenState({ phase: 'importing', message: 'Loading scene into viewport...', error: '' });
      await importFile(glbFile, null);

      setSceneGenState({ phase: 'done', message: `Imported scene from job ${job.jobId}.`, error: '' });
    } catch (error) {
      setSceneGenState({ phase: 'error', message: '', error: errorMessage(error) });
    } finally {
      sceneGenAbortRef.current = null;
    }
  }, [importFile, sceneGenImage, sceneGenOptions]);

  const cancelSceneGen = useCallback(() => {
    sceneGenAbortRef.current?.abort();
    setSceneGenState(SCENEGEN_IDLE);
  }, []);

  const generateSceneImage = useCallback(async () => {
    if (!imagePrompt.trim()) return;
    setImageGenState({ phase: 'generating', error: '' });
    try {
      const result = await requestBackgroundImage({
        prompt: buildSceneGenImagePrompt(imagePrompt),
      });
      if (!result?.imageDataUrl) throw new Error('Nano Banana returned no image.');
      const fileName = `nano-banana-${Date.now().toString(36)}`;
      const image = dataUrlToImageFile(result.imageDataUrl, fileName);
      setSceneGenImage(image);
      setSceneGenState(SCENEGEN_IDLE);
      setImageGenState({ phase: 'done', error: '' });
    } catch (error) {
      setImageGenState({ phase: 'error', error: errorMessage(error) });
    }
  }, [imagePrompt]);

  const imageGenBusy = imageGenState.phase === 'generating';

  const sceneGenBusy = ['submitting', 'processing', 'downloading', 'importing'].includes(sceneGenState.phase);

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

      <div className={styles.panelDivider} />
      <span className={styles.sectionLabel}>Photo → Scene (SceneGen)</span>

      <div
        {...sceneGenDropzone.getRootProps()}
        className={`${styles.dropzone} ${sceneGenDropzone.isDragActive ? styles.dragOver : ''} ${sceneGenPreviewUrl ? styles.dropzoneHasPreview : ''}`}
      >
        <input {...sceneGenDropzone.getInputProps()} />
        {sceneGenPreviewUrl ? (
          <>
            <button
              type="button"
              className={styles.clearImportBtn}
              title="Remove image"
              onClick={(event) => {
                event.stopPropagation();
                setSceneGenImage(null);
                setSceneGenState(SCENEGEN_IDLE);
              }}
            >
              <X size={12} />
            </button>
            <img src={sceneGenPreviewUrl} alt={sceneGenImage?.name ?? 'Scene source'} className={styles.imagePreview} />
            <span className={styles.dropzoneText}>{sceneGenImage?.name ?? 'Scene source'}</span>
          </>
        ) : (
          <>
            <ImagePlus size={20} className={styles.dropzoneIcon} />
            <span className={styles.dropzoneText}>
              Drop a room photo<br />HEIC converts to JPG automatically
            </span>
          </>
        )}
      </div>

      <span className={styles.sectionLabel}>Or generate one with Nano Banana</span>
      <textarea
        className={styles.promptInput}
        rows={2}
        placeholder="e.g. a cozy living room with a sofa, coffee table, floor lamp, and bookshelf"
        value={imagePrompt}
        disabled={imageGenBusy || sceneGenBusy}
        onChange={(event) => setImagePrompt(event.target.value)}
      />
      <button
        className={styles.processBtn}
        onClick={() => void generateSceneImage()}
        disabled={!imagePrompt.trim() || imageGenBusy || sceneGenBusy}
      >
        <Wand2 size={14} className={styles.btnIcon} />
        {imageGenBusy ? 'Generating image...' : 'Generate Scene Image'}
      </button>

      {imageGenState.error && (
        <div className={`${styles.importNotice} ${styles.errorNotice}`}>
          <AlertTriangle size={14} />
          <span>{imageGenState.error}</span>
        </div>
      )}

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Segmentation</span>
        <select
          className={styles.select}
          value={sceneGenOptions.segmentationMode}
          disabled={sceneGenBusy}
          onChange={(event) =>
            setSceneGenOptions((prev) => ({ ...prev, segmentationMode: event.target.value }))
          }
        >
          <option value="hybrid">hybrid</option>
          <option value="sam2_auto">sam2_auto</option>
        </select>
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Max instances</span>
        <select
          className={styles.select}
          value={sceneGenOptions.maxInstances}
          disabled={sceneGenBusy}
          onChange={(event) =>
            setSceneGenOptions((prev) => ({ ...prev, maxInstances: Number(event.target.value) }))
          }
        >
          {[4, 8, 12, 16, 24].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Texture size</span>
        <select
          className={styles.select}
          value={sceneGenOptions.textureSize}
          disabled={sceneGenBusy}
          onChange={(event) =>
            setSceneGenOptions((prev) => ({ ...prev, textureSize: Number(event.target.value) }))
          }
        >
          {[512, 1024, 2048, 4096].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      {sceneGenBusy ? (
        <button className={styles.processBtn} onClick={cancelSceneGen}>
          Cancel
        </button>
      ) : (
        <button
          className={styles.processBtn}
          onClick={() => void runSceneGenPipeline()}
          disabled={!sceneGenImage}
        >
          Run SceneGen Pipeline
        </button>
      )}

      {(sceneGenState.message || sceneGenState.error) && (
        <div className={`${styles.importNotice} ${sceneGenState.error ? styles.errorNotice : ''}`}>
          {sceneGenState.error ? <AlertTriangle size={14} /> : <Sparkles size={14} />}
          <span>{sceneGenState.error || sceneGenState.message}</span>
        </div>
      )}

      <div className={styles.importMetaRow}>
        <span>Endpoint</span>
        <span title={configuredSceneGenBaseUrl()}>{new URL(configuredSceneGenBaseUrl()).host}</span>
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
