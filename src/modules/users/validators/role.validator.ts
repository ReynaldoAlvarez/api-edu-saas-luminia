import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validationErrorResponse, formatZodErrors } from '@/shared/utils/response';

/**
 * Validadores para el módulo de roles
 * Utiliza Zod para validación de esquemas según el schema de Prisma
 */

/**
 * Schema para validación de asignación de rol
 */
export const assignRoleSchema = z.object({
  roleId: z
    .string()
    .min(1, 'ID de rol es requerido'),
  
  isPrimary: z
    .boolean()
    .optional()
    .default(false),
});

/**
 * Schema para validación de cambio de rol primario
 */
export const setPrimaryRoleSchema = z.object({
  roleId: z
    .string()
    .min(1, 'ID de rol es requerido'),
});

/**
 * Schema para validación de parámetros de usuario y rol
 */
export const userRoleParamsSchema = z.object({
  userId: z
    .string()
    .uuid('ID de usuario debe ser un UUID válido'),
  
  roleId: z
    .string()
    .optional(),
});

/**
 * Schema para validación de parámetros solo de usuario
 */
export const userIdParamSchema = z.object({
  userId: z
    .string(),
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
 * Middleware para validar datos de asignación de rol
 */
export const validateAssignRole = createValidationMiddleware(assignRoleSchema);

/**
 * Middleware para validar cambio de rol primario
 */
export const validateSetPrimaryRole = createValidationMiddleware(setPrimaryRoleSchema);

/**
 * Middleware para validar parámetros de usuario y rol
 */
export const validateUserRoleParams = createValidationMiddleware(userRoleParamsSchema, 'params');

/**
 * Middleware para validar parámetro de usuario
 */
export const validateUserIdParam = createValidationMiddleware(userIdParamSchema, 'params');