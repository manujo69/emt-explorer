# Implementation Plan: EMT Málaga Map

## Overview

Implementación incremental de la aplicación Next.js 15 que muestra en tiempo real la posición de los autobuses de la EMT de Málaga sobre un mapa OpenStreetMap con MapLibre GL y teselas de OpenFreeMap (sin API key). El orden de las tareas sigue las dependencias naturales del grafo: primero los tipos y utilidades puras, luego las API Routes (servidor), después el estado global y los hooks de cliente, a continuación los componentes de UI, y finalmente la integración y el cableado final.

Stack: Next.js 15, React 19, TypeScript strict, Tailwind CSS v4, TanStack Query v5, Zustand, MapLibre GL + react-map-gl/maplibre + OpenFreeMap, Vitest, RTL, MSW, fast-check.

---

## Tasks

### Fase 1 — Tipos, utilidades puras y API Routes base

- [x] 1.1 Crear los tipos TypeScript del dominio EMT
  - `src/features/emt/types/emt.types.ts` con `BusUbicacion`, `LineaEMT` (incluye `cabeceraIda`/`cabeceraVuelta`), `ParadaEMT`, `LlegadaLinea`, `ShapePoint`, `ShapesByDirection`, `ApiError`
  - _Requirements: 1.3, 2.5, 3.1, 3.2, 10.4, 11.1, 12.1_

- [x] 1.2 Implementar el CSV parser (`csvParser.ts`)
  - `src/shared/utils/csvParser.ts` con `detectDelimiter`, `parseCSVLine`, `normalizeCodLinea`, `parseUbicacionesCSV`, `parseLineasCSV`, `parseParadasCSV`
  - Detección automática de delimitador (coma vs punto y coma)
  - Normalización de `codLinea` float-string → string entero (`"1.0"` → `"1"`)
  - Validación de rangos geográficos, campos requeridos y número de columnas
  - Deduplicación por `codLinea` en `parseLineasCSV`
  - _Requirements: 3.1–3.6_

- [x]* 1.3 Escribir property tests para `csvParser.ts` — Properties 1–4
  - `src/shared/utils/csvParser.test.ts` con arbitrarios fast-check
  - Property 1: parser ubicaciones produce objetos con forma y rangos válidos
  - Property 2: parser líneas produce objetos con forma válida y sin duplicados
  - Property 3: parser descarta filas inválidas y preserva las válidas
  - Property 4: parser recorta espacios en blanco de todos los campos string
  - Edge cases: CSV vacío, solo cabecera, BOM, columnas de más/menos

- [x] 1.4 Implementar `formatErrorMessage`
  - `src/shared/utils/formatErrorMessage.ts`
  - Nunca expone status codes, stack traces ni objetos internos
  - _Requirements: 9.6_

- [x]* 1.5 Escribir property test para `formatErrorMessage` — Property 12
  - `src/shared/utils/formatErrorMessage.test.ts`
  - Property 12: mensajes de error siempre cadenas legibles sin datos técnicos
  - Casos: `Error`, string, número, `null`, objeto con campo `error`

- [x] 1.6 Implementar utilidades de geometría compartidas
  - `src/shared/utils/snapToPolyline.ts` — proyecta un punto sobre el segmento más cercano de una polilínea
  - `src/shared/utils/catmullRomSmooth.ts` — suavizado Catmull-Rom de coordenadas
  - `src/shared/utils/haversine.ts` — distancia Haversine entre dos puntos GPS

- [x]* 1.7 Escribir tests para utilidades de geometría
  - `src/shared/utils/snapToPolyline.test.ts`
  - `src/shared/utils/catmullRomSmooth.test.ts`
  - `src/shared/utils/haversine.test.ts`

- [x] 1.8 Crear constantes compartidas de las API Routes
  - `src/app/api/emt/constants.ts` con `EMT_UBICACIONES_URL`, `EMT_LINEAS_URL`, `LINEA_PARAM_REGEX`, `PARADA_PARAM_REGEX`
  - _Requirements: 1.2, 2.4_

