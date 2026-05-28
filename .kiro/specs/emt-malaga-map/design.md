# Design Document — EMT Málaga Map

## Overview

EMT Málaga Map es una aplicación Next.js 15 que muestra en tiempo real la posición de los autobuses de la EMT de Málaga sobre un mapa de Google Maps. El usuario selecciona una línea para filtrar los buses visibles; las posiciones se actualizan automáticamente cada 60 segundos mediante polling.

### Decisiones de diseño clave

- **Sin RSC**: toda la UI es `'use client'`. La única lógica server-side vive en API Routes.
- **Proxy obligatorio**: el cliente nunca llama directamente a `datosabiertos.malaga.eu` (CORS). Las API Routes actúan de intermediario.
- **Separación de capas**: CSV parsing en `src/shared/utils/`, estado global en Zustand, estado servidor en TanStack Query, UI en componentes de feature.
- **CSV real**: los ficheros del Ayuntamiento usan comas como delimitador y comillas dobles como quoting (formato RFC 4180 estándar). El campo `codLinea` en ubicaciones llega como float-string (`"1.0"`); se normaliza a string entero (`"1"`) durante el parseo.

---

## Architecture

### Diagrama de componentes y flujo de datos

```mermaid
graph TD
    subgraph Browser["Navegador (cliente)"]
        Page["page.tsx"]
        LS["LineaSelector"]
        MapaEMT["MapaEMT (dynamic, ssr:false)"]
        BM["BusMarker ×N"]
        Store["EMTStore (Zustand)"]
        TQ["TanStack Query Cache"]
        HookL["useLineas()"]
        HookU["useUbicaciones(linea)"]
    end

    subgraph Server["Next.js Server (API Routes)"]
        RouteL["GET /api/emt/lineas"]
        RouteU["GET /api/emt/ubicaciones?linea=X"]
        Parser["CSV_Parser (shared/utils)"]
    end

    subgraph External["Origen externo"]
        EMT_L["lineasyparadas.csv (revalidate:3600)"]
        EMT_U["lineasyubicaciones.csv (no-store)"]
    end

    Page --> LS
    Page --> MapaEMT
    MapaEMT --> BM
    LS --> Store
    Store --> HookU
    HookL --> TQ
    HookU --> TQ
    TQ --> LS
    TQ --> MapaEMT
    HookL -->|fetch /api/emt/lineas| RouteL
    HookU -->|fetch /api/emt/ubicaciones?linea=X| RouteU
    RouteL -->|fetch + revalidate:3600| EMT_L
    RouteU -->|fetch + no-store| EMT_U
    EMT_L -->|CSV text| RouteL
    EMT_U -->|CSV text| RouteU
    RouteL --> Parser
    RouteU --> Parser
    Parser -->|LineaEMT[]| RouteL
    Parser -->|BusUbicacion[]| RouteU
```

### Flujo de datos principal

1. `page.tsx` monta `LineaSelector` y `MapaEMT` (cargado con `next/dynamic`).
2. `LineaSelector` llama a `useLineas()` → TanStack Query → `GET /api/emt/lineas` → CSV_Parser → `LineaEMT[]`.
3. El usuario selecciona una línea → `LineaSelector` llama a `setLineaSeleccionada(codLinea)` en `EMTStore`.
4. `MapaEMT` lee `lineaSeleccionada` del store y llama a `useUbicaciones(linea)` → TanStack Query → `GET /api/emt/ubicaciones?linea=X` → CSV_Parser → `BusUbicacion[]`.
5. TanStack Query hace polling cada 60 s; `MapaEMT` re-renderiza los `BusMarker` con las nuevas posiciones.

---

## Components and Interfaces

### Estructura de ficheros completa

```
src/
├── app/
│   ├── api/
│   │   └── emt/
│   │       ├── lineas/
│   │       │   └── route.ts          # GET /api/emt/lineas
│   │       └── ubicaciones/
│   │           └── route.ts          # GET /api/emt/ubicaciones?linea=X
│   ├── layout.tsx                    # Root layout — Providers globales
│   ├── page.tsx                      # Página principal
│   └── globals.css
├── features/
│   └── emt/
│       ├── components/
│       │   ├── LineaSelector.tsx     # Selector de línea (combobox)
│       │   ├── MapaEMT.tsx           # Mapa Google Maps con marcadores
│       │   └── BusMarker.tsx         # Marcador individual de bus
│       ├── hooks/
│       │   ├── useLineas.ts          # TanStack Query — lista de líneas
│       │   └── useUbicaciones.ts     # TanStack Query — posiciones con polling
│       ├── services/
│       │   ├── emtApi.ts             # Funciones fetch puras
│       │   └── emtQueryKeys.ts       # Query keys centralizadas
│       ├── store/
│       │   └── emtStore.ts           # Zustand slice EMT
│       ├── types/
│       │   └── emt.types.ts          # BusUbicacion, LineaEMT, etc.
│       └── index.ts                  # Barrel export público
├── shared/
│   ├── components/
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorMessage.tsx
│   └── utils/
│       └── csvParser.ts              # parseUbicacionesCSV, parseLineasCSV
└── providers/
    └── Providers.tsx                 # QueryClientProvider + GoogleMapsProvider
```

