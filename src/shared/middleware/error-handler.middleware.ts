import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import logger from '@/shared/utils/logger';
import {
  internalServerErrorResponse,
  validationErrorResponse,
  badRequestResponse,
  notFoundResponse,
  conflictResponse,
  formatZodErrors,
  HTTP_STATUS,
} from '@/shared/utils/response';
import { env, isDevelopment } from '@/config/environment';

/**
 * Middleware centralizado para el manejo de errores
 * Captura todos los errores y los formatea de manera consistente
 */

/**
 * Interface para errores personalizados de la aplicación
 */
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

/**
 * Función para crear errores personalizados de la aplicación
 * @param message - Mensaje del error
 * @param statusCode - Código de estado HTTP
 * @param isOperational - Indica si es un error operacional esperado
 */
export const createAppError = (
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  isOperational: boolean = true
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  return error;
};

/**
 * Función para manejar errores de Prisma
 * @param error - Error de Prisma
 * @returns Error formateado con código de estado apropiado
 */
const handlePrismaError = (error: PrismaClientKnownRequestError): AppError => {
  let message = 'Error de base de datos';
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  switch (error.code) {
    case 'P2002':
      // Violación de restricción única
      message = 'El recurso ya existe';
      statusCode = HTTP_STATUS.CONFLICT;
      break;
    
    case 'P2025':
      // Registro no encontrado
      message = 'Recurso no encontrado';
      statusCode = HTTP_STATUS.NOT_FOUND;
      break;
    
    case 'P2003':
      // Violación de clave foránea
      message = 'Referencia inválida a otro recurso';
      statusCode = HTTP_STATUS.BAD_REQUEST;
      break;
    
    case 'P2014':
      // Violación de relación requerida
      message = 'La operación violaría una relación requerida';
      statusCode = HTTP_STATUS.BAD_REQUEST;
      break;
    
    default:
      // Error genérico de Prisma
      message = isDevelopment() ? error.message : 'Error de base de datos';
      break;
  }

  return createAppError(message, statusCode);
};

/**
 * Función para manejar errores de validación de Prisma
 * @param error - Error de validación de Prisma
 * @returns Error formateado
 */
const handlePrismaValidationError = (error: PrismaClientValidationError): AppError => {
  const message = isDevelopment() 
    ? `Error de validación: ${error.message}`
    : 'Datos inválidos proporcionados';
  
  return createAppError(message, HTTP_STATUS.BAD_REQUEST);
};

/**
 * Función para determinar si un error debe ser loggeado
 * @param error - Error a evaluar
 * @returns true si debe ser loggeado
 */
const shouldLogError = (error: AppError): boolean => {
  // No loggear errores operacionales de cliente (4xx)
  if (error.isOperational && error.statusCode && error.statusCode < 500) {
    return false;
  }
  
  // Loggear todos los errores de servidor (5xx) y errores no operacionales
  return true;
};

/**
 * Función para loggear errores con contexto adicional
 * @param error - Error a loggear
 * @param req - Request de Express
 */
const logError = (error: AppError, req: Request): void => {
  const errorContext = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    institutionId: (req as any).institutionId,
  };

  if (error.statusCode && error.statusCode >= 500) {
    logger.error('Server Error', errorContext);
  } else {
    logger.warn('Client Error', errorContext);
  }
};

/**
 * Middleware principal de manejo de errores
 * Debe ser el último middleware en la cadena
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;

  // Si ya es un AppError, usarlo directamente
  if ((error as AppError).statusCode) {
    appError = error as AppError;
  }
  // Manejar errores de validación de Zod
  else if (error instanceof ZodError) {
    const validationErrors = formatZodErrors(error);
    validationErrorResponse(res, validationErrors, 'Errores de validación en los datos');
    return;
  }
  // Manejar errores conocidos de Prisma
  else if (error instanceof PrismaClientKnownRequestError) {
    appError = handlePrismaError(error);
  }
  // Manejar errores de validación de Prisma
  else if (error instanceof PrismaClientValidationError) {
    appError = handlePrismaValidationError(error);
  }
  // Error genérico
  else {
    appError = createAppError(
      isDevelopment() ? error.message : 'Error interno del servidor',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      false
    );
  }

  // Loggear el error si es necesario
  if (shouldLogError(appError)) {
    logError(appError, req);
  }

  // Enviar respuesta de error apropiada
  const statusCode = appError.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = appError.message || 'Error interno del servidor';

  switch (statusCode) {
    case HTTP_STATUS.BAD_REQUEST:
      badRequestResponse(res, message);
      break;
    
    case HTTP_STATUS.NOT_FOUND:
      notFoundResponse(res, message);
      break;
    
    case HTTP_STATUS.CONFLICT:
      conflictResponse(res, message);
      break;
    
    default:
      internalServerErrorResponse(res, message);
      break;
  }
};

/**
 * Middleware para capturar errores asíncronos
 * Wrapper para funciones async que automáticamente pasa errores al error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para manejar rutas no encontradas
 * Debe colocarse antes del error handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createAppError(
    `Ruta ${req.method} ${req.originalUrl} no encontrada`,
    HTTP_STATUS.NOT_FOUND
  );
  next(error);
};