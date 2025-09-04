import { Router } from 'express';

// Controladores
import {
  createUserController,
  getUsersController,
  getUserByIdController,
  updateUserController,
  deleteUserController,
} from './controllers/user.controller';

import {
  createTeacherController,
  getTeachersController,
  getTeacherByIdController,
  updateTeacherController,
} from './controllers/teacher.controller';

import {
  createTutorController,
  getTutorsController,
  getTutorByIdController,
  updateTutorController,
} from './controllers/tutor.controller';

import {
  assignRoleController,
  removeRoleController,
  getUserRolesController,
  setPrimaryRoleController,
  getAvailableRolesController,
} from './controllers/role.controller';

// Validadores
import {
  validateCreateUser,
  validateUpdateUser,
  validateUserFilters,
  validateUserIdParam,
} from './validators/user.validator';

import {
  validateCreateTeacher,
  validateUpdateTeacher,
  validateTeacherFilters,
  validateTeacherIdParam,
} from './validators/teacher.validator';

import {
  validateCreateTutor,
  validateUpdateTutor,
  validateTutorFilters,
  validateTutorIdParam,
} from './validators/tutor.validator';

import {
  validateAssignRole,
  validateSetPrimaryRole,
  validateUserRoleParams,
  validateUserIdParam as validateRoleUserIdParam,
} from './validators/role.validator';

// Middleware
import { authenticate } from '@/shared/middleware/auth.middleware';
import { setTenantContext, validateTenantAccess } from '@/shared/middleware/tenant.middleware';
import { requireABACPermission } from '@/shared/middleware/abac.middleware';

/**
 * Rutas del módulo de usuarios
 * Define todos los endpoints relacionados con gestión de usuarios
 */

const router = Router();

// Middleware común para todas las rutas
router.use(authenticate);
router.use(setTenantContext);
router.use(validateTenantAccess);

// ========================================
// RUTAS DE USUARIOS GENERALES
// ========================================

/**
 * @route   GET /api/v1/users
 * @desc    Listar usuarios con filtros
 * @access  Private (ADMIN, DIRECTOR)
 */
router.get(
  '/',
  ...requireABACPermission('user', 'read', ['ADMIN', 'DIRECTOR']),
  validateUserFilters,
  getUsersController
);

/**
 * @route   POST /api/v1/users
 * @desc    Crear nuevo usuario
 * @access  Private (ADMIN, DIRECTOR)
 */
router.post(
  '/',
  ...requireABACPermission('user', 'create', ['ADMIN', 'DIRECTOR']),
  validateCreateUser,
  createUserController
);



// ========================================
// RUTAS DE DOCENTES
// ========================================

/**
 * @route   GET /api/v1/users/teachers
 * @desc    Listar docentes
 * @access  Private (ADMIN, DIRECTOR, SECRETARY)
 */
router.get(
  '/teachers',
  ...requireABACPermission('teacher', 'read', ['ADMIN', 'DIRECTOR', 'SECRETARY']),
  validateTeacherFilters,
  getTeachersController
);

/**
 * @route   POST /api/v1/users/teachers
 * @desc    Crear nuevo docente
 * @access  Private (ADMIN, DIRECTOR)
 */
router.post(
  '/teachers',
  ...requireABACPermission('teacher', 'create', ['ADMIN', 'DIRECTOR']),
  validateCreateTeacher,
  createTeacherController
);



// ========================================
// RUTAS DE TUTORES
// ========================================

/**
 * @route   GET /api/v1/users/tutors
 * @desc    Listar tutores
 * @access  Private (ADMIN, DIRECTOR, SECRETARY)
 */
router.get(
  '/tutors',
  ...requireABACPermission('tutor', 'read', ['ADMIN', 'DIRECTOR', 'SECRETARY']),
  validateTutorFilters,
  getTutorsController
);

/**
 * @route   POST /api/v1/users/tutors
 * @desc    Crear nuevo tutor
 * @access  Private (ADMIN, DIRECTOR, SECRETARY)
 */
router.post(
  '/tutors',
  ...requireABACPermission('tutor', 'create', ['ADMIN', 'DIRECTOR', 'SECRETARY']),
  validateCreateTutor,
  createTutorController
);



