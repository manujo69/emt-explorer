'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { useEMTStore, selectLineaSeleccionada } from '../store/emtStore'
import { useParadas } from '../hooks/useParadas'

export function MapCameraController() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const { data: paradas = [] } = useParadas(linea)
  const map = useMap()

  useEffect(() => {
    if (!linea || paradas.length === 0) return

    const bounds = L.latLngBounds(
      paradas.map(p => [p.latitud, p.longitud] as [number, number])
    )
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, linea, paradas])

  return null
}
