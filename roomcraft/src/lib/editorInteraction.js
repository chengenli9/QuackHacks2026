export function transformModeForTool(tool) {
  if (tool === 'rotate') return 'rotate';
  if (tool === 'scale') return 'scale';
  return 'translate';
}

export function shouldShowTransformControls({ isSelected }) {
  return Boolean(isSelected);
}

export function shouldApplyRuntimePhysicsTransform({ gravityEnabled, isEditorDragging, isStatic }) {
  return Boolean(gravityEnabled && !isEditorDragging && !isStatic);
}

export function editorGravityScale({ isEditorDragging }) {
  return isEditorDragging ? 0 : 1;
}

export function selectViewportObject(event, objectId, setSelectedObject) {
  event?.stopPropagation?.();
  setSelectedObject(objectId);
}
