import { z } from 'zod';
import dotenv from 'dotenv';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

/**
 * Schema de validación para las variables de entorno
 * Utiliza Zod para validar que todas las variables requeridas estén presentes
 * y tengan el formato correcto
 */
const envSchema = z.object({
  // Configuración del servidor
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).default(3000),
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),

  // Configuración de base de datos
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(val => parseInt(val, 10)).default(5432),
  DB_NAME: z.string().min(1, 'DB_NAME es requerida'),
  DB_USER: z.string().min(1, 'DB_USER es requerido'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD es requerida'),

  // Configuración de seguridad
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val, 10)).default(12),

  // Configuración de Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(val => parseInt(val, 10)).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(val => parseInt(val, 10)).default(0),

  // Configuración de CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default(true),

  // Configuración de Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val, 10)).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(val => parseInt(val, 10)).default(100),

  // Configuración de archivos
  MAX_FILE_SIZE: z.string().transform(val => parseInt(val, 10)).default(10485760),
  ALLOWED_FILE_TYPES: z.string().default('jpg,jpeg,png,pdf,doc,docx'),
  UPLOAD_PATH: z.string().default('./uploads'),

  // Configuración de logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),

  // Configuración de desarrollo
  SWAGGER_ENABLED: z.string().transform(val => val === 'true').default(true),
  DEBUG_MODE: z.string().transform(val => val === 'true').default(false),
});

/**
 * Función para validar y parsear las variables de entorno
 * @returns Objeto con las variables de entorno validadas y parseadas
 * @throws Error si alguna variable requerida falta o tiene formato incorrecto
 */
const validateEnvironment = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Variables de entorno inválidas:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

// Exportar las variables de entorno validadas
export const env = validateEnvironment();

/**
 * Función helper para verificar si estamos en desarrollo
 */
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';

/**
 * Función helper para verificar si estamos en producción
 */
export const isProduction = (): boolean => env.NODE_ENV === 'production';

/**
 * Función helper para verificar si estamos en testing
 */
export const isTest = (): boolean => env.NODE_ENV === 'test';

/**
 * Función helper para obtener la URL completa de la API
 */
export const getApiUrl = (): string => `${env.API_PREFIX}/${env.API_VERSION}`;

/**
 * Función helper para obtener los orígenes permitidos para CORS
 */
export const getCorsOrigins = (): string[] => {
  return env.CORS_ORIGIN.split(',').map(origin => origin.trim());
};

/**
 * Función helper para obtener los tipos de archivo permitidos
 */
export const getAllowedFileTypes = (): string[] => {
  return env.ALLOWED_FILE_TYPES.split(',').map(type => type.trim());
};