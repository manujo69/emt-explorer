import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { haversineMeters } from './haversine'

const latArb = fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true, noDefaultInfinity: true })
const lonArb = fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true, noDefaultInfinity: true })
const latLngArb = fc.record({ latitud: latArb, longitud: lonArb })

describe('haversineMeters', () => {
  it('devuelve 0 para el mismo punto', () => {
    const p = { latitud: 36.7213, longitud: -4.4214 }
    expect(haversineMeters(p, p)).toBe(0)
  })

  it('aproxima la distancia Málaga centro → aeropuerto (≈8 km)', () => {
    const malaga = { latitud: 36.7213, longitud: -4.4214 }
    const airport = { latitud: 36.6749, longitud: -4.4990 }
    const dist = haversineMeters(malaga, airport)
    expect(dist).toBeGreaterThan(7000)
    expect(dist).toBeLessThan(9500)
  })

  it('Property: simetría — d(a,b) === d(b,a)', () => {
    fc.assert(
      fc.property(latLngArb, latLngArb, (a, b) => {
        return Math.abs(haversineMeters(a, b) - haversineMeters(b, a)) < 0.001
      }),
      { numRuns: 200 },
    )
  })

  it('Property: no negativo', () => {
    fc.assert(
      fc.property(latLngArb, latLngArb, (a, b) => {
        return haversineMeters(a, b) >= 0
      }),
      { numRuns: 200 },
    )
  })

  it('Property: desigualdad triangular — d(a,c) ≤ d(a,b) + d(b,c)', () => {
    fc.assert(
      fc.property(latLngArb, latLngArb, latLngArb, (a, b, c) => {
        const ac = haversineMeters(a, c)
        const ab = haversineMeters(a, b)
        const bc = haversineMeters(b, c)
        return ac <= ab + bc + 0.01
      }),
      { numRuns: 100 },
    )
  })
})