- [x] 1.9 Implementar `GET /api/emt/lineas`
  - `src/app/api/emt/lineas/route.ts`
  - `next: { revalidate: 3600 }`, parseo con `parseLineasCSV`, ordenación lexicográfica por `codLinea`
  - Incluye `cabeceraIda` y `cabeceraVuelta` en la respuesta
  - _Requirements: 1.1–1.7_

- [x]* 1.10 Escribir tests para `GET /api/emt/lineas` — Properties 5, 7
  - `src/app/api/emt/lineas/route.test.ts` con MSW
  - Property 5: lista siempre ordenada lexicográficamente
  - Property 7: errores HTTP del origen propagados con el mismo status code
  - Edge cases: CSV vacío, error de red

- [x] 1.11 Implementar `GET /api/emt/ubicaciones`
  - `src/app/api/emt/ubicaciones/route.ts`
  - Valida `linea` (presente, no vacío, solo alfanuméricos/guiones → HTTP 400)
  - `cache: 'no-store'`, parseo con `parseUbicacionesCSV`, filtrado por `codLinea === linea`
  - _Requirements: 2.1–2.8_

- [x]* 1.12 Escribir tests para `GET /api/emt/ubicaciones` — Properties 6, 7, 8
  - `src/app/api/emt/ubicaciones/route.test.ts` con MSW
  - Property 6: filtrado devuelve solo buses de la línea solicitada
  - Property 7: errores HTTP del origen propagados
  - Property 8: parámetro con caracteres inválidos → HTTP 400
  - Edge cases: sin `linea`, `linea` vacía, error de red, 0 coincidencias

---

### Fase 2 — Nuevas API Routes (paradas, shapes, llegadas)

- [x] 2.1 Implementar `GET /api/emt/paradas`
  - `src/app/api/emt/paradas/route.ts`
  - Valida `linea` (HTTP 400 si inválido)
  - `next: { revalidate: 1800 }`, parseo con `parseParadasCSV`, filtra por `codLinea`, ordena por `sentido` → `orden`
  - _Requirements: 10.1–10.8_

- [x]* 2.2 Escribir tests para `GET /api/emt/paradas`
  - `src/app/api/emt/paradas/route.test.ts` con MSW
  - Valida ordenación, filtrado, HTTP 400 sin parámetro, HTTP 200 con array vacío

- [x] 2.3 Implementar `GET /api/emt/shapes`
  - `src/app/api/emt/shapes/route.ts`
  - Valida `linea` (HTTP 400 si inválido)
  - Lee GTFS locales (`data/gtfs/shapes.csv`, `data/gtfs/trips.csv`) con caché en memoria de 1800 s
  - Cruza `trips.csv` para mapear sentido → `shape_id`, extrae coordenadas ordenadas de `shapes.csv`
  - Devuelve `ShapesByDirection` (`{}` si no hay shapes para la línea)
  - _Requirements: 11.1–11.7_

- [x]* 2.4 Escribir tests para `GET /api/emt/shapes`
  - `src/app/api/emt/shapes/route.test.ts`
  - Verifica parsing de GTFS, respuesta vacía para líneas sin shapes, HTTP 400 sin parámetro

- [x] 2.5 Implementar `GET /api/emt/llegadas`
  - `src/app/api/emt/llegadas/route.ts`
  - Valida `parada` (HTTP 400 si inválido)
  - Intenta scraping de EMT_Mobile (`informacionParada.html?codParada=X`) con `cache: 'no-store'`
  - Fallback Haversine: descarga `EMT_LINEAS_URL` (revalidate:1800) y `EMT_UBICACIONES_URL` (no-store) en paralelo con `Promise.all`, calcula `busIdx > targetIdx` y velocidad 200 m/min
  - Ordena resultado por `minutos` ascendente
  - _Requirements: 12.1–12.9_

- [x]* 2.6 Escribir tests para `GET /api/emt/llegadas`
  - `src/app/api/emt/llegadas/route.test.ts`
  - Testea ruta happy path EMT_Mobile, fallback Haversine, HTTP 400, array vacío

---

### Fase 3 — Store, servicios y hooks de cliente

- [x] 3.1 Implementar query keys y funciones de fetch puras
  - `src/features/emt/services/emtQueryKeys.ts` con `emtKeys` (lineas, ubicaciones, paradas, llegadas, shapes)
  - `src/features/emt/services/emtApi.ts` con `fetchLineas`, `fetchUbicaciones`, `fetchParadas`, `fetchShapes`, `fetchLlegadas`
  - Todas lanzan `Error` con mensaje legible si `res.ok === false`
  - _Requirements: 4.1, 5.2, 8.1_

