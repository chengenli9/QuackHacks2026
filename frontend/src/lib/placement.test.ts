import { describe, expect, it } from 'vitest'
import { computePlacementPosition } from './placement'
import type { ObjectBounds } from '../store/types'

const objectBounds: ObjectBounds = {
  min: [-0.5, -0.5, -0.5],
  max: [0.5, 0.5, 0.5],
  size: [1, 1, 1],
  center: [0, 0, 0],
}

const targetBounds: ObjectBounds = {
  min: [2, 0, 3],
  max: [4, 1, 5],
  size: [2, 1, 2],
  center: [3, 0.5, 4],
}

describe('computePlacementPosition', () => {
  it('places objects on the floor with a vertical offset', () => {
    expect(computePlacementPosition({ mode: 'on_floor' }, objectBounds, undefined)).toEqual([0, 0.55, 0])
  })

  it('places objects above target bounds for on_object placement', () => {
    expect(computePlacementPosition({ mode: 'on_object', target: 'table' }, objectBounds, targetBounds)).toEqual([
      3,
      1.55,
      4,
    ])
  })

  it('uses exact coordinates for at_position placement', () => {
    expect(computePlacementPosition({ mode: 'at_position', position: [7, 8, 9] }, objectBounds, targetBounds)).toEqual([
      7,
      8,
      9,
    ])
  })
})
