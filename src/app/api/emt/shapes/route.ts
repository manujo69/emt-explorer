import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { EMT_SHAPES_URL, EMT_TRIPS_URL, LINEA_PARAM_REGEX } from '../constants'
import { parseShapesCSV, parseTripsMapping } from '@/shared/utils/csvParser'
import type { ShapesByDirection } from '@/features/emt/types/emt.types'

const CACHE_TTL_MS = 1_800_000

type CsvCache = { data: string; expiresAt: number }
const memCache: Record<string, CsvCache> = {}

const DISK_PATHS: Record<string, string> = {
  [EMT_SHAPES_URL]: join(process.cwd(), 'data', 'gtfs', 'shapes.csv'),
  [EMT_TRIPS_URL]: join(process.cwd(), 'data', 'gtfs', 'trips.csv'),
}

async function getCsv(url: string): Promise<string> {
  const now = Date.now()
  if (memCache[url] && now < memCache[url].expiresAt) return memCache[url].data

  let data: string
  try {
    data = await readFile(DISK_PATHS[url], 'utf-8')
  } catch {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error al obtener ${url}: ${res.statusText}`)
    data = await res.text()
  }

  memCache[url] = { data, expiresAt: now + CACHE_TTL_MS }
  return data
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const linea = request.nextUrl.searchParams.get('linea')

  if (!linea || linea.trim() === '') {
    return NextResponse.json(
      { error: 'El parámetro "linea" es obligatorio y no puede estar vacío' },
      { status: 400 },
    )
  }

  if (!LINEA_PARAM_REGEX.test(linea)) {
    return NextResponse.json(
      { error: 'El parámetro "linea" solo puede contener caracteres alfanuméricos y guiones' },
      { status: 400 },
    )
  }

  try {
    const [tripsCsv, shapesCsv] = await Promise.all([
      getCsv(EMT_TRIPS_URL),
      getCsv(EMT_SHAPES_URL),
    ])

    const tripsMap = parseTripsMapping(tripsCsv)
    const sentidoShapes = tripsMap.get(linea)

    if (!sentidoShapes || sentidoShapes.size === 0) {
      return NextResponse.json({} as ShapesByDirection)
    }

    const shapeIds = new Set(sentidoShapes.values())
    const shapeBuckets = parseShapesCSV(shapesCsv, shapeIds)

    const result: ShapesByDirection = {}
    for (const [sentido, shapeId] of sentidoShapes) {
      result[sentido] = shapeBuckets.get(shapeId) ?? []
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al procesar shapes: ${message}` },
      { status: 500 },
    )
  }
}
