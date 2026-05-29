'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import type { FilterSpecification } from 'maplibre-gl'
import { useState, useRef } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { formatErrorMessage } from '@/shared/utils/formatErrorMessage'
import { useEMTStore, selectLineaSeleccionada, selectSentidosActivos } from '../store/emtStore'
import { useUbicaciones } from '../hooks/useUbicaciones'
import { useShapes } from '../hooks/useShapes'
import { snapToPolyline } from '@/shared/utils/snapToPolyline'
import { BusMarker } from './BusMarker'
import { RutaLinea } from './RutaLinea'
import { ParadaModal } from './ParadaModal'
import { MapCameraController } from './MapCameraController'

const MALAGA_CENTER = { longitude: -4.4214, latitude: 36.7213, zoom: 13 }
const STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

function BusMarkersLayer({ zoom }: { zoom: number }) {
  const linea = useEMTStore(selectLineaSeleccionada)
  const sentidosActivos = useEMTStore(selectSentidosActivos)
  const { data: rawBuses = [] } = useUbicaciones(linea)
  const { data: shapes = {} } = useShapes(linea)

  const buses = rawBuses
    .filter(b => sentidosActivos.includes(b.sentido))
    .map(b => {
      const shape = shapes[b.sentido]
      if (!shape?.length) return b
      const snapped = snapToPolyline(b.latitud, b.longitud, shape)
      return { ...b, latitud: snapped.lat, longitud: snapped.lng }
    })

  return (
    <>
      {buses.map(bus => (
        <BusMarker key={bus.codBus} bus={bus} zoom={zoom} />
      ))}
    </>
  )
}

export function MapaEMT() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const { isLoading, isError, error, isStale } = useUbicaciones(linea)
  const [zoom, setZoom] = useState(MALAGA_CENTER.zoom)
  const mapRef = useRef<MapRef>(null)

  function handleLoad() {
    const mapInstance = mapRef.current?.getMap()
    if (!mapInstance) return
    mapInstance.on('styleimagemissing', (e) => {
      mapInstance.addImage(e.id, new ImageData(1, 1))
    })
    for (const layer of mapInstance.getStyle().layers ?? []) {
      if (layer.type === 'fill-extrusion') {
        mapInstance.setLayoutProperty(layer.id, 'visibility', 'none')
      }
    }
    for (const layerId of ['poi_r1', 'poi_r7', 'poi_r20']) {
      if (mapInstance.getLayer(layerId)) {
        const current = mapInstance.getFilter(layerId)
        mapInstance.setFilter(layerId, [
          'all',
          ...(current ? [current] : []),
          ['!', ['match', ['get', 'class'], ['park', 'leisure', 'nature', 'national_park', 'wood', 'garden', 'waste', 'recycling'], true, false]],
          ['!', ['match', ['get', 'subclass'], ['park', 'public_park', 'garden', 'nature_reserve', 'pitch', 'playground', 'waste_basket', 'recycling', 'waste_disposal', 'toilets', 'bench', 'drinking_water'], true, false]],
        ] as FilterSpecification)
      }
    }
    if (mapInstance.getLayer('building')) {
      mapInstance.setLayoutProperty('building', 'visibility', 'none')
    }
    if (mapInstance.getLayer('building-top')) {
      mapInstance.setPaintProperty('building-top', 'fill-color', '#e8e8e8')
    }
    const ROAD_FILL = '#ffffff'
    const ROAD_CASING = '#d0d0d0'
    for (const id of [
      'highway-primary',
      'highway-secondary-tertiary',
      'highway-trunk',
      'highway-motorway',
      'highway-motorway-link',
      'highway-link',
      'bridge-trunk-primary',
      'bridge-secondary-tertiary',
      'bridge-motorway',
      'bridge-motorway-link',
      'bridge-link',
      'tunnel-trunk-primary',
      'tunnel-secondary-tertiary',
      'tunnel-motorway',
      'tunnel-motorway-link',
      'tunnel-link',
    ]) {
      if (mapInstance.getLayer(id)) mapInstance.setPaintProperty(id, 'line-color', ROAD_FILL)
    }
    for (const id of [
      'highway-primary-casing',
      'highway-secondary-tertiary-casing',
      'highway-trunk-casing',
      'highway-motorway-casing',
      'highway-motorway-link-casing',
      'highway-link-casing',
      'bridge-trunk-primary-casing',
      'bridge-secondary-tertiary-casing',
      'bridge-motorway-casing',
      'bridge-motorway-link-casing',
      'bridge-link-casing',
      'tunnel-trunk-primary-casing',
      'tunnel-secondary-tertiary-casing',
      'tunnel-motorway-casing',
      'tunnel-motorway-link-casing',
      'tunnel-link-casing',
    ]) {
      if (mapInstance.getLayer(id)) mapInstance.setPaintProperty(id, 'line-color', ROAD_CASING)
    }
    if (mapInstance.getLayer('landuse-hospital')) mapInstance.setPaintProperty('landuse-hospital', 'fill-color', '#d8d8d8')
    if (mapInstance.getLayer('landuse-school')) mapInstance.setPaintProperty('landuse-school', 'fill-color', '#cacaca')
    mapInstance.setPaintProperty('park', 'fill-color', '#c8ddb8')
    if (mapInstance.getLayer('landcover_wood')) mapInstance.setPaintProperty('landcover_wood', 'fill-color', '#b8d0a8')
    if (!mapInstance.getLayer('building-worship')) {
      mapInstance.addLayer({
        id: 'building-worship',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        filter: ['match', ['get', 'class'], ['cathedral', 'church', 'chapel', 'place_of_worship', 'mosque', 'synagogue', 'temple'], true, false],
        paint: { 'fill-color': '#bfbdbd' },
      }, 'building-top')
    }
    if (!mapInstance.getLayer('public-park')) {
      mapInstance.addLayer({
        id: 'public-park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        filter: ['==', ['get', 'class'], 'public_park'],
        paint: { 'fill-color': '#c8ddb8' },
      }, 'park')
    }
    if (!mapInstance.getLayer('landuse-park')) {
      mapInstance.addLayer({
        id: 'landuse-park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'park'],
        paint: { 'fill-color': '#c8ddb8' },
      }, 'park')
    }
    if (!mapInstance.getLayer('park-label')) {
      mapInstance.addLayer({
        id: 'park-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'park',
        minzoom: 13,
        filter: ['has', 'name'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#4a7c3f',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })
    }
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        id="main"
        initialViewState={MALAGA_CENTER}
        mapStyle={STYLE_URL}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleLoad}
        onZoom={(e) => setZoom(e.viewState.zoom)}
      >
        <MapCameraController />
        <RutaLinea zoom={zoom} />
        <BusMarkersLayer zoom={zoom} />
<ParadaModal />
      </Map>

      {isLoading && (
        <div className="absolute right-2 top-2 rounded-md bg-white p-2 shadow-md">
          <LoadingSpinner label="Actualizando posiciones..." />
        </div>
      )}

      {isStale && !isLoading && !isError && (
        <div role="status" className="absolute right-2 top-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 shadow-md">
          Datos desactualizados
        </div>
      )}

      {isError && (
        <div className="absolute right-2 top-2 max-w-xs">
          <ErrorMessage message={formatErrorMessage(error)} />
        </div>
      )}
    </div>
  )
}
