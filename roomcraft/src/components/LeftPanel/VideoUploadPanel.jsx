import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Film } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './LeftPanel.module.css';

export default function VideoUploadPanel() {
  const { uploadedVideoName, uploadedVideoDuration, setUploadedVideo } = useStore();

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    const file = accepted[0];
    // Mock duration
    setUploadedVideo(file.name, '0:32');
  }, [setUploadedVideo]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov'] },
    multiple: false,
  });

  return (
    <div className={styles.videoPanel}>
      <span className={styles.sectionLabel}>Video Upload</span>

      <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dragOver : ''}`}>
        <input {...getInputProps()} />
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
    </div>
  );
}