### Interfaces de componentes

```tsx
// LineaSelector
interface LineaSelectorProps {
  lineas: LineaEMT[]
  lineaSeleccionada: string | null
  isLoading: boolean
  error: Error | null
  onSelect: (codLinea: string) => void
  onRetry: () => void
}

// MapaEMT (componente interno, cargado con next/dynamic)
interface MapaEMTProps {
  buses: BusUbicacion[]
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
  isStale: boolean
}

// BusMarker
interface BusMarkerProps {
  bus: BusUbicacion
}
```

---

## Data Models

### Tipos TypeScript principales

```typescript
// src/features/emt/types/emt.types.ts

/** Posición GPS de un bus en servicio activo */
export interface BusUbicacion {
  codBus: string        // Identificador del vehículo
  codLinea: string      // Código de línea normalizado (ej: "1", no "1.0")
  sentido: number       // 1 = ida, 2 = vuelta
  longitud: number      // Coordenada X — rango [-180, 180]
  latitud: number       // Coordenada Y — rango [-90, 90]
  codParIni: string     // Código de parada de inicio de tramo
  lastUpdate: string    // Timestamp ISO de última actualización
}

/** Línea de autobús de la EMT */
export interface LineaEMT {
  codLinea: string      // Código único de línea (ej: "1")
  nombreLinea: string   // Nombre descriptivo (ej: "Parque del Sur - Alameda Principal")
}

/** Respuesta de error de las API Routes */
export interface ApiError {
  error: string
}
```

### Normalización de `codLinea`

El CSV de ubicaciones publica `codLinea` como float-string (`"1.0"`, `"10.0"`). El CSV de paradas lo publica como `codLineaStr` (`"1"`, `"10"`). Para garantizar que el filtrado `codLinea === linea` funcione correctamente, el parser de ubicaciones normaliza el valor:

```typescript
// "1.0" → "1", "10.0" → "10", "C1.0" → "C1"
function normalizeCodLinea(raw: string): string {
  const trimmed = raw.trim()
  // Si termina en ".0", eliminar el sufijo decimal
  return trimmed.replace(/\.0$/, '')
}
```

---

## API Routes Design

### Constantes compartidas

```typescript
// src/app/api/emt/constants.ts
export const EMT_UBICACIONES_URL =
  'https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTlineasUbicaciones/lineasyubicaciones.csv'

export const EMT_LINEAS_URL =
  'https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTLineasYParadas/lineasyparadas.csv'

/** Regex para validar el parámetro linea: solo alfanuméricos y guiones */
export const LINEA_PARAM_REGEX = /^[a-zA-Z0-9-]+$/
```

### GET /api/emt/lineas

```typescript
// src/app/api/emt/lineas/route.ts
export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(EMT_LINEAS_URL, { next: { revalidate: 3600 } })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al obtener líneas del origen: ${res.statusText}` },
        { status: res.status }
      )
    }

    const csv = await res.text()
    const lineas = parseLineasCSV(csv)

    // Ordenar por codLinea en orden lexicográfico ascendente
    lineas.sort((a, b) => a.codLinea.localeCompare(b.codLinea))

    return NextResponse.json(lineas)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al procesar líneas: ${message}` },
      { status: 500 }
    )
  }
}
```

**Decisión de diseño**: la ordenación se aplica en la API Route (no en el parser) para mantener el parser como función pura sin efectos secundarios de ordenación.

### GET /api/emt/ubicaciones?linea={codLinea}

```typescript
// src/app/api/emt/ubicaciones/route.ts
export async function GET(request: NextRequest): Promise<NextResponse> {
  const linea = request.nextUrl.searchParams.get('linea')

  // Validación 1: parámetro presente y no vacío
  if (!linea || linea.trim() === '') {
    return NextResponse.json(
      { error: 'El parámetro "linea" es obligatorio y no puede estar vacío' },
      { status: 400 }
    )
  }

  // Validación 2: solo caracteres alfanuméricos y guiones
  if (!LINEA_PARAM_REGEX.test(linea)) {
    return NextResponse.json(
      { error: 'El parámetro "linea" solo puede contener caracteres alfanuméricos y guiones' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(EMT_UBICACIONES_URL, { cache: 'no-store' })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al obtener ubicaciones del origen: ${res.statusText}` },
        { status: res.status }
      )
    }

    const csv = await res.text()
    const buses = parseUbicacionesCSV(csv)

    // Filtrar por línea exacta (codLinea ya normalizado por el parser)
    const filtrados = buses.filter(b => b.codLinea === linea)

    return NextResponse.json(filtrados)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al procesar ubicaciones: ${message}` },
      { status: 500 }
    )
  }
}
```

