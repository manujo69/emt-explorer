# Requirements Document

## Introduction

EMT Málaga Map es una aplicación web Next.js 15 que muestra en tiempo real la posición de los autobuses de la EMT de Málaga sobre un mapa OpenStreetMap renderizado con MapLibre GL y teselas de OpenFreeMap (sin API key). El usuario puede seleccionar una línea concreta para filtrar los buses visibles y ver el trazado de la ruta y sus paradas. Al pulsar una parada puede consultar cuánto tiempo falta para el próximo bus. Los datos provienen del portal de datos abiertos del Ayuntamiento de Málaga (`datosabiertos.malaga.eu`) y del portal móvil de la EMT, cuyo acceso directo desde el navegador está bloqueado por CORS; por ello, toda comunicación con los orígenes se canaliza a través de API Routes de Next.js que actúan de proxy.

---

## Glossary

- **App**: La aplicación web Next.js 15 EMT Málaga Map.
- **API_Route**: Endpoint de Next.js en `src/app/api/` que actúa de proxy entre el cliente y los orígenes de datos externos.
- **EMT_Origin**: El servidor `datosabiertos.malaga.eu` que publica los ficheros CSV con datos de la EMT (líneas, paradas y posiciones en tiempo real).
- **EMT_Mobile**: El servidor `www.emtmalaga.es` que publica información de llegadas a parada en formato HTML.
- **GTFS_Files**: Ficheros en formato GTFS (`data/gtfs/shapes.csv`, `data/gtfs/trips.csv`) almacenados localmente que contienen los trazados geográficos exactos de las rutas.
- **CSV_Parser**: Módulo utilitario que transforma el texto CSV recibido del EMT_Origin en objetos TypeScript tipados.
- **Linea**: Línea de autobús de la EMT de Málaga, identificada por un código único (`codLinea`), un nombre (`nombreLinea`) y las cabeceras de ida y vuelta (`cabeceraIda`, `cabeceraVuelta`).
- **Sentido**: Dirección de circulación de una Linea (1 = vuelta, 2 = ida). Las líneas circulares no tienen sentidos diferenciados.
- **Bus**: Vehículo de la EMT en servicio activo, con posición GPS (`latitud`, `longitud`), código de línea (`codLinea`), identificador de vehículo (`codBus`) y sentido (`sentido`).
- **Parada**: Parada de autobús de la EMT, con código (`codParada`), nombre (`nombreParada`), coordenadas GPS (`latitud`, `longitud`), sentido (`sentido`) y orden de paso (`orden`) dentro de la ruta de su Linea.
- **Shape**: Conjunto ordenado de coordenadas GPS que traza el recorrido geográfico exacto de una Linea para un Sentido dado, procedente de los GTFS_Files.
- **LlegadaLinea**: Objeto con información del próximo bus de una Linea hacia una Parada concreta: `codLinea`, `nombreLinea`, `sentido`, `destino` y `proximoBus.minutos`.
- **LineaSelector**: Componente de interfaz que permite al usuario elegir una Linea de la lista disponible.
- **MapaEMT**: Componente de mapa basado en MapLibre GL (`react-map-gl/maplibre`) con teselas de OpenFreeMap que renderiza los marcadores de posición de los Buses de la Linea seleccionada.
- **BusMarker**: Marcador visual sobre el MapaEMT que representa la posición de un Bus, ajustado visualmente a la Shape de su Sentido.
- **RutaLinea**: Componente que renderiza la ruta de la Linea seleccionada como una polilínea GeoJSON y sus Paradas como marcadores SVG interactivos sobre el MapaEMT.
- **ParadaModal**: Popup de MapLibre que se abre al pulsar una Parada en el mapa y muestra las llegadas próximas.
- **SentidoFilter**: Componente de interfaz que permite al usuario activar o desactivar la visualización de cada Sentido de la Linea seleccionada.
- **EMTStore**: Slice de Zustand que almacena la Linea seleccionada, los sentidos activos y la Parada seleccionada.
- **QueryClient**: Instancia de TanStack Query que gestiona el caché y el polling de datos en el cliente.
- **Poll_Interval**: Intervalo de refresco automático de posiciones GPS, fijado en 60 segundos.

---

## Requirements

### Requirement 1: Proxy de líneas disponibles

**User Story:** Como desarrollador, quiero un endpoint proxy que devuelva la lista de líneas de la EMT, para que el cliente pueda obtenerla sin restricciones de CORS.

