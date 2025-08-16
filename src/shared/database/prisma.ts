import { PrismaClient } from '@prisma/client';
import { env } from '@/config/environment';

/**
 * Configuración del cliente Prisma con singleton pattern
 * Esto asegura que solo tengamos una instancia de Prisma en toda la aplicación
 */

// Declaración global para el cliente Prisma en desarrollo
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Función para crear una nueva instancia del cliente Prisma
 * @returns Nueva instancia de PrismaClient configurada
 */
const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    // Configuración de logging basada en el entorno
    log: env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error'] 
      : ['error'],
    
    // Configuración de manejo de errores
    errorFormat: 'pretty',
    
    // Configuración de datasources (opcional, ya está en schema.prisma)
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });
};

/**
 * Cliente Prisma singleton
 * En desarrollo usa globalThis para evitar múltiples instancias durante hot reload
 * En producción crea una nueva instancia
 */
const prisma = globalThis.__prisma ?? createPrismaClient();

// En desarrollo, guardar la instancia globalmente para reutilizar
if (env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

/**
 * Función para conectar a la base de datos
 * Verifica la conexión y maneja errores
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Verificar conexión con una consulta simple
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos establecida correctamente');
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
    throw new Error('No se pudo conectar a la base de datos');
  }
};

/**
 * Función para desconectar de la base de datos
 * Útil para cerrar conexiones al terminar la aplicación
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ Desconexión de la base de datos exitosa');
  } catch (error) {
    console.error('❌ Error al desconectar de la base de datos:', error);
  }
};

/**
 * Función para verificar el estado de la base de datos
 * Útil para health checks
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    // Realizar una consulta simple para verificar conectividad
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Health check de base de datos falló:', error);
    return false;
  }
};

// Exportar el cliente Prisma como default
export default prisma;

// Exportar el cliente también con nombre para flexibilidad
export { prisma };