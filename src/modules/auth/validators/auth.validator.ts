import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validationErrorResponse, formatZodErrors } from '@/shared/utils/response';

/**
 * Validadores para el módulo de autenticación
 * Utiliza Zod para validación de esquemas y datos de entrada
 */

/**
 * Schema para validación de registro de usuario
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email es requerido')
    .email('Formato de email inválido')
    .max(255, 'Email demasiado largo'),
  
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede tener más de 128 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  
  fullName: z
    .string()
    .min(1, 'Nombre completo es requerido')
    .max(255, 'Nombre completo demasiado largo')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  
  ci: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, 'CI debe tener al menos 6 caracteres'),
  
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[\d\s\-\(\)]+$/.test(val), 'Formato de teléfono inválido'),
  
  institutionId: z
    .string()
    .min(1, 'ID de institución es requerido')
    .uuid('ID de institución debe ser un UUID válido'),
  
  roleName: z
    .enum(['ADMIN', 'SECRETARY', 'DIRECTOR', 'TEACHER', 'STUDENT', 'TUTOR', 'FINANCE', 'SUPPORT'])
    .refine((val) => val !== undefined, 'Rol es requerido'),
});

/**
 * Schema para validación de login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email es requerido')
    .email('Formato de email inválido'),
  
  password: z
    .string()
    .min(1, 'Contraseña es requerida'),
});

/**
 * Schema para validación de refresh token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token es requerido'),
});

/**
 * Schema para validación de cambio de contraseña
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Contraseña actual es requerida'),
  
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128, 'La nueva contraseña no puede tener más de 128 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'La nueva contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  
  confirmPassword: z
    .string()
    .min(1, 'Confirmación de contraseña es requerida'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

/**
 * Schema para validación de solicitud de reset de contraseña
 */
export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .min(1, 'Email es requerido')
    .email('Formato de email inválido'),
});

/**
 * Schema para validación de reset de contraseña
 */
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, 'Token de reset es requerido'),
  
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128, 'La nueva contraseña no puede tener más de 128 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'La nueva contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  
  confirmPassword: z
    .string()
    .min(1, 'Confirmación de contraseña es requerida'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

/**
 * Función helper para crear middleware de validación
 * @param schema - Schema de Zod para validar
 * @returns Middleware de Express
 */
const createValidationMiddleware = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
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
 * Middleware para validar datos de registro
 */
export const validateRegister = createValidationMiddleware(registerSchema);

/**
 * Middleware para validar datos de login
 */
export const validateLogin = createValidationMiddleware(loginSchema);

/**
 * Middleware para validar refresh token
 */
export const validateRefreshToken = createValidationMiddleware(refreshTokenSchema);

/**
 * Middleware para validar cambio de contraseña
 */
export const validateChangePassword = createValidationMiddleware(changePasswordSchema);

/**
 * Middleware para validar solicitud de reset de contraseña
 */
export const validateRequestPasswordReset = createValidationMiddleware(requestPasswordResetSchema);

/**
 * Middleware para validar reset de contraseña
 */
export const validateResetPassword = createValidationMiddleware(resetPasswordSchema);

/**
 * Validador personalizado para verificar que el email no esté en uso
 * (Se puede usar como middleware adicional después de la validación básica)
 */
export const validateEmailNotInUse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    
    // Esta validación se hace en el servicio, pero se puede hacer aquí también
    // para fallar más temprano
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validador para verificar que la institución existe y está activa
 */
export const validateInstitutionExists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { institutionId } = req.body;
    
    // Esta validación se hace en el servicio, pero se puede hacer aquí también
    // para fallar más temprano
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validador para parámetros de URL
 */
export const validateUserIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { userId } = req.params;
  
  if (!userId) {
    validationErrorResponse(res, [
      { field: 'userId', message: 'ID de usuario es requerido en la URL' }
    ]);
    return;
  }
  
  // Validar que sea un UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    validationErrorResponse(res, [
      { field: 'userId', message: 'ID de usuario debe ser un UUID válido' }
    ]);
    return;
  }
  
  next();
};

/**
 * Validador para headers de autorización
 */
export const validateAuthHeader = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    validationErrorResponse(res, [
      { field: 'authorization', message: 'Header de autorización es requerido' }
    ]);
    return;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    validationErrorResponse(res, [
      { field: 'authorization', message: 'Formato de header de autorización inválido. Use: Bearer <token>' }
    ]);
    return;
  }
  
  next();
};

/**
 * Validador combinado para operaciones que requieren autenticación
 */
export const validateAuthenticatedRequest = [
  validateAuthHeader,
  // El middleware de autenticación se aplicará después
];

/**
 * Función helper para validar datos sin middleware
 * Útil para validaciones en servicios o funciones utilitarias
 * @param schema - Schema de Zod
 * @param data - Datos a validar
 * @returns Datos validados
 * @throws Error si la validación falla
 */
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatZodErrors(error);
      const errorMessage = errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Errores de validación: ${errorMessage}`);
    }
    throw error;
  }
};