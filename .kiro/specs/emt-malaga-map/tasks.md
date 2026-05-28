# Implementation Plan: EMT Málaga Map

## Overview

Implementación incremental de la aplicación Next.js 15 que muestra en tiempo real la posición de los autobuses de la EMT de Málaga. El orden de las tareas sigue las dependencias naturales del grafo: primero los tipos y utilidades puras, luego las API Routes (servidor), después el estado global y los hooks de cliente, a continuación los componentes de UI, y finalmente la integración y el cableado final.

Stack: Next.js 15, React 19, TypeScript strict, Tailwind CSS v4, TanStack Query v5, Zustand, @vis.gl/react-google-maps, Vitest, RTL, MSW, fast-check.

---

## Tasks

- [ ] 1. Tipos TypeScript y utilidades compartidas
  - [ ] 1.1 Crear los tipos TypeScript del dominio EMT
    - Crear `src/features/emt/types/emt.types.ts` con las interfaces `BusUbicacion`, `LineaEMT` y `ApiError` tal como se definen en el diseño
    - Incluir los comentarios JSDoc de cada campo
    - _Requirements: 1.3, 2.5, 3.1, 3.2_

  - [ ] 1.2 Implementar el CSV parser (`csvParser.ts`)
    - Crear `src/shared/utils/csvParser.ts` con las funciones `detectDelimiter`, `parseCSVLine`, `normalizeCodLinea`, `parseUbicacionesCSV` y `parseLineasCSV`
    - Implementar detección automática de delimitador (coma vs punto y coma)
    - Implementar normalización de `codLinea` float-string → string entero (`"1.0"` → `"1"`)
    - Implementar validación de rangos geográficos, campos requeridos y número de columnas
    - Implementar deduplicación por `codLinea` en `parseLineasCSV`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 1.3 Escribir property tests para `csvParser.ts` — Properties 1–4
    - **Property 1: El parser de ubicaciones produce objetos con forma y rangos válidos**
    - **Validates: Requirements 2.5, 3.1**
    - **Property 2: El parser de líneas produce objetos con forma válida y sin duplicados**
    - **Validates: Requirements 1.3, 3.2**
    - **Property 3: El parser descarta filas inválidas y preserva las válidas**
    - **Validates: Requirements 3.3, 3.5, 3.6**
    - **Property 4: El parser recorta espacios en blanco de todos los campos string**
    - **Validates: Requirements 3.4**
    - Crear `src/shared/utils/csvParser.test.ts` con arbitrarios fast-check para CSV válidos e inválidos
    - Incluir edge cases: CSV vacío, solo cabecera, BOM, filas con columnas de más/menos
    - Mínimo 200 iteraciones por propiedad (`numRuns: 200`)

  - [ ] 1.4 Implementar `formatErrorMessage`
    - Crear `src/shared/utils/formatErrorMessage.ts` con la función `formatErrorMessage(error: unknown): string`
    - Manejar `Error`, objetos arbitrarios y `null`/`undefined`
    - Nunca exponer status codes, stack traces ni objetos internos
    - _Requirements: 9.6_

  - [ ]* 1.5 Escribir property test para `formatErrorMessage` — Property 12
    - **Property 12: Los mensajes de error son siempre cadenas legibles sin datos técnicos internos**
    - **Validates: Requirements 9.6**
    - Crear `src/shared/utils/formatErrorMessage.test.ts`
    - Incluir ejemplos concretos: `Error`, string, número, `null`, objeto con campo `error`