#### Acceptance Criteria

1. THE API_Route SHALL expose the endpoint `GET /api/emt/lineas` that returns a JSON array of Lineas.
2. WHEN the API_Route receives a request to `GET /api/emt/lineas`, THE API_Route SHALL fetch the CSV from EMT_Origin using `next: { revalidate: 3600 }` cache policy.
3. WHEN the EMT_Origin returns a valid CSV, THE CSV_Parser SHALL transform it into an array of objects with at least the fields `codLinea` (string) and `nombreLinea` (string).
4. IF the EMT_Origin returns a non-2xx HTTP status, THEN THE API_Route SHALL return a JSON error response with the same HTTP status code and a descriptive `error` field.
5. IF a network or parsing error occurs, THEN THE API_Route SHALL return a JSON error response with HTTP status 500 and a descriptive `error` field.
6. THE API_Route SHALL return the list of Lineas ordered by `codLinea` in ascending lexicographic order.
7. WHEN the EMT_Origin returns a valid CSV with zero data rows, THE API_Route SHALL return HTTP 200 with an empty JSON array.

---

### Requirement 2: Proxy de ubicaciones en tiempo real

**User Story:** Como desarrollador, quiero un endpoint proxy que devuelva las posiciones GPS de los buses de una línea concreta, para que el cliente pueda mostrarlas en el mapa sin restricciones de CORS.

#### Acceptance Criteria

1. WHEN the API_Route receives a request to `GET /api/emt/ubicaciones?linea={codLinea}`, THE API_Route SHALL return a JSON array of Bus positions for the specified Linea.
2. WHEN the API_Route receives a request to `GET /api/emt/ubicaciones`, THE API_Route SHALL validate that the `linea` query parameter is present and non-empty; IF it is absent or empty, THEN THE API_Route SHALL return HTTP 400 with a descriptive `error` field.
3. IF the `linea` query parameter contains characters other than alphanumeric characters and hyphens, THEN THE API_Route SHALL return HTTP 400 with a descriptive `error` field.
4. WHEN the API_Route receives a valid request, THE API_Route SHALL fetch the CSV from EMT_Origin without using a server-side cache (equivalent to `cache: 'no-store'`).
5. WHEN the EMT_Origin returns a valid CSV, THE CSV_Parser SHALL transform it into an array of objects with at least the fields `codLinea` (string), `latitud` (number in range [-90, 90]) and `longitud` (number in range [-180, 180]).
6. WHEN the parsed CSV contains Bus records, THE API_Route SHALL return only the Buses whose `codLinea` exactly matches the `linea` query parameter; IF no Buses match, THE API_Route SHALL return HTTP 200 with an empty JSON array.
7. IF the EMT_Origin returns a non-2xx HTTP status, THEN THE API_Route SHALL return a JSON error response with the same HTTP status code and a descriptive `error` field.
8. IF a network or parsing error occurs, THEN THE API_Route SHALL return a JSON error response with HTTP status 500 and a descriptive `error` field.

---

### Requirement 3: Parseo de CSV y propiedad de round-trip

**User Story:** Como desarrollador, quiero que el parseo de los ficheros CSV del Ayuntamiento sea correcto y verificable, para garantizar que los datos mostrados al usuario son fieles al origen.

#### Acceptance Criteria

1. WHEN the CSV_Parser receives the ubicaciones CSV (semicolon-delimited, first line is header), THE CSV_Parser SHALL produce an array of `BusUbicacion` objects each containing at minimum `codLinea` (string), `latitud` (number) and `longitud` (number).
2. WHEN the CSV_Parser receives the lineas CSV (semicolon-delimited, first line is header), THE CSV_Parser SHALL produce an array of `LineaEMT` objects each containing at minimum `codLinea` (string) and `nombreLinea` (string).
3. IF a CSV row has a column count that does not match the header row, or contains a non-numeric value in a numeric field (`latitud`, `longitud`), or contains an empty required string field after trimming, THEN THE CSV_Parser SHALL skip that row and continue parsing the remaining rows.
4. WHEN the CSV_Parser processes any CSV row, THE CSV_Parser SHALL trim leading and trailing whitespace from all parsed string fields.
5. IF a parsed `latitud` value is not a finite number in the range [-90, 90] or a parsed `longitud` value is not a finite number in the range [-180, 180], THEN THE CSV_Parser SHALL skip that row.
6. IF a parsed `codLinea` value is an empty string after trimming, THEN THE CSV_Parser SHALL skip that row.

