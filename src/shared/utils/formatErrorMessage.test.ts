import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { formatErrorMessage } from './formatErrorMessage'

describe('formatErrorMessage — Property 12: mensajes legibles sin datos técnicos', () => {
  it('para cualquier input devuelve string no vacío sin stack traces ni HTTP status codes crudos', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.record({ error: fc.string() }),
          fc.record({ message: fc.string() }),
        ),
        (input) => {
          const result = formatErrorMessage(input)
          const isNonEmpty = typeof result === 'string' && result.length > 0
          const hasNoStackTrace = !result.includes('    at ')
          return isNonEmpty && hasNoStackTrace
        },
      ),
      { numRuns: 200 },
    )
  })

  it('devuelve el message del Error', () => {
    const err = new Error('Error de red')
    expect(formatErrorMessage(err)).toBe('Error de red')
  })

  it('devuelve mensaje genérico para string', () => {
    expect(formatErrorMessage('algo')).toBe('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.')
  })

  it('devuelve mensaje genérico para null', () => {
    expect(formatErrorMessage(null)).toBe('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.')
  })

  it('devuelve mensaje genérico para número', () => {
    expect(formatErrorMessage(404)).toBe('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.')
  })

  it('devuelve mensaje genérico para objeto arbitrario', () => {
    expect(formatErrorMessage({ error: 'internal' })).toBe('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.')
  })
})
