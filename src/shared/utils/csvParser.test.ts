import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { parseUbicacionesCSV, parseLineasCSV, parseShapesCSV, parseTripsMapping } from './csvParser'

const UBICACIONES_HEADER = 'codBus,codLinea,sentido,lon,lat,codParIni,last_update'
const LINEAS_HEADER = 'codLinea,codLineaStr,nombreLinea,codParada,nombreParada,direccion,lon,lat,lineas'

function serializeUbicacionRow(
  codBus: string,
  codLinea: string,
  sentido: number,
  lon: number,
  lat: number,
  codParIni: string,
  lastUpdate: string,
): string {
  return `"${codBus}","${codLinea}","${sentido}","${lon}","${lat}","${codParIni}","${lastUpdate}"`
}

function serializeLineaRow(
  codLinea: string,
  codLineaStr: string,
  nombreLinea: string,
): string {
  return `"${codLinea}","${codLineaStr}","${nombreLinea}","P01","Parada 1","Calle 1","${-4.4}","${36.7}","1"`
}

const validLatArb = fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true })
const validLonArb = fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true })
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('"') && !s.includes(',') && !s.includes('\n'))
const lineaCodeArb = fc.integer({ min: 1, max: 200 }).map(n => String(n))

describe('parseUbicacionesCSV — Property 1: forma y rangos válidos', () => {
  it('para cualquier CSV válido todos los objetos tienen codLinea no vacío y coordenadas en rango', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            codBus: nonEmptyStringArb,
            codLinea: lineaCodeArb,
            sentido: fc.integer({ min: 1, max: 2 }),
            lon: validLonArb,
            lat: validLatArb,
            codParIni: nonEmptyStringArb,
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (buses) => {
          const rows = buses.map(b =>
            serializeUbicacionRow(b.codBus, `${b.codLinea}.0`, b.sentido, b.lon, b.lat, b.codParIni, '2026-01-01 00:00:00'),
          )
          const csv = [UBICACIONES_HEADER, ...rows].join('\n')
          const result = parseUbicacionesCSV(csv)
          return result.every(b =>
            typeof b.codLinea === 'string' &&
            b.codLinea.length > 0 &&
            b.latitud >= -90 && b.latitud <= 90 &&
            b.longitud >= -180 && b.longitud <= 180,
          )
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('parseLineasCSV — Property 2: forma válida y sin duplicados', () => {
  it('para cualquier CSV válido los objetos tienen campos no vacíos y no hay codLinea duplicados', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            codLinea: lineaCodeArb,
            nombreLinea: nonEmptyStringArb,
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (lineas) => {
          const rows = lineas.map(l =>
            serializeLineaRow(`${l.codLinea}.0`, l.codLinea, l.nombreLinea),
          )
          const csv = [LINEAS_HEADER, ...rows].join('\n')
          const result = parseLineasCSV(csv)

          const allValid = result.every(l =>
            typeof l.codLinea === 'string' && l.codLinea.length > 0 &&
            typeof l.nombreLinea === 'string' && l.nombreLinea.length > 0,
          )
          const codLineas = result.map(l => l.codLinea)
          const noDuplicates = new Set(codLineas).size === codLineas.length
          return allValid && noDuplicates
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('parseUbicacionesCSV — Property 3: descarta filas inválidas sin lanzar excepción', () => {
  it('filas con coordenadas fuera de rango son descartadas; las válidas se preservan', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            codBus: nonEmptyStringArb,
            codLinea: lineaCodeArb,
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (buses) => {
          const validRows = buses.map(b =>
            serializeUbicacionRow(b.codBus, b.codLinea, 1, -4.4, 36.7, 'P01', '2026-01-01 00:00:00'),
          )
          const invalidRows = [
            serializeUbicacionRow('X99', '1', 1, 999, 999, 'P01', '2026-01-01 00:00:00'),
            '"","1","1","-4.4","36.7","P01","2026-01-01"',
            'columnas,insuficientes',
          ]
          const csv = [UBICACIONES_HEADER, ...validRows, ...invalidRows].join('\n')

          let result: ReturnType<typeof parseUbicacionesCSV> = []
          expect(() => { result = parseUbicacionesCSV(csv) }).not.toThrow()
          return result.length === buses.length
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('parseUbicacionesCSV — Property 4: trim de espacios en blanco', () => {
  it('el resultado es idéntico con o sin espacios en los campos', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            codBus: nonEmptyStringArb,
            codLinea: lineaCodeArb,
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (buses) => {
          const makeRow = (codBus: string, codLinea: string, spaces: boolean) =>
            serializeUbicacionRow(
              spaces ? ` ${codBus} ` : codBus,
              spaces ? ` ${codLinea} ` : codLinea,
              1, -4.4, 36.7, 'P01', '2026-01-01 00:00:00',
            )

          const csvClean = [UBICACIONES_HEADER, ...buses.map(b => makeRow(b.codBus, b.codLinea, false))].join('\n')
          const csvSpaced = [UBICACIONES_HEADER, ...buses.map(b => makeRow(b.codBus, b.codLinea, true))].join('\n')

          const resultClean = parseUbicacionesCSV(csvClean)
          const resultSpaced = parseUbicacionesCSV(csvSpaced)

          return JSON.stringify(resultClean) === JSON.stringify(resultSpaced)
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('parseUbicacionesCSV — edge cases', () => {
  it('devuelve [] con CSV vacío', () => {
    expect(parseUbicacionesCSV('')).toEqual([])
  })

  it('devuelve [] con solo el header', () => {
    expect(parseUbicacionesCSV(UBICACIONES_HEADER)).toEqual([])
  })

  it('parsea correctamente el formato real con comillas (RFC 4180)', () => {
    const csv = [
      '"codBus","codLinea","sentido","lon","lat","codParIni","last_update"',
      '"581","1.0","2","-4.456579","36.697693","1253","2026-05-25 19:45:06"',
    ].join('\n')
    const result = parseUbicacionesCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].codLinea).toBe('1')
    expect(result[0].codBus).toBe('581')
  })

  it('normaliza codLinea de float-string a entero-string', () => {
    const csv = [
      'codBus,codLinea,sentido,lon,lat,codParIni,last_update',
      '100,10.0,1,-4.4,36.7,P01,2026-01-01',
    ].join('\n')
    const result = parseUbicacionesCSV(csv)
    expect(result[0].codLinea).toBe('10')
  })
})

describe('parseLineasCSV — edge cases', () => {
  it('devuelve [] con CSV vacío', () => {
    expect(parseLineasCSV('')).toEqual([])
  })

  it('deduplica líneas repetidas', () => {
    const csv = [
      LINEAS_HEADER,
      serializeLineaRow('1.0', '1', 'Línea 1'),
      serializeLineaRow('1.0', '1', 'Línea 1'),
      serializeLineaRow('2.0', '2', 'Línea 2'),
    ].join('\n')
    const result = parseLineasCSV(csv)
    expect(result).toHaveLength(2)
  })
})

const SHAPES_HEADER = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence'
const TRIPS_HEADER = 'route_id,direction_id,shape_id'

const SAMPLE_SHAPES_CSV = [
  SHAPES_HEADER,
  'SH001,36.70,-4.40,1',
  'SH001,36.71,-4.41,2',
  'SH002,36.72,-4.42,1',
  'SH002,36.73,-4.43,2',
].join('\n')

const SAMPLE_TRIPS_CSV = [
  TRIPS_HEADER,
  '1,0,SH001',
  '1,0,SH001',
  '1,1,SH002',
  '2,0,SH003',
].join('\n')

describe('parseShapesCSV — edge cases', () => {
  it('devuelve Map vacío con CSV vacío', () => {
    expect(parseShapesCSV('', new Set(['SH001']))).toEqual(new Map())
  })

  it('devuelve Map vacío si faltan columnas obligatorias', () => {
    const csv = 'shape_id,shape_pt_lat\nSH001,36.70'
    expect(parseShapesCSV(csv, new Set(['SH001']))).toEqual(new Map())
  })

  it('devuelve solo los shapeIds solicitados', () => {
    const result = parseShapesCSV(SAMPLE_SHAPES_CSV, new Set(['SH001']))
    expect(result.has('SH001')).toBe(true)
    expect(result.has('SH002')).toBe(false)
    expect(result.get('SH001')).toHaveLength(2)
  })

  it('ordena los puntos por sequence ascendente', () => {
    const csv = [
      SHAPES_HEADER,
      'SH001,36.72,-4.42,3',
      'SH001,36.70,-4.40,1',
      'SH001,36.71,-4.41,2',
    ].join('\n')
    const result = parseShapesCSV(csv, new Set(['SH001']))
    const pts = result.get('SH001')!
    expect(pts[0].sequence).toBe(1)
    expect(pts[1].sequence).toBe(2)
    expect(pts[2].sequence).toBe(3)
  })

  it('Property: todos los puntos retornados pertenecen al shapeId solicitado', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }).map(String), { minLength: 1, maxLength: 3 }),
        (requestedIds) => {
          const result = parseShapesCSV(SAMPLE_SHAPES_CSV, new Set(requestedIds))
          for (const [sid] of result) {
            if (!requestedIds.includes(sid)) return false
          }
          return true
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('parseTripsMapping — edge cases', () => {
  it('devuelve Map vacío con CSV vacío', () => {
    expect(parseTripsMapping('')).toEqual(new Map())
  })

  it('devuelve Map vacío si faltan columnas obligatorias', () => {
    const csv = 'route_id,shape_id\n1,SH001'
    expect(parseTripsMapping(csv)).toEqual(new Map())
  })

  it('mapea direction_id 0 → sentido 1 y direction_id 1 → sentido 2', () => {
    const result = parseTripsMapping(SAMPLE_TRIPS_CSV)
    const linea1 = result.get('1')!
    expect(linea1.get(1)).toBe('SH001')
    expect(linea1.get(2)).toBe('SH002')
  })

  it('selecciona el shape_id más frecuente por ruta y sentido', () => {
    const csv = [
      TRIPS_HEADER,
      '1,0,SH001',
      '1,0,SH001',
      '1,0,SH099',
    ].join('\n')
    const result = parseTripsMapping(csv)
    expect(result.get('1')!.get(1)).toBe('SH001')
  })

  it('agrupa correctamente múltiples rutas', () => {
    const result = parseTripsMapping(SAMPLE_TRIPS_CSV)
    expect(result.has('1')).toBe(true)
    expect(result.has('2')).toBe(true)
    expect(result.get('2')!.get(1)).toBe('SH003')
  })
})
