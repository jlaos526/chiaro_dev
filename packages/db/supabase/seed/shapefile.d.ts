// Minimal ambient declaration for the `shapefile` package, which ships
// without types. We only use `open()` from this module.
declare module 'shapefile' {
  type ShapefileGeometry =
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: 'Point'; coordinates: number[] }
    | { type: 'LineString'; coordinates: number[][] }
    | { type: string; coordinates: unknown }

  export function open(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array | null,
    options?: { encoding?: string },
  ): Promise<{
    read(): Promise<{
      done: boolean
      value: {
        type: string
        properties: Record<string, unknown>
        geometry: ShapefileGeometry
      }
    }>
    bbox?: number[]
  }>
}
