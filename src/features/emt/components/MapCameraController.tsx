'use client'

import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { useEMTStore, selectLineaSeleccionada } from '../store/emtStore'
import { useParadas } from '../hooks/useParadas'

export function MapCameraController() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const { data: paradas = [] } = useParadas(linea)
  const map = useMap()

  useEffect(() => {
    if (!map || !linea || paradas.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    for (const parada of paradas) {
      bounds.extend({ lat: parada.latitud, lng: parada.longitud })
    }
    map.fitBounds(bounds, 40)
  }, [map, linea, paradas])

  return null
}
