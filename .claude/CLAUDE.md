# CLAUDE.md — Next.js Project Guidelines

> Este fichero define el comportamiento esperado de Claude (y Kiro) al trabajar en este proyecto.
> Se aplica en toda interacción: generación de código, refactors, revisiones y respuestas.

---

## 🧠 Filosofía general

- **Spec antes que código.** Ante cualquier feature nueva, razona primero: ¿qué necesita hacer? ¿cómo se integra? ¿qué efectos secundarios tiene? Solo entonces implementa.
- **Código para humanos.** Prioriza legibilidad y mantenibilidad sobre brevedad. El código se lee más veces de las que se escribe.
- **Simplicidad deliberada.** No añadas abstracciones antes de necesitarlas (YAGNI). Refactoriza cuando el patrón se repite, no antes.
- **Consistencia sobre preferencia.** Sigue los patrones ya establecidos en el proyecto, aunque personalmente preferirías otro enfoque.

---

## ⚙️ Stack y versiones

- **Next.js 15** con App Router. Sin Pages Router.
- **React 19** con hooks funcionales. Sin clases.
- **TypeScript** estricto (`strict: true`). Sin `any` sin justificación explícita.
- **Zustand** para estado global del cliente.
- **TanStack Query v5** para estado servidor / fetching en el cliente.
- **Tailwind CSS v4** para estilos.
- **Vitest + React Testing Library** para tests.
- **Google Maps JavaScript API** para mapas (`@vis.gl/react-google-maps`).

### ⚠️ Restricciones de arquitectura

- **Sin React Server Components (RSC).** Este proyecto usa Next.js exclusivamente en modo cliente (`'use client'`). No generes Server Components, `async` components, ni `server actions`.
- **Sin `getServerSideProps` ni `getStaticProps`** — son del Pages Router, no aplican.
- **La única lógica server-side va en API Routes** (`src/app/api/`), que actúan de proxy hacia los datos abiertos del Ayuntamiento de Málaga (problema de CORS).

---

## 📁 Estructura de carpetas

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes (proxy → datos abiertos Ayuntamiento Málaga)
│   │   └── emt/
│   │       ├── ubicaciones/
│   │       │   └── route.ts    # GET /api/emt/ubicaciones?linea=X
│   │       ├── lineas/
│   │       │   └── route.ts    # GET /api/emt/lineas
│   │       └── paradas/
│   │           └── route.ts    # GET /api/emt/paradas?linea=X
│   ├── layout.tsx              # Root layout — providers globales
│   ├── page.tsx                # Página principal
│   └── globals.css
├── features/                   # Módulos por dominio
│   └── [feature]/
│       ├── components/         # Componentes específicos de la feature
│       ├── hooks/              # Hooks específicos de la feature
│       ├── services/           # Funciones de fetch + query keys
│       ├── store/              # Zustand slice de la feature
│       ├── types/              # Tipos TypeScript de la feature
│       └── index.ts            # Barrel export público
├── shared/                     # Código reutilizable entre features
│   ├── components/             # Componentes genéricos (Button, Skeleton, etc.)
│   ├── hooks/                  # Hooks genéricos (useDebounce…)
│   ├── utils/                  # Funciones puras utilitarias (parsers CSV, etc.)
│   └── types/                  # Tipos globales compartidos
└── providers/                  # QueryClientProvider, etc.
```

**Regla de importación:** una feature puede importar de `shared/`, pero **nunca** de otra feature directamente. La comunicación entre features va por estado global (Zustand) o query cache (TanStack Query).

---

## 🌐 API Routes — proxy Ayuntamiento de Málaga

Las API Routes son el único punto de contacto con los datos externos. El frontend **nunca** llama directamente a `datosabiertos.malaga.eu` (CORS).

### URLs de origen

```
Ubicaciones en tiempo real: https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTlineasUbicaciones/lineasyubicaciones.csv
Líneas y paradas:           https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTLineasYParadas/lineasyparadas.csv
```

### Reglas de API Routes

- **Datos en tiempo real** (ubicaciones): `cache: 'no-store'` — el cliente hace polling cada 60s.
- **Datos estáticos** (líneas, paradas): `next: { revalidate: 3600 }` — cambian raramente.
- **Fetches independientes siempre en paralelo** con `Promise.all`. Nunca encadenados con `await` secuencial.
- **Validar parámetros** de entrada antes de usarlos.
- **Manejo de errores** con status codes HTTP correctos y mensaje descriptivo.
- **Sin lógica de negocio compleja** — solo proxy, parseo de CSV y transformación a JSON.

```ts
// ✅ Fetches paralelos
const [lineasRes, paradasRes] = await Promise.all([
  fetch(EMT_LINEAS_URL, { next: { revalidate: 3600 } }),
  fetch(EMT_PARADAS_URL, { next: { revalidate: 3600 } }),
])

