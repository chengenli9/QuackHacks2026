import { Group } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function buildPhysicsExport(sceneObjects) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    objects: sceneObjects.map((object) => ({
      id: object.id,
      label: object.label,
      nodeName: object.nodeName,
      transform: cloneJson(object.transform),
      dimensions: cloneJson(object.dimensions),
      center: cloneJson(object.center),
      physics: cloneJson(object.physics),
      appearance: cloneJson(object.appearance),
      source: cloneJson(object.source),
    })),
  };
}

export async function exportSceneArtifacts({
  sceneObjects,
  exportName = 'scene',
  writeFile = downloadFile,
  exportGlb = exportSceneGlb,
}) {
  const glb = await exportGlb(sceneObjects);
  const physicsJson = `${JSON.stringify(buildPhysicsExport(sceneObjects), null, 2)}\n`;

  await writeFile(`${exportName}.glb`, glb, 'model/gltf-binary');
  await writeFile(`${exportName}.physics.json`, physicsJson, 'application/json');
}

export async function exportSceneGlb(sceneObjects) {
  const root = new Group();
  root.name = 'RoomCraft_Export';

  for (const object of sceneObjects) {
    if (!object.object3d) continue;
    const clone = object.object3d.clone(true);
    clone.name = object.label ?? object.id;
    clone.userData = {
      ...clone.userData,
      roomcraftObjectId: object.id,
      roomcraftPhysics: cloneJson(object.physics),
    };
    clone.position.set(...(object.transform?.position ?? [0, 0, 0]));
    clone.rotation.set(...(object.transform?.rotation ?? [0, 0, 0]));
    clone.scale.set(...(object.transform?.scale ?? [1, 1, 1]));
    root.add(clone);
  }

  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(root, resolve, reject, { binary: true });
  });
}

async function downloadFile(fileName, contents, mimeType) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
