import { NextRequest, NextResponse } from 'next/server'
import { EMT_UBICACIONES_URL, LINEA_PARAM_REGEX } from '../constants'
import { parseUbicacionesCSV } from '@/shared/utils/csvParser'

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
    const res = await fetch(EMT_UBICACIONES_URL, { cache: 'no-store' })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al obtener ubicaciones del origen: ${res.statusText}` },
        { status: res.status },
      )
    }

    const csv = await res.text()
    const buses = parseUbicacionesCSV(csv)
    const filtrados = buses.filter(b => b.codLinea === linea)

    return NextResponse.json(filtrados, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al procesar ubicaciones: ${message}` },
      { status: 500 },
    )
  }
}
