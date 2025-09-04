import { Response } from 'express';
import { 
  createTeacher, 
  getTeachers, 
  getTeacherById, 
  updateTeacher 
} from '../services/teacher.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';

/**
 * Controladores para gestión de docentes
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para crear docente
 * POST /api/v1/users/teachers
 */
export const createTeacherController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const teacherData = {
    ...req.body,
    institutionId: req.institutionId,
  };

  const result = await createTeacher(teacherData);

  createdResponse(res, result, 'Docente creado exitosamente');
});

/**
 * Controlador para listar docentes
 * GET /api/v1/users/teachers
 */
export const getTeachersController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }
  console.log("docentes----------", req.institutionId)
  const filters = {
    ...req.query,
    institutionId: req.institutionId,
  };

  const result = await getTeachers(filters as any);

  successResponse(res, result, 'Docentes obtenidos exitosamente');
});

/**
 * Controlador para obtener docente por ID
 * GET /api/v1/users/teachers/:id
 */
export const getTeacherByIdController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await getTeacherById(id, req.institutionId);

  successResponse(res, result, 'Docente obtenido exitosamente');
});

/**
 * Controlador para actualizar docente
 * PUT /api/v1/users/teachers/:id
 */
export const updateTeacherController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await updateTeacher(id, req.institutionId, req.body);

  successResponse(res, result, 'Docente actualizado exitosamente');
});