---

## CSV Parser Design

### Formato real de los CSV (observado en producción)

**lineasyubicaciones.csv** — delimitado por comas, con comillas dobles (RFC 4180):
```
"codBus","codLinea","sentido","lon","lat","codParIni","last_update"
"581","1.0","2","-4.456579","36.697693","1253","2026-05-25 19:45:06"
```

**lineasyparadas.csv** — delimitado por comas, con comillas dobles (RFC 4180):
```
"codLinea","codLineaStr","codLineaStrSin","userCodLinea","nombreLinea","observaciones",
"cabeceraIda","cabeceraVuelta","avisoSinHorarioEs","avisoSinHorarioEn","tagsAccesibilidad",
"linea","sentido","orden","espera","fechaInicioDemanda","fechaFinDemanda",
"codParada","nombreParada","direccion","lon","lat","lineas"
"1.0","1","1","1","Parque del Sur - Alameda Principal - San Andrés",...
```

**Nota importante**: el requirements.md describe los CSV como "semicolon-delimited", pero los datos reales usan comas. El parser implementará detección automática del delimitador (coma vs punto y coma) para ser robusto ante cambios del origen.

### Implementación del CSV Parser

```typescript
// src/shared/utils/csvParser.ts

/** Detecta el delimitador del CSV analizando la primera línea */
function detectDelimiter(header: string): ',' | ';' {
  const commaCount = (header.match(/,/g) ?? []).length
  const semicolonCount = (header.match(/;/g) ?? []).length
  return semicolonCount > commaCount ? ';' : ','
}

/** Parsea una línea CSV respetando comillas dobles (RFC 4180 simplificado) */
function parseCSVLine(line: string, delimiter: ',' | ';'): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

/** Parsea el CSV de ubicaciones y devuelve BusUbicacion[] */
export function parseUbicacionesCSV(csv: string): BusUbicacion[] {
  const lines = csv.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim())

  const idx = {
    codBus: headers.indexOf('codBus'),
    codLinea: headers.indexOf('codLinea'),
    sentido: headers.indexOf('sentido'),
    lon: headers.indexOf('lon'),
    lat: headers.indexOf('lat'),
    codParIni: headers.indexOf('codParIni'),
    lastUpdate: headers.indexOf('last_update'),
  }

  const result: BusUbicacion[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)

    // Validar número de columnas
    if (fields.length !== headers.length) continue

    const codBus = fields[idx.codBus]?.trim() ?? ''
    const codLineaRaw = fields[idx.codLinea]?.trim() ?? ''
    const codLinea = normalizeCodLinea(codLineaRaw)
    const sentidoRaw = fields[idx.sentido]?.trim() ?? ''
    const lonRaw = fields[idx.lon]?.trim() ?? ''
    const latRaw = fields[idx.lat]?.trim() ?? ''
    const codParIni = fields[idx.codParIni]?.trim() ?? ''
    const lastUpdate = fields[idx.lastUpdate]?.trim() ?? ''

    // Validar campos requeridos no vacíos
    if (!codBus || !codLinea) continue

    const longitud = parseFloat(lonRaw)
    const latitud = parseFloat(latRaw)
    const sentido = parseInt(sentidoRaw, 10)

    // Validar rangos geográficos y que sean números finitos
    if (!isFinite(latitud) || latitud < -90 || latitud > 90) continue
    if (!isFinite(longitud) || longitud < -180 || longitud > 180) continue
    if (!isFinite(sentido)) continue

    result.push({ codBus, codLinea, sentido, longitud, latitud, codParIni, lastUpdate })
  }

  return result
}

/** Parsea el CSV de líneas y devuelve LineaEMT[] deduplicadas por codLinea */
export function parseLineasCSV(csv: string): LineaEMT[] {
  const lines = csv.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim())

  // El CSV de paradas tiene una fila por parada; cada línea aparece N veces.
  // Usamos codLineaStr (código entero) y nombreLinea para deduplicar.
  const idx = {
    codLineaStr: headers.indexOf('codLineaStr'),
    nombreLinea: headers.indexOf('nombreLinea'),
  }

  // Fallback: si no existe codLineaStr, usar codLinea y normalizar
  const useCodeStr = idx.codLineaStr !== -1
  if (!useCodeStr) {
    idx.codLineaStr = headers.indexOf('codLinea')
  }

  const seen = new Set<string>()
  const result: LineaEMT[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)
    if (fields.length !== headers.length) continue

    const codLineaRaw = fields[idx.codLineaStr]?.trim() ?? ''
    const codLinea = useCodeStr ? codLineaRaw : normalizeCodLinea(codLineaRaw)
    const nombreLinea = fields[idx.nombreLinea]?.trim() ?? ''

    if (!codLinea || !nombreLinea) continue
    if (seen.has(codLinea)) continue

    seen.add(codLinea)
    result.push({ codLinea, nombreLinea })
  }

  return result
}
```

