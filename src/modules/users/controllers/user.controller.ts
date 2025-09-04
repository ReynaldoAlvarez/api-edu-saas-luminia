import { Response } from 'express';
import { 
  createUser, 
  getUsers, 
  getUserById, 
  updateUser, 
  deleteUser 
} from '../services/user.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';

/**
 * Controladores para gestión de usuarios
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para crear usuario
 * POST /api/v1/users
 */
export const createUserController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }
console.log("------------------ROL")
  const userData = {
    ...req.body,
    institutionId: req.institutionId,
  };

  const result = await createUser(userData);

  createdResponse(res, result, 'Usuario creado exitosamente');
});

/**
 * Controlador para listar usuarios
 * GET /api/v1/users
 */
export const getUsersController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    console.log("NO SE ENCONTRO INSTITUCIONID ---------")
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const filters = {
    ...req.query,
    institutionId: req.institutionId,
  };

  const result = await getUsers(filters as any);

  successResponse(res, result, 'Usuarios obtenidos exitosamente');
});

/**
 * Controlador para obtener usuario por ID
 * GET /api/v1/users/:id
 */
export const getUserByIdController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await getUserById(id, req.institutionId);

  successResponse(res, result, 'Usuario obtenido exitosamente');
});

/**
 * Controlador para actualizar usuario
 * PUT /api/v1/users/:id
 */
export const updateUserController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await updateUser(id, req.institutionId, req.body);

  successResponse(res, result, 'Usuario actualizado exitosamente');
});

/**
 * Controlador para eliminar usuario
 * DELETE /api/v1/users/:id
 */
export const deleteUserController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  await deleteUser(id, req.institutionId);

  successResponse(res, { success: true }, 'Usuario eliminado exitosamente');
});