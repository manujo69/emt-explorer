import type { BusUbicacion, LineaEMT, ParadaEMT, ShapePoint } from '@/features/emt/types/emt.types'

function detectDelimiter(header: string): ',' | ';' {
  const commaCount = (header.match(/,/g) ?? []).length
  const semicolonCount = (header.match(/;/g) ?? []).length
  return semicolonCount > commaCount ? ';' : ','
}

function parseCSVLine(line: string, delimiter: ',' | ';'): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
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

function normalizeCodLinea(raw: string): string {
  return raw.trim().replace(/\.0$/, '')
}

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
    if (fields.length !== headers.length) continue

    const codBus = fields[idx.codBus]?.trim() ?? ''
    const codLineaRaw = fields[idx.codLinea]?.trim() ?? ''
    const codLinea = normalizeCodLinea(codLineaRaw)
    const sentidoRaw = fields[idx.sentido]?.trim() ?? ''
    const lonRaw = fields[idx.lon]?.trim() ?? ''
    const latRaw = fields[idx.lat]?.trim() ?? ''
    const codParIni = fields[idx.codParIni]?.trim() ?? ''
    const lastUpdate = fields[idx.lastUpdate]?.trim() ?? ''

    if (!codBus || !codLinea) continue

    const longitud = parseFloat(lonRaw)
    const latitud = parseFloat(latRaw)
    const sentido = parseInt(sentidoRaw, 10)

    if (!isFinite(latitud) || latitud < -90 || latitud > 90) continue
    if (!isFinite(longitud) || longitud < -180 || longitud > 180) continue
    if (!isFinite(sentido)) continue

    result.push({ codBus, codLinea, sentido, longitud, latitud, codParIni, lastUpdate })
  }

  return result
}

export function parseLineasCSV(csv: string): LineaEMT[] {
  const lines = csv.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim())

  const codLineaStrIdx = headers.indexOf('codLineaStr')
  const codLineaIdx = headers.indexOf('codLinea')
  const nombreLineaIdx = headers.indexOf('nombreLinea')
  const cabeceraIdaIdx = headers.indexOf('cabeceraIda')
  const cabeceraVueltaIdx = headers.indexOf('cabeceraVuelta')

  const useCodeStr = codLineaStrIdx !== -1
  const sourceIdx = useCodeStr ? codLineaStrIdx : codLineaIdx

  if (sourceIdx === -1 || nombreLineaIdx === -1) return []

  const seen = new Set<string>()
  const result: LineaEMT[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)
    if (fields.length !== headers.length) continue

    const codLineaRaw = fields[sourceIdx]?.trim() ?? ''
    const codLinea = useCodeStr ? codLineaRaw : normalizeCodLinea(codLineaRaw)
    const nombreLinea = fields[nombreLineaIdx]?.trim() ?? ''
    const cabeceraIda = cabeceraIdaIdx !== -1 ? (fields[cabeceraIdaIdx]?.trim() ?? '') : ''
    const cabeceraVuelta = cabeceraVueltaIdx !== -1 ? (fields[cabeceraVueltaIdx]?.trim() ?? '') : ''

    if (!codLinea || !nombreLinea) continue
    if (seen.has(codLinea)) continue

    seen.add(codLinea)
    result.push({ codLinea, nombreLinea, cabeceraIda, cabeceraVuelta })
  }

  return result
}

export function parseParadasCSV(csv: string): ParadaEMT[] {
  const lines = csv.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim())

  const codLineaStrIdx = headers.indexOf('codLineaStr')
  const codLineaIdx = headers.indexOf('codLinea')
  const sentidoIdx = headers.indexOf('sentido')
  const ordenIdx = headers.indexOf('orden')
  const codParadaIdx = headers.indexOf('codParada')
  const nombreParadaIdx = headers.indexOf('nombreParada')
  const lonIdx = headers.indexOf('lon')
  const latIdx = headers.indexOf('lat')

  const useCodeStr = codLineaStrIdx !== -1
  const sourceIdx = useCodeStr ? codLineaStrIdx : codLineaIdx

  if (sourceIdx === -1 || sentidoIdx === -1 || ordenIdx === -1 || codParadaIdx === -1) return []

  const result: ParadaEMT[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)
    if (fields.length !== headers.length) continue

    const codLineaRaw = fields[sourceIdx]?.trim() ?? ''
    const codLinea = useCodeStr ? codLineaRaw : normalizeCodLinea(codLineaRaw)
    const codParada = fields[codParadaIdx]?.trim() ?? ''
    const nombreParada = nombreParadaIdx !== -1 ? (fields[nombreParadaIdx]?.trim() ?? '') : ''
    const sentido = parseInt(fields[sentidoIdx]?.trim() ?? '', 10)
    const orden = parseInt(fields[ordenIdx]?.trim() ?? '', 10)
    const longitud = parseFloat(lonIdx !== -1 ? (fields[lonIdx]?.trim() ?? '') : '')
    const latitud = parseFloat(latIdx !== -1 ? (fields[latIdx]?.trim() ?? '') : '')

    if (!codLinea || !codParada) continue
    if (!isFinite(sentido) || !isFinite(orden)) continue
    if (!isFinite(latitud) || latitud < -90 || latitud > 90) continue
    if (!isFinite(longitud) || longitud < -180 || longitud > 180) continue

    result.push({ codLinea, codParada, nombreParada, sentido, orden, longitud, latitud })
  }

  return result
}

