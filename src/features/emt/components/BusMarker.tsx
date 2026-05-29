'use client'

import { Marker } from 'react-map-gl/maplibre'
import type { BusUbicacion } from '../types/emt.types'
import { getSentidoColor, getTextColor, getLineaLabel } from '../utils/lineaColors'

interface BusMarkerProps {
  bus: BusUbicacion
  zoom: number
}

function busIconSize(zoom: number): number {
  if (zoom >= 16) return 32
  if (zoom >= 15) return 26
  if (zoom >= 14) return 20
  if (zoom >= 13) return 16
  return 12
}

export function BusMarker({ bus, zoom }: BusMarkerProps) {
  const color = getSentidoColor(bus.codLinea, bus.sentido)
  const textColor = getTextColor(color)
  const size = busIconSize(zoom)
  const strokeColor = textColor === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'
  const fontSize = Math.max(Math.round(size * 0.45), 7)
  const label = getLineaLabel(bus.codLinea)

  return (
    <Marker
      longitude={bus.longitud}
      latitude={bus.latitud}
      style={{ zIndex: 10 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <title>{`Bus ${bus.codBus} — Línea ${bus.codLinea}`}</title>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill={color} />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          stroke={strokeColor}
          strokeWidth={2}
          paintOrder="stroke"
          fontSize={fontSize}
          fontWeight={700}
          fontFamily="ui-sans-serif,system-ui,sans-serif"
        >
          {label}
        </text>
      </svg>
    </Marker>
  )
}
