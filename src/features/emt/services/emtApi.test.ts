import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from '@/test/mswServer'
import { fetchLineas, fetchUbicaciones } from './emtApi'

const SAMPLE_LINEAS = [
  { codLinea: '1', nombreLinea: 'Parque del Sur - Centro' },
  { codLinea: '2', nombreLinea: 'Portada Alta - Centro' },
]

const SAMPLE_BUSES = [
  { codBus: '581', codLinea: '1', sentido: 2, longitud: -4.456, latitud: 36.697, codParIni: '1253', lastUpdate: '2026-05-25' },
]

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

describe('fetchLineas', () => {
  it('devuelve LineaEMT[] en respuesta exitosa', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json(SAMPLE_LINEAS)),
    )
    const result = await fetchLineas()
    expect(result).toEqual(SAMPLE_LINEAS)
  })

  it('lanza Error con mensaje legible cuando el servidor responde error', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json({ error: 'Servicio no disponible' }, { status: 503 })),
    )
    await expect(fetchLineas()).rejects.toThrow('Servicio no disponible')
  })
})

describe('fetchUbicaciones', () => {
  it('devuelve BusUbicacion[] en respuesta exitosa', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json(SAMPLE_BUSES)),
    )
    const result = await fetchUbicaciones('1')
    expect(result).toEqual(SAMPLE_BUSES)
  })

  it('lanza Error con mensaje legible cuando el servidor responde error', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json({ error: 'Parámetro inválido' }, { status: 400 })),
    )
    await expect(fetchUbicaciones('???')).rejects.toThrow('Parámetro inválido')
  })
})
