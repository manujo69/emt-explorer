import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const GTFS_FILES = [
  {
    name: 'shapes.csv',
    url: 'https://datosabiertos.malaga.eu/recursos/transporte/EMT/lineasYHorarios/shapes.csv',
  },
  {
    name: 'trips.csv',
    url: 'https://datosabiertos.malaga.eu/recursos/transporte/EMT/lineasYHorarios/trips.csv',
  },
]

const OUT_DIR = join(process.cwd(), 'data', 'gtfs')

await mkdir(OUT_DIR, { recursive: true })

for (const { name, url } of GTFS_FILES) {
  process.stdout.write(`Downloading ${name}... `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error ${res.status} al descargar ${name}: ${res.statusText}`)
  const text = await res.text()
  await writeFile(join(OUT_DIR, name), text, 'utf-8')
  console.log(`${(text.length / 1024).toFixed(0)} KB`)
}

console.log('Ficheros GTFS descargados correctamente.')