---

## Zustand Store Design

```typescript
// src/features/emt/store/emtStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface EMTState {
  /** Código de la línea seleccionada por el usuario, o null si no hay selección */
  lineaSeleccionada: string | null
}

interface EMTActions {
  setLineaSeleccionada: (linea: string | null) => void
}

type EMTStoreType = EMTState & EMTActions

export const useEMTStore = create<EMTStoreType>()(
  devtools(
    (set) => ({
      lineaSeleccionada: null,
      setLineaSeleccionada: (linea) => set({ lineaSeleccionada: linea }),
    }),
    { name: 'emt-store' }
  )
)

// Selectores granulares — usar siempre estos, nunca desestructurar el store
export const selectLineaSeleccionada = (s: EMTStoreType): string | null =>
  s.lineaSeleccionada

export const selectSetLineaSeleccionada = (s: EMTStoreType): EMTActions['setLineaSeleccionada'] =>
  s.setLineaSeleccionada
```

**Decisión de diseño**: el store solo contiene `lineaSeleccionada`. Los datos de líneas y buses viven en el caché de TanStack Query, no en Zustand. Esto evita duplicación de estado y mantiene el store mínimo.

---

## TanStack Query Hooks Design

### Query Keys

```typescript
// src/features/emt/services/emtQueryKeys.ts
export const emtKeys = {
  all: ['emt'] as const,
  lineas: () => ['emt', 'lineas'] as const,
  ubicaciones: (linea: string) => ['emt', 'ubicaciones', linea] as const,
} as const
```

### Funciones de fetch puras

```typescript
// src/features/emt/services/emtApi.ts

export async function fetchLineas(): Promise<LineaEMT[]> {
  const res = await fetch('/api/emt/lineas')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status} al obtener líneas`)
  }
  return res.json()
}

export async function fetchUbicaciones(linea: string): Promise<BusUbicacion[]> {
  const res = await fetch(`/api/emt/ubicaciones?linea=${encodeURIComponent(linea)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status} al obtener ubicaciones`)
  }
  return res.json()
}
```

### useLineas

```typescript
// src/features/emt/hooks/useLineas.ts
export function useLineas() {
  return useQuery({
    queryKey: emtKeys.lineas(),
    queryFn: fetchLineas,
    staleTime: 55_000,        // Datos estáticos — revalidate:3600 en servidor
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  })
}
```

### useUbicaciones

```typescript
// src/features/emt/hooks/useUbicaciones.ts
export function useUbicaciones(linea: string | null) {
  return useQuery({
    queryKey: emtKeys.ubicaciones(linea ?? ''),
    queryFn: () => fetchUbicaciones(linea!),
    enabled: Boolean(linea),
    refetchInterval: 60_000,   // Polling cada 60 s (Req. 7.1)
    staleTime: 55_000,         // No refetch si datos < 55 s (Req. 7.2)
    refetchOnWindowFocus: true, // Refetch inmediato al volver al tab (Req. 7.5)
    retry: 1,
  })
}
```

**Decisión de diseño**: cuando `linea` es `null`, `enabled: false` desactiva la query. Al cambiar `linea`, TanStack Query crea una nueva entrada en caché con la nueva query key, dejando de hacer polling de la anterior automáticamente (Req. 7.4).

**Staleness indicator**: `useUbicaciones` expone `isStale` (derivado de `dataUpdatedAt` y `staleTime`) y `isError` para que `MapaEMT` muestre el indicador de datos desactualizados (Req. 7.6).

---

## Components Design

### page.tsx

```tsx
// src/app/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { LineaSelector } from '@/features/emt'
import { MapSkeleton } from '@/shared/components/MapSkeleton'

// Google Maps no funciona en servidor — carga diferida con skeleton
const MapaEMT = dynamic(
  () => import('@/features/emt').then(m => m.MapaEMT),
  { loading: () => <MapSkeleton />, ssr: false }
)

export default function HomePage() {
  return (
    <main className="flex h-screen flex-col">
      <header className="p-4 border-b">
        <LineaSelector />
      </header>
      <div className="flex-1">
        <MapaEMT />
      </div>
    </main>
  )
}
```

### LineaSelector

```tsx
// src/features/emt/components/LineaSelector.tsx
'use client'

// Lee líneas de TanStack Query y lineaSeleccionada del store.
// Responsabilidades: mostrar loading/error/opciones, llamar a setLineaSeleccionada.

