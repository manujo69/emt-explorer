import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { useEMTStore, selectLineaSeleccionada } from './emtStore'

beforeEach(() => {
  useEMTStore.setState({ lineaSeleccionada: null })
})

describe('emtStore — Property 11: refleja la última línea seleccionada', () => {
  it('para cualquier secuencia de selecciones el estado es el último valor', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
            fc.constant(null),
          ),
          { minLength: 1, maxLength: 50 },
        ),
        (selections) => {
          for (const linea of selections) {
            useEMTStore.getState().setLineaSeleccionada(linea)
          }
          const state = useEMTStore.getState()
          return selectLineaSeleccionada(state) === selections[selections.length - 1]
        },
      ),
      { numRuns: 200 },
    )
  })

  it('estado inicial es null', () => {
    expect(useEMTStore.getState().lineaSeleccionada).toBeNull()
  })

  it('setLineaSeleccionada actualiza el estado', () => {
    useEMTStore.getState().setLineaSeleccionada('1')
    expect(useEMTStore.getState().lineaSeleccionada).toBe('1')
  })

  it('setLineaSeleccionada acepta null para deseleccionar', () => {
    useEMTStore.getState().setLineaSeleccionada('1')
    useEMTStore.getState().setLineaSeleccionada(null)
    expect(useEMTStore.getState().lineaSeleccionada).toBeNull()
  })
})
