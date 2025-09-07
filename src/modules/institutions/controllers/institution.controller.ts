import { Response } from 'express';
import { 
  createInstitution,
  getInstitutions,
  getInstitutionById,
  getInstitutionBySlug,
  updateInstitution,
  deleteInstitution,
  getCurrentInstitution,
  getInstitutionStats
} from '../services/institution.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';
import { AuthenticatedRequest } from '@/shared/middleware/auth.middleware';

/**
 * Controladores para gestión de instituciones
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para crear institución
 * POST /api/v1/institutions
 */
export const createInstitutionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Solo super admins pueden crear instituciones
  if (!req.user || req.user.roleName !== 'ADMIN' || req.user.institutionId) {
    badRequestResponse(res, 'Solo super administradores pueden crear instituciones');
    return;
  }

  const result = await createInstitution(req.body);

  createdResponse(res, result, 'Institución creada exitosamente');
});

/**
 * Controlador para listar instituciones
 * GET /api/v1/institutions
 */
export const getInstitutionsController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
// Validar que sea super admin (sin institutionId)
if (!req.user || req.user.institutionId) {
  badRequestResponse(res, 'Solo super administradores pueden listar instituciones');
  return;
}

// Verificar que tenga rol ADMIN
if (req.user.roleName !== 'ADMIN') {
  badRequestResponse(res, 'Solo administradores pueden listar instituciones');
  return;
}

  const result = await getInstitutions(req.query as any);

  successResponse(res, result, 'Instituciones obtenidas exitosamente');
});

/**
 * Controlador para obtener institución por ID
 * GET /api/v1/institutions/:id
 */
export const getInstitutionByIdController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Validar que sea super admin (sin institutionId)
  if (!req.user || req.user.institutionId) {
    badRequestResponse(res, 'Solo super administradores pueden ver instituciones');
    return;
  }

  // Verificar que tenga rol ADMIN
  if (req.user.roleName !== 'ADMIN') {
    badRequestResponse(res, 'Solo administradores pueden ver instituciones');
    return;
  }

  const { id } = req.params;
  const result = await getInstitutionById(id);

  successResponse(res, result, 'Institución obtenida exitosamente');
});

/**
 * Controlador para obtener institución por slug
 * GET /api/v1/institutions/slug/:slug
 */
export const getInstitutionBySlugController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { slug } = req.params;
  const result = await getInstitutionBySlug(slug);

  successResponse(res, result, 'Institución obtenida exitosamente');
});

/**
 * Controlador para obtener institución actual (mi institución)
 * GET /api/v1/institutions/me
 */
export const getCurrentInstitutionController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const result = await getCurrentInstitution(req.institutionId);

  successResponse(res, result, 'Institución obtenida exitosamente');
});

/**
 * Controlador para actualizar institución
 * PUT /api/v1/institutions/:id
 */
export const updateInstitutionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  
  // Verificar permisos
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Super admin o admin de la misma institución
  if (!(req.user.roleName === 'ADMIN' && (!req.user.institutionId || req.user.institutionId === id))) {
    badRequestResponse(res, 'Sin permisos para actualizar esta institución');
    return;
  }

  const result = await updateInstitution(id, req.body);

  successResponse(res, result, 'Institución actualizada exitosamente');
});

/**
 * Controlador para eliminar institución (soft delete)
 * DELETE /api/v1/institutions/:id
 */
export const deleteInstitutionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Solo super admins pueden eliminar instituciones
  if (!req.user || req.user.roleName !== 'ADMIN' || req.user.institutionId) {
    badRequestResponse(res, 'Solo super administradores pueden eliminar instituciones');
    return;
  }

  const { id } = req.params;
  await deleteInstitution(id);

  successResponse(res, { success: true }, 'Institución eliminada exitosamente');
});

/**
 * Controlador para obtener estadísticas de la institución
 * GET /api/v1/institutions/me/stats
 */
export const getInstitutionStatsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const result = await getInstitutionStats(req.institutionId);

  successResponse(res, result, 'Estadísticas de institución obtenidas exitosamente');
});