---

### Requirement 4: Carga inicial de líneas en el cliente

**User Story:** Como usuario, quiero ver la lista de líneas disponibles al cargar la aplicación, para poder seleccionar la que me interesa.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL fetch the list of Lineas from `GET /api/emt/lineas`.
2. WHILE the Lineas request is in progress, THE LineaSelector SHALL display a loading indicator.
3. WHEN the Lineas request succeeds, THE LineaSelector SHALL display each Linea returned by the API as a selectable option showing its `codLinea` and `nombreLinea`.
4. IF the Lineas request fails, THEN THE App SHALL display an error message in place of the LineaSelector content that indicates the reason for the failure.
5. THE App SHALL NOT make any request directly to `datosabiertos.malaga.eu` or `www.emtmalaga.es` from the client; all data requests SHALL go through the corresponding `/api/emt/` routes.
6. WHEN the Lineas request succeeds and the API returns zero Lineas, THE LineaSelector SHALL display an empty state message indicating no lines are available.

---

### Requirement 5: Selección de línea por el usuario

**User Story:** Como usuario, quiero seleccionar una línea de autobús, para ver en el mapa únicamente los buses de esa línea.

#### Acceptance Criteria

1. WHEN the user selects a Linea in the LineaSelector, THE EMTStore SHALL update the `lineaSeleccionada` value to the `codLinea` of the selected Linea.
2. WHEN the user selects a Linea, THE App SHALL initiate a fetch of `GET /api/emt/ubicaciones?linea={codLinea}` keyed to the selected Linea, replacing any active fetch for a previously selected Linea.
3. AT ALL TIMES, THE LineaSelector's selected option SHALL display the `nombreLinea` of the currently selected Linea and its value SHALL match the `codLinea` stored in `lineaSeleccionada`; IF no Linea is selected, no option SHALL be marked as selected.
4. WHILE no Linea is selected, THE MapaEMT SHALL display no BusMarkers.

---

### Requirement 6: Visualización de buses en el mapa

**User Story:** Como usuario, quiero ver los buses de la línea seleccionada como marcadores en el mapa, para conocer su posición en tiempo real.

#### Acceptance Criteria

1. WHEN the ubicaciones request for the selected Linea succeeds, THE MapaEMT SHALL render one BusMarker per Bus returned by the API_Route.
2. THE BusMarker SHALL be positioned at the GPS coordinates (`latitud`, `longitud`) of the corresponding Bus; IF a Shape is available for the Bus's Sentido, THE BusMarker SHALL be snapped to the nearest point on that Shape polyline before rendering.
3. WHILE the ubicaciones request is in progress, THE MapaEMT SHALL display a loading indicator without removing existing BusMarkers.
4. IF the ubicaciones request fails, THEN THE App SHALL display an error message without removing existing BusMarkers.
5. THE MapaEMT SHALL be loaded with `next/dynamic` and `ssr: false` to prevent server-side rendering errors with MapLibre GL.
6. THE MapaEMT SHALL center the initial view on Málaga city (approximately 36.7213°N, 4.4214°W) at zoom level 13 using OpenFreeMap tiles (`https://tiles.openfreemap.org/styles/bright`).
7. WHEN the ubicaciones request for the selected Linea succeeds and the API returns zero Buses, THE MapaEMT SHALL display no BusMarkers and SHALL NOT display a loading indicator or error message.
8. THE BusMarker SHALL only be visible if its Bus's `sentido` is present in the `sentidosActivos` list in EMTStore.

---

### Requirement 7: Actualización automática de posiciones (polling)

**User Story:** Como usuario, quiero que las posiciones de los buses se actualicen automáticamente cada 60 segundos, para ver siempre la información más reciente sin recargar la página.

#### Acceptance Criteria