export function LineaSelector() {
  const { data: lineas, isLoading, error, refetch } = useLineas()
  const lineaSeleccionada = useEMTStore(selectLineaSeleccionada)
  const setLinea = useEMTStore(selectSetLineaSeleccionada)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    startTransition(() => {
      setLinea(value || null)
    })
  }

  if (isLoading) return <LoadingSpinner label="Cargando líneas..." />

  if (error) {
    return (
      <ErrorMessage
        message={formatErrorMessage(error)}
        onRetry={() => refetch()}
      />
    )
  }

  if (!lineas || lineas.length === 0) {
    return <p role="status">No hay líneas disponibles</p>
  }

  return (
    <select
      aria-label="Seleccionar línea de autobús"
      value={lineaSeleccionada ?? ''}
      onChange={handleChange}
    >
      <option value="">-- Selecciona una línea --</option>
      {lineas.map(l => (
        <option key={l.codLinea} value={l.codLinea}>
          {l.codLinea} — {l.nombreLinea}
        </option>
      ))}
    </select>
  )
}
```

### MapaEMT

```tsx
// src/features/emt/components/MapaEMT.tsx
'use client'

// Cargado con next/dynamic + ssr:false desde page.tsx.
// Lee lineaSeleccionada del store y buses de useUbicaciones.

const MALAGA_CENTER = { lat: 36.7213, lng: -4.4214 }
const INITIAL_ZOOM = 13

export function MapaEMT() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const { data: buses = [], isLoading, isError, error, isStale } = useUbicaciones(linea)

  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={MALAGA_CENTER}
          defaultZoom={INITIAL_ZOOM}
          mapId="emt-malaga-map"
        >
          {buses.map(bus => (
            <BusMarker key={bus.codBus} bus={bus} />
          ))}
        </Map>
      </APIProvider>

      {isLoading && (
        <div className="absolute top-2 right-2">
          <LoadingSpinner label="Actualizando posiciones..." />
        </div>
      )}

      {isStale && !isLoading && !isError && (
        <div role="status" className="absolute top-2 right-2 text-sm text-amber-600">
          Datos desactualizados
        </div>
      )}

      {isError && (
        <div className="absolute top-2 right-2">
          <ErrorMessage message={formatErrorMessage(error)} />
        </div>
      )}
    </div>
  )
}
```

### BusMarker

```tsx
// src/features/emt/components/BusMarker.tsx
'use client'

import { AdvancedMarker } from '@vis.gl/react-google-maps'

export function BusMarker({ bus }: BusMarkerProps) {
  return (
    <AdvancedMarker
      position={{ lat: bus.latitud, lng: bus.longitud }}
      title={`Bus ${bus.codBus} — Línea ${bus.codLinea}`}
    >
      {/* Icono SVG de bus */}
      <div
        role="img"
        aria-label={`Bus ${bus.codBus} línea ${bus.codLinea}`}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold"
      >
        🚌
      </div>
    </AdvancedMarker>
  )
}
```

### Utilidad de formateo de errores

```typescript
// src/shared/utils/formatErrorMessage.ts

