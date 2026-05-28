import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import fc from 'fast-check'
import { NextRequest } from 'next/server'
import { mswServer } from '@/test/mswServer'
import { GET } from './route'
import { EMT_LINEAS_URL } from '../constants'

// Combined CSV — works for both parseParadasCSV and parseLineasCSV
const SAMPLE_CSV = [
  'codLinea,codLineaStr,nombreLinea,sentido,orden,codParada,nombreParada,lon,lat',
  '1.0,1,Línea 1,1,1,P001,Alameda,-4.40,36.70',
  '1.0,1,Línea 1,1,2,P002,Constitución,-4.41,36.71',
  '1.0,1,Línea 1,2,1,P003,Parque,-4.42,36.72',
  '2.0,2,Línea 2,1,1,P004,Retiro,-4.43,36.73',
].join('\n')

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/emt/paradas')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('GET /api/emt/paradas', () => {
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

  it('devuelve HTTP 400 para caracteres inválidos en linea', async () => {
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

  it('filtra paradas de la línea solicitada ordenadas por sentido y orden', async () => {
    mswServer.use(http.get(EMT_LINEAS_URL, () => HttpResponse.text(SAMPLE_CSV)))

    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(3)
    expect(body.every((p: { codLinea: string }) => p.codLinea === '1')).toBe(true)
    expect(body[0].sentido).toBe(1)
    expect(body[0].orden).toBe(1)
    expect(body[1].orden).toBe(2)
    expect(body[2].sentido).toBe(2)
  })

  it('devuelve HTTP 200 con [] cuando ninguna parada coincide', async () => {
    mswServer.use(http.get(EMT_LINEAS_URL, () => HttpResponse.text(SAMPLE_CSV)))

    const res = await GET(makeRequest({ linea: '99' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('propaga el mismo status HTTP cuando el origen falla', async () => {
    mswServer.use(
      http.get(EMT_LINEAS_URL, () => new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' })),
    )

    const res = await GET(makeRequest({ linea: '1' }))
    expect(res.status).toBe(503)
  })

  it('devuelve HTTP 500 ante error de red', async () => {
    mswServer.use(http.get(EMT_LINEAS_URL, () => HttpResponse.error()))

    const res = await GET(makeRequest({ linea: '1' }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(typeof body.error).toBe('string')
  })
})
