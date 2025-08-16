import prisma, { connectDatabase, disconnectDatabase } from './prisma';
import { env } from '@/config/environment';

/**
 * Configuración y manejo de la conexión a la base de datos
 * Incluye retry logic y manejo de errores robusto
 */

/**
 * Configuración de reintentos para la conexión
 */
const CONNECTION_CONFIG = {
  maxRetries: 5,
  retryDelay: 2000, // 2 segundos
  backoffMultiplier: 1.5,
} as const;

/**
 * Función para esperar un tiempo determinado
 * @param ms - Milisegundos a esperar
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Función para inicializar la conexión a la base de datos con reintentos
 * Implementa exponential backoff para los reintentos
 */
export const initializeDatabase = async (): Promise<void> => {
  let retries = 0;
  let delay: number = CONNECTION_CONFIG.retryDelay;

  while (retries < CONNECTION_CONFIG.maxRetries) {
    try {
      console.log(`🔄 Intentando conectar a la base de datos (intento ${retries + 1}/${CONNECTION_CONFIG.maxRetries})`);
      
      await connectDatabase();
      
      // Si llegamos aquí, la conexión fue exitosa
      console.log('🎉 Base de datos inicializada correctamente');
      return;
      
    } catch (error) {
      retries++;
      
      if (retries >= CONNECTION_CONFIG.maxRetries) {
        console.error('💥 Se agotaron los intentos de conexión a la base de datos');
        throw new Error(`No se pudo conectar a la base de datos después de ${CONNECTION_CONFIG.maxRetries} intentos`);
      }
      
      console.warn(`⚠️ Error en intento ${retries}. Reintentando en ${delay}ms...`);
      console.warn('Error:', error instanceof Error ? error.message : 'Error desconocido');
      
      // Esperar antes del siguiente intento
      await sleep(delay);
      
      // Incrementar el delay para el siguiente intento (exponential backoff)
      delay = Math.floor(delay * CONNECTION_CONFIG.backoffMultiplier);
    }
  }
};

/**
 * Función para cerrar la conexión de manera segura
 * Maneja el cierre graceful de la aplicación
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    console.log('🔄 Cerrando conexión a la base de datos...');
    await disconnectDatabase();
  } catch (error) {
    console.error('❌ Error al cerrar la conexión:', error);
    throw error;
  }
};

/**
 * Función para configurar los manejadores de señales del proceso
 * Asegura que la base de datos se cierre correctamente al terminar la aplicación
 */
export const setupDatabaseCleanup = (): void => {
  // Manejar SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('\n🛑 Recibida señal SIGINT. Cerrando aplicación...');
    await closeDatabase();
    process.exit(0);
  });

  // Manejar SIGTERM (terminación del proceso)
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Recibida señal SIGTERM. Cerrando aplicación...');
    await closeDatabase();
    process.exit(0);
  });

  // Manejar errores no capturados
  process.on('uncaughtException', async (error) => {
    console.error('💥 Error no capturado:', error);
    await closeDatabase();
    process.exit(1);
  });

  // Manejar promesas rechazadas no manejadas
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Promesa rechazada no manejada:', reason);
    console.error('En promesa:', promise);
    await closeDatabase();
    process.exit(1);
  });
};

// Exportar el cliente prisma para uso directo
export { prisma };