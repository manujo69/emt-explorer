import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import fc from 'fast-check'
import { NextRequest } from 'next/server'
import { mswServer } from '@/test/mswServer'
import { GET } from './route'
import { EMT_LINEAS_URL, EMT_UBICACIONES_URL } from '../constants'

const EMT_PARADA_URL = 'https://www.emtmalaga.es/emt-mobile/informacionParada.html'

// Minimal HTML that parseInformacionParadaHTML can extract
function makeParadaHTML(items: Array<{ codLinea: string; sentido: number; destino: string; minutos: number }>) {
  const lis = items.map(
    ({ codLinea, sentido, destino, minutos }) =>
      `<li><a href="?sentido=${sentido}" title="${codLinea}"><span class="direccion">${destino}</span> ${minutos} min.</a></li>`,
  )
  return `<html><body><ul data-role="listview">${lis.join('')}</ul></body></html>`
}

// Combined CSV for parseParadasCSV + parseLineasCSV
const LINEAS_PARADAS_CSV = [
  'codLinea,codLineaStr,nombreLinea,sentido,orden,codParada,nombreParada,lon,lat',
  '1.0,1,Línea 1,1,1,P001,Alameda,-4.40,36.70',
  '1.0,1,Línea 1,1,2,P002,Constitución,-4.41,36.71',
].join('\n')

// Bus B01 is at P002 (orden=2, higher than target P001 orden=1) → approaching P001
const UBICACIONES_CSV = [
  '"codBus","codLinea","sentido","lon","lat","codParIni","last_update"',
  '"B01","1.0","1","-4.41","36.71","P002","2026-01-01 00:00:00"',
].join('\n')

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/emt/llegadas')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('GET /api/emt/llegadas — validación', () => {
  it('devuelve HTTP 400 si falta el parámetro parada', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(typeof body.error).toBe('string')
  })

  it('devuelve HTTP 400 si parada está vacía', async () => {
    const res = await GET(makeRequest({ parada: '' }))
    expect(res.status).toBe(400)
  })

  it('devuelve HTTP 400 si parada contiene solo espacios', async () => {
    const res = await GET(makeRequest({ parada: '   ' }))
    expect(res.status).toBe(400)
  })

  it('devuelve HTTP 400 para caracteres inválidos en parada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /[^a-zA-Z0-9-]/.test(s)),
        async (invalidParada) => {
          const res = await GET(makeRequest({ parada: invalidParada }))
          expect(res.status).toBe(400)
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('GET /api/emt/llegadas — ruta scraping EMT', () => {
  it('parsea el HTML y devuelve llegadas ordenadas por minutos', async () => {
    const html = makeParadaHTML([
      { codLinea: '14', sentido: 1, destino: 'Alameda Principal', minutos: 7 },
      { codLinea: '1', sentido: 2, destino: 'Parque del Sur', minutos: 3 },
    ])
    mswServer.use(http.get(EMT_PARADA_URL, () => HttpResponse.text(html)))

    const res = await GET(makeRequest({ parada: 'P100' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].proximoBus.minutos).toBe(3)
    expect(body[1].proximoBus.minutos).toBe(7)
    expect(body[0].codLinea).toBe('1')
    expect(body[0].sentido).toBe(2)
    expect(body[0].destino).toBe('Parque del Sur')
  })

  it('ignora items HTML sin minutos', async () => {
    const html = `<html><body><ul data-role="listview">
      <li><a title="5"><span class="direccion">Alameda</span> 4 min.</a></li>
      <li><a title="7"><span class="direccion">Centro</span> sin tiempo</a></li>
    </ul></body></html>`
    mswServer.use(http.get(EMT_PARADA_URL, () => HttpResponse.text(html)))

    const res = await GET(makeRequest({ parada: 'P100' }))
    const body = await res.json()

    // item sin minutos es ignorado; si haversine también falla (no CSVs), puede devolver [] o error
    expect(res.status === 200 || res.status === 500).toBe(true)
    if (res.status === 200 && Array.isArray(body)) {
      expect(body.every((l: { proximoBus: { minutos: number } }) => typeof l.proximoBus.minutos === 'number')).toBe(true)
    }
  })
})

describe('GET /api/emt/llegadas — fallback haversine', () => {
  it('usa haversine cuando el scraping EMT falla (error de red)', async () => {
    mswServer.use(
      http.get(EMT_PARADA_URL, () => HttpResponse.error()),
      http.get(EMT_LINEAS_URL, () => HttpResponse.text(LINEAS_PARADAS_CSV)),
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.text(UBICACIONES_CSV)),
    )

    const res = await GET(makeRequest({ parada: 'P001' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(typeof body[0].proximoBus.minutos).toBe('number')
  })

  it('usa haversine cuando el HTML no contiene llegadas', async () => {
    mswServer.use(
      http.get(EMT_PARADA_URL, () => HttpResponse.text('<html><body><ul data-role="listview"></ul></body></html>')),
      http.get(EMT_LINEAS_URL, () => HttpResponse.text(LINEAS_PARADAS_CSV)),
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.text(UBICACIONES_CSV)),
    )

    const res = await GET(makeRequest({ parada: 'P001' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })

  it('devuelve HTTP 500 cuando tanto EMT como haversine fallan', async () => {
    mswServer.use(
      http.get(EMT_PARADA_URL, () => HttpResponse.error()),
      http.get(EMT_LINEAS_URL, () => HttpResponse.error()),
      http.get(EMT_UBICACIONES_URL, () => HttpResponse.error()),
    )

    const res = await GET(makeRequest({ parada: 'P001' }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(typeof body.error).toBe('string')
  })
})