// ❌ Secuencial innecesario
const lineasRes = await fetch(EMT_LINEAS_URL)
const paradasRes = await fetch(EMT_PARADAS_URL)
```

---

## 🧩 Componentes React

### Estructura interna de un componente

```tsx
// 1. Directiva 'use client' si es necesario (todos los componentes con estado/efectos)
// 2. Imports externos
// 3. Imports internos
// 4. Tipos / interfaces propias del componente
// 5. Constantes locales (fuera del componente)
// 6. Definición del componente
// 7. Export
```

### Reglas

- **`'use client'` en todos los componentes con estado, efectos o event handlers.**
- **Un componente = un fichero.** Nombre en PascalCase: `BusMarker.tsx`.
- **Props tipadas siempre** con `interface` o `type`. No uses `React.FC<>`.
- **Componentes pequeños y enfocados.** Más de ~150 líneas → candidato a dividirse.
- **No lógica de negocio en componentes.** Extráela a hooks o servicios.
- **No definir componentes dentro de componentes** — provoca re-montajes en cada render.
- **Evita efectos innecesarios.** Antes de `useEffect`, pregúntate si puedes derivar el valor directamente en el render.

```tsx
// ✅ Bien
'use client'

interface BusMarkerProps {
  bus: BusUbicacion
  onClick?: (id: string) => void
}

export function BusMarker({ bus, onClick }: BusMarkerProps) { ... }

// ❌ Mal
const BusMarker: React.FC<{ bus: BusUbicacion }> = ({ bus }) => { ... }
```

---

## 🪝 Custom Hooks

- Nombre siempre con prefijo `use`: `useUbicaciones`, `useLineas`.
- Un hook debe tener **una responsabilidad clara**.
- Retorna un objeto nombrado (no array) salvo que sea un par `[value, setter]`.
- **Lógica de interacción en event handlers, no en efectos.** Si algo ocurre por un click, va en el handler.

```tsx
// ✅ Bien — lógica en handler
function handleSelectLinea(linea: string) {
  setLineaSeleccionada(linea)
  analytics.track('linea_selected', { linea })
}

// ❌ Mal — efecto innecesario para lógica de interacción
useEffect(() => {
  if (lineaSeleccionada) analytics.track('linea_selected', { lineaSeleccionada })
}, [lineaSeleccionada])
```

---

## 🔷 TypeScript

- `strict: true` en `tsconfig.json`. Sin negociación.
- Prefiere `interface` para objetos, `type` para uniones/intersecciones y tipos utilitarios.
- **No uses `any`.** Si es inevitable, usa `unknown` + type guard, o `// eslint-disable-next-line @typescript-eslint/no-explicit-any` con comentario explicativo.
- Los enums de strings se sustituyen por `as const`:

```tsx
const Sentido = { Ida: 1, Vuelta: 2 } as const
type Sentido = typeof Sentido[keyof typeof Sentido]
```

---

## 🌐 Fetching y estado servidor (cliente)

- Usa **TanStack Query** para toda comunicación con las API Routes. No hagas fetching manual en componentes.
- Centraliza las query keys en un objeto por feature.
- Para datos en tiempo real, configura `refetchInterval: 60_000` y `staleTime: 55_000`.
- Las mutaciones deben invalidar las queries relacionadas en `onSuccess`.
- Separa la capa de fetching (funciones puras) de los hooks de TanStack Query.

```ts
// features/emt/services/emtQueryKeys.ts
export const emtKeys = {
  all: ['emt'] as const,
  ubicaciones: (linea: string) => ['emt', 'ubicaciones', linea] as const,
  lineas: () => ['emt', 'lineas'] as const,
}
```

---

## 🗂️ Estado global (Zustand)

- Un slice por feature. No un store monolítico.
- El store **no contiene estado derivado** — compútalo en el render.
- **Siempre selectores granulares** para evitar re-renders innecesarios:

```tsx
// ✅ Solo re-renderiza si cambia lineaSeleccionada
const linea = useEMTStore(state => state.lineaSeleccionada)

// ❌ Re-renderiza con cualquier cambio del store
const { lineaSeleccionada } = useEMTStore()
```

---

## ⚡ Performance

### Re-renders

- **Derivar estado en render**, no con `useEffect` + `useState`.
- **`useState` con función inicializadora** para valores costosos: `useState(() => parse(data))`.
- **`setState` funcional** cuando el nuevo valor depende del anterior: `setCount(prev => prev + 1)`.
- **Hoistar defaults de props** arrays/objetos fuera del componente para mantener la referencia estable.
- **`startTransition`** para actualizaciones no urgentes (filtros, búsquedas).

