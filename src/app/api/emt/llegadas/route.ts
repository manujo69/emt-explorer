import { NextRequest, NextResponse } from 'next/server'
import { EMT_LINEAS_URL, EMT_UBICACIONES_URL, LINEA_PARAM_REGEX } from '../constants'
import { parseParadasCSV, parseLineasCSV, parseUbicacionesCSV } from '@/shared/utils/csvParser'
import { haversineMeters } from '@/shared/utils/haversine'
import type { LlegadaLinea } from '@/features/emt/types/emt.types'

const VELOCIDAD_M_POR_MIN = 200
const EMT_PARADA_URL = 'https://www.emtmalaga.es/emt-mobile/informacionParada.html'

function parseInformacionParadaHTML(html: string): LlegadaLinea[] {
  const resultado: LlegadaLinea[] = []

  const ulMatch = html.match(/<ul[^>]*data-role="listview"[^>]*>([\s\S]*?)<\/ul>/)
  if (!ulMatch) return resultado

  const items = ulMatch[1].split('<li>').slice(1)

  for (const item of items) {
    const lineaMatch = item.match(/title="([^"]+)"/)
    if (!lineaMatch) continue
    const codLinea = lineaMatch[1].trim()

    const sentidoMatch = item.match(/sentido=(\d)/)
    const sentido = sentidoMatch ? parseInt(sentidoMatch[1], 10) : 1

    const destinoMatch = item.match(/<span class="direccion">\s*([\s\S]*?)\s*<\/span>/)
    const destino = destinoMatch ? destinoMatch[1].replace(/\s+/g, ' ').trim() : ''

    const minutosMatch = item.match(/(\d+)\s*min\./)
    if (!minutosMatch) continue
    const minutos = parseInt(minutosMatch[1], 10)

    resultado.push({
      codLinea,
      nombreLinea: codLinea,
      sentido,
      destino,
      proximoBus: { codBus: '', minutos },
    })
  }

  resultado.sort((a, b) => a.proximoBus.minutos - b.proximoBus.minutos)
  return resultado
}

async function fetchLlegadasEMT(codParada: string): Promise<LlegadaLinea[]> {
  const res = await fetch(`${EMT_PARADA_URL}?codParada=${encodeURIComponent(codParada)}`, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; emt-explorer/1.0)',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  return parseInformacionParadaHTML(html)
}

async function calcularLlegadasHaversine(parada: string): Promise<LlegadaLinea[]> {
  const [lineasRes, ubicacionesRes] = await Promise.all([
    fetch(EMT_LINEAS_URL, { next: { revalidate: 1800 } }),
    fetch(EMT_UBICACIONES_URL, { cache: 'no-store' }),
  ])

  if (!lineasRes.ok) throw new Error(`Error al obtener paradas: ${lineasRes.statusText}`)
  if (!ubicacionesRes.ok) throw new Error(`Error al obtener ubicaciones: ${ubicacionesRes.statusText}`)

  const lineasCsv = await lineasRes.text()
  const ubicacionesCsv = await ubicacionesRes.text()

  const todasParadas = parseParadasCSV(lineasCsv)
  const lineasMeta = parseLineasCSV(lineasCsv)
  const buses = parseUbicacionesCSV(ubicacionesCsv)

  const paradaRows = todasParadas.filter(p => p.codParada === parada)
  if (paradaRows.length === 0) return []

  const lineaMetaMap = new Map(lineasMeta.map(l => [l.codLinea, l]))
  const pairs = Array.from(
    new Map(paradaRows.map(r => [`${r.codLinea}-${r.sentido}`, r])).values(),
  )

  const resultado: LlegadaLinea[] = []

  for (const paradaTarget of pairs) {
    const { codLinea, sentido, orden: targetOrden } = paradaTarget

    const ruta = todasParadas
      .filter(p => p.codLinea === codLinea && p.sentido === sentido)
      .sort((a, b) => a.orden - b.orden)

    if (ruta.length === 0) continue

    const targetIdx = ruta.findIndex(p => p.orden === targetOrden)
    if (targetIdx < 0) continue

    const meta = lineaMetaMap.get(codLinea)
    const nombreLinea = meta?.nombreLinea ?? codLinea
    const destino = sentido === 1 ? (meta?.cabeceraIda ?? '') : (meta?.cabeceraVuelta ?? '')

    const busesLinea = buses.filter(b => b.codLinea === codLinea && b.sentido === sentido)
    const busIdxMap = new Map<string, number>()

    for (const bus of busesLinea) {
      let busIdx = ruta.findIndex(p => p.codParada === bus.codParIni)

      if (busIdx < 0) {
        let nearestDist = Infinity
        for (let i = 0; i < ruta.length; i++) {
          const dist = haversineMeters(
            { latitud: bus.latitud, longitud: bus.longitud },
            { latitud: ruta[i].latitud, longitud: ruta[i].longitud },
          )
          if (dist < nearestDist) {
            nearestDist = dist
            busIdx = i
          }
        }
      }

      busIdxMap.set(bus.codBus, busIdx)
    }

    let proximoMinutos = Infinity
    let proximoCodBus = ''

    for (const bus of busesLinea) {
      const busIdx = busIdxMap.get(bus.codBus) ?? -1
      if (busIdx < 0 || busIdx <= targetIdx) continue

      let metros = haversineMeters(
        { latitud: bus.latitud, longitud: bus.longitud },
        { latitud: ruta[busIdx - 1].latitud, longitud: ruta[busIdx - 1].longitud },
      )
      for (let i = busIdx - 1; i > targetIdx; i--) {
        metros += haversineMeters(
          { latitud: ruta[i].latitud, longitud: ruta[i].longitud },
          { latitud: ruta[i - 1].latitud, longitud: ruta[i - 1].longitud },
        )
      }
      const minutos = Math.round(metros / VELOCIDAD_M_POR_MIN)
      if (minutos < proximoMinutos) {
        proximoMinutos = minutos
        proximoCodBus = bus.codBus
      }
    }

    if (proximoCodBus === '') continue

    resultado.push({
      codLinea,
      nombreLinea,
      sentido,
      destino,
      proximoBus: { codBus: proximoCodBus, minutos: proximoMinutos },
    })
  }

  resultado.sort((a, b) => a.proximoBus.minutos - b.proximoBus.minutos)
  return resultado
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parada = request.nextUrl.searchParams.get('parada')

  if (!parada || parada.trim() === '') {
    return NextResponse.json(
      { error: 'El parámetro "parada" es obligatorio y no puede estar vacío' },
      { status: 400 },
    )
  }

  if (!LINEA_PARAM_REGEX.test(parada)) {
    return NextResponse.json(
      { error: 'El parámetro "parada" solo puede contener caracteres alfanuméricos y guiones' },
      { status: 400 },
    )
  }

  try {
    const llegadas = await fetchLlegadasEMT(parada)
    if (llegadas.length > 0) {
      console.log(`[llegadas] parada=${parada} source=EMT items=${llegadas.length}`, llegadas.map(l => `${l.codLinea}→${l.destino} ${l.proximoBus.minutos}min`))
      return NextResponse.json(llegadas)
    }
  } catch (err) {
    console.warn(`[llegadas] parada=${parada} EMT fetch failed, using haversine fallback:`, err)
  }

  try {
    const llegadas = await calcularLlegadasHaversine(parada)
    return NextResponse.json(llegadas)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al calcular llegadas: ${message}` },
      { status: 500 },
    )
  }
}