/** Convierte cualquier error en un mensaje legible para el usuario.
 *  Nunca expone status codes, stack traces ni objetos internos. */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Los errores de fetchLineas/fetchUbicaciones ya tienen mensajes legibles
    return error.message
  }
  return 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'
}
```

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe ser verdadero en todas las ejecuciones válidas del sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquinas.*

### Reflexión sobre redundancias

Antes de listar las propiedades finales, se identifican y eliminan redundancias del prework:

- **3.1 y 3.2** (parser produce objetos con campos requeridos) son casos específicos de **3.3** (parser solo devuelve filas válidas). Sin embargo, 3.1 y 3.2 verifican la *forma* del output mientras 3.3 verifica la *robustez* ante entradas inválidas. Se mantienen separadas.
- **2.5 y 3.1** son equivalentes (ambas verifican que el parser de ubicaciones produce `BusUbicacion` con los campos correctos). Se consolidan en una sola propiedad.
- **1.3 y 3.2** son equivalentes (ambas verifican que el parser de líneas produce `LineaEMT` con los campos correctos). Se consolidan.
- **2.1 y 2.6** (filtrado por línea) se consolidan: si el filtrado es correcto, todos los buses devueltos tienen el `codLinea` correcto.
- **1.4 y 2.7** (propagación de errores HTTP) son idénticas en estructura. Se consolidan en una propiedad parametrizada.
- **6.1 y 6.2** (número de marcadores y posición) se consolidan: si hay un marcador por bus y cada marcador está en la posición correcta, ambas propiedades quedan cubiertas.

### Property 1: El parser de ubicaciones produce objetos con forma y rangos válidos

*Para cualquier* CSV de ubicaciones con N filas de datos válidas, `parseUbicacionesCSV` debe devolver exactamente N objetos `BusUbicacion`, cada uno con `codLinea` no vacío, `latitud` en `[-90, 90]` y `longitud` en `[-180, 180]`.

**Validates: Requirements 2.5, 3.1**

### Property 2: El parser de líneas produce objetos con forma válida y sin duplicados

*Para cualquier* CSV de líneas con M filas de datos válidas (potencialmente con líneas repetidas), `parseLineasCSV` debe devolver un array de `LineaEMT` donde cada objeto tiene `codLinea` y `nombreLinea` no vacíos, y no hay dos objetos con el mismo `codLinea`.

**Validates: Requirements 1.3, 3.2**

### Property 3: El parser descarta filas inválidas y preserva las válidas

*Para cualquier* CSV que contenga una mezcla de filas válidas e inválidas (columnas incorrectas, valores numéricos no finitos, campos requeridos vacíos, coordenadas fuera de rango), el parser debe devolver exactamente las filas válidas y descartar las inválidas, sin lanzar excepciones.

**Validates: Requirements 3.3, 3.5, 3.6**

### Property 4: El parser recorta espacios en blanco de todos los campos string

*Para cualquier* CSV donde los campos string tengan espacios en blanco al inicio o al final, el parser debe devolver objetos donde todos los campos string estén recortados (`trim()`), y el resultado debe ser idéntico al de parsear el mismo CSV sin esos espacios.

**Validates: Requirements 3.4**

### Property 5: La lista de líneas siempre está ordenada lexicográficamente por codLinea

*Para cualquier* CSV de líneas válido (independientemente del orden de las filas en el CSV), la API Route `GET /api/emt/lineas` debe devolver un array donde `codLinea[i] <= codLinea[i+1]` para todo `i`.

**Validates: Requirements 1.6**

### Property 6: El filtrado de ubicaciones devuelve solo buses de la línea solicitada

*Para cualquier* conjunto de buses con `codLinea` variados y cualquier código de línea válido `L`, la API Route `GET /api/emt/ubicaciones?linea=L` debe devolver únicamente buses cuyo `codLinea === L`; si ningún bus coincide, devuelve un array vacío.

**Validates: Requirements 2.1, 2.6**

### Property 7: Los errores HTTP del origen se propagan con el mismo status code

*Para cualquier* código de estado HTTP no-2xx `S` devuelto por `EMT_Origin`, las API Routes deben devolver una respuesta con exactamente el mismo status code `S` y un campo `error` con una cadena no vacía.

**Validates: Requirements 1.4, 2.7**

### Property 8: El parámetro linea con caracteres inválidos siempre devuelve 400

*Para cualquier* string que contenga al menos un carácter que no sea alfanumérico ni guión, la API Route `GET /api/emt/ubicaciones?linea={string}` debe devolver HTTP 400 con un campo `error` no vacío.

**Validates: Requirements 2.3**

### Property 9: MapaEMT renderiza exactamente un BusMarker por bus con la posición correcta

*Para cualquier* array de `BusUbicacion` con coordenadas válidas, `MapaEMT` debe renderizar exactamente `buses.length` marcadores, y cada marcador debe estar posicionado en `{ lat: bus.latitud, lng: bus.longitud }` del bus correspondiente.

**Validates: Requirements 6.1, 6.2**

### Property 10: LineaSelector muestra todas las líneas recibidas como opciones seleccionables

*Para cualquier* array de `LineaEMT` no vacío, `LineaSelector` debe renderizar exactamente `lineas.length` opciones, cada una mostrando el `codLinea` y `nombreLinea` de la línea correspondiente.

**Validates: Requirements 4.3**

### Property 11: El store refleja siempre la última línea seleccionada

*Para cualquier* secuencia de selecciones de línea, `EMTStore.lineaSeleccionada` debe ser igual al `codLinea` de la última selección realizada.

**Validates: Requirements 5.1, 5.3**

### Property 12: Los mensajes de error son siempre cadenas legibles sin datos técnicos internos

*Para cualquier* error (instancia de `Error`, objeto arbitrario, o `null`), `formatErrorMessage` debe devolver una cadena no vacía que no contenga stack traces, códigos de estado HTTP crudos (ej: `"404"`, `"500"`), ni representaciones JSON de objetos de error.

**Validates: Requirements 9.6**

---

## Error Handling

### Estrategia de errores por capa

| Capa | Tipo de error | Respuesta |
|---|---|---|
| API Route — origen no-2xx | `res.ok === false` | Propagar mismo status + `{ error: string }` |
| API Route — red/timeout | `fetch` lanza excepción | HTTP 500 + `{ error: string }` |
| API Route — parámetro inválido | Validación manual | HTTP 400 + `{ error: string }` |
| TanStack Query — fetch falla | `Error` lanzado en `queryFn` | `isError: true`, `error: Error` en el hook |
| Componente — error de render | React Error Boundary | Fallback UI (no implementado en v1) |

### Reglas de mensajes de error

1. **Nunca exponer al usuario**: status codes HTTP crudos, stack traces, nombres de variables internas, URLs del origen externo.
2. **Siempre incluir**: descripción legible de qué falló y, cuando aplique, sugerencia de acción (reintentar).
3. **Formato**: `formatErrorMessage(error: unknown): string` — función pura en `src/shared/utils/`.

### Comportamiento ante errores de polling (Req. 7.6)

Cuando un refetch en background falla, TanStack Query mantiene `data` con el último valor exitoso y pone `isError: true`. `MapaEMT` usa esta combinación para:
- Mantener los `BusMarker` existentes (usando `data` previo).
- Mostrar un indicador de error superpuesto sin ocultar el mapa.

```typescript
// Patrón en MapaEMT
const { data: buses = [], isError, error, isStale } = useUbicaciones(linea)
// buses siempre tiene el último valor exitoso gracias al caché de TanStack Query
```

---

## Testing Strategy

### Herramientas

- **Vitest** — runner de tests
- **React Testing Library** — tests de componentes
- **MSW (Mock Service Worker)** — mocks de API HTTP
- **fast-check** — librería de property-based testing para TypeScript/JavaScript

### Distribución de tests por tipo

#### Property-Based Tests (fast-check) — `src/shared/utils/csvParser.test.ts`

Los parsers CSV son funciones puras con un espacio de entrada grande (cualquier string CSV). Son el candidato ideal para PBT.

```typescript
// Ejemplo de estructura de test PBT
import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { parseUbicacionesCSV, parseLineasCSV } from './csvParser'