1. WHILE a Linea is selected, THE App SHALL automatically refetch `GET /api/emt/ubicaciones?linea={codLinea}` every 60 seconds.
2. WHILE a Linea is selected and a successful fetch has completed, THE App SHALL NOT issue another fetch for the same Linea within 55 seconds of the last successful response.
3. WHEN a background refetch completes successfully, THE MapaEMT SHALL update the BusMarkers positions without a full page reload.
4. WHEN the user changes the selected Linea, THE App SHALL issue no further requests for the previous Linea and SHALL begin polling for the new Linea.
5. WHEN the App tab becomes not visible (document hidden), THE App SHALL pause polling; WHEN the tab becomes visible again, THE App SHALL resume polling with an immediate refetch.
6. WHEN a background refetch fails, THE App SHALL retain the last successfully fetched BusMarker positions and SHALL display a staleness indicator to the user.

---

### Requirement 8: Arquitectura por features y restricciones de importación

**User Story:** Como desarrollador, quiero que el código siga la arquitectura por features definida en el proyecto, para mantener la base de código organizada y sin acoplamiento entre módulos.

#### Acceptance Criteria

1. THE App SHALL organise all EMT-related code under `src/features/emt/` following the subdirectory structure: `components/`, `hooks/`, `services/`, `store/`, `types/`.
2. THE App SHALL NOT import from one feature's internal modules into another feature's internal modules; cross-feature communication SHALL use the EMTStore or TanStack Query cache. Imports from `src/shared/` are permitted in any feature.
3. THE App SHALL use `'use client'` directive in all components and hooks that use React state, effects, or event handlers.
4. THE App SHALL NOT use React Server Components, `async` page components, or Server Actions anywhere in the codebase.
5. THE App SHALL place all server-side logic (proxy calls to external origins, CSV and HTML parsing, and JSON transformation) exclusively in API Routes under `src/app/api/`.

---

### Requirement 9: Manejo de errores y estados de carga

**User Story:** Como usuario, quiero recibir retroalimentación clara cuando los datos no están disponibles o se está cargando información, para entender el estado de la aplicación en todo momento.

#### Acceptance Criteria

1. WHILE any data request is in progress, THE App SHALL display a visible loading indicator (spinner or skeleton) within the component awaiting data.
2. IF a request to `GET /api/emt/lineas` fails, THEN THE App SHALL display an error message that includes a human-readable description of the failure reason and a retry button that re-issues the request.
3. IF a request to `GET /api/emt/ubicaciones` fails, THEN THE App SHALL display an error message that includes a human-readable description of the failure reason without clearing the previously displayed BusMarkers.
4. WHEN the user clicks the retry button and the retried request succeeds, THE App SHALL restore the normal view and remove the error message.
5. WHEN the user clicks the retry button and the retried request also fails, THE App SHALL display an updated error message indicating the retry also failed.
6. THE App SHALL NOT display raw HTTP status codes, stack traces, or internal error objects to the user; all error messages SHALL be human-readable strings.

---

### Requirement 10: Proxy de paradas por línea

**User Story:** Como desarrollador, quiero un endpoint proxy que devuelva las paradas de una línea concreta ordenadas por sentido y orden de paso, para que el cliente pueda mostrarlas en el mapa.

#### Acceptance Criteria

1. THE API_Route SHALL expose the endpoint `GET /api/emt/paradas?linea={codLinea}` that returns a JSON array of Paradas for the specified Linea.
2. WHEN the API_Route receives a request to `GET /api/emt/paradas`, THE API_Route SHALL validate that the `linea` query parameter is present, non-empty, and matches the alphanumeric-and-hyphens pattern; IF validation fails, THE API_Route SHALL return HTTP 400 with a descriptive `error` field.
3. WHEN the API_Route receives a valid request, THE API_Route SHALL fetch the lineas CSV from EMT_Origin using `next: { revalidate: 1800 }` cache policy.
4. WHEN the EMT_Origin returns a valid CSV, THE CSV_Parser SHALL produce an array of `ParadaEMT` objects containing at minimum `codLinea` (string), `codParada` (string), `nombreParada` (string), `latitud` (number), `longitud` (number), `sentido` (number) and `orden` (number).
5. THE API_Route SHALL return only the Paradas whose `codLinea` exactly matches the `linea` query parameter, sorted ascending by `sentido` then by `orden`.
6. IF the EMT_Origin returns a non-2xx HTTP status, THEN THE API_Route SHALL return a JSON error response with the same HTTP status code and a descriptive `error` field.
7. IF a network or parsing error occurs, THEN THE API_Route SHALL return a JSON error response with HTTP status 500 and a descriptive `error` field.
8. WHEN the EMT_Origin returns a valid CSV with no matching Paradas for the requested Linea, THE API_Route SHALL return HTTP 200 with an empty JSON array.
9. THE client SHALL cache Parada data with a `staleTime` of 3600 seconds (1 hour), as stop positions change infrequently.

