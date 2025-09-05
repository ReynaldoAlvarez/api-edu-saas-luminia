import { Router } from 'express';

// Controladores
import {
  createStudentController,
  getStudentsController,
  getStudentByIdController,
  getStudentByNumberController,
  updateStudentController,
  updateStudentStatusController,
  deleteStudentController,
  getStudentStatsController,
} from './controllers/student.controller';

// Validadores
import {
  validateCreateStudent,
  validateUpdateStudent,
  validateUpdateStudentStatus,
  validateStudentFilters,
  validateStudentIdParam,
  validateStudentNumberParam,
} from './validators/student.validator';

// Middleware
import { authenticate } from '@/shared/middleware/auth.middleware';
import { setTenantContext, validateTenantAccess } from '@/shared/middleware/tenant.middleware';
import { requireABACPermission } from '@/shared/middleware/abac.middleware';

/**
 * Rutas del módulo de estudiantes
 * Define todos los endpoints relacionados con gestión de estudiantes
 */

const router = Router();

// Middleware común para todas las rutas
router.use(authenticate);
router.use(setTenantContext);
router.use(validateTenantAccess);

// ========================================
// RUTAS ESPECÍFICAS (DEBEN IR PRIMERO)
// ========================================

/**
 * @route   GET /api/v1/students/stats
 * @desc    Obtener estadísticas de estudiantes
 * @access  Private (ADMIN, DIRECTOR, SECRETARY)
 */
router.get(
  '/stats',
  ...requireABACPermission('student', 'read', ['ADMIN', 'DIRECTOR', 'SECRETARY']),
  getStudentStatsController
);

/**
 * @route   GET /api/v1/students/by-number/:studentNumber
 * @desc    Obtener estudiante por número
 * @access  Private (ADMIN, DIRECTOR, SECRETARY, TEACHER)
 */
router.get(
  '/by-number/:studentNumber',
  ...requireABACPermission('student', 'read', ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER']),
  validateStudentNumberParam,
  getStudentByNumberController
);

// ========================================
// RUTAS PRINCIPALES
// ========================================

/**
 * @route   GET /api/v1/students
 * @desc    Listar estudiantes con filtros
 * @access  Private (ADMIN, DIRECTOR, SECRETARY, TEACHER)
 */
router.get(
  '/',
  ...requireABACPermission('student', 'read', ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER']),
  validateStudentFilters,
  getStudentsController
);

/**
 * @route   POST /api/v1/students
 * @desc    Crear nuevo estudiante
 * @access  Private (ADMIN, DIRECTOR, SECRETARY)
 */
router.post(
  '/',
  ...requireABACPermission('student', 'create', ['ADMIN', 'DIRECTOR', 'SECRETARY']),
  validateCreateStudent,
  createStudentController
);

/**
 * @route   GET /api/v1/students/:id
 * @desc    Obtener estudiante por ID
 * @access  Private (ADMIN, DIRECTOR, SECRETARY, TEACHER, propio estudiante)
 */
router.get(
  '/:id',
  validateStudentIdParam,
  getStudentByIdController
);

/**
 * @route   PUT /api/v1/students/:id
 * @desc    Actualizar estudiante
 * @access  Private (ADMIN, DIRECTOR, SECRETARY, propio estudiante)
 */
router.put(
  '/:id',
  validateStudentIdParam,
  validateUpdateStudent,
  updateStudentController
);

/**
 * @route   PUT /api/v1/students/:id/status
 * @desc    Cambiar estado del estudiante
 * @access  Private (ADMIN, DIRECTOR, SECRETARY)
 */
router.put(
  '/:id/status',
  ...requireABACPermission('student', 'update', ['ADMIN', 'DIRECTOR', 'SECRETARY']),
  validateStudentIdParam,
  validateUpdateStudentStatus,
  updateStudentStatusController
);

/**
 * @route   DELETE /api/v1/students/:id
 * @desc    Eliminar estudiante (soft delete)
 * @access  Private (ADMIN, DIRECTOR)
 */
router.delete(
  '/:id',
  ...requireABACPermission('student', 'delete', ['ADMIN', 'DIRECTOR']),
  validateStudentIdParam,
  deleteStudentController
);

export default router;