import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { forbiddenResponse, badRequestResponse } from '@/shared/utils/response';
import { logAuthEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';

/**
 * Middleware multi-tenant
 * Filtra datos por institución y valida acceso a recursos
 */

/**
 * Interface extendida para Request con información de tenant
 */
export interface TenantRequest extends AuthenticatedRequest {
  institutionId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    planId: string | null;
  };
}

/**
 * Middleware para establecer el contexto de tenant
 * Extrae institutionId del usuario autenticado y lo establece en el request
 */
export const setTenantContext = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  // Verificar que el usuario esté autenticado
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado para establecer contexto de tenant');
    return;
  }

  // Establecer institutionId desde el usuario autenticado
  req.institutionId = req.user.institutionId;

  next();
};

/**
 * Middleware para validar acceso a una institución específica
 * Verifica que el usuario tenga acceso a la institución solicitada
 */
export const validateTenantAccess = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      badRequestResponse(res, 'Usuario no autenticado');
      return;
    }

    // Obtener institutionId del parámetro de ruta o del usuario
    const requestedInstitutionId = req.params.institutionId || req.user.institutionId;

    if (!requestedInstitutionId) {
      badRequestResponse(res, 'ID de institución requerido');
      return;
    }

    // Verificar que el usuario pertenece a la institución solicitada
    if (req.user.institutionId !== requestedInstitutionId) {
      logAuthEvent('tenant_access_denied', req.user.id, req.ip, req.get('User-Agent'), {
        userInstitution: req.user.institutionId,
        requestedInstitution: requestedInstitutionId,
      });
      forbiddenResponse(res, 'Acceso denegado a esta institución');
      return;
    }

    // Cargar información completa de la institución
    const institution = await prisma.institution.findUnique({
      where: { id: requestedInstitutionId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        planId: true,
      },
    });

    if (!institution) {
      badRequestResponse(res, 'Institución no encontrada');
      return;
    }

    // Verificar que la institución esté activa
    if (institution.status !== 'active') {
      forbiddenResponse(res, 'Institución no activa');
      return;
    }

    // Establecer información del tenant en el request
    req.institutionId = institution.id;
    req.tenant = {
      ...institution,
      status: institution.status ?? 'inactive', // Ensure status is always a string
    };

    next();
  } catch (error) {
    logAuthEvent('tenant_validation_error', req.user?.id, req.ip, req.get('User-Agent'), {
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
    forbiddenResponse(res, 'Error validando acceso a institución');
  }
};

/**
 * Middleware para filtrar queries por institución
 * Automáticamente agrega filtro de institutionId a las consultas
 */
export const applyTenantFilter = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  // Verificar que tengamos el contexto de tenant
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de tenant no establecido');
    return;
  }

  // Agregar filtro de institución a los query parameters
  if (!req.query.institutionId) {
    req.query.institutionId = req.institutionId;
  }

  next();
};

/**
 * Middleware para validar que un recurso pertenece a la institución del usuario
 * @param resourceModel - Nombre del modelo a validar
 * @param resourceIdParam - Nombre del parámetro que contiene el ID del recurso
 */
export const validateResourceOwnership = (
  resourceModel: string,
  resourceIdParam: string = 'id'
) => {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.institutionId) {
        badRequestResponse(res, 'Contexto de autenticación/tenant requerido');
        return;
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        badRequestResponse(res, `Parámetro ${resourceIdParam} requerido`);
        return;
      }

      // Mapear nombres de modelos a sus equivalentes en Prisma
      const modelMap: Record<string, any> = {
        student: prisma.student,
        teacher: prisma.teacher,
        course: prisma.course,
        career: prisma.career,
        virtualClassroom: prisma.virtualClassroom,
        subject: prisma.subject,
        // Agregar más modelos según sea necesario
      };

      const model = modelMap[resourceModel];
      if (!model) {
        badRequestResponse(res, `Modelo ${resourceModel} no soportado`);
        return;
      }

      // Buscar el recurso y verificar que pertenece a la institución
      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { 
          id: true, 
          institutionId: true 
        },
      });

      if (!resource) {
        badRequestResponse(res, 'Recurso no encontrado');
        return;
      }

      if (resource.institutionId !== req.institutionId) {
        logAuthEvent('resource_access_denied', req.user.id, req.ip, req.get('User-Agent'), {
          resourceModel,
          resourceId,
          resourceInstitution: resource.institutionId,
          userInstitution: req.institutionId,
        });
        forbiddenResponse(res, 'Acceso denegado a este recurso');
        return;
      }

      next();
    } catch (error) {
      logAuthEvent('resource_validation_error', req.user?.id, req.ip, req.get('User-Agent'), {
        error: error instanceof Error ? error.message : 'Error desconocido',
        resourceModel,
      });
      forbiddenResponse(res, 'Error validando propiedad del recurso');
    }
  };
};

/**
 * Middleware combinado que aplica autenticación, tenant y validación de acceso
 */
export const requireTenantAccess = [
  setTenantContext,
  validateTenantAccess,
  applyTenantFilter,
];

/**
 * Helper function para crear filtros de Prisma con tenant
 * @param baseWhere - Condiciones base de la consulta
 * @param institutionId - ID de la institución
 * @returns Objeto where con filtro de tenant aplicado
 */
export const createTenantFilter = (
  baseWhere: Record<string, any> = {},
  institutionId: string
): Record<string, any> => {
  return {
    ...baseWhere,
    institutionId,
  };
};

/**
 * Helper function para validar que un array de IDs pertenecen a la institución
 * @param model - Modelo de Prisma a consultar
 * @param ids - Array de IDs a validar
 * @param institutionId - ID de la institución
 * @returns true si todos los IDs pertenecen a la institución
 */
export const validateBulkOwnership = async (
  model: any,
  ids: string[],
  institutionId: string
): Promise<boolean> => {
  try {
    const count = await model.count({
      where: {
        id: { in: ids },
        institutionId,
      },
    });

    return count === ids.length;
  } catch (error) {
    return false;
  }
};