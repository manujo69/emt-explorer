/** Posición GPS de un bus en servicio activo */
export interface BusUbicacion {
  /** Identificador del vehículo */
  codBus: string
  /** Código de línea normalizado (ej: "1", no "1.0") */
  codLinea: string
  /** 1 = ida, 2 = vuelta */
  sentido: number
  /** Coordenada X — rango [-180, 180] */
  longitud: number
  /** Coordenada Y — rango [-90, 90] */
  latitud: number
  /** Código de parada de inicio de tramo */
  codParIni: string
  /** Timestamp ISO de última actualización */
  lastUpdate: string
}

/** Línea de autobús de la EMT */
export interface LineaEMT {
  /** Código único de línea (ej: "1") */
  codLinea: string
  /** Nombre descriptivo (ej: "Parque del Sur - Alameda Principal") */
  nombreLinea: string
  /** Cabecera del sentido ida */
  cabeceraIda?: string
  /** Cabecera del sentido vuelta */
  cabeceraVuelta?: string
}

/** Parada de una línea de autobús con su posición en ruta */
export interface ParadaEMT {
  /** Código de la línea normalizado */
  codLinea: string
  /** Código identificador de la parada */
  codParada: string
  /** Nombre de la parada */
  nombreParada: string
  /** 1 = ida, 2 = vuelta */
  sentido: number
  /** Posición en la secuencia del recorrido */
  orden: number
  /** Coordenada X */
  longitud: number
  /** Coordenada Y */
  latitud: number
}

/** Próximo bus de una línea/sentido aproximándose a una parada */
export interface LlegadaLinea {
  codLinea: string
  nombreLinea: string
  /** 1 = ida, 2 = vuelta */
  sentido: number
  /** Destino del sentido (cabeceraIda o cabeceraVuelta) */
  destino: string
  proximoBus: {
    codBus: string
    /** Minutos estimados hasta la parada */
    minutos: number
  }
}

/** Punto de trazado de una forma de ruta (GTFS shapes.csv) */
export interface ShapePoint {
  latitud: number
  longitud: number
  sequence: number
}

/** Trazados de ruta por sentido: clave 1 = ida, 2 = vuelta */
export type ShapesByDirection = Record<number, ShapePoint[]>

/** Respuesta de error de las API Routes */
export interface ApiError {
  error: string
}
