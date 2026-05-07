import { z } from 'zod'

export const addressInputSchema = z.object({
  address: z.string().trim().min(5).max(200),
})

export const gpsInputSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
})

export const calibrateInputSchema = z.union([addressInputSchema, gpsInputSchema])

export type AddressInput = z.infer<typeof addressInputSchema>
export type GpsInput = z.infer<typeof gpsInputSchema>
export type CalibrateInput = z.infer<typeof calibrateInputSchema>