- [ ] 2. Constantes y API Routes (servidor)
  - [ ] 2.1 Crear las constantes compartidas de las API Routes
    - Crear `src/app/api/emt/constants.ts` con `EMT_UBICACIONES_URL`, `EMT_LINEAS_URL` y `LINEA_PARAM_REGEX`
    - _Requirements: 1.2, 2.4_

  - [ ] 2.2 Implementar `GET /api/emt/lineas`
    - Crear `src/app/api/emt/lineas/route.ts`
    - Fetch con `next: { revalidate: 3600 }`
    - Parsear CSV con `parseLineasCSV` y ordenar por `codLinea` lexicográficamente
    - Manejar errores HTTP del origen (propagar mismo status) y errores de red (HTTP 500)
    - Devolver HTTP 200 + `[]` cuando el CSV no tiene filas de datos
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.3 Escribir tests para `GET /api/emt/lineas` — Properties 5, 7 + edge cases
    - **Property 5: La lista de líneas siempre está ordenada lexicográficamente por codLinea**
    - **Validates: Requirements 1.6**
    - **Property 7: Los errores HTTP del origen se propagan con el mismo status code** (para `/lineas`)
    - **Validates: Requirements 1.4**
    - Crear `src/app/api/emt/lineas/route.test.ts` con MSW para mockear `EMT_LINEAS_URL`
    - Edge cases: CSV vacío (HTTP 200 + `[]`), error de red (HTTP 500)
    - _Requirements: 1.4, 1.5, 1.6, 1.7_

  - [ ] 2.4 Implementar `GET /api/emt/ubicaciones`
    - Crear `src/app/api/emt/ubicaciones/route.ts`
    - Validar parámetro `linea`: presente y no vacío (HTTP 400), solo alfanuméricos y guiones (HTTP 400)
    - Fetch con `cache: 'no-store'`
    - Parsear CSV con `parseUbicacionesCSV` y filtrar por `codLinea === linea`
    - Manejar errores HTTP del origen y errores de red (HTTP 500)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 2.5 Escribir tests para `GET /api/emt/ubicaciones` — Properties 6, 7, 8 + edge cases
    - **Property 6: El filtrado de ubicaciones devuelve solo buses de la línea solicitada**
    - **Validates: Requirements 2.1, 2.6**
    - **Property 7: Los errores HTTP del origen se propagan con el mismo status code** (para `/ubicaciones`)
    - **Validates: Requirements 2.7**
    - **Property 8: El parámetro linea con caracteres inválidos siempre devuelve 400**
    - **Validates: Requirements 2.3**
    - Crear `src/app/api/emt/ubicaciones/route.test.ts` con MSW
    - Edge cases: sin parámetro `linea` (HTTP 400), `linea` vacía (HTTP 400), error de red (HTTP 500), 0 buses coincidentes (HTTP 200 + `[]`)
    - _Requirements: 2.2, 2.3, 2.7, 2.8_

- [ ] 3. Checkpoint — API Routes
  - Asegurarse de que todos los tests de API Routes pasan. Preguntar al usuario si hay dudas antes de continuar.

