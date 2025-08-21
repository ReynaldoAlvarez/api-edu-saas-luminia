import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  changeUserPassword,
  requestPasswordResetController,
  resetPassword,
  verifyToken,
  getUserPermissions,
} from './controllers/auth.controller';
import {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateChangePassword,
  validateRequestPasswordReset,
  validateResetPassword,
} from './validators/auth.validator';
import { authenticate } from '@/shared/middleware/auth.middleware';
import { setTenantContext } from '@/shared/middleware/tenant.middleware';

/**
 * Rutas del módulo de autenticación
 * Define todos los endpoints relacionados con autenticación
 */

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', validateRegister, register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login', validateLogin, login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refrescar tokens de acceso
 * @access  Public
 */
router.post('/refresh', validateRefreshToken, refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Cerrar sesión
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Obtener información del usuario actual
 * @access  Private
 */
router.get('/me', authenticate, setTenantContext, getCurrentUser);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Cambiar contraseña del usuario actual
 * @access  Private
 */
router.put('/change-password', authenticate, validateChangePassword, changeUserPassword);

/**
 * @route   POST /api/v1/auth/request-password-reset
 * @desc    Solicitar reset de contraseña
 * @access  Public
 */
router.post('/request-password-reset', validateRequestPasswordReset, requestPasswordResetController);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Resetear contraseña con token
 * @access  Public
 */
router.post('/reset-password', validateResetPassword, resetPassword);

/**
 * @route   GET /api/v1/auth/verify
 * @desc    Verificar validez del token
 * @access  Private
 */
router.get('/verify', authenticate, verifyToken);

/**
 * @route   GET /api/v1/auth/permissions
 * @desc    Obtener permisos del usuario actual
 * @access  Private
 */
router.get('/permissions', authenticate, setTenantContext, getUserPermissions);

export default router;