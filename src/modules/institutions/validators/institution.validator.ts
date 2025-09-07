import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validationErrorResponse, formatZodErrors } from '@/shared/utils/response';

/**
 * Validadores para el módulo de instituciones
 * Utiliza Zod para validación de esquemas según el schema de Prisma
 */

/**
 * Schema para validación de creación de institución
 */
export const createInstitutionSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre de la institución es requerido')
    .max(255, 'Nombre demasiado largo')
    .refine((val) => val.trim().length > 0, 'Nombre no puede estar vacío'),
  
  contactEmail: z
    .string()
    .min(1, 'Email de contacto es requerido')
    .email('Formato de email inválido')
    .max(255, 'Email demasiado largo'),
  
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[\d\s\-\(\)]+$/.test(val), 'Formato de teléfono inválido'),
  
  address: z
    .any()
    .optional(),
  
  slug: z
    .string()
    .min(3, 'Slug debe tener al menos 3 caracteres')
    .max(50, 'Slug demasiado largo')
    .regex(/^[a-z0-9\-]+$/, 'Slug solo puede contener letras minúsculas, números y guiones')
    .optional(),
});

/**
 * Schema para validación de actualización de institución
 */
export const updateInstitutionSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre de la institución no puede estar vacío')
    .max(255, 'Nombre demasiado largo')
    .optional(),
  
  contactEmail: z
    .string()
    .email('Formato de email inválido')
    .max(255, 'Email demasiado largo')
    .optional(),
  
  phone: z
    .string()
    .refine((val) => /^\+?[\d\s\-\(\)]+$/.test(val), 'Formato de teléfono inválido')
    .optional(),
  
  address: z
    .any()
    .optional(),
  
  status: z
    .enum(['active', 'inactive', 'suspended'])
    .optional(),
});

/**
 * Schema para validación de configuración de institución
 */
export const updateSettingsSchema = z.object({
  timezone: z
    .string()
    .optional(),
  
  currency: z
    .string()
    .optional(),
  
  language: z
    .string()
    .optional(),
  
  branding: z
    .object({
      primaryColor: z.string().optional(),
      logoUrl: z.string().optional(),
      faviconUrl: z.string().optional(),
    })
    .optional(),
  
  features: z
    .object({
      aiEnabled: z.boolean().optional(),
      certificatesEnabled: z.boolean().optional(),
      virtualClassroomsEnabled: z.boolean().optional(),
      attendanceTracking: z.boolean().optional(),
      gradebook: z.boolean().optional(),
    })
    .optional(),
  
  notifications: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  
  security: z
    .object({
      twoFactorAuth: z.boolean().optional(),
      sessionTimeout: z.number().optional(),
      passwordPolicy: z.object({
        minLength: z.number().optional(),
        requireUppercase: z.boolean().optional(),
        requireNumbers: z.boolean().optional(),
        requireSpecialChars: z.boolean().optional(),
      }).optional(),
    })
    .optional(),
});

/**
 * Schema para validación de filtros de instituciones
 */
export const institutionFiltersSchema = z.object({
  search: z
    .string()
    .min(1, 'Término de búsqueda debe tener al menos 1 carácter')
    .optional(),
  
  status: z
    .enum(['active', 'inactive', 'suspended'])
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
 * Schema para validación de parámetros de ID de institución
 */
export const institutionIdParamSchema = z.object({
  id: z
    .string()
    .uuid('ID de institución debe ser un UUID válido'),
});

/**
 * Schema para validación de parámetros de slug
 */
export const institutionSlugParamSchema = z.object({
  slug: z
    .string()
    .min(3, 'Slug debe tener al menos 3 caracteres')
    .max(50, 'Slug demasiado largo')
    .regex(/^[a-z0-9\-]+$/, 'Slug solo puede contener letras minúsculas, números y guiones'),
});

/**
 * Schema para validación de onboarding
 */
export const onboardingSchema = z.object({
  institution: createInstitutionSchema,
  
  adminUser: z.object({
    email: z
      .string()
      .min(1, 'Email del administrador es requerido')
      .email('Formato de email inválido'),
    
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    
    fullName: z
      .string()
      .min(1, 'Nombre completo es requerido')
      .max(255, 'Nombre completo demasiado largo'),
    
    phone: z
      .string()
      .optional()
      .refine((val) => !val || /^\+?[\d\s\-\(\)]+$/.test(val), 'Formato de teléfono inválido'),
  }),
  
  planSlug: z
    .enum(['free', 'basic', 'pro', 'premium'])
    .optional()
    .default('free'),
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
 * Middleware para validar datos de creación de institución
 */
export const validateCreateInstitution = createValidationMiddleware(createInstitutionSchema);

/**
 * Middleware para validar datos de actualización de institución
 */
export const validateUpdateInstitution = createValidationMiddleware(updateInstitutionSchema);

/**
 * Middleware para validar configuración de institución
 */
export const validateUpdateSettings = createValidationMiddleware(updateSettingsSchema);

/**
 * Middleware para validar filtros de instituciones
 */
export const validateInstitutionFilters = createValidationMiddleware(institutionFiltersSchema, 'query');

/**
 * Middleware para validar parámetro de ID de institución
 */
export const validateInstitutionIdParam = createValidationMiddleware(institutionIdParamSchema, 'params');

/**
 * Middleware para validar parámetro de slug
 */
export const validateInstitutionSlugParam = createValidationMiddleware(institutionSlugParamSchema, 'params');

/**
 * Middleware para validar datos de onboarding
 */
export const validateOnboarding = createValidationMiddleware(onboardingSchema);