- [ ] 4. Servicios, store y hooks de cliente
  - [ ] 4.1 Implementar query keys y funciones de fetch puras
    - Crear `src/features/emt/services/emtQueryKeys.ts` con el objeto `emtKeys`
    - Crear `src/features/emt/services/emtApi.ts` con `fetchLineas` y `fetchUbicaciones`
    - Las funciones de fetch lanzan `Error` con mensaje legible si `res.ok === false`
    - _Requirements: 4.1, 5.2, 8.1_

  - [ ]* 4.2 Escribir unit tests para `emtApi.ts`
    - Crear `src/features/emt/services/emtApi.test.ts` con MSW
    - Testear respuesta exitosa y respuesta de error para `fetchLineas` y `fetchUbicaciones`
    - _Requirements: 4.1, 5.2_

  - [ ] 4.3 Implementar el Zustand store (`emtStore.ts`)
    - Crear `src/features/emt/store/emtStore.ts` con `useEMTStore`, `selectLineaSeleccionada` y `selectSetLineaSeleccionada`
    - Usar `devtools` middleware con `name: 'emt-store'`
    - Estado inicial: `lineaSeleccionada: null`
    - _Requirements: 5.1, 5.3, 8.1_

  - [ ]* 4.4 Escribir property test para `emtStore.ts` — Property 11
    - **Property 11: El store refleja siempre la última línea seleccionada**
    - **Validates: Requirements 5.1, 5.3**
    - Crear `src/features/emt/store/emtStore.test.ts`
    - Generar secuencias arbitrarias de selecciones con fast-check y verificar que el estado final es el último valor aplicado

  - [ ] 4.5 Implementar `useLineas`
    - Crear `src/features/emt/hooks/useLineas.ts`
    - `queryKey: emtKeys.lineas()`, `queryFn: fetchLineas`, `staleTime: 55_000`, `retry: 2`, `retryDelay` exponencial con cap en 10 s
    - _Requirements: 4.1, 4.2, 9.4, 9.5_

  - [ ]* 4.6 Escribir tests para `useLineas`
    - Crear `src/features/emt/hooks/useLineas.test.ts` con RTL `renderHook` + MSW
    - Verificar `staleTime`, `retry`, y que `refetch()` re-emite la query
    - _Requirements: 4.1, 9.4, 9.5_

  - [ ] 4.7 Implementar `useUbicaciones`
    - Crear `src/features/emt/hooks/useUbicaciones.ts`
    - `enabled: Boolean(linea)`, `refetchInterval: 60_000`, `staleTime: 55_000`, `refetchOnWindowFocus: true`, `retry: 1`
    - _Requirements: 5.2, 5.4, 7.1, 7.2, 7.4, 7.5_

  - [ ]* 4.8 Escribir tests para `useUbicaciones`
    - Crear `src/features/emt/hooks/useUbicaciones.test.ts` con RTL `renderHook` + MSW
    - Verificar: `enabled: false` cuando `linea` es `null`, `refetchInterval: 60_000`, `staleTime: 55_000`, cambio de query key al cambiar `linea`
    - _Requirements: 5.4, 7.1, 7.2, 7.4_

- [ ] 5. Checkpoint — Servicios y hooks
  - Asegurarse de que todos los tests de servicios, store y hooks pasan. Preguntar al usuario si hay dudas antes de continuar.

