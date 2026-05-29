---
name: react-best-practices
description: >
  Aplica este skill cuando el usuario pida crear, revisar o refactorizar código React o Next.js.
  Cubre: componentes funcionales, hooks, TypeScript estricto, TanStack Query, Zustand,
  Tailwind CSS, testing con Vitest + RTL, performance (re-renders, bundle, async),
  API Routes como proxy, y arquitectura por features.
  NO usar para proyectos Angular, Vue u otros frameworks.
  IMPORTANTE: las reglas marcadas [RSC] son exclusivas de React Server Components
  y NO aplican a este proyecto (Next.js client-side + API Routes, sin RSC).
---

# React Best Practices Skill

Este skill guía la generación y revisión de código React/Next.js siguiendo los estándares
del proyecto. Antes de generar cualquier código, lee las instrucciones del `CLAUDE.md`
del proyecto si existe.

Incorpora reglas de performance de Vercel Engineering (vercel-labs/agent-skills),
filtradas y adaptadas al stack del proyecto (Next.js client-side + API Routes, sin RSC).

---

## 1. Contexto y análisis previo

Antes de escribir código, determina:

1. **¿Es un componente nuevo, un hook, un servicio, o un refactor?**
2. **¿A qué feature pertenece?** → Sitúalo en `src/features/[feature]/`
3. **¿Es código compartido/genérico?** → Va en `src/shared/`
4. **¿Qué tipos necesita?** → Defínelos antes de implementar
5. **¿Necesita tests?** → Si tiene lógica, sí
6. **¿Es una API Route (proxy)?** → Sigue las reglas de la sección 10

---

## 2. Generar un componente React

### Patrón base

```tsx
// src/features/[feature]/components/ComponentName.tsx

import { useState } from 'react'
import { clsx } from 'clsx'
// imports internos...

// --- Tipos ---
interface ComponentNameProps {
  /** Descripción de la prop si no es obvia */
  propName: string
  onAction?: (value: string) => void
}

// --- Constantes locales (fuera del componente, nunca dentro) ---
const DEFAULT_VALUE = 'default'

// --- Componente ---
export function ComponentName({ propName, onAction }: ComponentNameProps) {
  const [localState, setLocalState] = useState(false)

  function handleClick() {
    onAction?.(propName)
  }

  return (
    <div className={clsx('base-classes', { 'conditional-class': localState })}>
      {/* JSX limpio, sin lógica inline compleja */}
    </div>
  )
}
```

### Reglas de componentes

- **Sin `React.FC<>`** — tipado directo en parámetros
- **Funciones nombradas**, no arrow functions para el componente principal (mejor stack traces)
- **Handlers nombrados** (`handleClick`, `handleSubmit`) en lugar de inline arrows en JSX
- **Early returns** para estados vacíos/error en lugar de ternarios anidados
- **Fragmentos** (`<>`) en lugar de `<div>` contenedor innecesario
- **No definir componentes dentro de componentes** — provoca re-montajes en cada render

```tsx
// ✅ Early return para loading/error
export function BusCard({ busId }: BusCardProps) {
  const { bus, isLoading, error } = useBus(busId)

  if (isLoading) return <Skeleton />
  if (error) return <ErrorMessage error={error} />
  if (!bus) return null

  return <div>...</div>
}

// ❌ Componente definido dentro de otro — BusItem se re-monta en cada render
export function BusList({ buses }: BusListProps) {
  function BusItem({ bus }: { bus: Bus }) { // NUNCA
    return <div>{bus.linea}</div>
  }
  return buses.map(b => <BusItem key={b.id} bus={b} />)
}
```

---

## 3. Generar un Custom Hook

```tsx
// src/features/[feature]/hooks/useHookName.ts

import { useState, useCallback } from 'react'

interface UseHookNameOptions {
  initialValue?: string
}

interface UseHookNameReturn {
  value: string
  setValue: (value: string) => void
  reset: () => void
}

export function useHookName({ initialValue = '' }: UseHookNameOptions = {}): UseHookNameReturn {
  const [value, setValue] = useState(initialValue)

  const reset = useCallback(() => {
    setValue(initialValue)
  }, [initialValue])

  return { value, setValue, reset }
}
```

**Reglas de hooks:**
- Prefijo `use` obligatorio
- Retorna objeto nombrado (salvo pares `[value, setter]`)
- `useCallback` para funciones que van a props de hijos
- `useMemo` solo cuando el cálculo sea costoso y medible — no por defecto
- Nunca llames a hooks condicionalmente
- **Lógica de interacción en event handlers, no en efectos**

