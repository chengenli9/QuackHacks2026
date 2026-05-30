import { useState } from 'react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const OBJECT_DATA = {
  Scene: { verts: null, polys: null, format: null, color: '#1c1c1c' },
  Room_Mesh: { verts: '12,482', polys: '6,241', format: '.glb', color: '#C8C8C8' },
  Floor: { verts: '4,096', polys: '2,048', format: '.glb', color: '#8a8a8a' },
  Walls: { verts: '6,144', polys: '3,072', format: '.glb', color: '#9a9a9a' },
  Ceiling: { verts: '2,048', polys: '1,024', format: '.glb', color: '#707070' },
  Lights: { verts: null, polys: null, format: null, color: '#ffcc44' },
  Ambient: { verts: null, polys: null, format: null, color: '#ffeeaa' },
  Sun: { verts: null, polys: null, format: null, color: '#ffffff' },
  Camera: { verts: null, polys: null, format: null, color: '#4499ff' },
};

const DEFAULT_DATA = { verts: '-', polys: '-', format: '-', color: '#888888' };

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '-';
}

function formatFixed(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function XYZRow({ label, values }) {
  return (
    <div className={styles.transformRow}>
      <span className={styles.transformLabel}>{label}</span>
      <div className={styles.xyzRow} style={{ flex: 1 }}>
        {['X', 'Y', 'Z'].map((axis, index) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 2 }}>
            <span className={styles.xyzLabel}>{axis}</span>
            <input
              className={styles.xyzInput}
              value={formatFixed(values[index])}
              readOnly
              aria-label={`${label} ${axis}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportedPhysicsSection({ object }) {
  const physics = object.physics;

  return (
    <div className={styles.propSection}>
      <div className={styles.propSectionHeader}>Physics</div>
      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Body</span>
        <span className={styles.meshInfoVal}>{physics.static ? 'Fixed' : 'Dynamic'}</span>
      </div>
      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Collider</span>
        <span className={styles.meshInfoVal}>{physics.collider}</span>
      </div>
      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Mass</span>
        <span className={styles.meshInfoVal}>{physics.massKg.toFixed(2)} kg</span>
      </div>
      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Friction</span>
        <span className={styles.meshInfoVal}>{physics.friction.toFixed(2)}</span>
      </div>
      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Bounce</span>
        <span className={styles.meshInfoVal}>{physics.restitution.toFixed(2)}</span>
      </div>
      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Source</span>
        <span className={styles.meshInfoVal}>
          {physics.needsVisualEstimate ? 'Needs VLM' : physics.source}
        </span>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const { selectedObjectId, sceneObjects } = useStore();
  const selected = selectedObjectId || 'Room_Mesh';
  const selectedSceneObject = sceneObjects.find((object) => object.id === selected);
  const data = selectedSceneObject
    ? {
        verts: formatNumber(selectedSceneObject.vertexCount),
        polys: formatNumber(selectedSceneObject.triangleCount),
        format: '.glb',
        color: '#8a8a8a',
      }
    : OBJECT_DATA[selected] || DEFAULT_DATA;

  const [roughness, setRoughness] = useState(0.8);
  const [metalness, setMetalness] = useState(0.1);
  const [colorByObject, setColorByObject] = useState({});
  const color = colorByObject[selected] ?? data.color;

  const location = selectedSceneObject?.center ?? [0, 0, 0];
  const rotation = [0, 0, 0];
  const scale = selectedSceneObject?.dimensions ?? [1, 1, 1];

  return (
    <div className={styles.propertiesPanel}>
      <div className="panel-header">
        <span>Properties</span>
        <span style={{ color: 'var(--text-accent)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)' }}>
          {selectedSceneObject?.label ?? selected}
        </span>
      </div>

      <div className={styles.transformScroll}>
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Transform</div>
          <XYZRow label="Location" values={location} />
          <XYZRow label="Rotation" values={rotation} />
          <XYZRow label="Scale" values={scale} />
        </div>
      </div>

      <div className={styles.staticSections}>
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Material</div>

          <div className={styles.colorRow}>
            <span className={styles.colorLabel}>Base Color</span>
            <div className={styles.colorSwatch}>
              <input
                type="color"
                value={color}
                onChange={(event) =>
                  setColorByObject((state) => ({ ...state, [selected]: event.target.value }))
                }
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
              min={0}
              max={1}
              step={0.01}
              value={roughness}
              onChange={(event) => setRoughness(parseFloat(event.target.value))}
            />
            <span className={styles.sliderVal}>{roughness.toFixed(1)}</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Metalness</span>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={1}
              step={0.01}
              value={metalness}
              onChange={(event) => setMetalness(parseFloat(event.target.value))}
            />
            <span className={styles.sliderVal}>{metalness.toFixed(1)}</span>
          </div>
        </div>

        {selectedSceneObject && <ImportedPhysicsSection object={selectedSceneObject} />}

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
