import { Response } from 'express';
import { 
  createTutor, 
  getTutors, 
  getTutorById, 
  updateTutor 
} from '../services/tutor.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';

/**
 * Controladores para gestión de tutores
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para crear tutor
 * POST /api/v1/users/tutors
 */
export const createTutorController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const tutorData = {
    ...req.body,
    institutionId: req.institutionId,
  };

  const result = await createTutor(tutorData);

  createdResponse(res, result, 'Tutor creado exitosamente');
});

/**
 * Controlador para listar tutores
 * GET /api/v1/users/tutors
 */
export const getTutorsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const filters = {
    ...req.query,
    institutionId: req.institutionId,
  };

  const result = await getTutors(filters as any);

  successResponse(res, result, 'Tutores obtenidos exitosamente');
});

/**
 * Controlador para obtener tutor por ID
 * GET /api/v1/users/tutors/:id
 */
export const getTutorByIdController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await getTutorById(id, req.institutionId);

  successResponse(res, result, 'Tutor obtenido exitosamente');
});

/**
 * Controlador para actualizar tutor
 * PUT /api/v1/users/tutors/:id
 */
export const updateTutorController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await updateTutor(id, req.institutionId, req.body);

  successResponse(res, result, 'Tutor actualizado exitosamente');
});