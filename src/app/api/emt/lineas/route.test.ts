import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from '@/test/mswServer'
import { GET } from './route'
import { EMT_LINEAS_URL } from '../constants'

const SAMPLE_LINEAS_CSV = [
  '"codLinea","codLineaStr","codLineaStrSin","userCodLinea","nombreLinea","observaciones","cabeceraIda","cabeceraVuelta","avisoSinHorarioEs","avisoSinHorarioEn","tagsAccesibilidad","linea","sentido","orden","espera","fechaInicioDemanda","fechaFinDemanda","codParada","nombreParada","direccion","lon","lat","lineas"',
  '"2.0","2","2","2","Portada Alta - Centro","","Portada Alta","Alameda Principal","","","","2","1","1","3","","","P001","Portada Alta","Calle A","-4.4","36.7","2"',
  '"2.0","2","2","2","Portada Alta - Centro","","Portada Alta","Alameda Principal","","","","2","2","1","3","","","P002","Alameda","Calle B","-4.5","36.8","2"',
  '"10.0","10","10","10","Hospital - Estadio","","Hospital","Estadio","","","","10","1","1","3","","","P003","Hospital","Calle C","-4.3","36.6","10"',
  '"1.0","1","1","1","Parque del Sur - Centro","","Parque del Sur","Alameda","","","","1","1","1","3","","","P004","Parque del Sur","Calle D","-4.6","36.9","1"',
].join('\n')

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

describe('GET /api/emt/lineas', () => {
  it('devuelve HTTP 200 con lista de líneas ordenada lexicográficamente (Property 5)', async () => {
    mswServer.use(
      http.get(EMT_LINEAS_URL, () => HttpResponse.text(SAMPLE_LINEAS_CSV)),
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(3)

    const codLineas = body.map((l: { codLinea: string }) => l.codLinea)
    expect(codLineas).toEqual([...codLineas].sort((a: string, b: string) => a.localeCompare(b)))
  })

  it('propaga el mismo status HTTP cuando el origen falla (Property 7)', async () => {
    mswServer.use(
      http.get(EMT_LINEAS_URL, () => new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' })),
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
  })

  it('devuelve HTTP 200 con [] cuando el CSV no tiene filas de datos', async () => {
    mswServer.use(
      http.get(EMT_LINEAS_URL, () => HttpResponse.text('')),
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('devuelve HTTP 500 ante error de red', async () => {
    mswServer.use(
      http.get(EMT_LINEAS_URL, () => HttpResponse.error()),
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(typeof body.error).toBe('string')
  })
})