```tsx
// ✅ Lógica en el handler
function handleSelectLinea(linea: string) {
  setLineaSeleccionada(linea)
  analytics.track('linea_selected', { linea }) // aquí, no en un efecto
}

// ❌ Efecto innecesario para lógica de interacción
useEffect(() => {
  if (lineaSeleccionada) analytics.track('linea_selected', { linea: lineaSeleccionada })
}, [lineaSeleccionada])
```

---

## 4. Re-renders: optimización (Vercel rules: rerender-*)

### No suscribirse a estado que solo se usa en callbacks

```tsx
// ✅ El componente no re-renderiza cuando cambia lineaSeleccionada
function MapControls() {
  const setLinea = useEMTStore(state => state.setLinea) // solo la acción
}

// ❌ Re-render innecesario cada vez que cambia lineaSeleccionada
function MapControls() {
  const { lineaSeleccionada, setLinea } = useEMTStore() // suscribe a todo
}
```

### Derivar estado en render, nunca con useEffect + useState

```tsx
// ✅ Derivado directamente en render
function BusList({ buses, lineaFiltro }: BusListProps) {
  const busesFiltrados = buses.filter(b => b.linea === lineaFiltro)
  return busesFiltrados.map(b => <BusMarker key={b.id} bus={b} />)
}

// ❌ useEffect + estado extra para algo derivable
function BusList({ buses, lineaFiltro }: BusListProps) {
  const [busesFiltrados, setBusesFiltrados] = useState(buses)
  useEffect(() => {
    setBusesFiltrados(buses.filter(b => b.linea === lineaFiltro))
  }, [buses, lineaFiltro])
}
```

### useState con función inicializadora para valores costosos

```tsx
// ✅ parseCSV solo se ejecuta una vez
const [parsedData, setParsedData] = useState(() => parseCSV(rawData))

// ❌ parseCSV se ejecuta en cada render
const [parsedData, setParsedData] = useState(parseCSV(rawData))
```

### setState funcional para callbacks estables

```tsx
// ✅ handleIncrement es estable — no necesita deps en useCallback
const handleIncrement = useCallback(() => {
  setCount(prev => prev + 1)
}, [])

// ❌ handleIncrement cambia en cada render porque depende de count
const handleIncrement = useCallback(() => {
  setCount(count + 1)
}, [count])
```

### Hoistar defaults de props no primitivas fuera del componente

```tsx
// ✅ El array es la misma referencia siempre — no provoca re-renders en hijos
const DEFAULT_LINEAS: string[] = []

export function BusSelector({ lineas = DEFAULT_LINEAS }: BusSelectorProps) { ... }

// ❌ Nuevo array en cada render → re-renders innecesarios en hijos memoizados
export function BusSelector({ lineas = [] }: BusSelectorProps) { ... }
```

### startTransition para actualizaciones no urgentes

```tsx
import { startTransition } from 'react'

function handleLineaChange(linea: string) {
  setInputValue(linea)                            // urgente: actualizar el input
  startTransition(() => setLineaSeleccionada(linea)) // no urgente: re-renderizar el mapa
}
```

---

## 5. Fetching con TanStack Query

### Query (lectura)

```tsx
// src/features/emt/services/emtApi.ts
export async function fetchUbicaciones(linea: string): Promise<BusUbicacion[]> {
  const res = await fetch(`/api/emt/ubicaciones?linea=${linea}`)
  if (!res.ok) throw new Error('Error al obtener ubicaciones')
  return res.json()
}

// src/features/emt/services/emtQueryKeys.ts
export const emtKeys = {
  all: ['emt'] as const,
  ubicaciones: (linea: string) => ['emt', 'ubicaciones', linea] as const,
  lineas: () => ['emt', 'lineas'] as const,
}

// src/features/emt/hooks/useUbicaciones.ts
export function useUbicaciones(linea: string) {
  return useQuery({
    queryKey: emtKeys.ubicaciones(linea),
    queryFn: () => fetchUbicaciones(linea),
    enabled: Boolean(linea),
    refetchInterval: 60_000,   // polling cada 60s (datos EMT se actualizan cada minuto)
    staleTime: 55_000,
  })
}
```

### Cargar datos en paralelo — nunca en cascada (Vercel rule: async-parallel)

