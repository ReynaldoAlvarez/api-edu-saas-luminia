import winston from 'winston';
import path from 'path';
import { env, isDevelopment, isProduction } from '@/config/environment';

/**
 * Configuración del sistema de logging usando Winston
 * Proporciona logging estructurado con diferentes niveles y formatos
 */

/**
 * Configuración de colores para los diferentes niveles de log
 */
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
} as const;

// Aplicar colores a Winston
winston.addColors(logColors);

/**
 * Formato personalizado para logs en desarrollo
 * Incluye timestamp, nivel, mensaje y metadata adicional
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Formatear metadata adicional si existe
    const metaString = Object.keys(meta).length > 0 
      ? `\n${JSON.stringify(meta, null, 2)}` 
      : '';
    
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * Formato para logs en producción
 * JSON estructurado para mejor parsing por sistemas de monitoreo
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

/**
 * Configuración de transports (destinos de los logs)
 */
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [];

  // Console transport - siempre presente
  transports.push(
    new winston.transports.Console({
      level: env.LOG_LEVEL,
      format: isDevelopment() ? developmentFormat : productionFormat,
    })
  );

  // File transport - solo en producción o si se especifica
  if (isProduction() || env.LOG_FILE_PATH) {
    // Asegurar que el directorio de logs existe
    const logDir = path.dirname(env.LOG_FILE_PATH);
    
    // Log general
    transports.push(
      new winston.transports.File({
        filename: env.LOG_FILE_PATH,
        level: env.LOG_LEVEL,
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );

    // Log solo de errores
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return transports;
};

/**
 * Crear instancia del logger principal
 */
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: isDevelopment() ? developmentFormat : productionFormat,
  transports: createTransports(),
  
  // Configuración adicional
  exitOnError: false, // No salir del proceso en errores
  silent: env.NODE_ENV === 'test', // Silenciar en tests
});

/**
 * Función helper para logging de requests HTTP
 * @param method - Método HTTP
 * @param url - URL del request
 * @param statusCode - Código de estado de la respuesta
 * @param responseTime - Tiempo de respuesta en ms
 * @param userAgent - User agent del cliente
 * @param ip - IP del cliente
 */
export const logHttpRequest = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  userAgent?: string,
  ip?: string
): void => {
  const logData = {
    type: 'http_request',
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    userAgent,
    ip,
  };

  // Determinar nivel de log basado en status code
  if (statusCode >= 500) {
    logger.error('HTTP Request Error', logData);
  } else if (statusCode >= 400) {
    logger.warn('HTTP Request Warning', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

/**
 * Función helper para logging de errores de base de datos
 * @param operation - Operación que falló
 * @param error - Error ocurrido
 * @param query - Query que causó el error (opcional)
 */
export const logDatabaseError = (
  operation: string,
  error: Error,
  query?: string
): void => {
  logger.error('Database Error', {
    type: 'database_error',
    operation,
    error: error.message,
    stack: error.stack,
    query,
  });
};

/**
 * Función helper para logging de eventos de autenticación
 * @param event - Tipo de evento (login, logout, failed_login, etc.)
 * @param userId - ID del usuario (si aplica)
 * @param ip - IP del cliente
 * @param userAgent - User agent del cliente
 * @param details - Detalles adicionales
 */
export const logAuthEvent = (
  event: string,
  userId?: string,
  ip?: string,
  userAgent?: string,
  details?: Record<string, unknown>
): void => {
  logger.info('Authentication Event', {
    type: 'auth_event',
    event,
    userId,
    ip,
    userAgent,
    ...details,
  });
};

/**
 * Función helper para logging de eventos de API
 * @param event - Tipo de evento
 * @param clientId - ID del cliente API
 * @param endpoint - Endpoint accedido
 * @param details - Detalles adicionales
 */
export const logApiEvent = (
  event: string,
  clientId?: string,
  endpoint?: string,
  details?: Record<string, unknown>
): void => {
  logger.info('API Event', {
    type: 'api_event',
    event,
    clientId,
    endpoint,
    ...details,
  });
};

/**
 * Función helper para logging de eventos de negocio
 * @param event - Tipo de evento de negocio
 * @param institutionId - ID de la institución
 * @param userId - ID del usuario
 * @param details - Detalles del evento
 */
export const logBusinessEvent = (
  event: string,
  institutionId?: string,
  userId?: string,
  details?: Record<string, unknown>
): void => {
  logger.info('Business Event', {
    type: 'business_event',
    event,
    institutionId,
    userId,
    ...details,
  });
};

// Exportar el logger principal y las funciones helper
export default logger;
export { logger };