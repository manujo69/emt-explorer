import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// The disk fallback + network fallback paths in getCsv are covered by unit tests
// in csvParser.test.ts (parseShapesCSV, parseTripsMapping). Route-level integration
// tests here focus on validation and the data transformation end-to-end using the
// real data/gtfs/ files that ship with the project.

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/emt/shapes')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('GET /api/emt/shapes — validación', () => {
  it('devuelve HTTP 400 si falta el parámetro linea', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(typeof body.error).toBe('string')
  })

  it('devuelve HTTP 400 si linea está vacía', async () => {
    const res = await GET(makeRequest({ linea: '' }))
    expect(res.status).toBe(400)
  })

  it('devuelve HTTP 400 si linea contiene solo espacios', async () => {
    const res = await GET(makeRequest({ linea: '   ' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/emt/shapes — datos reales', () => {
  it('devuelve 200 con shapes para una línea existente', async () => {
    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    // At least one sentido should have shape points
    const hasSentido = Object.values(body as Record<string, unknown[]>).some(pts => pts.length > 0)
    expect(hasSentido).toBe(true)
  })

  it('devuelve {} para una línea que no existe en los datos GTFS', async () => {
    const res = await GET(makeRequest({ linea: '9999' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({})
  })

  it('los shape points tienen la forma correcta', async () => {
    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json() as Record<string, Array<{ latitud: number; longitud: number; sequence: number }>>

    expect(res.status).toBe(200)
    for (const pts of Object.values(body)) {
      for (const pt of pts) {
        expect(typeof pt.latitud).toBe('number')
        expect(typeof pt.longitud).toBe('number')
        expect(typeof pt.sequence).toBe('number')
        expect(pt.latitud).toBeGreaterThanOrEqual(-90)
        expect(pt.latitud).toBeLessThanOrEqual(90)
      }
    }
  })
})
