import { describe, it, expect } from 'vitest'
import { snapToPolyline } from './snapToPolyline'

describe('snapToPolyline', () => {
  it('returns original coords when shape is empty', () => {
    expect(snapToPolyline(36.7, -4.4, [])).toEqual({ lat: 36.7, lng: -4.4 })
  })

  it('returns the single shape point when shape has one point', () => {
    expect(snapToPolyline(36.7, -4.4, [{ latitud: 36.8, longitud: -4.5 }])).toEqual({
      lat: 36.8,
      lng: -4.5,
    })
  })

  it('snaps to the nearest point on a horizontal segment', () => {
    const shape = [
      { latitud: 0, longitud: 0 },
      { latitud: 0, longitud: 1 },
    ]
    const result = snapToPolyline(0.1, 0.5, shape)
    expect(result.lat).toBeCloseTo(0, 5)
    expect(result.lng).toBeCloseTo(0.5, 5)
  })

  it('clamps to segment endpoint when projection falls outside', () => {
    const shape = [
      { latitud: 0, longitud: 0 },
      { latitud: 0, longitud: 1 },
    ]
    const result = snapToPolyline(0, 2, shape)
    expect(result.lat).toBeCloseTo(0, 5)
    expect(result.lng).toBeCloseTo(1, 5)
  })

  it('picks the closest of two segments', () => {
    const shape = [
      { latitud: 0, longitud: 0 },
      { latitud: 0, longitud: 1 },
      { latitud: 1, longitud: 1 },
    ]
    const result = snapToPolyline(0.5, 1.1, shape)
    expect(result.lng).toBeCloseTo(1, 4)
    expect(result.lat).toBeCloseTo(0.5, 4)
  })
})