export function parseShapesCSV(csv: string, shapeIds: Set<string>): Map<string, ShapePoint[]> {
  const lines = csv.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return new Map()

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim())

  const shapeIdIdx = headers.indexOf('shape_id')
  const latIdx = headers.indexOf('shape_pt_lat')
  const lonIdx = headers.indexOf('shape_pt_lon')
  const seqIdx = headers.indexOf('shape_pt_sequence')

  if (shapeIdIdx === -1 || latIdx === -1 || lonIdx === -1 || seqIdx === -1) return new Map()

  const buckets = new Map<string, ShapePoint[]>()

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)
    if (fields.length < headers.length) continue

    const sid = fields[shapeIdIdx]?.trim() ?? ''
    if (!shapeIds.has(sid)) continue

    const latitud = parseFloat(fields[latIdx]?.trim() ?? '')
    const longitud = parseFloat(fields[lonIdx]?.trim() ?? '')
    const sequence = parseInt(fields[seqIdx]?.trim() ?? '', 10)

    if (!isFinite(latitud) || !isFinite(longitud) || !isFinite(sequence)) continue

    if (!buckets.has(sid)) buckets.set(sid, [])
    buckets.get(sid)!.push({ latitud, longitud, sequence })
  }

  for (const pts of buckets.values()) pts.sort((a, b) => a.sequence - b.sequence)

  return buckets
}

/**
 * Devuelve el shape_id más frecuente por (route_id, direction_id).
 * direction_id 0 → sentido 1 (ida), direction_id 1 → sentido 2 (vuelta).
 * Resultado: route_id → Map<sentido, shapeId>
 */
export function parseTripsMapping(csv: string): Map<string, Map<number, string>> {
  const lines = csv.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return new Map()

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim())

  const routeIdIdx = headers.indexOf('route_id')
  const dirIdx = headers.indexOf('direction_id')
  const shapeIdIdx = headers.indexOf('shape_id')
  if (routeIdIdx === -1 || dirIdx === -1 || shapeIdIdx === -1) return new Map()

  // route_id → direction_id → shape_id → count
  const counts = new Map<string, Map<number, Map<string, number>>>()

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)
    if (fields.length < headers.length) continue

    const routeId = fields[routeIdIdx]?.trim()
    const dirRaw = parseInt(fields[dirIdx]?.trim() ?? '', 10)
    const shapeId = fields[shapeIdIdx]?.trim()
    if (!routeId || !shapeId || !isFinite(dirRaw)) continue

    const sentido = dirRaw === 0 ? 1 : 2

    if (!counts.has(routeId)) counts.set(routeId, new Map())
    const byDir = counts.get(routeId)!
    if (!byDir.has(sentido)) byDir.set(sentido, new Map())
    const byShape = byDir.get(sentido)!
    byShape.set(shapeId, (byShape.get(shapeId) ?? 0) + 1)
  }

  // Pick the most frequent shape_id per route+sentido
  const result = new Map<string, Map<number, string>>()
  for (const [routeId, byDir] of counts) {
    const sentidoMap = new Map<number, string>()
    for (const [sentido, byShape] of byDir) {
      let best = ''
      let bestCount = 0
      for (const [shapeId, count] of byShape) {
        if (count > bestCount) { best = shapeId; bestCount = count }
      }
      if (best) sentidoMap.set(sentido, best)
    }
    result.set(routeId, sentidoMap)
  }
  return result
}
