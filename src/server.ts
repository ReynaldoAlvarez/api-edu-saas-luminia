import { createApp } from './app';
import { 
  initializeDatabase, 
  setupDatabaseCleanup 
} from '@/shared/database/connection';
import { env, isDevelopment } from '@/config/environment';
import logger from '@/shared/utils/logger';

/**
 * Configuración e inicio del servidor HTTP
 * Maneja la inicialización completa de la aplicación
 */

/**
 * Función para inicializar todos los servicios de la aplicación
 * @returns Promise que resuelve cuando todos los servicios están listos
 */
const initializeServices = async (): Promise<void> => {
  try {
    logger.info('🚀 Iniciando servicios de la aplicación...');

    // Inicializar conexión a la base de datos
    logger.info('📊 Inicializando base de datos...');
    await initializeDatabase();
    logger.info('✅ Base de datos inicializada correctamente');

    // TODO: Aquí se inicializarán otros servicios
    // - Redis connection
    // - External API connections
    // - Background job queues
    // - etc.

    logger.info('🎉 Todos los servicios inicializados correctamente');
  } catch (error) {
    logger.error('💥 Error al inicializar servicios:', error);
    throw error;
  }
};

/**
 * Función para iniciar el servidor HTTP
 * @returns Promise que resuelve cuando el servidor está escuchando
 */
const startServer = async (): Promise<void> => {
  try {
    // Crear la aplicación Express
    const app = createApp();

    // Inicializar servicios
    await initializeServices();

    // Configurar manejo de cierre graceful
    setupDatabaseCleanup();

    // Iniciar el servidor
    const server = app.listen(env.PORT, () => {
      logger.info('🌟 Servidor iniciado exitosamente', {
        port: env.PORT,
        environment: env.NODE_ENV,
        processId: process.pid,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      });

      // Mostrar información adicional en desarrollo
      if (isDevelopment()) {
        logger.info('🔗 URLs disponibles:', {
          local: `http://localhost:${env.PORT}`,
          health: `http://localhost:${env.PORT}/health`,
          api: `http://localhost:${env.PORT}/api/v1`,
        });
      }
    });

    // Configurar timeout del servidor
    server.timeout = 30000; // 30 segundos

    // Manejar errores del servidor
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`💥 Puerto ${env.PORT} ya está en uso`);
        process.exit(1);
      } else {
        logger.error('💥 Error del servidor:', error);
        process.exit(1);
      }
    });

    // Manejar cierre graceful del servidor
    const gracefulShutdown = (signal: string) => {
      logger.info(`🛑 Recibida señal ${signal}. Cerrando servidor...`);
      
      server.close(async (error) => {
        if (error) {
          logger.error('❌ Error al cerrar servidor:', error);
          process.exit(1);
        }
        
        logger.info('✅ Servidor cerrado correctamente');
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('⏰ Timeout alcanzado. Forzando cierre...');
        process.exit(1);
      }, 10000);
    };

    // Registrar manejadores de señales
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('💥 Error fatal al iniciar servidor:', error);
    process.exit(1);
  }
};

/**
 * Función principal que inicia toda la aplicación
 */
const main = async (): Promise<void> => {
  try {
    // Mostrar banner de inicio
    logger.info('🎓 Educational SaaS API');
    logger.info('📅 Iniciando aplicación...', {
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
    });

    // Validar variables de entorno críticas
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada');
    }

    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
    }

    // Iniciar servidor
    await startServer();

  } catch (error) {
    logger.error('💥 Error fatal en main:', error);
    process.exit(1);
  }
};

// Manejar errores no capturados globalmente
process.on('uncaughtException', (error) => {
  logger.error('💥 Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promesa rechazada no manejada:', {
    reason,
    promise,
  });
  process.exit(1);
});

// Ejecutar la aplicación solo si este archivo es el punto de entrada
if (require.main === module) {
  main().catch((error) => {
    logger.error('💥 Error en punto de entrada:', error);
    process.exit(1);
  });
}

// Exportar funciones para testing
export { startServer, initializeServices };