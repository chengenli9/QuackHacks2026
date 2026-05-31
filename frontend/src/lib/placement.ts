import type { AssetPlacement, Vector3 } from '../schemas'
import type { ObjectBounds } from '../store/types'

const FLOOR_Y = 0
const FLOOR_OFFSET = 0.05

export function computePlacementPosition(
  placement: AssetPlacement,
  objectBounds: ObjectBounds | undefined,
  targetBounds: ObjectBounds | undefined
): Vector3 {
  const halfH = objectBounds ? objectBounds.size[1] / 2 : 0.25

  switch (placement.mode) {
    case 'on_floor':
      return [0, FLOOR_Y + halfH + FLOOR_OFFSET, 0]

    case 'on_object': {
      if (!targetBounds) {
        return [0, FLOOR_Y + halfH + FLOOR_OFFSET, 0]
      }
      const cx = targetBounds.center[0]
      const topY = targetBounds.max[1]
      const cz = targetBounds.center[2]
      return [cx, topY + halfH + FLOOR_OFFSET, cz]
    }

    case 'at_position':
      return placement.position
  }
}
