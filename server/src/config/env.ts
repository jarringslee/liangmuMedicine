import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DEEPSEEK_API_KEY: z.string().optional(),
  JWT_SECRET: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().min(32, 'JWT_SECRET must contain at least 32 characters').optional(),
  ),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.JWT_SECRET) {
    context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET is required in production' })
  }
})

export const env = envSchema.parse(process.env)
