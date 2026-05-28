'use client'

import { Popup } from 'react-leaflet'
import { useEMTStore, selectParadaSeleccionada, selectSetParadaSeleccionada, selectLineaSeleccionada } from '../store/emtStore'
import { useLlegadas } from '../hooks/useLlegadas'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { getLineaColor, getTextColor, getTextShadow, getLineaLabel } from '../utils/lineaColors'

function getDestinoDisplay(codLinea: string, destino: string): string {
  if (destino) return destino
  if (codLinea === 'N2') return 'Nocturno 2'
  return `Circular ${codLinea}`
}

function formatMinutos(min: number): string {
  if (min < 60) return `${min} min`
  const days = Math.floor(min / 1440)
  const hours = Math.floor((min % 1440) / 60)
  const mins = min % 60
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function ParadaModal() {
  const parada = useEMTStore(selectParadaSeleccionada)
  const setParadaSeleccionada = useEMTStore(selectSetParadaSeleccionada)
  const lineaSeleccionada = useEMTStore(selectLineaSeleccionada)
  const { data: llegadas = [], isLoading } = useLlegadas(parada?.codParada ?? null)

  if (!parada) return null

  return (
    <Popup
      key={parada.codParada}
      position={[parada.latitud, parada.longitud]}
      offset={[0, -20]}
      autoPan={true}
      eventHandlers={{ remove: () => setParadaSeleccionada(null) }}
    >
      <div>
        <p className="text-xs font-mono text-gray-500">Parada {parada.codParada}</p>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{parada.nombreParada}</p>
      </div>

      <div className="min-w-48">
        {isLoading && (
          <div className="flex justify-center py-2">
            <LoadingSpinner label="Calculando llegadas..." />
          </div>
        )}

        {!isLoading && llegadas.length === 0 && (
          <p className="py-1 text-sm text-gray-500">No hay buses en camino</p>
        )}

        {!isLoading && (() => {
          const selectedLabel = getLineaLabel(lineaSeleccionada ?? '')
          const seleccionadas = llegadas.filter(ll => getLineaLabel(ll.codLinea) === selectedLabel)
          const resto = llegadas
            .filter(ll => getLineaLabel(ll.codLinea) !== selectedLabel)
            .sort((a, b) => Number(a.codLinea) - Number(b.codLinea))
          const renderFila = (ll: typeof llegadas[number]) => {
            const bg = getLineaColor(ll.codLinea)
            const textColor = getTextColor(bg)
            return (
              <div
                key={`${ll.codLinea}-${ll.sentido}`}
                className="flex items-center gap-3 py-1.5"
              >
                <span
                  style={{ backgroundColor: bg, color: textColor, textShadow: getTextShadow(textColor) }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                >
                  {getLineaLabel(ll.codLinea)}
                </span>
                <span className="flex-1 truncate text-sm text-gray-700">{getDestinoDisplay(ll.codLinea, ll.destino)}</span>
                <span className="shrink-0 text-sm font-semibold text-gray-900">
                  {formatMinutos(ll.proximoBus.minutos)}
                </span>
              </div>
            )
          }

          return (
            <>
              {seleccionadas.map(renderFila)}
              {seleccionadas.length > 0 && resto.length > 0 && (
                <hr className="my-1 border-gray-200" />
              )}
              {resto.map(renderFila)}
            </>
          )
        })()}
      </div>
    </Popup>
  )
}
