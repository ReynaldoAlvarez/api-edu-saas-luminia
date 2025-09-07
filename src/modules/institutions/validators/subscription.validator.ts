import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validationErrorResponse, formatZodErrors } from '@/shared/utils/response';

/**
 * Validadores para el módulo de suscripciones
 * Utiliza Zod para validación de esquemas según el schema de Prisma
 */

/**
 * Schema para validación de creación de suscripción
 */
export const createSubscriptionSchema = z.object({
  planId: z
    .string()
    .min(1, 'ID de plan es requerido')
    .uuid('ID de plan debe ser un UUID válido'),
  
  billingCycle: z
    .enum(['monthly', 'annual', 'quarterly'])
    .optional(),
  
  autoRenew: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * Schema para validación de actualización de suscripción
 */
export const updateSubscriptionSchema = z.object({
  planId: z
    .string()
    .uuid('ID de plan debe ser un UUID válido')
    .optional(),
  
  status: z
    .enum(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED', 'TRIAL'])
    .optional(),
  
  autoRenew: z
    .boolean()
    .optional(),
  
  billingCycle: z
    .enum(['monthly', 'annual', 'quarterly'])
    .optional(),
});

/**
 * Schema para validación de parámetros de suscripción
 */
export const subscriptionParamsSchema = z.object({
  id: z
    .string()
    .uuid('ID de institución debe ser un UUID válido'),
  
  subscriptionId: z
    .string()
    .uuid('ID de suscripción debe ser un UUID válido')
    .optional(),
});

/**
 * Schema para validación de filtros de historial
 */
export const subscriptionHistoryFiltersSchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, 'Página debe ser mayor a 0')
    .optional(),
  
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 100, 'Límite debe estar entre 1 y 100')
    .optional(),
});

/**
 * Función helper para crear middleware de validación
 */
const createValidationMiddleware = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = source === 'body' ? req.body : 
                           source === 'query' ? req.query : 
                           req.params;
      
      const validatedData = schema.parse(dataToValidate);
      
      if (source === 'body') {
        req.body = validatedData;
      } else if (source === 'params') {
        req.params = validatedData as any;
      }
      // Para query, solo validamos pero no reasignamos
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatZodErrors(error);
        validationErrorResponse(res, validationErrors, 'Errores de validación en los datos');
        return;
      }
      next(error);
    }
  };
};

/**
 * Middleware para validar datos de creación de suscripción
 */
export const validateCreateSubscription = createValidationMiddleware(createSubscriptionSchema);

/**
 * Middleware para validar datos de actualización de suscripción
 */
export const validateUpdateSubscription = createValidationMiddleware(updateSubscriptionSchema);

/**
 * Middleware para validar parámetros de suscripción
 */
export const validateSubscriptionParams = createValidationMiddleware(subscriptionParamsSchema, 'params');

/**
 * Middleware para validar filtros de historial de suscripciones
 */
export const validateSubscriptionHistoryFilters = createValidationMiddleware(subscriptionHistoryFiltersSchema, 'query');