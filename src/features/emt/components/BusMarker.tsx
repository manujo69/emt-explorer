'use client'

import L from 'leaflet'
import { Marker } from 'react-leaflet'
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

function busSvgIcon(color: string, textColor: string, label: string, size: number): L.DivIcon {
  const strokeColor = textColor === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'
  const fontSize = Math.max(Math.round(size * 0.45), 7)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 0.5}" fill="${color}"/>
    <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
      fill="${textColor}" stroke="${strokeColor}" stroke-width="2" paint-order="stroke"
      font-size="${fontSize}" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif"
    >${label}</text>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function BusMarker({ bus, zoom }: BusMarkerProps) {
  const color = getSentidoColor(bus.codLinea, bus.sentido)
  const textColor = getTextColor(color)
  const size = busIconSize(zoom)

  return (
    <Marker
      position={[bus.latitud, bus.longitud]}
      title={`Bus ${bus.codBus} — Línea ${bus.codLinea}`}
      icon={busSvgIcon(color, textColor, getLineaLabel(bus.codLinea), size)}
      zIndexOffset={10}
    />
  )
}
