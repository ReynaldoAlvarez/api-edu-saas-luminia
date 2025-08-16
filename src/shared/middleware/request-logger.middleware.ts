import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import logger, { logHttpRequest } from '@/shared/utils/logger';
import { isDevelopment, env } from '@/config/environment';

/**
 * Middleware para logging de requests HTTP
 * Utiliza Morgan para logging estructurado y Winston para persistencia
 */

/**
 * Interface extendida para Request con información adicional
 */
interface RequestWithId extends Request {
  id?: string;
  startTime?: number;
}

/**
 * Middleware para agregar ID único a cada request
 * Útil para tracking y debugging
 */
export const addRequestId = (req: RequestWithId, res: Response, next: NextFunction): void => {
  // Generar ID único para el request
  req.id = uuidv4();
  
  // Agregar timestamp de inicio
  req.startTime = Date.now();
  
  // Agregar el ID al header de respuesta para debugging
  res.setHeader('X-Request-ID', req.id);
  
  next();
};

/**
 * Función para crear tokens personalizados de Morgan
 */
const createMorganTokens = (): void => {
  // Token para el ID del request
  morgan.token('id', (req: RequestWithId) => req.id || 'unknown');
  
  // Token para el tiempo de respuesta en formato personalizado
  morgan.token('response-time-ms', (req: RequestWithId, res: Response) => {
    if (!req.startTime) return '0ms';
    const responseTime = Date.now() - req.startTime;
    return `${responseTime}ms`;
  });
  
  // Token para el tamaño del body del request
  morgan.token('req-size', (req: Request) => {
    const contentLength = req.get('content-length');
    return contentLength ? `${contentLength}B` : '0B';
  });
  
  // Token para información del usuario autenticado
  morgan.token('user-id', (req: any) => {
    return req.user?.id || 'anonymous';
  });
  
  // Token para la institución
  morgan.token('institution-id', (req: any) => {
    return req.institutionId || 'none';
  });
  
  // Token para el user agent simplificado
  morgan.token('user-agent-short', (req: Request) => {
    const userAgent = req.get('User-Agent') || '';
    // Extraer información básica del user agent
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Postman')) return 'Postman';
    if (userAgent.includes('curl')) return 'curl';
    return 'Other';
  });
};

/**
 * Formato de log para desarrollo
 * Más legible y con colores
 */
const developmentFormat = [
  '🔍 :id',
  ':method :url',
  ':status',
  ':response-time-ms',
  '- :user-agent-short',
  '(:user-id)',
].join(' ');

/**
 * Formato de log para producción
 * Más estructurado para parsing automático
 */
const productionFormat = [
  ':id',
  ':remote-addr',
  ':method',
  ':url',
  ':status',
  ':res[content-length]',
  ':response-time',
  ':user-id',
  ':institution-id',
  '":user-agent"',
].join(' | ');

/**
 * Función para determinar si un request debe ser loggeado
 * @param req - Request de Express
 * @param res - Response de Express
 * @returns true si debe ser loggeado
 */
const shouldLogRequest = (req: Request, res: Response): boolean => {
  // No loggear health checks en producción
  if (!isDevelopment() && req.url === '/health') {
    return false;
  }
  
  // No loggear assets estáticos
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    return false;
  }
  
  // No loggear requests de métricas internas
  if (req.url.startsWith('/metrics') || req.url.startsWith('/_internal')) {
    return false;
  }
  
  return true;
};

/**
 * Stream personalizado para integrar Morgan con Winston
 */
const morganStream = {
  write: (message: string): void => {
    // Remover el salto de línea que agrega Morgan
    const cleanMessage = message.trim();
    
    // Usar Winston para loggear
    logger.info(cleanMessage, { type: 'http_request' });
  },
};

/**
 * Configurar tokens personalizados de Morgan
 */
createMorganTokens();

/**
 * Middleware de Morgan configurado para desarrollo
 */
export const developmentLogger = morgan(developmentFormat, {
  stream: morganStream,
  skip: (req, res) => !shouldLogRequest(req as Request, res as Response),
});

/**
 * Middleware de Morgan configurado para producción
 */
export const productionLogger = morgan(productionFormat, {
  stream: morganStream,
  skip: (req, res) => !shouldLogRequest(req as Request, res as Response),
});

/**
 * Middleware principal de logging que selecciona el formato apropiado
 */
export const requestLogger = isDevelopment() ? developmentLogger : productionLogger;

/**
 * Middleware para logging detallado de requests específicos
 * Útil para debugging de APIs críticas
 */
export const detailedRequestLogger = (req: RequestWithId, res: Response, next: NextFunction): void => {
  // Solo aplicar en desarrollo o si está habilitado el debug
  if (!isDevelopment() && !env.DEBUG_MODE) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Loggear información del request entrante
  logger.debug('Incoming Request', {
    id: req.id,
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  // Interceptar el final de la respuesta para loggear detalles
  const originalSend = res.send;
  res.send = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    logger.debug('Outgoing Response', {
      id: req.id,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      headers: res.getHeaders(),
      body: res.statusCode >= 400 ? body : '[Response body hidden]',
    });
    
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * Middleware para loggear requests lentos
 * Útil para identificar problemas de performance
 */
export const slowRequestLogger = (threshold: number = 1000) => {
  return (req: RequestWithId, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Interceptar el final de la respuesta
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      // Solo loggear si supera el threshold
      if (responseTime > threshold) {
        logger.warn('Slow Request Detected', {
          id: req.id,
          method: req.method,
          url: req.url,
          responseTime: `${responseTime}ms`,
          threshold: `${threshold}ms`,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      }
    });
    
    next();
  };
};