### Bundle

- **Imports directos** de librerías, no desde barrel cuando el tamaño importa.
- **`next/dynamic` con `ssr: false`** para Google Maps y cualquier componente que no funcione en servidor.
- **Librerías de analytics/tracking** cargadas con `import()` dinámico dentro de `useEffect`.

---

## 🎨 Estilos (Tailwind CSS)

- Clases de Tailwind directamente en JSX. Sin CSS Modules ni styled-components salvo casos justificados.
- Para variantes condicionales usa `clsx` o `cva` (class-variance-authority).
- Extrae clases repetidas a componentes, no a `@apply`.
- Los valores de diseño (colores, espaciados especiales) van en la config de Tailwind como tokens.

---

## 🧪 Testing

- **Cobertura mínima:** lógica de negocio (hooks, utils, parsers CSV) al 80%+.
- Usa **Vitest** como runner y **React Testing Library** para componentes.
- Testea comportamiento, no implementación: queries por rol/label/texto, nunca por clases CSS.
- Mockea llamadas HTTP con **MSW (Mock Service Worker)**.
- Nombrado: `ComponentName.test.tsx`, `hookName.test.ts`, `utilName.test.ts`.

```tsx
// ✅ Bien — testea lo que el usuario ve/hace
expect(screen.getByRole('button', { name: /seleccionar línea/i })).toBeInTheDocument()

// ❌ Mal — testea implementación
expect(wrapper.find('.btn-primary')).toHaveLength(1)
```

---

## 🚫 Anti-patrones prohibidos

| Anti-patrón | Alternativa |
|---|---|
| React Server Components | No aplican — todo `'use client'` |
| Llamadas directas a `datosabiertos.malaga.eu` desde el cliente | Siempre via API Routes (`/api/emt/…`) |
| `useEffect` para sincronizar estado derivado | Computarlo en render |
| Lógica de interacción en `useEffect` | Moverla al event handler |
| Desestructurar el store Zustand entero | Selectores granulares |
| Prop drilling > 2 niveles | Zustand o TanStack Query |
| Lógica de negocio en JSX | Extraer a hook o servicio |
| Componentes dentro de componentes | Definirlos fuera |
| Props array/objeto con default inline `= []` | Hoistar default fuera del componente |
| Componentes > 200 líneas sin justificación | Dividir en subcomponentes |
| `useState` para estado servidor | TanStack Query |
| Fetches secuenciales independientes | `Promise.all` |
| `console.log` en commits | Eliminar o usar logger estructurado |
| Imports de barrel en paths críticos de bundle | Imports directos |

---

## 📝 Convenciones de nombrado

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | PascalCase | `BusMarker`, `LineaSelector` |
| Hooks | camelCase con `use` | `useUbicaciones`, `useLineas` |
| Utilidades | camelCase | `parseUbicacionesCSV` |
| Constantes globales | SCREAMING_SNAKE | `POLL_INTERVAL_MS` |
| Tipos / Interfaces | PascalCase | `BusUbicacion`, `LineaEMT` |
| Ficheros de componente | PascalCase | `BusMarker.tsx` |
| Ficheros de hook/util | camelCase | `useUbicaciones.ts` |
| Carpetas de feature | kebab-case | `emt-mapa/` |
| API Routes | kebab-case | `app/api/emt/ubicaciones/route.ts` |

---

## ✅ Checklist antes de dar código por terminado

**Corrección**
- [ ] TypeScript sin errores (`tsc --noEmit`)
- [ ] Sin `any` injustificados
- [ ] Props tipadas
- [ ] `'use client'` donde corresponde

**Performance — re-renders**
- [ ] Selectores granulares en Zustand
- [ ] Estado derivado computado en render, no con efectos
- [ ] Props arrays/objetos con default hoistado
- [ ] `startTransition` para actualizaciones no urgentes si aplica

**Performance — bundle**
- [ ] `next/dynamic` con `ssr: false` para Google Maps
- [ ] Sin imports de barrel en rutas críticas

**Performance — async**
- [ ] Fetches independientes en `Promise.all`
- [ ] Cache correcto en API Routes según tipo de dato

**Calidad**
- [ ] Tests para lógica de negocio y parsers
- [ ] Sin `console.log` olvidados
- [ ] Sin efectos innecesarios
- [ ] Componente < 200 líneas o justificado
- [ ] Nombres descriptivos (sin abreviaturas crípticas)
- [ ] Sin importaciones cruzadas entre features
- [ ] Sin llamadas directas al Ayuntamiento desde el cliente
