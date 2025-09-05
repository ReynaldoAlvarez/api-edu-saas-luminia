import { Response } from 'express';
import { 
  createStudent, 
  getStudents, 
  getStudentById, 
  getStudentByNumber,
  updateStudent,
  updateStudentStatus,
  deleteStudent,
  getStudentStats
} from '../services/student.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { TenantRequest } from '@/shared/middleware/tenant.middleware';

/**
 * Controladores para gestión de estudiantes
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para crear estudiante
 * POST /api/v1/students
 */
export const createStudentController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const studentData = {
    ...req.body,
    institutionId: req.institutionId,
  };

  const result = await createStudent(studentData);

  createdResponse(res, result, 'Estudiante creado exitosamente');
});

/**
 * Controlador para listar estudiantes
 * GET /api/v1/students
 */
export const getStudentsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const filters = {
    ...req.query,
    institutionId: req.institutionId,
  };

  const result = await getStudents(filters as any);

  successResponse(res, result, 'Estudiantes obtenidos exitosamente');
});

/**
 * Controlador para obtener estudiante por ID
 * GET /api/v1/students/:id
 */
export const getStudentByIdController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await getStudentById(id, req.institutionId);

  successResponse(res, result, 'Estudiante obtenido exitosamente');
});

/**
 * Controlador para obtener estudiante por número
 * GET /api/v1/students/by-number/:studentNumber
 */
export const getStudentByNumberController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { studentNumber } = req.params;
  const result = await getStudentByNumber(studentNumber, req.institutionId);

  successResponse(res, result, 'Estudiante obtenido exitosamente');
});

/**
 * Controlador para actualizar estudiante
 * PUT /api/v1/students/:id
 */
export const updateStudentController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const result = await updateStudent(id, req.institutionId, req.body);

  successResponse(res, result, 'Estudiante actualizado exitosamente');
});

/**
 * Controlador para cambiar estado de estudiante
 * PUT /api/v1/students/:id/status
 */
export const updateStudentStatusController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  const { status } = req.body;

  const result = await updateStudentStatus(id, req.institutionId, status);

  successResponse(res, result, 'Estado del estudiante actualizado exitosamente');
});

/**
 * Controlador para eliminar estudiante
 * DELETE /api/v1/students/:id
 */
export const deleteStudentController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const { id } = req.params;
  await deleteStudent(id, req.institutionId);

  successResponse(res, { success: true }, 'Estudiante eliminado exitosamente');
});

/**
 * Controlador para obtener estadísticas de estudiantes
 * GET /api/v1/students/stats
 */
export const getStudentStatsController = asyncHandler(async (req: TenantRequest, res: Response): Promise<void> => {
  if (!req.institutionId) {
    badRequestResponse(res, 'Contexto de institución requerido');
    return;
  }

  const result = await getStudentStats(req.institutionId);

  successResponse(res, result, 'Estadísticas de estudiantes obtenidas exitosamente');
});