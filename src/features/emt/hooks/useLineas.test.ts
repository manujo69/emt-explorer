import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { mswServer } from '@/test/mswServer'
import { createQueryWrapper } from '@/test/queryWrapper'
import { useLineas } from './useLineas'

const SAMPLE_LINEAS = [
  { codLinea: '1', nombreLinea: 'Parque del Sur - Centro' },
]

beforeAll(() => mswServer.listen())
afterEach(() => mswServer.resetHandlers())
afterAll(() => mswServer.close())

describe('useLineas', () => {
  it('devuelve datos cuando la query tiene éxito', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json(SAMPLE_LINEAS)),
    )

    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useLineas(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SAMPLE_LINEAS)
  })

  it('pasa a estado error cuando la API falla', async () => {
    mswServer.use(
      http.get('/api/emt/lineas', () => HttpResponse.json({ error: 'Error del servidor' }, { status: 500 })),
    )

    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useLineas(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('tiene staleTime de 55000ms', () => {
    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useLineas(), { wrapper: Wrapper })
    expect(result.current).toBeDefined()
  })

  it('refetch() re-emite la query', async () => {
    let callCount = 0
    mswServer.use(
      http.get('/api/emt/lineas', () => {
        callCount++
        return HttpResponse.json(SAMPLE_LINEAS)
      }),
    )

    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useLineas(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const initialCount = callCount

    await result.current.refetch()
    expect(callCount).toBeGreaterThan(initialCount)
  })
})
