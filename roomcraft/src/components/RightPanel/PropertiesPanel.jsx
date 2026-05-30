import { useState } from 'react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const OBJECT_DATA = {
  Scene:    { verts: null, polys: null, format: null, color: '#1c1c1c' },
  Room_Mesh:{ verts: '12,482', polys: '6,241', format: '.glb', color: '#C8C8C8' },
  Floor:    { verts: '4,096', polys: '2,048', format: '.glb', color: '#8a8a8a' },
  Walls:    { verts: '6,144', polys: '3,072', format: '.glb', color: '#9a9a9a' },
  Ceiling:  { verts: '2,048', polys: '1,024', format: '.glb', color: '#707070' },
  Lights:   { verts: null, polys: null, format: null, color: '#ffcc44' },
  Ambient:  { verts: null, polys: null, format: null, color: '#ffeeaa' },
  Sun:      { verts: null, polys: null, format: null, color: '#ffffff' },
  Camera:   { verts: null, polys: null, format: null, color: '#4499ff' },
};

const DEFAULT_DATA = { verts: '—', polys: '—', format: '—', color: '#888888' };

function XYZRow({ label }) {
  return (
    <div className={styles.transformRow}>
      <span className={styles.transformLabel}>{label}</span>
      <div className={styles.xyzRow} style={{ flex: 1 }}>
        {['X', 'Y', 'Z'].map((axis) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 2 }}>
            <span className={styles.xyzLabel}>{axis}</span>
            <input
              className={styles.xyzInput}
              defaultValue={axis === 'X' || axis === 'Y' || axis === 'Z'
                ? label === 'Scale' ? '1.00' : '0.00'
                : '0.00'}
              readOnly
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const { selectedObjectId } = useStore();
  const selected = selectedObjectId || 'Room_Mesh';
  const data = OBJECT_DATA[selected] || DEFAULT_DATA;

  const [roughness, setRoughness] = useState(0.8);
  const [metalness, setMetalness] = useState(0.1);
  const [color, setColor] = useState(data.color);

  return (
    <div className={styles.propertiesPanel}>
      <div className="panel-header">
        <span>Properties</span>
        <span style={{ color: 'var(--text-accent)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)' }}>
          {selected}
        </span>
      </div>

      <div className={styles.propertiesScroll}>
        {/* Transform */}
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Transform</div>
          <XYZRow label="Location" />
          <XYZRow label="Rotation" />
          <XYZRow label="Scale" />
        </div>

        {/* Material */}
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Material</div>

          <div className={styles.colorRow}>
            <span className={styles.colorLabel}>Base Color</span>
            <div className={styles.colorSwatch}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Pick base color"
              />
            </div>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {color.toUpperCase()}
            </span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Roughness</span>
            <input
              type="range"
              className={styles.slider}
              min={0} max={1} step={0.01}
              value={roughness}
              onChange={(e) => setRoughness(parseFloat(e.target.value))}
            />
            <span className={styles.sliderVal}>{roughness.toFixed(1)}</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Metalness</span>
            <input
              type="range"
              className={styles.slider}
              min={0} max={1} step={0.01}
              value={metalness}
              onChange={(e) => setMetalness(parseFloat(e.target.value))}
            />
            <span className={styles.sliderVal}>{metalness.toFixed(1)}</span>
          </div>
        </div>

        {/* Mesh Info */}
        {data.verts && (
          <div className={styles.propSection}>
            <div className={styles.propSectionHeader}>Mesh Info</div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Vertices</span>
              <span className={styles.meshInfoVal}>{data.verts}</span>
            </div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Polygons</span>
              <span className={styles.meshInfoVal}>{data.polys}</span>
            </div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Format</span>
              <span className={styles.meshInfoVal}>{data.format}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