- [ ] 6. Componentes compartidos y de feature
  - [ ] 6.1 Implementar componentes compartidos
    - Crear `src/shared/components/LoadingSpinner.tsx` con prop `label?: string` y atributo `role="status"`
    - Crear `src/shared/components/ErrorMessage.tsx` con props `message: string` y `onRetry?: () => void`
    - Usar Tailwind CSS v4 para los estilos
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 6.2 Implementar `BusMarker`
    - Crear `src/features/emt/components/BusMarker.tsx`
    - Usar `AdvancedMarker` de `@vis.gl/react-google-maps`
    - Posicionar en `{ lat: bus.latitud, lng: bus.longitud }`
    - Incluir `title` y `aria-label` accesibles con `codBus` y `codLinea`
    - _Requirements: 6.1, 6.2_

  - [ ] 6.3 Implementar `LineaSelector`
    - Crear `src/features/emt/components/LineaSelector.tsx`
    - Usar `useLineas()` y `useEMTStore` con selectores granulares
    - Mostrar `LoadingSpinner` mientras carga, `ErrorMessage` con retry si falla, empty state si `lineas.length === 0`
    - Usar `startTransition` al llamar a `setLineaSeleccionada`
    - `aria-label="Seleccionar línea de autobús"` en el `<select>`
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 5.1, 5.3, 9.1, 9.2_

  - [ ]* 6.4 Escribir tests para `LineaSelector` — Property 10
    - **Property 10: LineaSelector muestra todas las líneas recibidas como opciones seleccionables**
    - **Validates: Requirements 4.3**
    - Crear `src/features/emt/components/LineaSelector.test.tsx` con RTL + MSW
    - Testear: spinner durante carga, opciones al completar, error + retry, empty state, llamada a `setLineaSeleccionada` al seleccionar
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 5.1_

  - [ ] 6.5 Implementar `MapaEMT`
    - Crear `src/features/emt/components/MapaEMT.tsx`
    - Usar `useEMTStore(selectLineaSeleccionada)` y `useUbicaciones(linea)`
    - Envolver con `APIProvider` de `@vis.gl/react-google-maps` usando `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
    - Centro inicial: `{ lat: 36.7213, lng: -4.4214 }`, zoom 13
    - Mostrar `LoadingSpinner` superpuesto durante refetch sin quitar marcadores existentes
    - Mostrar indicador de staleness (`role="status"`) cuando `isStale && !isLoading && !isError`
    - Mostrar `ErrorMessage` superpuesto sin quitar marcadores existentes
    - _Requirements: 5.4, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 7.3, 7.6, 9.3_

  - [ ]* 6.6 Escribir tests para `MapaEMT` — Property 9
    - **Property 9: MapaEMT renderiza exactamente un BusMarker por bus con la posición correcta**
    - **Validates: Requirements 6.1, 6.2**
    - Crear `src/features/emt/components/MapaEMT.test.tsx` con RTL + MSW
    - Mockear `@vis.gl/react-google-maps` con `vi.mock`
    - Testear: sin marcadores cuando no hay línea seleccionada, N marcadores para N buses, loading overlay sin quitar marcadores, error sin quitar marcadores, empty state con 0 buses, staleness indicator
    - _Requirements: 5.4, 6.1, 6.3, 6.4, 6.7, 7.6_

- [ ] 7. Checkpoint — Componentes
  - Asegurarse de que todos los tests de componentes pasan. Preguntar al usuario si hay dudas antes de continuar.

- [ ] 8. Providers, layout y página principal
  - [ ] 8.1 Implementar `Providers`
    - Crear `src/providers/Providers.tsx` con `QueryClientProvider`
    - Instanciar `QueryClient` fuera del componente (singleton)
    - `defaultOptions.queries.staleTime: 0` (cada query define el suyo)
    - _Requirements: 8.4, 8.5_

  - [ ] 8.2 Implementar el barrel export de la feature EMT
    - Crear `src/features/emt/index.ts` exportando `LineaSelector`, `MapaEMT`, `BusMarker`, `useLineas`, `useUbicaciones`, `useEMTStore`, `selectLineaSeleccionada`, `selectSetLineaSeleccionada`
    - _Requirements: 8.2_

  - [ ] 8.3 Implementar `layout.tsx` y `globals.css`
    - Crear `src/app/layout.tsx` envolviendo `{children}` con `<Providers>`
    - Crear `src/app/globals.css` con las directivas de Tailwind CSS v4
    - _Requirements: 8.4, 8.5_

  - [ ] 8.4 Implementar `page.tsx`
    - Crear `src/app/page.tsx` con `'use client'`
    - Cargar `MapaEMT` con `next/dynamic` + `ssr: false` y skeleton de carga
    - Montar `LineaSelector` en el header y `MapaEMT` en el área principal
    - Layout `flex h-screen flex-col`
    - _Requirements: 4.1, 6.5, 8.4, 8.5_

- [ ] 9. Checkpoint final — Integración completa
  - Asegurarse de que todos los tests pasan (`vitest --run`). Verificar que no hay errores de TypeScript (`tsc --noEmit`). Preguntar al usuario si hay dudas antes de dar la implementación por terminada.

---

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos que implementa para trazabilidad
- Los checkpoints garantizan validación incremental antes de avanzar a la siguiente capa
- Los tests PBT usan fast-check con `numRuns: 200` mínimo por propiedad
- Los tests de componentes mockean `@vis.gl/react-google-maps` con `vi.mock` para evitar dependencia del SDK de Google Maps en el entorno de test
- `MapaEMT` se carga con `next/dynamic + ssr: false` — no incluir en tests de SSR
- Todos los componentes llevan `'use client'` (sin RSC en este proyecto)
- Las importaciones externas a `src/features/emt/` deben pasar siempre por `src/features/emt/index.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "1.5", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.4"] },
    { "id": 4, "tasks": ["2.3", "2.5", "4.1", "4.3"] },
    { "id": 5, "tasks": ["4.2", "4.4", "4.5", "4.7"] },
    { "id": 6, "tasks": ["4.6", "4.8", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4", "6.5"] },
    { "id": 9, "tasks": ["6.6", "8.1", "8.2"] },
    { "id": 10, "tasks": ["8.3"] },
    { "id": 11, "tasks": ["8.4"] }
  ]
}
```
