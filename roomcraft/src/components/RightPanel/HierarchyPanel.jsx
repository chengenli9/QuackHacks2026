import { useState } from 'react';
import { Box, ChevronRight, Eye, EyeOff, Globe, Trash2 } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const STATIC_TREE = [
  { id: 'Scene', label: 'Scene', icon: Globe, children: [] },
];

function buildTree(sceneObjects) {
  if (!sceneObjects.length) return STATIC_TREE;

  const importedNode = {
    id: 'Imported_GLB',
    label: 'Imported GLB',
    icon: Box,
    children: sceneObjects.map((object) => ({
      id: object.id,
      label: object.label,
      icon: Box,
    })),
  };

  return STATIC_TREE.map((node) =>
    node.id === 'Scene'
      ? { ...node, children: [importedNode] }
      : node
  );
}

function nodeMatchesSearch(node, searchQuery) {
  if (!searchQuery) return true;
  const query = searchQuery.toLowerCase();
  return (
    node.label.toLowerCase().includes(query) ||
    node.children?.some((child) => nodeMatchesSearch(child, searchQuery))
  );
}

function filterDeleted(nodes, deletedIds) {
  return nodes
    .filter((n) => !deletedIds.has(n.id))
    .map((n) => n.children ? { ...n, children: filterDeleted(n.children, deletedIds) } : n);
}

function TreeNode({ node, depth = 0, searchQuery, hiddenNodes, onToggleVisibility, onDeleteRequest }) {
  const { selectedObjectId, setSelectedObject, expandedNodes, toggleNode } = useStore();
  const isExpanded = expandedNodes.includes(node.id);
  const isSelected = selectedObjectId === node.id;
  const isHidden = hiddenNodes.has(node.id);
  const hasChildren = node.children?.length > 0;
  const Icon = node.icon;

  if (!nodeMatchesSearch(node, searchQuery)) return null;

  return (
    <div>
      <div
        className={`${styles.treeNode} ${isSelected ? styles.selected : ''} ${isHidden ? styles.nodeHidden : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => setSelectedObject(node.id)}
      >
        {hasChildren ? (
          <span
            className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
            onClick={(event) => { event.stopPropagation(); toggleNode(node.id); }}
          >
            <ChevronRight size={10} />
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <span className={styles.nodeIcon}><Icon size={12} /></span>
        <span className={styles.nodeName}>{node.label}</span>
        {node.id !== 'Scene' && (
          <>
            <button
              className={`${styles.visibilityBtn} ${isHidden ? styles.visibilityBtnActive : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(node.id); }}
              title={isHidden ? 'Show' : 'Hide'}
            >
              {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
            <button
              className={styles.trashBtn}
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(node); }}
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} searchQuery={searchQuery}
              hiddenNodes={hiddenNodes} onToggleVisibility={onToggleVisibility} onDeleteRequest={onDeleteRequest} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const sceneObjects = useStore((state) => state.sceneObjects);
  const deletedNodeIds = useStore((state) => state.deletedNodeIds);
  const deleteNode = useStore((state) => state.deleteNode);
  const hiddenNodeIds = useStore((state) => state.hiddenNodeIds);
  const toggleNodeVisibility = useStore((state) => state.toggleNodeVisibility);

  const deletedSet = new Set(deletedNodeIds);
  const hiddenSet = new Set(hiddenNodeIds);
  const rawTree = buildTree(sceneObjects);
  const tree = filterDeleted(rawTree, deletedSet);

  function confirmDelete() {
    if (pendingDelete) {
      deleteNode(pendingDelete.id);
      setPendingDelete(null);
    }
  }

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
          <TreeNode key={node.id} node={node} searchQuery={searchQuery}
            hiddenNodes={hiddenSet} onToggleVisibility={toggleNodeVisibility}
            onDeleteRequest={(node) => setPendingDelete(node)} />
        ))}
      </div>

      {pendingDelete && (
        <div className={styles.deleteOverlay}>
          <div className={styles.deleteModal}>
            <p className={styles.deleteWarning}>Delete "{pendingDelete.label}"?</p>
            <p className={styles.deleteSubtext}>This action cannot be undone.</p>
            <div className={styles.deleteActions}>
              <button className={styles.deleteCancelBtn} onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className={styles.deleteConfirmBtn} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