// ========================================
// RUTAS DE GESTIÓN DE ROLES
// ========================================

/**
 * @route   GET /api/v1/users/roles/available
 * @desc    Obtener roles disponibles para la institución
 * @access  Private (ADMIN, DIRECTOR)
 */
router.get(
  '/roles/available',
  ...requireABACPermission('role', 'read', ['ADMIN', 'DIRECTOR']),
  getAvailableRolesController
);

/**
 * @route   GET /api/v1/users/teachers/:id
 * @desc    Obtener docente por ID
 * @access  Private (ADMIN, DIRECTOR, SECRETARY, propio docente)
 */
router.get(
  '/teachers/:id',
  validateTeacherIdParam,
  getTeacherByIdController
);

/**
 * @route   PUT /api/v1/users/teachers/:id
 * @desc    Actualizar docente
 * @access  Private (ADMIN, DIRECTOR, propio docente)
 */
router.put(
  '/teachers/:id',
  validateTeacherIdParam,
  validateUpdateTeacher,
  updateTeacherController
);

/**
 * @route   GET /api/v1/users/tutors/:id
 * @desc    Obtener tutor por ID
 * @access  Private (ADMIN, DIRECTOR, SECRETARY, propio tutor)
 */
router.get(
  '/tutors/:id',
  validateTutorIdParam,
  getTutorByIdController
);

/**
 * @route   PUT /api/v1/users/tutors/:id
 * @desc    Actualizar tutor
 * @access  Private (ADMIN, DIRECTOR, propio tutor)
 */
router.put(
  '/tutors/:id',
  validateTutorIdParam,
  validateUpdateTutor,
  updateTutorController
);
/**
 * @route   GET /api/v1/users/:userId/roles
 * @desc    Obtener roles de un usuario
 * @access  Private (ADMIN, DIRECTOR)
 */
router.get(
  '/:userId/roles',
  ...requireABACPermission('role', 'read', ['ADMIN', 'DIRECTOR']),
  validateRoleUserIdParam,
  getUserRolesController
);

/**
 * @route   POST /api/v1/users/:userId/roles
 * @desc    Asignar rol a usuario
 * @access  Private (ADMIN, DIRECTOR)
 */
router.post(
  '/:userId/roles',
  ...requireABACPermission('role', 'create', ['ADMIN', 'DIRECTOR']),
  validateRoleUserIdParam,
  validateAssignRole,
  assignRoleController
);

/**
 * @route   DELETE /api/v1/users/:userId/roles/:roleId
 * @desc    Remover rol de usuario
 * @access  Private (ADMIN, DIRECTOR)
 */
router.delete(
  '/:userId/roles/:roleId',
  ...requireABACPermission('role', 'delete', ['ADMIN', 'DIRECTOR']),
  validateUserRoleParams,
  removeRoleController
);

/**
 * @route   PUT /api/v1/users/:userId/roles/primary
 * @desc    Cambiar rol primario de usuario
 * @access  Private (ADMIN, DIRECTOR)
 */
router.put(
  '/:userId/roles/primary',
  ...requireABACPermission('role', 'update', ['ADMIN', 'DIRECTOR']),
  validateRoleUserIdParam,
  validateSetPrimaryRole,
  setPrimaryRoleController
);


/**
 * @route   GET /api/v1/users/:id
 * @desc    Obtener usuario por ID
 * @access  Private (ADMIN, DIRECTOR, propio usuario)
 */
router.get(
  '/:id',
  validateUserIdParam,
  getUserByIdController
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Actualizar usuario
 * @access  Private (ADMIN, DIRECTOR, propio usuario)
 */
router.put(
  '/:id',
  validateUserIdParam,
  validateUpdateUser,
  updateUserController
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Eliminar usuario (soft delete)
 * @access  Private (ADMIN, DIRECTOR)
 */
router.delete(
  '/:id',
  ...requireABACPermission('user', 'delete', ['ADMIN', 'DIRECTOR']),
  validateUserIdParam,
  deleteUserController
);
export default router;