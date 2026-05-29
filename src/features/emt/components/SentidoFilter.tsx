'use client'

import { useLineas } from '../hooks/useLineas'
import {
  useEMTStore,
  selectLineaSeleccionada,
  selectSentidosActivos,
  selectToggleSentido,
} from '../store/emtStore'
import { isCircular } from '../utils/isCircular'
import { getSentidoColor } from '../utils/lineaColors'

interface SentidoRowProps {
  color: string
  label: string
  active: boolean
  onToggle: () => void
}

function SentidoRow({ color, label, active, onToggle }: SentidoRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 select-none cursor-pointer">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="text-sm font-medium leading-none text-gray-900">{label}</span>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={active}
          onChange={onToggle}
        />
        <div className="w-9 h-5 rounded-full transition-colors duration-200" style={{ backgroundColor: active ? color : '#9ca3af' }} />
        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </label>
  )
}

export function SentidoFilter() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const sentidosActivos = useEMTStore(selectSentidosActivos)
  const toggleSentido = useEMTStore(selectToggleSentido)
  const { data: lineas = [] } = useLineas()

  if (!linea) return null

  const lineaData = lineas.find((l) => l.codLinea === linea)
  if (!lineaData || isCircular(lineaData.nombreLinea)) return null

  const { cabeceraIda = '', cabeceraVuelta = '' } = lineaData

  const sentidos = [
    { sentido: 2, label: cabeceraIda },
    { sentido: 1, label: cabeceraVuelta },
  ].filter(({ label }) => label.trim() !== '')

  if (sentidos.length < 2) return null

  return (
    <div className="flex flex-col gap-2.5">
      {sentidos.map(({ sentido, label }) => (
        <SentidoRow
          key={sentido}
          color={getSentidoColor(linea, sentido)}
          label={label}
          active={sentidosActivos.includes(sentido)}
          onToggle={() => toggleSentido(sentido)}
        />
      ))}
    </div>
  )
}