- [x]* 3.2 Escribir unit tests para `emtApi.ts`
  - `src/features/emt/services/emtApi.test.ts` con MSW
  - Respuesta exitosa y de error para todas las funciones de fetch

- [x] 3.3 Implementar el Zustand store (`emtStore.ts`)
  - `src/features/emt/store/emtStore.ts`
  - Estado: `lineaSeleccionada: null`, `sentidosActivos: [1, 2]`, `paradaSeleccionada: null`
  - Acciones: `setLineaSeleccionada` (resetea `sentidosActivos` y `paradaSeleccionada`), `toggleSentido` (nunca deja el array vacío), `setParadaSeleccionada`
  - Selectores granulares para todos los campos y acciones
  - `devtools` middleware con `name: 'emt-store'`
  - _Requirements: 5.1, 5.3, 15.2, 15.3_

- [x]* 3.4 Escribir tests para `emtStore.ts` — Properties 11, 13
  - `src/features/emt/store/emtStore.test.ts`
  - Property 11: store refleja siempre la última línea seleccionada
  - Property 13: `sentidosActivos` nunca queda vacío
  - Secuencias arbitrarias de selecciones con fast-check

- [x] 3.5 Implementar hooks de TanStack Query
  - `src/features/emt/hooks/useLineas.ts` — `staleTime: 55_000`, `retry: 2`, retryDelay exponencial
  - `src/features/emt/hooks/useUbicaciones.ts` — `enabled: Boolean(linea)`, `refetchInterval: 60_000`, `staleTime: 55_000`, `refetchOnWindowFocus: true`, `retry: 1`
  - `src/features/emt/hooks/useParadas.ts` — `enabled: Boolean(linea)`, `staleTime: 3_600_000`, `retry: 2`
  - `src/features/emt/hooks/useShapes.ts` — `enabled: Boolean(linea)`, `staleTime: 1_800_000`, `retry: 2`
  - `src/features/emt/hooks/useLlegadas.ts` — `enabled: Boolean(parada)`, `staleTime: 0`
  - _Requirements: 4.1, 5.2, 5.4, 7.1, 7.2, 7.4, 7.5, 10.9, 11.8_

- [x]* 3.6 Escribir tests para `useLineas` y `useUbicaciones`
  - `src/features/emt/hooks/useLineas.test.ts` — staleTime, retry, refetch
  - `src/features/emt/hooks/useUbicaciones.test.ts` — enabled:false cuando linea es null, refetchInterval, staleTime, cambio de query key
  - RTL `renderHook` + MSW

- [ ]* 3.7 Escribir tests para `useParadas`, `useShapes` y `useLlegadas`
  - `src/features/emt/hooks/useParadas.test.ts`
  - `src/features/emt/hooks/useShapes.test.ts`
  - `src/features/emt/hooks/useLlegadas.test.ts`
  - Verificar `enabled: false` cuando el parámetro es null, `staleTime` correcto

---

### Fase 4 — Utilidades de feature y componentes compartidos

- [x] 4.1 Implementar utilidades de feature EMT
  - `src/features/emt/utils/lineaColors.ts` — tabla de colores por `codLinea`; `getLineaColor`, `getSentidoColor`, `getTextColor`, `getTextShadow`, `getLineaLabel`
  - `src/features/emt/utils/isCircular.ts` — detecta si `nombreLinea` corresponde a una línea circular

- [x] 4.2 Implementar componentes compartidos
  - `src/shared/components/LoadingSpinner.tsx` — prop `label?: string`, `role="status"`
  - `src/shared/components/ErrorMessage.tsx` — props `message: string`, `onRetry?: () => void`
  - `src/shared/components/MapSkeleton.tsx` — skeleton visible mientras carga MapLibre GL
  - _Requirements: 9.1, 9.2, 9.3_

---

### Fase 5 — Componentes de mapa

