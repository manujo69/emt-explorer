# Requirements Document

## Introduction

EMT Málaga Map es una aplicación web Next.js 15 que muestra en tiempo real la posición de los autobuses de la EMT de Málaga sobre un mapa de Google Maps. El usuario puede seleccionar una línea concreta para filtrar los buses visibles. Los datos provienen del portal de datos abiertos del Ayuntamiento de Málaga (`datosabiertos.malaga.eu`), cuyo acceso directo desde el navegador está bloqueado por CORS; por ello, toda comunicación con el origen se canaliza a través de API Routes de Next.js que actúan de proxy.

---

## Glossary

- **App**: La aplicación web Next.js 15 EMT Málaga Map.
- **API_Route**: Endpoint de Next.js en `src/app/api/` que actúa de proxy entre el cliente y el origen de datos del Ayuntamiento de Málaga.
- **EMT_Origin**: El servidor externo `datosabiertos.malaga.eu` que publica los ficheros CSV con datos de la EMT.
- **CSV_Parser**: Módulo utilitario que transforma el texto CSV recibido del EMT_Origin en objetos TypeScript tipados.
- **Linea**: Línea de autobús de la EMT de Málaga, identificada por un código único (`codLinea`) y un nombre (`nombreLinea`).
- **Bus**: Vehículo de la EMT en servicio activo, con posición GPS (latitud y longitud) y código de línea asociado.
- **LineaSelector**: Componente de interfaz que permite al usuario elegir una Linea de la lista disponible.
- **MapaEMT**: Componente de mapa (Google Maps) que renderiza los marcadores de posición de los Buses de la Linea seleccionada.
- **BusMarker**: Marcador visual sobre el MapaEMT que representa la posición de un Bus.
- **EMTStore**: Slice de Zustand que almacena la Linea seleccionada por el usuario.
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
5. THE App SHALL NOT make any request directly to `datosabiertos.malaga.eu` from the client; all data requests SHALL go through `/api/emt/lineas` or `/api/emt/ubicaciones`.
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
2. THE BusMarker SHALL be positioned at the GPS coordinates (`latitud`, `longitud`) of the corresponding Bus.
3. WHILE the ubicaciones request is in progress, THE MapaEMT SHALL display a loading indicator without removing existing BusMarkers.
4. IF the ubicaciones request fails, THEN THE App SHALL display an error message without removing existing BusMarkers.
5. THE MapaEMT SHALL be loaded with `next/dynamic` and `ssr: false` to prevent server-side rendering errors.
6. THE MapaEMT SHALL center the initial view on Málaga city (approximately 36.7213°N, 4.4214°W) at zoom level 13.
7. WHEN the ubicaciones request for the selected Linea succeeds and the API returns zero Buses, THE MapaEMT SHALL display no BusMarkers and SHALL NOT display a loading indicator or error message.

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
2. THE App SHALL expose a public API for the EMT feature exclusively through `src/features/emt/index.ts`; no file outside `src/features/emt/` SHALL import directly from a path inside `src/features/emt/` other than `src/features/emt/index.ts`.
3. THE App SHALL NOT import from one feature's internal modules into another feature's internal modules; cross-feature communication SHALL use the EMTStore or TanStack Query cache. Imports from `src/shared/` are permitted in any feature.
4. THE App SHALL use `'use client'` directive in all components and hooks that use React state, effects, or event handlers.
5. THE App SHALL NOT use React Server Components, `async` page components, or Server Actions anywhere in the codebase.
6. THE App SHALL place all server-side logic (proxy calls to EMT_Origin, CSV parsing, and JSON transformation) exclusively in API Routes under `src/app/api/`.

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
