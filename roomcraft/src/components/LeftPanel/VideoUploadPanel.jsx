import { useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Box, Film, Sparkles, Upload, X } from 'lucide-react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import useStore from '../../store/useStore';
import { createSceneObjectRegistry } from '../../lib/sceneObjects';
import { requestVisualPhysicsEstimate } from '../../lib/objectEstimatorClient';
import { dataUrlToImagePayload, renderObjectPreviewToDataUrl } from '../../lib/objectPreview';
import styles from './LeftPanel.module.css';

const ESTIMATOR_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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

export default function VideoUploadPanel() {
  const {
    uploadedVideoName,
    uploadedVideoDuration,
    setUploadedVideo,
    importedGlbFileName,
    glbImportRequestId,
    sceneObjects,
    glbImportStatus,
    glbImportError,
    glbImportWarnings,
    vlmEstimateStatus,
    setGlbImportStatus,
    setVlmEstimateStatus,
    addImportedScene,
    mergeSceneObjectEstimate,
    addGlbImportWarning,
    clearImportedScene,
  } = useStore();
  const lastHandledGlbImportRequest = useRef(0);

  const onVideoDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    const file = accepted[0];
    // Mock duration
    setUploadedVideo(file.name, '0:32');
  }, [setUploadedVideo]);

  const importGlb = useCallback(async (file) => {
    const loader = new GLTFLoader();
    const url = URL.createObjectURL(file);

    setGlbImportStatus('loading');
    setVlmEstimateStatus('idle');

    try {
      const gltf = await loader.loadAsync(url);
      const existingIds = sceneObjects.map((object) => object.id);
      const registry = createSceneObjectRegistry(gltf.scene, { sourceFileName: file.name, existingIds });
      addImportedScene({ fileName: file.name, objects: registry.objects, warnings: registry.warnings });

      const targets = registry.objects.filter((object) => object.physics.needsVisualEstimate);
      if (!ESTIMATOR_API_BASE_URL || targets.length === 0) {
        setVlmEstimateStatus(ESTIMATOR_API_BASE_URL ? 'complete' : 'unavailable');
        return;
      }

      setVlmEstimateStatus('estimating');
      for (const object of targets) {
        try {
          const payload = dataUrlToImagePayload(renderObjectPreviewToDataUrl(object.object3d));
          const estimate = await requestVisualPhysicsEstimate({
            apiBaseUrl: ESTIMATOR_API_BASE_URL,
            object,
            ...payload,
          });
          if (estimate) {
            mergeSceneObjectEstimate(object.id, estimate);
          }
        } catch (error) {
          addGlbImportWarning(`VLM estimate failed for ${object.label}: ${errorMessage(error)}`);
        }
      }
      setVlmEstimateStatus('complete');
    } catch (error) {
      setGlbImportStatus('error', errorMessage(error));
      setVlmEstimateStatus('error');
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [
    addGlbImportWarning,
    addImportedScene,
    mergeSceneObjectEstimate,
    sceneObjects,
    setGlbImportStatus,
    setVlmEstimateStatus,
  ]);

  const onGlbDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    void importGlb(accepted[0]);
  }, [importGlb]);

  const videoDropzone = useDropzone({
    onDrop: onVideoDrop,
    accept: { 'video/*': ['.mp4', '.mov'] },
    multiple: false,
  });

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

  return (
    <div className={styles.videoPanel}>
      <span className={styles.sectionLabel}>Video Upload</span>

      <div
        {...videoDropzone.getRootProps()}
        className={`${styles.dropzone} ${videoDropzone.isDragActive ? styles.dragOver : ''}`}
      >
        <input {...videoDropzone.getInputProps()} />
        <Upload size={20} className={styles.dropzoneIcon} />
        <span className={styles.dropzoneText}>
          Drop .mp4 / .mov<br />or click to browse
        </span>
      </div>

      {uploadedVideoName && (
        <div className={styles.videoPreview}>
          <div className={styles.videoThumb}>
            <Film size={18} />
          </div>
          <div className={styles.videoMeta}>
            <div className={styles.videoName}>{uploadedVideoName}</div>
            <div className={styles.videoDuration}>{uploadedVideoDuration}</div>
          </div>
        </div>
      )}

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Frame Rate</span>
        <select className={styles.select} defaultValue="1fps">
          <option>1fps</option>
          <option>2fps</option>
          <option>5fps</option>
          <option>10fps</option>
        </select>
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Quality</span>
        <select className={styles.select} defaultValue="High">
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
          <option>Ultra</option>
        </select>
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Depth Model</span>
        <select className={styles.select} defaultValue="VGGT">
          <option>VGGT</option>
          <option>MASt3R</option>
          <option>Depth-Pro</option>
        </select>
      </div>

      <button className={styles.processBtn} disabled>
        Process Video
      </button>

      <div className={styles.panelDivider} />

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

      {glbImportWarnings.map((warning) => (
        <div key={warning} className={styles.importNotice}>
          <AlertTriangle size={14} />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}