- [x] 5.1 Implementar `BusMarker`
  - `src/features/emt/components/BusMarker.tsx`
  - `<Marker>` de `react-map-gl/maplibre` con SVG circular
  - Color de relleno desde `getSentidoColor(codLinea, sentido)`
  - Tamaño zoom-aware: 12 px (< z13) → 32 px (≥ z16)
  - Texto con el código de línea abreviado, `title` accesible
  - _Requirements: 6.1, 6.2_

- [ ]* 5.2 Escribir tests para `BusMarker`
  - `src/features/emt/components/BusMarker.test.tsx` con RTL, mockear `react-map-gl/maplibre`
  - Verifica posición, color y accesibilidad del marcador

- [x] 5.3 Implementar `MapCameraController`
  - `src/features/emt/components/MapCameraController.tsx`
  - Componente sin DOM; usa `useMap()` para acceder al mapa
  - Cuando cambia `linea` o `paradas`, calcula bounding box y llama a `map.fitBounds(bounds, { padding: 40 })`

- [x] 5.4 Implementar `RutaLinea`
  - `src/features/emt/components/RutaLinea.tsx`
  - Renderiza `<Source>/<Layer>` GeoJSON por sentido activo con `line-width: 6`, `line-opacity: 0.7`
  - Suavizado Catmull-Rom (factor 4 con shapes, factor 8 con fallback de paradas)
  - Thinning de paradas: suprime marcadores intermedios a < 28 px, preserva primer y último
  - Snap de paradas al shape; marcadores SVG escalados por zoom
  - Al pulsar una parada → `setParadaSeleccionada`
  - _Requirements: 13.1–13.9_

- [ ]* 5.5 Escribir tests para `RutaLinea`
  - `src/features/emt/components/RutaLinea.test.tsx` con RTL + MSW, mockear `react-map-gl/maplibre`
  - Sin renders cuando no hay línea o paradas están vacías
  - Renderiza un marcador de parada por cada parada visible tras thinning
  - Llama a `setParadaSeleccionada` al pulsar

- [x] 5.6 Implementar `ParadaModal`
  - `src/features/emt/components/ParadaModal.tsx`
  - `<Popup>` de `react-map-gl/maplibre` con `closeOnClick: false`
  - Spinner durante carga; lista de llegadas agrupada (línea seleccionada primero, separador, resto)
  - Badge coloreado con código de línea, destino, minutos formateados
  - Fallback de destino para circulares sin `destino`
  - Cierra con `setParadaSeleccionada(null)`
  - _Requirements: 14.1–14.9_

- [ ]* 5.7 Escribir tests para `ParadaModal`
  - `src/features/emt/components/ParadaModal.test.tsx` con RTL + MSW
  - Sin render cuando `paradaSeleccionada` es null
  - Spinner durante carga de llegadas
  - "No hay buses en camino" con array vacío
  - Orden correcto (línea seleccionada primero)
  - Cierre al pulsar X

- [x] 5.8 Implementar `SentidoFilter`
  - `src/features/emt/components/SentidoFilter.tsx`
  - Solo renderiza cuando hay línea seleccionada, no es circular, y ambas cabeceras son no vacías
  - Dos filas (`SentidoRow`) con toggle switch coloreado por sentido
  - Llama a `toggleSentido(sentido)` del store
  - _Requirements: 15.1–15.7_

- [ ]* 5.9 Escribir tests para `SentidoFilter`
  - `src/features/emt/components/SentidoFilter.test.tsx` con RTL + MSW
  - Sin render sin línea seleccionada
  - Sin render para líneas circulares
  - Toggle llama a `toggleSentido` del store

- [x] 5.10 Implementar `MapaEMT`
  - `src/features/emt/components/MapaEMT.tsx`
  - `<Map>` de `react-map-gl/maplibre` con estilo `https://tiles.openfreemap.org/styles/bright`
  - Customizaciones de estilo en `onLoad`: oculta edificios 3D, filtra POIs recreativos/turísticos, ajusta colores de carreteras, añade capas de parques y edificios religiosos
  - Sub-componentes internos: `<MapCameraController>`, `<RutaLinea zoom>`, `<BusMarkersLayer zoom>`, `<ParadaModal>`
  - `BusMarkersLayer`: filtra buses por `sentidosActivos`, aplica snap a cada bus, renderiza `<BusMarker>`
  - Overlays: loading, staleness, error (sin quitar marcadores existentes)
  - _Requirements: 5.4, 6.1–6.8, 7.3, 7.6, 9.3_

