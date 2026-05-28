import { NextRequest, NextResponse } from 'next/server'
import { EMT_LINEAS_URL, LINEA_PARAM_REGEX } from '../constants'
import { parseParadasCSV } from '@/shared/utils/csvParser'

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
    const res = await fetch(EMT_LINEAS_URL, { next: { revalidate: 1800 } })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al obtener paradas del origen: ${res.statusText}` },
        { status: res.status },
      )
    }

    const csv = await res.text()
    const paradas = parseParadasCSV(csv)
    const filtradas = paradas
      .filter(p => p.codLinea === linea)
      .sort((a, b) => a.sentido - b.sentido || a.orden - b.orden)

    return NextResponse.json(filtradas)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al procesar paradas: ${message}` },
      { status: 500 },
    )
  }
}
