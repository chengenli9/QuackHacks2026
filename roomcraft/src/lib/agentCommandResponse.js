export function operationsFromCommandResponse(response = {}) {
  if (Array.isArray(response.operations) && response.operations.length > 0) {
    return response.operations;
  }
  return response.operation ? [response.operation] : [];
}

export function visibleThoughtsFromCommandResponse(response = {}) {
  return Array.isArray(response.thoughts)
    ? response.thoughts.filter((thought) => typeof thought === 'string' && thought.trim())
    : [];
}

export function toolCallLabel(operation = {}) {
  switch (operation.action) {
    case 'add_generated_object':
      return `add_generated_object("${operation.prompt}")`;
    case 'add_local_object':
      return `add_local_object(${operation.fallbackAssetKey})`;
    case 'remove_object':
      return `remove_object(${operation.target})`;
    case 'move_object':
      return `move_object(${operation.target})`;
    case 'rotate_object':
      return `rotate_object(${operation.target})`;
    case 'scale_object':
      return `scale_object(${operation.target})`;
    case 'update_object_physics':
      return `update_object_physics(${operation.target})`;
    case 'update_object_appearance':
      return `update_object_appearance(${operation.target})`;
    case 'toggle_gravity':
      return `toggle_gravity(${operation.enabled ? 'on' : 'off'})`;
    case 'toggle_collisions':
      return `toggle_collisions(${operation.enabled ? 'on' : 'off'})`;
    case 'export_scene':
      return 'export_scene()';
    case 'relabel_object':
      return `relabel_object(${operation.target})`;
    case 'generate_background_image':
      return `generate_background_image("${operation.prompt}")`;
    case 'generate_environment_scene':
      return `generate_environment_scene("${operation.scenePrompt}")`;
    default:
      return operation.action || 'unknown_tool';
  }
}