```tsx
// ✅ Ambas queries se lanzan simultáneamente
export function MapaEMT({ linea }: { linea: string }) {
  const { data: ubicaciones } = useUbicaciones(linea)
  const { data: paradas } = useParadas(linea)
}

// ❌ Cascada: paradas espera a ubicaciones innecesariamente
export function MapaEMT({ linea }: { linea: string }) {
  const { data: ubicaciones } = useUbicaciones(linea)
  const { data: paradas } = useParadas(ubicaciones?.lineaId)
}
```

### Mutation (escritura)

```tsx
export function useUpdateLinea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateLineaDto) => updateLinea(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emtKeys.ubicaciones(variables.linea) })
    },
  })
}
```

---

## 6. Estado global con Zustand

```tsx
// src/features/emt/store/emtStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface EMTState {
  lineaSeleccionada: string | null
}

interface EMTActions {
  setLineaSeleccionada: (linea: string | null) => void
}

type EMTStore = EMTState & EMTActions

export const useEMTStore = create<EMTStore>()(
  devtools(
    (set) => ({
      lineaSeleccionada: null,
      setLineaSeleccionada: (linea) => set({ lineaSeleccionada: linea }),
    }),
    { name: 'emt-store' }
  )
)

// Selectores granulares exportados — usar siempre estos, nunca desestructurar el store
export const selectLineaSeleccionada = (s: EMTStore) => s.lineaSeleccionada
export const selectSetLinea = (s: EMTStore) => s.setLineaSeleccionada
```

---

## 7. Bundle size (Vercel rules: bundle-*)

### Importar directo, no desde barrel cuando el bundle importa

```tsx
// ✅ Tree-shaking efectivo
import { format } from 'date-fns/format'

// ❌ Puede importar toda la librería
import { format } from 'date-fns'
```

### Dynamic import para componentes pesados (Vercel rule: bundle-dynamic-imports)

```tsx
import dynamic from 'next/dynamic'

// MapLibre GL no funciona en servidor — cargarlo solo en el cliente
const MapaEMT = dynamic(
  () => import('@/features/emt/components/MapaEMT').then(m => m.MapaEMT),
  {
    loading: () => <MapSkeleton />,
    ssr: false,
  }
)
```

### Cargar librerías de tracking después de hidratación (Vercel rule: bundle-defer-third-party)

```tsx
useEffect(() => {
  import('@/lib/analytics').then(({ init }) => init())
}, [])
```

---

## 8. TypeScript: patrones frecuentes

```tsx
// Tipo genérico para respuestas API
interface ApiResponse<T> {
  data: T
  meta?: { total: number; page: number }
}

// Union type para estados
type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

// as const en lugar de enum
const Sentido = { Ida: 1, Vuelta: 2 } as const
type Sentido = typeof Sentido[keyof typeof Sentido]

// Props de HTML extendidas
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  isLoading?: boolean
}
```

---

## 9. Tailwind CSS: patrones

```tsx
import { clsx } from 'clsx'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost: 'hover:bg-gray-100',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

export function Button({ variant, size, isLoading, className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(buttonVariants({ variant, size }), className)}
      disabled={isLoading || props.disabled}
      {...props}
    />
  )
}
```

---

## 10. API Routes — proxy Next.js (Vercel rules: async-api-routes, async-parallel)

Las API Routes actúan de proxy entre el frontend y los datos abiertos del Ayuntamiento,
resolviendo el problema de CORS.

### Patrón base

```tsx
// src/app/api/emt/ubicaciones/route.ts
import { NextRequest, NextResponse } from 'next/server'

const EMT_UBICACIONES_URL =
  'https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTlineasUbicaciones/lineasyubicaciones.csv'

export async function GET(request: NextRequest) {
  const linea = request.nextUrl.searchParams.get('linea')

  try {
    const res = await fetch(EMT_UBICACIONES_URL, {
      // Datos en tiempo real: sin cache (se actualizan cada 60s, el cliente hace polling)
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Error al obtener datos de EMT' },
        { status: res.status }
      )
    }

    const csv = await res.text()
    const datos = parseUbicacionesCSV(csv)
    const filtrados = linea ? datos.filter(b => b.codLinea === linea) : datos

    return NextResponse.json(filtrados)
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

### Fetches paralelos en API Routes (Vercel rule: async-parallel)

```tsx
// ✅ Lanza ambos fetches a la vez
export async function GET() {
  const [lineasRes, paradasRes] = await Promise.all([
    fetch(EMT_LINEAS_URL, { next: { revalidate: 3600 } }),  // estático: cache 1h
    fetch(EMT_PARADAS_URL, { next: { revalidate: 3600 } }),
  ])
  // ...
}

