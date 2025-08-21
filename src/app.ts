import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env, getCorsOrigins } from '@/config/environment';
import { 
  errorHandler, 
  notFoundHandler 
} from '@/shared/middleware/error-handler.middleware';
import { 
  addRequestId, 
  requestLogger, 
  slowRequestLogger 
} from '@/shared/middleware/request-logger.middleware';
import logger from '@/shared/utils/logger';
import { successResponse } from '@/shared/utils/response';
import authRoutes from '@/modules/auth/routes';
/**
 * Configuración principal de la aplicación Express
 * Incluye middleware global, seguridad y configuración base
 */

/**
 * Función para crear y configurar la aplicación Express
 * @returns Aplicación Express configurada
 */
export const createApp = (): Application => {
  const app = express();

  // ========================================
  // CONFIGURACIÓN DE SEGURIDAD
  // ========================================
  
  /**
   * Helmet - Configuración de headers de seguridad
   * Protege contra vulnerabilidades comunes
   */
  app.use(helmet({
    // Configuración personalizada para desarrollo
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  /**
   * CORS - Control de acceso entre dominios
   * Configurado según las variables de entorno
   */
  app.use(cors({
    origin: getCorsOrigins(),
    credentials: env.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Client-ID',
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  }));

  // ========================================
  // MIDDLEWARE DE UTILIDADES
  // ========================================

  /**
   * Compression - Compresión GZIP para respuestas
   * Mejora el rendimiento reduciendo el tamaño de las respuestas
   */
  app.use(compression({
    level: 6, // Nivel de compresión balanceado
    threshold: 1024, // Solo comprimir respuestas > 1KB
  }));

  /**
   * Parsers de contenido
   * Para manejar diferentes tipos de datos en requests
   */
  app.use(express.json({ 
    limit: '10mb',
    strict: true,
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
  }));
  
  app.use(cookieParser());

  // ========================================
  // MIDDLEWARE DE LOGGING Y TRACKING
  // ========================================

  /**
   * Request ID - Agregar ID único a cada request
   * Para tracking y debugging
   */
  app.use(addRequestId);

  /**
   * Request Logger - Logging de requests HTTP
   * Configurado según el entorno
   */
  app.use(requestLogger);

  /**
   * Slow Request Logger - Detectar requests lentos
   * Para monitoreo de performance
   */
  app.use(slowRequestLogger(2000)); // 2 segundos threshold

  // ========================================
  // RATE LIMITING
  // ========================================

  /**
   * Rate Limiting global
   * Protección básica contra abuso
   */
  const globalRateLimit = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: {
      success: false,
      message: 'Demasiadas solicitudes, intenta de nuevo más tarde',
      error: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Remover keyGenerator personalizado por ahora
    skipSuccessfulRequests: env.NODE_ENV === 'development',
  });

  app.use(globalRateLimit);

  // ========================================
  // HEALTH CHECK ENDPOINT
  // ========================================

  /**
   * Endpoint de health check
   * Para verificar el estado de la aplicación
   */
  app.get('/health', (req, res) => {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    successResponse(res, healthData, 'Servicio funcionando correctamente');
  });

  // ========================================
  // RUTAS DE LA API
  // ========================================

  /**
   * Ruta base de la API
   * Información general sobre la API
   */
  app.get('/', (req, res) => {
    const apiInfo = {
      name: 'Educational SaaS API Production ver',
      version: 'v1',
      description: 'API para plataforma educativa SaaS',
      documentation: '/api/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    };

    successResponse(res, apiInfo, 'Bienvenido a Educational SaaS API');
  });

  // TODO: Aquí se agregarán las rutas de los módulos
   app.use('/api/v1/auth', authRoutes);
  // app.use('/api/v1/institutions', institutionRoutes);
  // etc.

  // ========================================
  // MIDDLEWARE DE MANEJO DE ERRORES
  // ========================================

  /**
   * Handler para rutas no encontradas
   * Debe ir antes del error handler
   */
  app.use(notFoundHandler);

  /**
   * Error handler global
   * Debe ser el último middleware
   */
  app.use(errorHandler);

  // ========================================
  // LOGGING DE CONFIGURACIÓN
  // ========================================

  logger.info('Express app configurada exitosamente', {
    environment: env.NODE_ENV,
    corsOrigins: getCorsOrigins(),
    rateLimitWindow: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX_REQUESTS,
  });

  return app;
};

// Exportar la función para crear la app
export default createApp;