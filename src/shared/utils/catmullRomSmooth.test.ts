import { describe, it, expect } from 'vitest'
import { catmullRomSmooth } from './catmullRomSmooth'

describe('catmullRomSmooth', () => {
  it('returns empty array unchanged', () => {
    expect(catmullRomSmooth([])).toEqual([])
  })

  it('returns single point unchanged', () => {
    expect(catmullRomSmooth([{ lat: 1, lng: 2 }])).toEqual([{ lat: 1, lng: 2 }])
  })

  it('handles two points without crashing and includes both endpoints', () => {
    const result = catmullRomSmooth([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])
    expect(result[0]).toEqual({ lat: 0, lng: 0 })
    expect(result[result.length - 1]).toEqual({ lat: 1, lng: 1 })
  })

  it('output length equals (N - 1) * segments + 1', () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 2, lng: 1 }, { lat: 3, lng: 0 }]
    expect(catmullRomSmooth(pts, 4)).toHaveLength((pts.length - 1) * 4 + 1)
    expect(catmullRomSmooth(pts, 8)).toHaveLength((pts.length - 1) * 8 + 1)
  })

  it('first output point equals first input point', () => {
    const pts = [{ lat: 36.7, lng: -4.4 }, { lat: 36.71, lng: -4.41 }, { lat: 36.72, lng: -4.39 }]
    const result = catmullRomSmooth(pts)
    expect(result[0].lat).toBeCloseTo(pts[0].lat, 10)
    expect(result[0].lng).toBeCloseTo(pts[0].lng, 10)
  })

  it('last output point equals last input point', () => {
    const pts = [{ lat: 36.7, lng: -4.4 }, { lat: 36.71, lng: -4.41 }, { lat: 36.72, lng: -4.39 }]
    const result = catmullRomSmooth(pts)
    const last = result[result.length - 1]
    expect(last.lat).toBeCloseTo(pts[pts.length - 1].lat, 10)
    expect(last.lng).toBeCloseTo(pts[pts.length - 1].lng, 10)
  })

  it('all original control points appear in the output', () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 2, lng: 1 }, { lat: 3, lng: 0 }]
    const result = catmullRomSmooth(pts, 4)
    for (const p of pts) {
      expect(result.some(r => Math.abs(r.lat - p.lat) < 1e-9 && Math.abs(r.lng - p.lng) < 1e-9)).toBe(true)
    }
  })

  it('collinear points produce collinear output (linear interpolation)', () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 2, lng: 0 }, { lat: 3, lng: 0 }]
    const result = catmullRomSmooth(pts, 8)
    for (const r of result) {
      expect(r.lng).toBeCloseTo(0, 10)
    }
  })

  it('segments = 1 returns exactly the original points', () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 2, lng: 0 }]
    const result = catmullRomSmooth(pts, 1)
    expect(result).toHaveLength(pts.length)
    for (let i = 0; i < pts.length; i++) {
      expect(result[i].lat).toBeCloseTo(pts[i].lat, 10)
      expect(result[i].lng).toBeCloseTo(pts[i].lng, 10)
    }
  })

  it('default segments (no arg) equals segments = 4', () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 2, lng: 0 }, { lat: 3, lng: 1 }]
    const withDefault = catmullRomSmooth(pts)
    const withFour = catmullRomSmooth(pts, 4)
    expect(withDefault).toEqual(withFour)
  })
})
