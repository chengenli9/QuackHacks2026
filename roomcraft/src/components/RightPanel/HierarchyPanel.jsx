import { useState } from 'react';
import { Camera, ChevronRight, Eye, EyeOff, Globe, Lightbulb, Package, Trash2 } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const STATIC_LIGHTS_CAMERA = [
  {
    id: 'Lights',
    label: 'Lights',
    icon: Lightbulb,
    isStatic: true,
    children: [
      { id: 'Ambient', label: 'Ambient', icon: Lightbulb, isStatic: true },
      { id: 'Sun', label: 'Sun', icon: Lightbulb, isStatic: true },
    ],
  },
  { id: 'Camera', label: 'Camera', icon: Camera, isStatic: true },
];

function buildTree(sceneObjects) {
  return [
    {
      id: 'Scene',
      label: 'Scene',
      icon: Globe,
      isStatic: true,
      children: [
        ...sceneObjects.map((object) => ({
          id: object.id,
          label: object.label,
          icon: Package,
          isStatic: false,
          visible: object.visible !== false,
        })),
        ...STATIC_LIGHTS_CAMERA,
      ],
    },
  ];
}

function nodeMatchesSearch(node, searchQuery) {
  if (!searchQuery) return true;
  const query = searchQuery.toLowerCase();
  return (
    node.label.toLowerCase().includes(query) ||
    node.children?.some((child) => nodeMatchesSearch(child, searchQuery))
  );
}

function TreeNode({ node, depth = 0, searchQuery }) {
  const { selectedObjectId, setSelectedObject, expandedNodes, toggleNode,
    toggleSceneObjectVisibility, deleteSceneObject } = useStore();
  // For imported objects, read visible state live from the store so it stays reactive
  const liveVisible = useStore((state) => {
    if (node.isStatic) return true;
    const obj = state.sceneObjects.find((o) => o.id === node.id);
    return obj ? obj.visible !== false : true;
  });
  const isExpanded = expandedNodes.includes(node.id);
  const isSelected = selectedObjectId === node.id;
  const hasChildren = node.children?.length > 0;
  const Icon = node.icon;
  const isVisible = node.isStatic ? true : liveVisible;

  if (!nodeMatchesSearch(node, searchQuery)) return null;

  const handleVisibilityToggle = (event) => {
    event.stopPropagation();
    toggleSceneObjectVisibility(node.id);
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    if (window.confirm(`Delete "${node.label}"? This cannot be undone.`)) {
      deleteSceneObject(node.id);
    }
  };

  return (
    <div>
      <div
        className={`${styles.treeNode} ${isSelected ? styles.selected : ''} ${!isVisible ? styles.hiddenNode : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => setSelectedObject(node.id)}
      >
        {hasChildren ? (
          <span
            className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              toggleNode(node.id);
            }}
          >
            <ChevronRight size={10} />
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <span className={styles.nodeIcon}>
          <Icon size={12} />
        </span>
        <span className={styles.nodeName}>{node.label}</span>

        {!node.isStatic && (
          <>
            <button
              className={`${styles.visibilityBtn} ${!isVisible ? styles.visibilityBtnActive : ''}`}
              title={isVisible ? 'Hide' : 'Show'}
              onClick={handleVisibilityToggle}
            >
              {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button
              className={styles.deleteBtn}
              title="Delete"
              onClick={handleDelete}
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const sceneObjects = useStore((state) => state.sceneObjects);
  const tree = buildTree(sceneObjects);

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
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div className={styles.hierarchyScroll}>
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} searchQuery={searchQuery} />
        ))}
      </div>
    </div>
  );
}
