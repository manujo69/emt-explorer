# EMT Explorer

Visor en tiempo real de la flota de autobuses de la EMT de Málaga. Muestra la posición de los buses, las paradas y los tiempos de llegada estimados sobre un mapa interactivo.

## Qué hace

- Selecciona una línea y filtra por sentido (ida / vuelta)
- Muestra los buses en movimiento con actualización cada 60 segundos
- Al pulsar una parada, muestra los tiempos de llegada en tiempo real (scraping de `emtmalaga.es`) con fallback a cálculo haversine
- Dibuja el recorrido de la línea sobre el mapa con suavizado Catmull-Rom
- Centra y ajusta el zoom automáticamente al seleccionar una línea

## Stack

- **Next.js 15** (App Router, modo cliente completo)
- **React 19** + **TypeScript** estricto
- **Zustand** — estado global
- **TanStack Query v5** — fetching y caché
- **Google Maps** (`@vis.gl/react-google-maps`)
- **Tailwind CSS v4**
- **Vitest** + **React Testing Library** + **MSW**

## Arquitectura

Los datos del Ayuntamiento de Málaga tienen restricciones CORS, así que el frontend nunca los llama directamente. Las API Routes de Next.js actúan de proxy:

```
/api/emt/lineas      → CSV líneas y paradas (caché 1h)
/api/emt/paradas     → ídem, filtrado por línea
/api/emt/ubicaciones → posiciones en tiempo real (sin caché)
/api/emt/llegadas    → scraping tiempos de llegada
/api/emt/shapes      → trazado de rutas GTFS
```

## Puesta en marcha

```bash
# Instalar dependencias
npm install

# Crear .env.local con tu clave de Google Maps
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_clave" > .env.local

# Arrancar en desarrollo
npm run dev
```

La primera vez que hagas `npm run build`, el script `download-gtfs.mjs` descarga automáticamente los datos GTFS de Málaga.

## Tests

```bash
npm test              # pasa una vez
npm run test:watch    # modo watch
npm run test:coverage # con cobertura
```
