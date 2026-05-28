import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import fc from 'fast-check'
import { NextRequest } from 'next/server'
import { mswServer } from '@/test/mswServer'
import { GET } from './route'
import { EMT_UBICACIONES_URL } from '../constants'

const SAMPLE_UBICACIONES_CSV = [
  '"codBus","codLinea","sentido","lon","lat","codParIni","last_update"',
  '"581","1.0","2","-4.456579","36.697693","1253","2026-05-25 19:45:06"',
  '"582","1.0","1","-4.400000","36.700000","1254","2026-05-25 19:45:06"',
  '"600","2.0","1","-4.420000","36.710000","2001","2026-05-25 19:45:06"',
  '"700","10.0","2","-4.430000","36.720000","3001","2026-05-25 19:45:06"',
].join('\n')

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/emt/ubicaciones')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString())
}

describe('GET /api/emt/ubicaciones', () => {
  it('devuelve HTTP 400 si falta el parámetro linea', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(typeof body.error).toBe('string')
  })

  it('devuelve HTTP 400 si linea está vacía', async () => {
    const res = await GET(makeRequest({ linea: '' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(typeof body.error).toBe('string')
  })

  it('devuelve HTTP 400 para caracteres inválidos en linea (Property 8)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /[^a-zA-Z0-9-]/.test(s)),
        async (invalidLinea) => {
          const res = await GET(makeRequest({ linea: invalidLinea }))
          expect(res.status).toBe(400)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('filtra solo buses de la línea solicitada (Property 6)', async () => {
    mswServer.use(
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.text(SAMPLE_UBICACIONES_CSV)),
    )

    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.length).toBe(2)
    expect(body.every((b: { codLinea: string }) => b.codLinea === '1')).toBe(true)
  })

  it('devuelve HTTP 200 con [] cuando ningún bus coincide con la línea', async () => {
    mswServer.use(
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.text(SAMPLE_UBICACIONES_CSV)),
    )

    const res = await GET(makeRequest({ linea: '99' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('propaga el mismo status HTTP cuando el origen falla (Property 7)', async () => {
    mswServer.use(
      http.get(EMT_UBICACIONES_URL, () => new HttpResponse(null, { status: 504, statusText: 'Gateway Timeout' })),
    )

    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(504)
    expect(typeof body.error).toBe('string')
  })

  it('devuelve HTTP 500 ante error de red', async () => {
    mswServer.use(
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.error()),
    )

    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(typeof body.error).toBe('string')
  })

  it('devuelve HTTP 400 si linea contiene solo espacios', async () => {
    const res = await GET(makeRequest({ linea: '   ' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(typeof body.error).toBe('string')
  })

  it('incluye header Cache-Control: no-store en respuesta exitosa', async () => {
    mswServer.use(
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.text(SAMPLE_UBICACIONES_CSV)),
    )

    const res = await GET(makeRequest({ linea: '1' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('los objetos devueltos tienen la forma BusUbicacion correcta', async () => {
    mswServer.use(
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.text(SAMPLE_UBICACIONES_CSV)),
    )

    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.length).toBeGreaterThan(0)
    for (const bus of body) {
      expect(typeof bus.codBus).toBe('string')
      expect(typeof bus.codLinea).toBe('string')
      expect(typeof bus.sentido).toBe('number')
      expect(typeof bus.longitud).toBe('number')
      expect(typeof bus.latitud).toBe('number')
      expect(typeof bus.codParIni).toBe('string')
      expect(typeof bus.lastUpdate).toBe('string')
    }
  })
})