// ❌ Cascada innecesaria
export async function GET() {
  const lineasRes = await fetch(EMT_LINEAS_URL)
  const paradasRes = await fetch(EMT_PARADAS_URL) // espera a lineasRes sin necesidad
}
```

### Reglas de API Routes

- **Validar parámetros** de entrada antes de usarlos
- **Cache según frecuencia de cambio**: `cache: 'no-store'` para tiempo real, `next: { revalidate: N }` para datos estáticos (líneas, paradas)
- **Sin lógica de negocio compleja** — solo proxy y transformación de datos
- **Manejo de errores** con status codes HTTP correctos
- **Tipado explícito** de request y response

---

## 11. Testing

### Componente

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LineaSelector } from './LineaSelector'

describe('LineaSelector', () => {
  const lineas = [
    { codLinea: '1', nombreLinea: 'Línea 1' },
    { codLinea: '2', nombreLinea: 'Línea 2' },
  ]

  it('muestra las líneas disponibles', () => {
    render(<LineaSelector lineas={lineas} onSelect={vi.fn()} />)
    expect(screen.getByRole('option', { name: 'Línea 1' })).toBeInTheDocument()
  })

  it('llama a onSelect con el código al cambiar', async () => {
    const onSelect = vi.fn()
    render(<LineaSelector lineas={lineas} onSelect={onSelect} />)
    await userEvent.selectOptions(
      screen.getByRole('combobox'),
      screen.getByRole('option', { name: 'Línea 1' })
    )
    expect(onSelect).toHaveBeenCalledWith('1')
  })
})
```

### Hook

```tsx
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCounter } from './useCounter'

describe('useCounter', () => {
  it('incrementa el valor', () => {
    const { result } = renderHook(() => useCounter())
    act(() => result.current.increment())
    expect(result.current.count).toBe(1)
  })
})
```

### Reglas de testing

- Query por rol semántico (`getByRole`) > por label > por texto > por testId
- Nunca por clase CSS o estructura interna del DOM
- MSW para mockear APIs, no `vi.mock('fetch')`
- Un `describe` por componente/hook, `it` en lenguaje de usuario

---

## 12. Checklist de revisión de código

**TypeScript**
- [ ] Sin `any` sin comentario justificativo
- [ ] Props tipadas con `interface`/`type`
- [ ] Return types explícitos en funciones públicas de servicios y hooks

**Componentes**
- [ ] Sin lógica de negocio inline en JSX
- [ ] Handlers nombrados, no arrow functions inline para lógica compleja
- [ ] Early returns para loading/error/empty states
- [ ] Componente < 200 líneas o dividido
- [ ] Sin componentes definidos dentro de otros componentes

**Performance — re-renders**
- [ ] Selectores granulares en Zustand (nunca desestructurar el store entero)
- [ ] Estado derivado computado en render, no con `useEffect` + `useState`
- [ ] `useState` con función inicializadora para valores costosos
- [ ] `setState` funcional cuando el nuevo valor depende del anterior
- [ ] Props arrays/objetos con default hoistado fuera del componente
- [ ] `startTransition` para actualizaciones no urgentes

**Performance — bundle**
- [ ] Imports directos de librerías (no barrel cuando el tamaño importa)
- [ ] `next/dynamic` con `ssr: false` para componentes que no funcionan en servidor (mapa vectorial — MapLibre GL)
- [ ] Librerías de analytics/tracking cargadas después de hidratación

**Performance — async**
- [ ] Fetches independientes en paralelo con `Promise.all`
- [ ] En API Routes: no encadenar awaits innecesariamente

**Hooks y efectos**
- [ ] Sin `useEffect` para estado derivado
- [ ] Lógica de interacción en event handlers, no en efectos
- [ ] Dependencias de `useEffect`/`useCallback`/`useMemo` correctas

**Estado**
- [ ] Estado servidor gestionado con TanStack Query
- [ ] `refetchInterval` configurado para datos en tiempo real
- [ ] Sin duplicación de estado

**API Routes**
- [ ] Validación de parámetros de entrada
- [ ] Cache apropiado según frecuencia de actualización del dato
- [ ] Manejo de errores con status codes correctos
- [ ] Sin lógica de negocio compleja

**Arquitectura**
- [ ] Sin importaciones cruzadas entre features
- [ ] Barrel exports en `index.ts`
- [ ] Ficheros en la carpeta correcta

**Testing**
- [ ] Tests para lógica de negocio
- [ ] Queries semánticas en RTL
- [ ] Sin implementación mockeada innecesariamente