---

### Requirement 11: Proxy de shapes GTFS

**User Story:** Como desarrollador, quiero un endpoint que devuelva las coordenadas del trazado geográfico de cada sentido de una línea, para que el mapa pueda trazar la ruta exacta en lugar de conectar las paradas con líneas rectas.

#### Acceptance Criteria

1. THE API_Route SHALL expose the endpoint `GET /api/emt/shapes?linea={codLinea}` that returns a `ShapesByDirection` object (keyed by Sentido number) where each value is an ordered array of GPS coordinates.
2. WHEN the API_Route receives a request to `GET /api/emt/shapes`, THE API_Route SHALL validate that the `linea` query parameter is present, non-empty, and matches the alphanumeric-and-hyphens pattern; IF validation fails, THE API_Route SHALL return HTTP 400 with a descriptive `error` field.
3. WHEN the API_Route receives a valid request, it SHALL attempt to read the GTFS_Files from disk first; IF the files are not present, it SHALL fetch them from their remote URLs.
4. THE API_Route SHALL maintain an in-memory cache of the GTFS_Files data with a TTL of 1800 seconds (30 minutes); subsequent requests within the TTL SHALL use the cached data without re-reading disk or re-fetching.
5. WHEN the GTFS_Files are successfully read or fetched, THE API_Route SHALL parse the trips mapping to determine the `shape_id` for each Sentido of the requested Linea, then extract the ordered coordinates for each `shape_id`.
6. IF no shapes are found for the requested Linea, THE API_Route SHALL return HTTP 200 with an empty JSON object (`{}`).
7. IF a file read or fetch error occurs, THEN THE API_Route SHALL return HTTP 500 with a descriptive `error` field.
8. THE client SHALL cache Shape data with a `staleTime` of 1800 seconds (30 minutes).

---

### Requirement 12: Proxy de llegadas a una parada

**User Story:** Como usuario, quiero consultar cuánto tiempo falta para el próximo bus en una parada, para planificar mi desplazamiento.

#### Acceptance Criteria

1. THE API_Route SHALL expose the endpoint `GET /api/emt/llegadas?parada={codParada}` that returns a JSON array of `LlegadaLinea` objects sorted ascending by `proximoBus.minutos`.
2. WHEN the API_Route receives a request to `GET /api/emt/llegadas`, THE API_Route SHALL validate that the `parada` query parameter is present, non-empty, and matches the alphanumeric-and-hyphens pattern; IF validation fails, THE API_Route SHALL return HTTP 400 with a descriptive `error` field.
3. WHEN the API_Route receives a valid request, it SHALL first attempt to fetch arrival data from EMT_Mobile (`informacionParada.html?codParada={codParada}`) with `cache: 'no-store'`.
4. IF the EMT_Mobile response is valid and contains arrival data, THE API_Route SHALL parse the HTML and return the extracted `LlegadaLinea` array.
5. IF the EMT_Mobile request fails or returns no arrival data, THE API_Route SHALL fall back to computing estimated arrivals using Haversine distance from the bus positions CSV and the stops CSV, using a speed constant of 200 m/min.
6. WHEN using the Haversine fallback, THE API_Route SHALL fetch the lineas CSV (with `next: { revalidate: 1800 }`) and the ubicaciones CSV (with `cache: 'no-store'`) in parallel using `Promise.all`.
7. WHEN using the Haversine fallback, THE API_Route SHALL return only buses whose `busIdx` is strictly greater than `targetIdx` in the route order (buses that have not yet reached the stop travel in descending stop index order).
8. IF both the EMT_Mobile fetch and the Haversine fallback fail, THEN THE API_Route SHALL return HTTP 500 with a descriptive `error` field.
9. WHEN the EMT_Origin returns zero arriving buses for the requested stop, THE API_Route SHALL return HTTP 200 with an empty JSON array.

---

### Requirement 13: Visualización de ruta y paradas en el mapa

**User Story:** Como usuario, quiero ver el trazado de la línea seleccionada y sus paradas sobre el mapa, para entender el recorrido y poder interactuar con las paradas.

#### Acceptance Criteria

