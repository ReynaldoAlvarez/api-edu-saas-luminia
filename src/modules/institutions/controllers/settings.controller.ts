import { Response } from 'express';
import { 
  getCurrentInstitution,
  updateInstitution,
  getBasicInstitutionData
} from '../services/institution.service';
import { 
  getPlanUsageStats
} from '../services/subscription.service';
import { 
  successResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';

/**
 * Controladores para gestión de configuración de instituciones
 * Maneja settings, uso de recursos y configuración general
 */

/**
 * Controlador para obtener configuración de la institución
 * GET /api/v1/institutions/me/settings
 */
export const getSettingsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const institution = await getCurrentInstitution(req.institutionId);

  // Solo retornar settings y datos básicos
  const settingsData = {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    contactEmail: institution.contactEmail,
    phone: institution.phone,
    address: institution.address,
    settings: institution.settings,
    status: institution.status,
    createdAt: institution.createdAt,
  };

  successResponse(res, settingsData, 'Configuración obtenida exitosamente');
});

/**
 * Controlador para actualizar configuración de la institución
 * PUT /api/v1/institutions/me/settings
 */
export const updateSettingsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  // Obtener la institución actual para conservar los campos requeridos
  const currentInstitution = await getBasicInstitutionData(req.institutionId);

  // Crear el objeto de actualización asegurando que cumple con UpdateInstitutionData
  const updateData = {
    ...currentInstitution,
    settings: req.body,
  };

  const result = await updateInstitution(req.institutionId, updateData);

  successResponse(res, {
    id: result.id,
    name: result.name,
    settings: result.settings,
  }, 'Configuración actualizada exitosamente');
});

/**
 * Controlador para obtener estadísticas de uso del plan
 * GET /api/v1/institutions/me/usage
 */
export const getUsageStatsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const stats = await getPlanUsageStats(req.institutionId);

  successResponse(res, stats, 'Estadísticas de uso obtenidas exitosamente');
});

/**
 * Controlador para actualizar información básica de la institución
 * PUT /api/v1/institutions/me
 */
export const updateInstitutionInfoController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  console.log("-----updateData:",req.body)
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  // Solo permitir actualizar ciertos campos
  const allowedFields = ['name', 'contactEmail', 'phone', 'address'];
  const updateData: any = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }


  const result = await updateInstitution(req.institutionId, updateData);

  successResponse(res, {
    id: result.id,
    name: result.name,
    contactEmail: result.contactEmail,
    phone: result.phone,
    address: result.address,
  }, 'Información de institución actualizada exitosamente');
});