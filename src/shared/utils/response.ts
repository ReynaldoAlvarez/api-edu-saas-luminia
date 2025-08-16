import { Response } from 'express';
import { z } from 'zod';

/**
 * Utilidades para estandarizar las respuestas de la API
 * Proporciona funciones helper para respuestas consistentes
 */

/**
 * Códigos de estado HTTP más comunes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Tipos para las respuestas de la API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
  meta?: ResponseMeta;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
  version?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Función base para crear respuestas estandarizadas
 * @param res - Objeto Response de Express
 * @param statusCode - Código de estado HTTP
 * @param success - Indica si la operación fue exitosa
 * @param message - Mensaje descriptivo
 * @param data - Datos de respuesta (opcional)
 * @param errors - Errores de validación (opcional)
 * @param meta - Metadata adicional (opcional)
 */
const createResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: T,
  errors?: ValidationError[],
  meta?: Partial<ResponseMeta>
): Response => {
  const response: ApiResponse<T> = {
    success,
    message,
    ...(data !== undefined && { data }),
    ...(errors && errors.length > 0 && { errors }),
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      ...meta,
    },
  };

  return res.status(statusCode).json(response);
};

/**
 * Respuesta exitosa con datos
 * @param res - Objeto Response de Express
 * @param data - Datos a retornar
 * @param message - Mensaje personalizado (opcional)
 * @param meta - Metadata adicional (opcional)
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message = 'Operación exitosa',
  meta?: Partial<ResponseMeta>
): Response => {
  return createResponse(res, HTTP_STATUS.OK, true, message, data, undefined, meta);
};

/**
 * Respuesta de creación exitosa
 * @param res - Objeto Response de Express
 * @param data - Datos del recurso creado
 * @param message - Mensaje personalizado (opcional)
 * @param meta - Metadata adicional (opcional)
 */
export const createdResponse = <T>(
  res: Response,
  data: T,
  message = 'Recurso creado exitosamente',
  meta?: Partial<ResponseMeta>
): Response => {
  return createResponse(res, HTTP_STATUS.CREATED, true, message, data, undefined, meta);
};

/**
 * Respuesta sin contenido (para operaciones como DELETE)
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 */
export const noContentResponse = (
  res: Response,
  message = 'Operación completada'
): Response => {
  return createResponse(res, HTTP_STATUS.NO_CONTENT, true, message);
};

/**
 * Respuesta de error de validación
 * @param res - Objeto Response de Express
 * @param errors - Array de errores de validación
 * @param message - Mensaje personalizado (opcional)
 */
export const validationErrorResponse = (
  res: Response,
  errors: ValidationError[],
  message = 'Errores de validación'
): Response => {
  return createResponse(res, HTTP_STATUS.UNPROCESSABLE_ENTITY, false, message, undefined, errors);
};

/**
 * Respuesta de solicitud incorrecta
 * @param res - Objeto Response de Express
 * @param message - Mensaje de error
 * @param errors - Errores específicos (opcional)
 */
export const badRequestResponse = (
  res: Response,
  message = 'Solicitud incorrecta',
  errors?: ValidationError[]
): Response => {
  return createResponse(res, HTTP_STATUS.BAD_REQUEST, false, message, undefined, errors);
};

/**
 * Respuesta de no autorizado
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 */
export const unauthorizedResponse = (
  res: Response,
  message = 'No autorizado'
): Response => {
  return createResponse(res, HTTP_STATUS.UNAUTHORIZED, false, message);
};

/**
 * Respuesta de acceso prohibido
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 */
export const forbiddenResponse = (
  res: Response,
  message = 'Acceso prohibido'
): Response => {
  return createResponse(res, HTTP_STATUS.FORBIDDEN, false, message);
};

/**
 * Respuesta de recurso no encontrado
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 */
export const notFoundResponse = (
  res: Response,
  message = 'Recurso no encontrado'
): Response => {
  return createResponse(res, HTTP_STATUS.NOT_FOUND, false, message);
};

/**
 * Respuesta de conflicto (recurso ya existe)
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 */
export const conflictResponse = (
  res: Response,
  message = 'El recurso ya existe'
): Response => {
  return createResponse(res, HTTP_STATUS.CONFLICT, false, message);
};

/**
 * Respuesta de demasiadas solicitudes (rate limiting)
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 * @param retryAfter - Tiempo en segundos para reintentar (opcional)
 */
export const tooManyRequestsResponse = (
  res: Response,
  message = 'Demasiadas solicitudes',
  retryAfter?: number
): Response => {
  if (retryAfter) {
    res.set('Retry-After', retryAfter.toString());
  }
  return createResponse(res, HTTP_STATUS.TOO_MANY_REQUESTS, false, message);
};

/**
 * Respuesta de error interno del servidor
 * @param res - Objeto Response de Express
 * @param message - Mensaje personalizado (opcional)
 */
export const internalServerErrorResponse = (
  res: Response,
  message = 'Error interno del servidor'
): Response => {
  return createResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, false, message);
};

/**
 * Función helper para convertir errores de Zod a ValidationError[]
 * @param zodError - Error de validación de Zod
 * @returns Array de ValidationError
 */
export const formatZodErrors = (zodError: z.ZodError): ValidationError[] => {
  return zodError.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
};

/**
 * Función helper para crear metadata de paginación
 * @param page - Página actual
 * @param limit - Límite de elementos por página
 * @param total - Total de elementos
 * @returns Metadata de paginación
 */
export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/**
 * Función helper para respuestas paginadas
 * @param res - Objeto Response de Express
 * @param data - Datos paginados
 * @param page - Página actual
 * @param limit - Límite por página
 * @param total - Total de elementos
 * @param message - Mensaje personalizado (opcional)
 */
export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message = 'Datos obtenidos exitosamente'
): Response => {
  const paginationMeta = createPaginationMeta(page, limit, total);
  
  return successResponse(res, data, message, {
    pagination: paginationMeta,
  });
};