1. WHEN a Linea is selected, THE RutaLinea component SHALL fetch Paradas from `GET /api/emt/paradas?linea={codLinea}` and Shapes from `GET /api/emt/shapes?linea={codLinea}`.
2. WHEN Shapes are available for a Sentido, THE RutaLinea SHALL render the route for that Sentido as a GeoJSON LineString layer in MapLibre GL using the Shape coordinates, smoothed with Catmull-Rom interpolation.
3. WHEN no Shapes are available, THE RutaLinea SHALL render the route using the Parada coordinates for each Sentido as a fallback polyline, with a higher Catmull-Rom smoothing factor.
4. THE route polyline for each Sentido SHALL use a distinct color per Sentido and Linea combination, with `line-width: 6` and `line-opacity: 0.7`.
5. THE RutaLinea SHALL render Parada markers as SVG circles on the map; the circle size SHALL scale with the current zoom level (8 px at zoom < 13, up to 24 px at zoom ≥ 16).
6. WHEN two adjacent Paradas would render within 28 screen pixels of each other at the current zoom level, THE RutaLinea SHALL suppress intermediate stops while always rendering the first and last stop of the route.
7. IF a Shape is available for a Parada's Sentido, THE Parada marker SHALL be snapped to the nearest point on that Shape polyline before rendering.
8. THE RutaLinea SHALL only render routes and Paradas for Sentidos present in `sentidosActivos` in EMTStore.
9. WHEN no Linea is selected or the Paradas array is empty, THE RutaLinea SHALL render nothing.

---

### Requirement 14: Modal de información de parada

**User Story:** Como usuario, quiero pulsar una parada en el mapa para ver cuántos minutos faltan para el próximo bus, para decidir si voy caminando o espero.

#### Acceptance Criteria

1. WHEN the user clicks a Parada marker on the map, THE EMTStore SHALL store the selected Parada in `paradaSeleccionada` and THE ParadaModal SHALL open as a MapLibre GL Popup anchored to the Parada's coordinates.
2. THE ParadaModal SHALL display the stop code (`codParada`) and name (`nombreParada`) of the selected Parada.
3. WHILE the llegadas request for the selected Parada is in progress, THE ParadaModal SHALL display a loading spinner with the label "Calculando llegadas...".
4. WHEN the llegadas request succeeds and returns one or more `LlegadaLinea` entries, THE ParadaModal SHALL display one row per entry showing: a colored circle badge with the line code, a destination label, and the minutes until arrival.
5. THE ParadaModal SHALL display the arrivals for the currently selected Linea first, followed by a divider and the remaining arrivals sorted by line code.
6. WHEN the llegadas request succeeds and returns an empty array, THE ParadaModal SHALL display the message "No hay buses en camino".
7. WHEN the user closes the ParadaModal (via the close button), THE EMTStore SHALL set `paradaSeleccionada` to null and THE ParadaModal SHALL unmount.
8. THE ParadaModal SHALL NOT close when the user clicks elsewhere on the map (`closeOnClick: false`).
9. FOR circular lines where the destination string is empty, THE ParadaModal SHALL display a fallback destination label derived from the line code (e.g., "Circular 21").

---

### Requirement 15: Filtro por sentido

**User Story:** Como usuario, quiero poder activar y desactivar cada sentido (ida/vuelta) de la línea seleccionada, para ver solo los buses y la ruta que me interesan.

#### Acceptance Criteria

1. WHEN a non-circular Linea with two distinct sentido labels is selected, THE SentidoFilter SHALL render one toggle row per Sentido showing the endpoint name and a colored toggle switch.
2. WHEN the user toggles a Sentido, THE EMTStore SHALL add or remove that Sentido from `sentidosActivos`; THE MapaEMT SHALL immediately update BusMarkers and THE RutaLinea SHALL immediately update the visible routes and Paradas to reflect the new set of active Sentidos.
3. WHEN a Linea is first selected, THE EMTStore SHALL initialise `sentidosActivos` to include all available Sentidos (both 1 and 2).
4. THE SentidoFilter SHALL NOT render for circular lines (lines whose `nombreLinea` matches the circular pattern).
5. THE SentidoFilter SHALL NOT render when fewer than two Sentidos have non-empty labels.
6. WHEN no Linea is selected, THE SentidoFilter SHALL render nothing.
7. THE toggle for each Sentido SHALL use the same color as the corresponding route polyline rendered by RutaLinea for that Sentido.
