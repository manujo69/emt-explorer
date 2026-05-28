import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import fc from 'fast-check'
import { mswServer } from '@/test/mswServer'
import { createQueryWrapper } from '@/test/queryWrapper'
import { useEMTStore } from '../store/emtStore'
import { LineaSelector } from './LineaSelector'

const SAMPLE_LINEAS = [
  { codLinea: '1', nombreLinea: 'Parque del Sur - Centro' },
  { codLinea: '2', nombreLinea: 'Portada Alta - Centro' },
  { codLinea: '10', nombreLinea: 'Hospital - Estadio' },
]

beforeAll(() => mswServer.listen())
afterEach(() => {
  mswServer.resetHandlers()
  useEMTStore.setState({ lineaSeleccionada: null })
})
afterAll(() => mswServer.close())

function renderLineaSelector() {
  const { Wrapper } = createQueryWrapper()
  return render(<LineaSelector />, { wrapper: Wrapper })
}

describe('LineaSelector', () => {
  it('muestra un spinner mientras carga', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', async () => {
        await new Promise(r => setTimeout(r, 100))
        return HttpResponse.json(SAMPLE_LINEAS)
      }),
    )

    renderLineaSelector()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('muestra las opciones cuando la carga completa (Property 10)', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json(SAMPLE_LINEAS)),
    )

    renderLineaSelector()

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /seleccionar línea de autobús/i })).toBeInTheDocument(),
    )

    const options = screen.getAllByRole('option')
    expect(options.length).toBe(SAMPLE_LINEAS.length + 1)

    for (const linea of SAMPLE_LINEAS) {
      expect(screen.getByRole('option', { name: new RegExp(`^${linea.codLinea} —`) })).toBeInTheDocument()
    }
  })

  it('Property 10: N líneas → N opciones seleccionables', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            codLinea: fc.integer({ min: 1, max: 200 }).map(String),
            nombreLinea: fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length > 0),
          }),
          { minLength: 1, maxLength: 10 },
        ).filter(lineas => {
          const codes = lineas.map(l => l.codLinea)
          return new Set(codes).size === codes.length
        }),
        async (lineas) => {
          mswServer.use(
            http.get('/api/emt/lineas', () => HttpResponse.json(lineas)),
          )

          const { Wrapper } = createQueryWrapper()
          const { unmount } = render(<LineaSelector />, { wrapper: Wrapper })

          await waitFor(() =>
            expect(screen.getByRole('combobox')).toBeInTheDocument(),
          )

          const options = screen.getAllByRole('option')
          expect(options.length).toBe(lineas.length + 1)

          unmount()
          mswServer.resetHandlers()
        },
      ),
      { numRuns: 10 },
    )
  })

  it('muestra un mensaje de error con botón de retry cuando la carga falla', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json({ error: 'Error del servidor' }, { status: 500 })),
    )

    renderLineaSelector()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('muestra empty state cuando no hay líneas', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json([])),
    )

    renderLineaSelector()

    await waitFor(() =>
      expect(screen.getByText(/no hay líneas disponibles/i)).toBeInTheDocument(),
    )
  })

  it('llama a setLineaSeleccionada al seleccionar una opción', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json(SAMPLE_LINEAS)),
    )

    const user = userEvent.setup()
    renderLineaSelector()

    await waitFor(() =>
      expect(screen.getByRole('combobox')).toBeInTheDocument(),
    )

    await user.selectOptions(screen.getByRole('combobox'), '1')

    expect(useEMTStore.getState().lineaSeleccionada).toBe('1')
  })
})
