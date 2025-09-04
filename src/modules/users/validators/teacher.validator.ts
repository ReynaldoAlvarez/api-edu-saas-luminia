import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validationErrorResponse, formatZodErrors } from '@/shared/utils/response';

/**
 * Validadores para el módulo de docentes
 * Utiliza Zod para validación de esquemas según el schema de Prisma
 */

/**
 * Schema para validación de creación de docente
 */
export const createTeacherSchema = z.object({
  // Datos del User base
  email: z
    .string()
    .min(1, 'Email es requerido')
    .email('Formato de email inválido')
    .max(255, 'Email demasiado largo'),
  
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 8, 'La contraseña debe tener al menos 8 caracteres'),
  
  fullName: z
    .string()
    .min(1, 'Nombre completo es requerido')
    .max(255, 'Nombre completo demasiado largo'),
  
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
    .uuid('ID de institución debe ser un UUID válido')
    .optional(),
  
  // Datos específicos del Teacher
  bio: z
    .string()
    .max(1000, 'Biografía demasiado larga')
    .optional(),
  
  specialties: z
    .array(z.string().min(1, 'Especialidad no puede estar vacía'))
    .max(10, 'Máximo 10 especialidades permitidas')
    .optional(),
  
  hireDate: z
    .string()
    .datetime('Fecha de contratación debe ser una fecha válida')
    .transform((val) => new Date(val))
    .optional(),
});

/**
 * Schema para validación de actualización de docente
 */
export const updateTeacherSchema = z.object({
  // Datos del User
  fullName: z
    .string()
    .min(1, 'Nombre completo no puede estar vacío')
    .max(255, 'Nombre completo demasiado largo')
    .optional(),
  
  ci: z
    .string()
    .min(6, 'CI debe tener al menos 6 caracteres')
    .optional(),
  
  phone: z
    .string()
    .refine((val) => /^\+?[\d\s\-\(\)]+$/.test(val), 'Formato de teléfono inválido')
    .optional(),
  
  isActive: z
    .boolean()
    .optional(),
  
  // Datos del Teacher
  bio: z
    .string()
    .max(1000, 'Biografía demasiado larga')
    .optional(),
  
  specialties: z
    .array(z.string().min(1, 'Especialidad no puede estar vacía'))
    .max(10, 'Máximo 10 especialidades permitidas')
    .optional(),
  
  hireDate: z
    .string()
    .datetime('Fecha de contratación debe ser una fecha válida')
    .transform((val) => new Date(val))
    .optional(),
});

/**
 * Schema para validación de filtros de docentes
 */
export const teacherFiltersSchema = z.object({
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  
  search: z
    .string()
    .min(1, 'Término de búsqueda debe tener al menos 1 carácter')
    .optional(),
  
  specialty: z
    .string()
    .min(1, 'Especialidad debe tener al menos 1 carácter')
    .optional(),
  
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
 * Schema para validación de parámetros de ID de docente
 */
export const teacherIdParamSchema = z.object({
  id: z
    .string()
    .uuid('ID de docente debe ser un UUID válido'),
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
 * Middleware para validar datos de creación de docente
 */
export const validateCreateTeacher = createValidationMiddleware(createTeacherSchema);

/**
 * Middleware para validar datos de actualización de docente
 */
export const validateUpdateTeacher = createValidationMiddleware(updateTeacherSchema);

/**
 * Middleware para validar filtros de docentes
 */
export const validateTeacherFilters = createValidationMiddleware(teacherFiltersSchema, 'query');

/**
 * Middleware para validar parámetro de ID de docente
 */
export const validateTeacherIdParam = createValidationMiddleware(teacherIdParamSchema, 'params');