// Feature: emt-malaga-map, Property 1: parser de ubicaciones produce objetos válidos
describe('parseUbicacionesCSV — Property 1', () => {
  it('para cualquier CSV válido, todos los objetos tienen forma y rangos correctos', () => {
    fc.assert(
      fc.property(
        fc.array(validBusUbicacionArbitrary(), { minLength: 1, maxLength: 50 }),
        (buses) => {
          const csv = serializeToCSV(buses, UBICACIONES_HEADERS)
          const result = parseUbicacionesCSV(csv)
          return result.every(b =>
            typeof b.codLinea === 'string' && b.codLinea.length > 0 &&
            b.latitud >= -90 && b.latitud <= 90 &&
            b.longitud >= -180 && b.longitud <= 180
          )
        }
      ),
      { numRuns: 200 }
    )
  })
})
```

**Tests PBT a implementar** (uno por propiedad de corrección):

| Test | Propiedad | Archivo |
|---|---|---|
| Parser ubicaciones — forma y rangos | Property 1 | `csvParser.test.ts` |
| Parser líneas — forma y deduplicación | Property 2 | `csvParser.test.ts` |
| Parser — robustez ante filas inválidas | Property 3 | `csvParser.test.ts` |
| Parser — trim de espacios | Property 4 | `csvParser.test.ts` |
| Ordenación de líneas | Property 5 | `lineas/route.test.ts` |
| Filtrado de ubicaciones | Property 6 | `ubicaciones/route.test.ts` |
| Propagación de errores HTTP | Property 7 | `lineas/route.test.ts`, `ubicaciones/route.test.ts` |
| Validación parámetro linea inválido | Property 8 | `ubicaciones/route.test.ts` |
| formatErrorMessage — sin datos técnicos | Property 12 | `formatErrorMessage.test.ts` |

**Configuración**: mínimo 200 iteraciones por test PBT (`numRuns: 200`).

#### Unit Tests (Vitest) — lógica pura

```
src/shared/utils/csvParser.test.ts       — edge cases: CSV vacío, solo cabecera, BOM
src/shared/utils/formatErrorMessage.test.ts — ejemplos concretos de errores
src/features/emt/store/emtStore.test.ts  — acciones del store
src/features/emt/services/emtApi.test.ts — fetchLineas, fetchUbicaciones con MSW
```

#### Component Tests (RTL + MSW) — comportamiento de UI

```
src/features/emt/components/LineaSelector.test.tsx
  - Muestra spinner mientras carga (Req. 4.2)
  - Muestra opciones cuando carga completa (Req. 4.3) — Property 10
  - Muestra error + retry cuando falla (Req. 4.4, 9.2)
  - Muestra empty state con 0 líneas (Req. 4.6)
  - Llama a setLineaSeleccionada al seleccionar (Req. 5.1) — Property 11

src/features/emt/components/MapaEMT.test.tsx
  - No renderiza BusMarkers sin línea seleccionada (Req. 5.4)
  - Renderiza N BusMarkers para N buses (Req. 6.1) — Property 9
  - Muestra loading overlay sin quitar marcadores (Req. 6.3)
  - Muestra error sin quitar marcadores (Req. 6.4, 9.3)
  - Muestra empty state con 0 buses (Req. 6.7)
  - Muestra staleness indicator tras error de polling (Req. 7.6)
