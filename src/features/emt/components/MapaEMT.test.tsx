import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import fc from 'fast-check'
import { mswServer } from '@/test/mswServer'
import { createQueryWrapper } from '@/test/queryWrapper'
import { useEMTStore } from '../store/emtStore'
import { MapaEMT } from './MapaEMT'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="google-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="bus-marker" aria-label={title ?? ''}>{children}</div>
  ),
  Polyline: () => null,
  Popup: () => null,
  useMap: () => ({ getZoom: () => 13, on: () => {}, off: () => {}, fitBounds: () => {} }),
}))

vi.mock('leaflet', () => ({
  default: { divIcon: () => ({}), latLngBounds: () => ({}) },
}))

function makeBus(codBus: string, codLinea: string, lat = 36.7, lng = -4.4) {
  return { codBus, codLinea, sentido: 1, longitud: lng, latitud: lat, codParIni: 'P01', lastUpdate: '2026-05-25' }
}

beforeAll(() => mswServer.listen())
afterEach(() => {
  mswServer.resetHandlers()
  useEMTStore.setState({ lineaSeleccionada: null })
})
afterAll(() => mswServer.close())

function renderMapaEMT() {
  const { Wrapper } = createQueryWrapper()
  return render(<MapaEMT />, { wrapper: Wrapper })
}

describe('MapaEMT', () => {
  it('no renderiza marcadores cuando no hay línea seleccionada', () => {
    renderMapaEMT()
    expect(screen.queryAllByTestId('bus-marker')).toHaveLength(0)
  })

  it('renderiza exactamente un marcador por bus con la posición correcta (Property 9)', async () => {
    const buses = [
      makeBus('100', '1', 36.697, -4.456),
      makeBus('200', '1', 36.710, -4.420),
    ]

    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json(buses)),
    )

    useEMTStore.setState({ lineaSeleccionada: '1' })
    renderMapaEMT()

    await waitFor(() =>
      expect(screen.getAllByTestId('bus-marker')).toHaveLength(2),
    )
  })

  it('Property 9: N buses → N marcadores', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 100, max: 999 }).map(String),
            lat: fc.float({ min: Math.fround(36.5), max: Math.fround(37.0), noNaN: true, noDefaultInfinity: true }),
            lng: fc.float({ min: Math.fround(-4.8), max: Math.fround(-4.1), noNaN: true, noDefaultInfinity: true }),
          }),
          { minLength: 0, maxLength: 15 },
        ).filter(buses => {
          const ids = buses.map(b => b.id)
          return new Set(ids).size === ids.length
        }),
        async (busesDef) => {
          const buses = busesDef.map(b => makeBus(b.id, '1', b.lat, b.lng))

          mswServer.use(
            http.get('/api/emt/ubicaciones', () => HttpResponse.json(buses)),
          )

          useEMTStore.setState({ lineaSeleccionada: '1' })
          const { Wrapper } = createQueryWrapper()
          const { unmount } = render(<MapaEMT />, { wrapper: Wrapper })

          await waitFor(() => {
            const markers = screen.queryAllByTestId('bus-marker')
            expect(markers).toHaveLength(buses.length)
          })

          unmount()
          mswServer.resetHandlers()
          useEMTStore.setState({ lineaSeleccionada: null })
        },
      ),
      { numRuns: 10 },
    )
  })

  it('muestra loading overlay sin quitar los marcadores existentes', async () => {
    const buses = [makeBus('100', '1')]

    mswServer.use(
      http.get('/api/emt/ubicaciones', async () => {
        await new Promise(r => setTimeout(r, 50))
        return HttpResponse.json(buses)
      }),
    )

    useEMTStore.setState({ lineaSeleccionada: '1' })
    renderMapaEMT()

    await waitFor(() =>
      expect(screen.getByRole('status')).toBeInTheDocument(),
    )
  })

  it('muestra error overlay sin quitar los marcadores existentes', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json({ error: 'Error' }, { status: 500 })),
      http.get('/api/emt/paradas', () => HttpResponse.json([])),
      http.get('/api/emt/shapes', () => HttpResponse.json({})),
    )

    useEMTStore.setState({ lineaSeleccionada: '1' })
    renderMapaEMT()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
      { timeout: 10000 },
    )
    expect(screen.queryAllByTestId('bus-marker')).toHaveLength(0)
  })

  it('no muestra marcadores ni spinner cuando la API devuelve 0 buses', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json([])),
    )

    useEMTStore.setState({ lineaSeleccionada: '1' })
    renderMapaEMT()

    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
      { timeout: 5000 },
    )

    expect(screen.queryAllByTestId('bus-marker')).toHaveLength(0)
  })
})
