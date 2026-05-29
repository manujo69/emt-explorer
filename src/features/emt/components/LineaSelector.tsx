'use client'

import { startTransition } from 'react'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { formatErrorMessage } from '@/shared/utils/formatErrorMessage'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { useLineas } from '../hooks/useLineas'
import { useEMTStore, selectLineaSeleccionada, selectSetLineaSeleccionada } from '../store/emtStore'
import { getLineaLabel } from '../utils/lineaColors'
import type { LineaEMT } from '../types/emt.types'

function truncarNombre(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max).lastIndexOf(' ')
  return (corte > 0 ? texto.slice(0, corte) : texto.slice(0, max)) + '…'
}

function lineaGroup(label: string): number {
  if (/^N\d+$/.test(label)) return 3
  if (/^C\d+$/.test(label)) return 2
  if (/^[A-Z]$/.test(label)) return 1
  return 0
}

function sortLineas(lineas: LineaEMT[]): LineaEMT[] {
  return [...lineas].sort((a, b) => {
    const la = getLineaLabel(a.codLinea, a.nombreLinea)
    const lb = getLineaLabel(b.codLinea, b.nombreLinea)
    const ga = lineaGroup(la)
    const gb = lineaGroup(lb)
    if (ga !== gb) return ga - gb
    const na = parseInt(la.replace(/\D/g, ''), 10)
    const nb = parseInt(lb.replace(/\D/g, ''), 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return la.localeCompare(lb)
  })
}

export function LineaSelector() {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const { data: lineas, isLoading, error, refetch } = useLineas()
  const lineaSeleccionada = useEMTStore(selectLineaSeleccionada)
  const setLinea = useEMTStore(selectSetLineaSeleccionada)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    startTransition(() => {
      setLinea(value || null)
    })
  }

  if (isLoading) {
    return <LoadingSpinner label="Cargando líneas..." />
  }

  if (error) {
    return (
      <ErrorMessage
        message={formatErrorMessage(error)}
        onRetry={() => refetch()}
      />
    )
  }

  if (!lineas || lineas.length === 0) {
    return <p role="status" className="text-sm text-gray-500">No hay líneas disponibles</p>
  }

  return (
    <select
      aria-label="Seleccionar línea de autobús"
      value={lineaSeleccionada ?? ''}
      onChange={handleChange}
      className="flex-1 min-w-0 mr-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">-- Selecciona una línea --</option>
      {sortLineas(lineas).map(l => (
        <option key={l.codLinea} value={l.codLinea}>
          {getLineaLabel(l.codLinea, l.nombreLinea)} — {isMobile ? truncarNombre(l.nombreLinea, 35) : l.nombreLinea}
        </option>
      ))}
    </select>
  )
}