```

#### Hook Tests (RTL renderHook + MSW)

```
src/features/emt/hooks/useLineas.test.ts
  - Configuración: staleTime, retry
  - Retry button re-emite la query (Req. 9.4, 9.5)

src/features/emt/hooks/useUbicaciones.test.ts
  - enabled: false cuando linea es null (Req. 5.4)
  - refetchInterval: 60_000 (Req. 7.1)
  - staleTime: 55_000 (Req. 7.2)
  - Cambia query key al cambiar linea (Req. 7.4)
```

#### Integration / Smoke Tests

```
src/app/api/emt/lineas/route.test.ts
  - Cache: next: { revalidate: 3600 } (Req. 1.2) — SMOKE
  - HTTP 500 ante error de red (Req. 1.5) — EDGE_CASE
  - HTTP 200 + [] con CSV vacío (Req. 1.7) — EDGE_CASE

src/app/api/emt/ubicaciones/route.test.ts
  - Cache: no-store (Req. 2.4) — SMOKE
  - HTTP 400 sin parámetro linea (Req. 2.2) — EDGE_CASE
  - HTTP 400 con linea vacía (Req. 2.2) — EDGE_CASE
  - HTTP 500 ante error de red (Req. 2.8) — EDGE_CASE
```

### Cobertura objetivo

| Módulo | Cobertura mínima |
|---|---|
| `src/shared/utils/csvParser.ts` | 95% (lógica crítica) |
| `src/shared/utils/formatErrorMessage.ts` | 100% |
| `src/features/emt/store/emtStore.ts` | 90% |
| `src/features/emt/services/emtApi.ts` | 85% |
| `src/features/emt/hooks/` | 80% |
| `src/features/emt/components/` | 75% |
| `src/app/api/emt/` | 80% |

---

## Performance Considerations

### Bundle — carga diferida de Google Maps

```tsx
// page.tsx — MapaEMT cargado solo en cliente, con skeleton durante la carga
const MapaEMT = dynamic(
  () => import('@/features/emt').then(m => m.MapaEMT),
  { loading: () => <MapSkeleton />, ssr: false }
)
```

`@vis.gl/react-google-maps` y el SDK de Google Maps son pesados (~200 KB). Con `next/dynamic + ssr: false` se excluyen del bundle inicial y se cargan solo cuando el componente se monta en el cliente.

### Re-renders — selectores granulares de Zustand

```tsx
// ✅ Solo re-renderiza cuando cambia lineaSeleccionada
const linea = useEMTStore(selectLineaSeleccionada)

// ✅ Solo re-renderiza cuando cambia la acción (nunca, es estable)
const setLinea = useEMTStore(selectSetLineaSeleccionada)
```

`MapaEMT` y `LineaSelector` suscriben solo al slice que necesitan. Un cambio en otra parte del store (si se añade en el futuro) no provoca re-renders innecesarios.

### Re-renders — startTransition para selección de línea

```tsx
function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
  const value = e.target.value
  startTransition(() => {
    setLinea(value || null)  // No urgente: puede diferirse
  })
}
```

La actualización del store y el inicio del fetch de ubicaciones son no urgentes. `startTransition` permite que React priorice la actualización del input antes de re-renderizar el mapa.

### Re-renders — BusMarker estable

`BusMarker` recibe un objeto `bus` como prop. Para evitar re-renders innecesarios cuando el array de buses se actualiza con los mismos datos, los buses se identifican por `codBus` en el `key` del map. React reconcilia por key y solo re-monta los marcadores que realmente cambian.

### Async — fetches paralelos en API Routes

Si en el futuro una API Route necesita combinar datos de múltiples endpoints del Ayuntamiento, se usará `Promise.all`:

```typescript
// Patrón para fetches paralelos (si aplica en futuras features)
const [lineasRes, paradasRes] = await Promise.all([
  fetch(EMT_LINEAS_URL, { next: { revalidate: 3600 } }),
  fetch(EMT_PARADAS_URL, { next: { revalidate: 3600 } }),
])
```

### Polling — eficiencia de TanStack Query

- `staleTime: 55_000` evita refetches redundantes si el componente se desmonta y remonta dentro de la ventana de 55 s.
- `refetchOnWindowFocus: true` (default) garantiza un refetch inmediato al volver al tab, cumpliendo Req. 7.5.
- Cuando el usuario cambia de línea, TanStack Query cancela el polling de la línea anterior automáticamente al cambiar la query key.

### Providers — QueryClient singleton

```tsx
// src/providers/Providers.tsx
'use client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,  // Cada query define su propio staleTime
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

El `QueryClient` se crea fuera del componente para garantizar que es un singleton y no se recrea en cada render.
