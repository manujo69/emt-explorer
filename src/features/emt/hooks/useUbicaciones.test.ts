import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mswServer } from '@/test/mswServer'
import { createQueryWrapper } from '@/test/queryWrapper'
import { useUbicaciones } from './useUbicaciones'

const SAMPLE_BUSES = [
  { codBus: '581', codLinea: '1', sentido: 2, longitud: -4.456, latitud: 36.697, codParIni: '1253', lastUpdate: '2026-05-25' },
]

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

describe('useUbicaciones', () => {
  it('no ejecuta la query cuando linea es null', () => {
    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUbicaciones(null), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('ejecuta la query cuando se proporciona una línea', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json(SAMPLE_BUSES)),
    )

    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUbicaciones('1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SAMPLE_BUSES)
  })

  it('la query key cambia al cambiar la línea seleccionada', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', ({ request }) => {
        const linea = new URL(request.url).searchParams.get('linea')
        return HttpResponse.json(
          linea === '1' ? SAMPLE_BUSES : [],
        )
      }),
    )

    const { Wrapper } = createQueryWrapper()
    let linea = '1'
    const { result, rerender } = renderHook(() => useUbicaciones(linea), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SAMPLE_BUSES)

    linea = '2'
    rerender()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('pasa a estado error cuando la API falla', async () => {
    mswServer.use(
      http.get('/api/emt/ubicaciones', () => HttpResponse.json({ error: 'Error del servidor' }, { status: 500 })),
    )

    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUbicaciones('1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
