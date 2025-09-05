import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validationErrorResponse, formatZodErrors } from '@/shared/utils/response';

/**
 * Validadores para el módulo de estudiantes
 * Utiliza Zod para validación de esquemas según el schema de Prisma
 */

/**
 * Schema para validación de creación de estudiante
 */
export const createStudentSchema = z.object({
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
  
  // Datos específicos del Student
  careerId: z
    .string()
    .uuid('ID de carrera debe ser un UUID válido')
    .optional(),
  
  enrollmentDate: z
    .string()
    .datetime('Fecha de matrícula debe ser una fecha válida')
    .transform((val) => new Date(val))
    .optional(),
  
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED'])
    .optional()
    .default('ACTIVE'),
  
  metadata: z
    .any()
    .optional(),
});

/**
 * Schema para validación de actualización de estudiante
 */
export const updateStudentSchema = z.object({
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
  
  // Datos del Student
  careerId: z
    .string()
    .uuid('ID de carrera debe ser un UUID válido')
    .optional(),
  
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED'])
    .optional(),
  
  metadata: z
    .any()
    .optional(),
});

/**
 * Schema para validación de cambio de estado
 */
export const updateStudentStatusSchema = z.object({
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED'])
    .refine((val) => val !== undefined, 'Estado es requerido'),
});

/**
 * Schema para validación de filtros de estudiantes
 */
export const studentFiltersSchema = z.object({
  careerId: z
    .string()
    .uuid('ID de carrera debe ser un UUID válido')
    .optional(),
  
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED'])
    .optional(),
  
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  
  search: z
    .string()
    .min(1, 'Término de búsqueda debe tener al menos 1 carácter')
    .optional(),
  
  enrollmentYear: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 2000 && val <= new Date().getFullYear() + 1, 'Año de matrícula inválido')
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
 * Schema para validación de parámetros de ID de estudiante
 */
export const studentIdParamSchema = z.object({
  id: z
    .string()
    .uuid('ID de estudiante debe ser un UUID válido'),
});

/**
 * Schema para validación de parámetros de número de estudiante
 */
export const studentNumberParamSchema = z.object({
  studentNumber: z
    .string()
    .regex(/^EST-\d{4}-\d{4}$/, 'Número de estudiante debe tener formato EST-YYYY-NNNN'),
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
 * Middleware para validar datos de creación de estudiante
 */
export const validateCreateStudent = createValidationMiddleware(createStudentSchema);

/**
 * Middleware para validar datos de actualización de estudiante
 */
export const validateUpdateStudent = createValidationMiddleware(updateStudentSchema);

/**
 * Middleware para validar cambio de estado de estudiante
 */
export const validateUpdateStudentStatus = createValidationMiddleware(updateStudentStatusSchema);

/**
 * Middleware para validar filtros de estudiantes
 */
export const validateStudentFilters = createValidationMiddleware(studentFiltersSchema, 'query');

/**
 * Middleware para validar parámetro de ID de estudiante
 */
export const validateStudentIdParam = createValidationMiddleware(studentIdParamSchema, 'params');

/**
 * Middleware para validar parámetro de número de estudiante
 */
export const validateStudentNumberParam = createValidationMiddleware(studentNumberParamSchema, 'params');