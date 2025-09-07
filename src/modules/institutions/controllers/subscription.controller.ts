import { Response } from 'express';
import { 
  createSubscription,
  getCurrentSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscriptionHistory,
  getPlanUsageStats
} from '../services/subscription.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';
import { AuthenticatedRequest } from '@/shared/middleware/auth.middleware';

/**
 * Controladores para gestión de suscripciones de instituciones
 * Maneja planes, renovaciones y verificación de límites
 */

/**
 * Controlador para crear suscripción
 * POST /api/v1/institutions/:id/subscription
 */
export const createSubscriptionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Solo super admins o admins de la institución pueden crear suscripciones
  const { id: institutionId } = req.params;
  
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Verificar permisos
  if (!(req.user.roleName === 'ADMIN' && (!req.user.institutionId || req.user.institutionId === institutionId))) {
    badRequestResponse(res, 'Sin permisos para crear suscripción');
    return;
  }

  const subscriptionData = {
    institutionId,
    ...req.body,
  };

  const result = await createSubscription(subscriptionData);

  createdResponse(res, result, 'Suscripción creada exitosamente');
});

/**
 * Controlador para obtener suscripción actual
 * GET /api/v1/institutions/:id/subscription
 */
export const getCurrentSubscriptionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: institutionId } = req.params;
  
  // Verificar permisos
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Super admin o usuario de la misma institución
  if (!(req.user.roleName === 'ADMIN' || req.user.institutionId === institutionId)) {
    badRequestResponse(res, 'Sin permisos para ver suscripción');
    return;
  }

  const result = await getCurrentSubscription(institutionId);

  successResponse(res, result, 'Suscripción obtenida exitosamente');
});

/**
 * Controlador para obtener suscripción actual (endpoint para mi institución)
 * GET /api/v1/institutions/me/subscription
 */
export const getMySubscriptionController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const result = await getCurrentSubscription(req.institutionId);

  successResponse(res, result, 'Suscripción obtenida exitosamente');
});

/**
 * Controlador para actualizar suscripción
 * PUT /api/v1/institutions/:id/subscription/:subscriptionId
 */
export const updateSubscriptionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { subscriptionId } = req.params;
  
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Solo super admins o admins de la institución pueden actualizar
  // (La verificación de institución se hace en el servicio)
  
  const result = await updateSubscription(subscriptionId, req.body);

  successResponse(res, result, 'Suscripción actualizada exitosamente');
});

/**
 * Controlador para cancelar suscripción
 * DELETE /api/v1/institutions/:id/subscription/:subscriptionId
 */
export const cancelSubscriptionController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { subscriptionId } = req.params;
  
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Solo super admins o admins de la institución pueden cancelar
  // (La verificación se hace en el servicio)
  
  await cancelSubscription(subscriptionId);

  successResponse(res, { success: true }, 'Suscripción cancelada exitosamente');
});

/**
 * Controlador para obtener historial de suscripciones
 * GET /api/v1/institutions/:id/subscription/history
 */
export const getSubscriptionHistoryController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: institutionId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Super admin o usuario de la misma institución
  if (!(req.user.roleName === 'ADMIN' || req.user.institutionId === institutionId)) {
    badRequestResponse(res, 'Sin permisos para ver historial');
    return;
  }

  const result = await getSubscriptionHistory(institutionId, page, limit);

  successResponse(res, result, 'Historial de suscripciones obtenido exitosamente');
});

/**
 * Controlador para obtener historial de suscripciones (mi institución)
 * GET /api/v1/institutions/me/subscription/history
 */
export const getMySubscriptionHistoryController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await getSubscriptionHistory(req.institutionId, page, limit);

  successResponse(res, result, 'Historial de suscripciones obtenido exitosamente');
});

/**
 * Controlador para obtener estadísticas de uso del plan
 * GET /api/v1/institutions/:id/usage
 */
export const getInstitutionUsageController = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: institutionId } = req.params;
  
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Super admin o usuario de la misma institución
  if (!(req.user.roleName === 'ADMIN' || req.user.institutionId === institutionId)) {
    badRequestResponse(res, 'Sin permisos para ver estadísticas');
    return;
  }

  const stats = await getPlanUsageStats(institutionId);

  successResponse(res, stats, 'Estadísticas de uso obtenidas exitosamente');
});