import { Router } from 'express';

// Controladores
import {
  createInstitutionController,
  getInstitutionsController,
  getInstitutionByIdController,
  getInstitutionBySlugController,
  getCurrentInstitutionController,
  updateInstitutionController,
  deleteInstitutionController,
  getInstitutionStatsController,
} from './controllers/institution.controller';

import {
  getSettingsController,
  updateSettingsController,
  getUsageStatsController,
  updateInstitutionInfoController,
} from './controllers/settings.controller';

import {
  createSubscriptionController,
  getCurrentSubscriptionController,
  getMySubscriptionController,
  updateSubscriptionController,
  cancelSubscriptionController,
  getSubscriptionHistoryController,
  getMySubscriptionHistoryController,
  getInstitutionUsageController,
} from './controllers/subscription.controller';

// Validadores
import {
  validateCreateInstitution,
  validateUpdateInstitution,
  validateUpdateSettings,
  validateInstitutionFilters,
  validateInstitutionIdParam,
  validateInstitutionSlugParam,
} from './validators/institution.validator';

// Middleware
import { authenticate } from '@/shared/middleware/auth.middleware';
import { setTenantContext, validateTenantAccess } from '@/shared/middleware/tenant.middleware';
import { requireABACPermission } from '@/shared/middleware/abac.middleware';

/**
 * Rutas del módulo de instituciones
 * Define todos los endpoints relacionados con gestión de instituciones
 */

const router = Router();

// ========================================
// RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// ========================================

/**
 * @route   GET /api/v1/institutions/slug/:slug
 * @desc    Obtener institución por slug (público)
 * @access  Public
 */
router.get('/slug/:slug', validateInstitutionSlugParam, getInstitutionBySlugController);

// ========================================
// RUTAS PROTEGIDAS (CON AUTENTICACIÓN)
// ========================================

// Middleware común para rutas protegidas
router.use(authenticate);

/**
 * @route   POST /api/v1/institutions
 * @desc    Crear nueva institución (solo super admin)
 * @access  Private (Super Admin)
 */
router.post(
  '/',
  validateCreateInstitution,
  createInstitutionController
);

/**
 * @route   GET /api/v1/institutions
 * @desc    Listar instituciones (solo super admin)
 * @access  Private (Super Admin)
 */
router.get(
  '/',
  validateInstitutionFilters,
  getInstitutionsController
);

// ========================================
// RUTAS CON CONTEXTO DE TENANT
// ========================================

router.use(setTenantContext);
router.use(validateTenantAccess);

// ========================================
// RUTAS ESPECÍFICAS DE "ME" (DEBEN IR PRIMERO)
// ========================================

/**
 * @route   GET /api/v1/institutions/me
 * @desc    Obtener mi institución
 * @access  Private (Usuarios autenticados)
 */
router.get('/me', getCurrentInstitutionController);

/**
 * @route   PUT /api/v1/institutions/me
 * @desc    Actualizar información básica de mi institución
 * @access  Private (Admin de institución)
 */
router.put(
  '/me',
  requireABACPermission('institution', 'update', ['ADMIN']),
  validateUpdateInstitution,
  updateInstitutionInfoController
);

/**
 * @route   GET /api/v1/institutions/me/settings
 * @desc    Obtener configuración de mi institución
 * @access  Private (Usuarios autenticados)
 */
router.get('/me/settings', getSettingsController);

/**
 * @route   PUT /api/v1/institutions/me/settings
 * @desc    Actualizar configuración de mi institución
 * @access  Private (Admin de institución)
 */
router.put(
  '/me/settings',
  requireABACPermission('institution', 'update', ['ADMIN']),
  validateUpdateSettings,
  updateSettingsController
);

/**
 * @route   GET /api/v1/institutions/me/stats
 * @desc    Obtener estadísticas de mi institución
 * @access  Private (Usuarios autenticados)
 */
router.get('/me/stats', getInstitutionStatsController);

/**
 * @route   GET /api/v1/institutions/me/usage
 * @desc    Obtener estadísticas de uso del plan
 * @access  Private (Usuarios autenticados)
 */
router.get('/me/usage', getUsageStatsController);

/**
 * @route   GET /api/v1/institutions/me/subscription
 * @desc    Obtener suscripción actual de mi institución
 * @access  Private (Usuarios autenticados)
 */
router.get('/me/subscription', getMySubscriptionController);

/**
 * @route   GET /api/v1/institutions/me/subscription/history
 * @desc    Obtener historial de suscripciones de mi institución
 * @access  Private (Usuarios autenticados)
 */
router.get('/me/subscription/history', getMySubscriptionHistoryController);

// ========================================
// RUTAS CON PARÁMETROS (DEBEN IR AL FINAL)
// ========================================

/**
 * @route   GET /api/v1/institutions/:id
 * @desc    Obtener institución por ID (solo super admin)
 * @access  Private (Super Admin)
 */
router.get(
  '/:id',
  validateInstitutionIdParam,
  getInstitutionByIdController
);

/**
 * @route   PUT /api/v1/institutions/:id
 * @desc    Actualizar institución (solo super admin)
 * @access  Private (Super Admin)
 */
router.put(
  '/:id',
  validateInstitutionIdParam,
  validateUpdateInstitution,
  updateInstitutionController
);

/**
 * @route   DELETE /api/v1/institutions/:id
 * @desc    Eliminar institución (solo super admin)
 * @access  Private (Super Admin)
 */
router.delete(
  '/:id',
  validateInstitutionIdParam,
  deleteInstitutionController
);

/**
 * @route   POST /api/v1/institutions/:id/subscription
 * @desc    Crear suscripción para institución específica
 * @access  Private (Super Admin o Admin de institución)
 */
router.post(
  '/:id/subscription',
  validateInstitutionIdParam,
  requireABACPermission('subscription', 'create', ['ADMIN']),
  createSubscriptionController
);

/**
 * @route   GET /api/v1/institutions/:id/subscription
 * @desc    Obtener suscripción de institución específica
 * @access  Private (Super Admin o usuarios de la institución)
 */
router.get(
  '/:id/subscription',
  validateInstitutionIdParam,
  getCurrentSubscriptionController
);

/**
 * @route   PUT /api/v1/institutions/:id/subscription/:subscriptionId
 * @desc    Actualizar suscripción específica
 * @access  Private (Super Admin o Admin de institución)
 */
router.put(
  '/:id/subscription/:subscriptionId',
  requireABACPermission('subscription', 'update', ['ADMIN']),
  updateSubscriptionController
);

/**
 * @route   DELETE /api/v1/institutions/:id/subscription/:subscriptionId
 * @desc    Cancelar suscripción específica
 * @access  Private (Super Admin o Admin de institución)
 */
router.delete(
  '/:id/subscription/:subscriptionId',
  requireABACPermission('subscription', 'delete', ['ADMIN']),
  cancelSubscriptionController
);

/**
 * @route   GET /api/v1/institutions/:id/subscription/history
 * @desc    Obtener historial de suscripciones de institución específica
 * @access  Private (Super Admin o usuarios de la institución)
 */
router.get(
  '/:id/subscription/history',
  validateInstitutionIdParam,
  getSubscriptionHistoryController
);

/**
 * @route   GET /api/v1/institutions/:id/usage
 * @desc    Obtener estadísticas de uso de institución específica
 * @access  Private (Super Admin o usuarios de la institución)
 */
router.get(
  '/:id/usage',
  validateInstitutionIdParam,
  getInstitutionUsageController
);

export default router;