- [x]* 5.11 Escribir tests para `MapaEMT` — Property 9
  - `src/features/emt/components/MapaEMT.test.tsx` con RTL + MSW, mockear `react-map-gl/maplibre`
  - Property 9: renderiza exactamente un BusMarker por bus del sentido activo
  - Sin marcadores cuando no hay línea; N marcadores para N buses; loading overlay; error overlay; empty state; staleness indicator

- [x]* 5.12 Escribir tests para `LineaSelector` — Property 10
  - `src/features/emt/components/LineaSelector.test.tsx` con RTL + MSW
  - Property 10: muestra todas las líneas como opciones seleccionables
  - Spinner durante carga, error + retry, empty state, llamada a `setLineaSeleccionada`

---

### Fase 6 — Providers, layout y cableado final

- [x] 6.1 Implementar `Providers`
  - `src/providers/Providers.tsx` con `QueryClientProvider`
  - `QueryClient` instanciado fuera del componente (singleton)
  - `defaultOptions.queries.staleTime: 0`

- [x] 6.2 Implementar `layout.tsx` y `globals.css`
  - `src/app/layout.tsx` envolviendo `{children}` con `<Providers>`
  - `src/app/globals.css` con directivas de Tailwind CSS v4

- [x] 6.3 Implementar `page.tsx`
  - `src/app/page.tsx` con `'use client'`
  - `MapaEMT` cargado con `next/dynamic + ssr: false` y `<MapSkeleton>` de carga
  - `LineaSelector` y `SentidoFilter` en la cabecera, `MapaEMT` en el área principal

---

## Checklist de entrega

- [x] TypeScript sin errores (`tsc --noEmit`)
- [x] Todos los archivos de implementación creados
- [ ] Suite de tests completa (`vitest --run`) — tests de nuevos hooks y componentes pendientes (tareas 3.7, 5.2, 5.5, 5.7, 5.9)
- [x] Mapa renderiza con teselas OpenFreeMap sin API key
- [x] Polling de posiciones cada 60 s
- [x] Ruta y paradas visibles al seleccionar línea
- [x] Modal de llegadas al pulsar parada
- [x] Filtro de sentido funcional

---

## Notes

- Las tareas marcadas con `*` son opcionales (tests); la implementación funcional está completa
- Tareas pendientes (todas opcionales): 3.7, 5.2, 5.5, 5.7, 5.9 — tests de hooks y componentes nuevos
- Los tests de componentes mockean `react-map-gl/maplibre` con `vi.mock` para evitar dependencia de WebGL en el entorno de test
- El barrel export `src/features/emt/index.ts` se eliminó; los imports son directos por componente
- `MapaEMT` se carga con `next/dynamic + ssr: false` — MapLibre GL requiere APIs de browser
- Todos los componentes llevan `'use client'` (sin RSC en este proyecto)
- El tipo declaration `src/maplibre-css.d.ts` permite importar `maplibre-gl/dist/maplibre-gl.css`
- La infraestructura de tests está en `src/test/`: `mswServer.ts`, `queryWrapper.tsx`, `setup.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6"] },
    { "id": 2, "tasks": ["1.3", "1.5", "1.7", "1.8"] },
    { "id": 3, "tasks": ["1.9", "1.11", "2.1", "2.3", "2.5"] },
    { "id": 4, "tasks": ["1.10", "1.12", "2.2", "2.4", "2.6", "3.1", "3.3"] },
    { "id": 5, "tasks": ["3.2", "3.4", "3.5", "4.1", "4.2"] },
    { "id": 6, "tasks": ["3.6", "3.7", "5.1", "5.3"] },
    { "id": 7, "tasks": ["5.4", "5.6", "5.8", "5.10"] },
    { "id": 8, "tasks": ["5.2", "5.5", "5.7", "5.9", "5.11", "5.12"] },
    { "id": 9, "tasks": ["6.1"] },
    { "id": 10, "tasks": ["6.2"] },
    { "id": 11, "tasks": ["6.3"] }
  ]
}
```
