import { Response } from 'express';
import { 
  assignRoleToUser, 
  removeRoleFromUser, 
  getUserRoles, 
  setPrimaryRole, 
  getAvailableRoles 
} from '../services/role.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';

/**
 * Controladores para gestión de roles de usuarios
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para asignar rol a usuario
 * POST /api/v1/users/:userId/roles
 */
export const assignRoleController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { userId } = req.params;
  const { roleId, isPrimary } = req.body;

  const result = await assignRoleToUser({
    userId,
    roleId,
    isPrimary,
    institutionId: req.institutionId,
  });

  createdResponse(res, result, 'Rol asignado exitosamente');
});

/**
 * Controlador para remover rol de usuario
 * DELETE /api/v1/users/:userId/roles/:roleId
 */
export const removeRoleController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { userId, roleId } = req.params;

  await removeRoleFromUser(userId, roleId, req.institutionId);

  successResponse(res, { success: true }, 'Rol removido exitosamente');
});

/**
 * Controlador para obtener roles de usuario
 * GET /api/v1/users/:userId/roles
 */
export const getUserRolesController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { userId } = req.params;

  const result = await getUserRoles({
    userId,
    institutionId: req.institutionId,
  });

  successResponse(res, result, 'Roles del usuario obtenidos exitosamente');
});

/**
 * Controlador para cambiar rol primario
 * PUT /api/v1/users/:userId/roles/primary
 */
export const setPrimaryRoleController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { userId } = req.params;
  const { roleId } = req.body;

  const result = await setPrimaryRole(userId, roleId, req.institutionId);

  successResponse(res, result, 'Rol primario cambiado exitosamente');
});

/**
 * Controlador para obtener roles disponibles
 * GET /api/v1/users/roles/available
 */
export const getAvailableRolesController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const result = await getAvailableRoles(req.institutionId);

  successResponse(res, result, 'Roles disponibles obtenidos exitosamente');
});