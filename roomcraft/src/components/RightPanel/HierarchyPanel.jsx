import { useState } from 'react';
import { Eye, EyeOff, Box, Package, Loader2, Download, Globe } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const TYPE_ICON_MAP = {
  placeholder: Box,
  glb: Package,
  generating: Loader2,
  imported: Download,
};

function ObjectRow({ obj, searchQuery }) {
  const { selectedObjectId, setSelectedObject, setObjectVisibility } = useStore();
  const isSelected = selectedObjectId === obj.id;

  if (searchQuery && !obj.label.toLowerCase().includes(searchQuery.toLowerCase())) {
    return null;
  }

  const IconComp = TYPE_ICON_MAP[obj.type] || Box;

  return (
    <div
      className={`${styles.treeNode} ${isSelected ? styles.selected : ''}`}
      style={{ paddingLeft: 22 }}
      onClick={() => setSelectedObject(obj.id)}
    >
      <span className={styles.chevronSpacer} />
      <span className={styles.nodeIcon}><IconComp size={11} /></span>
      <span className={styles.nodeName} style={{ opacity: obj.visible === false ? 0.45 : 1 }}>
        {obj.label}
        {obj.type === 'generating' && (
          <span style={{ color: 'var(--accent)', marginLeft: 4, fontSize: 9 }}>generating...</span>
        )}
      </span>
      <button
        className={styles.visibilityBtn}
        title={obj.visible === false ? 'Show' : 'Hide'}
        onClick={(e) => {
          e.stopPropagation();
          setObjectVisibility(obj.id, obj.visible === false ? true : false);
        }}
      >
        {obj.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
    </div>
  );
}

export default function HierarchyPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const sceneObjects = useStore((s) => s.sceneObjects);

  const objects = Object.values(sceneObjects);

  return (
    <div className={styles.hierarchyPanel}>
      <div className="panel-header">
        <span>Outliner</span>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className={styles.hierarchyScroll}>
        {/* Static scene root */}
        <div
          className={styles.treeNode}
          style={{ paddingLeft: 8 }}
        >
          <span className={styles.nodeIcon}><Globe size={11} /></span>
          <span className={styles.nodeName}>Scene</span>
        </div>

        {objects.length === 0 && (
          <div style={{
            padding: '8px 16px',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-ui)',
          }}>
            No objects in scene
          </div>
        )}

        {objects.map((obj) => (
          <ObjectRow key={obj.id} obj={obj} searchQuery={searchQuery} />
        ))}
      </div>
    </div>
  );
}
