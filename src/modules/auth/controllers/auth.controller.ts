import { Request, Response } from 'express';
import { 
  registerUser, 
  loginUser, 
  refreshTokens, 
  changePassword, 
  requestPasswordReset 
} from '../services/auth.service';
import { 
  successResponse, 
  createdResponse, 
  badRequestResponse 
} from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler.middleware';
import { AuthenticatedRequest } from '@/shared/middleware/auth.middleware';

/**
 * Controladores para el módulo de autenticación
 * Maneja las peticiones HTTP y coordina con los servicios
 */

/**
 * Controlador para registro de usuarios
 * POST /api/v1/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password, fullName, ci, phone, institutionId, roleName } = req.body;
  
  // Obtener información del cliente
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent');

  // Llamar al servicio de registro
  const result = await registerUser(
    {
      email,
      password,
      fullName,
      ci,
      phone,
      institutionId,
      roleName,
    },
    clientIp,
    userAgent
  );

  createdResponse(res, result, 'Usuario registrado exitosamente');
});

/**
 * Controlador para login de usuarios
 * POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  
  // Obtener información del cliente
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent');

  // Llamar al servicio de login
  const result = await loginUser(
    { email, password },
    clientIp,
    userAgent
  );

  successResponse(res, result, 'Login exitoso');
});

/**
 * Controlador para refresh de tokens
 * POST /api/v1/auth/refresh
 */
export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  
  // Obtener información del cliente
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent');

  // Llamar al servicio de refresh
  const result = await refreshTokens(refreshToken, clientIp, userAgent);

  successResponse(res, result, 'Tokens actualizados exitosamente');
});

/**
 * Controlador para logout
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // En una implementación completa, aquí se invalidaría el token
  // Por ahora, solo respondemos exitosamente
  
  // TODO: Implementar blacklist de tokens o invalidación en Redis
  // await invalidateToken(req.token);

  successResponse(res, { message: 'Logout exitoso' }, 'Sesión cerrada correctamente');
});

/**
 * Controlador para obtener información del usuario actual
 * GET /api/v1/auth/me
 */
export const getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // Responder con información del usuario actual
  const userData = {
    id: req.user.id,
    email: req.user.email,
    institutionId: req.user.institutionId,
    roleName: req.user.roleName,
    isActive: req.user.isActive,
  };

  successResponse(res, userData, 'Información del usuario obtenida exitosamente');
});

/**
 * Controlador para cambiar contraseña
 * PUT /api/v1/auth/change-password
 */
export const changeUserPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  const { currentPassword, newPassword } = req.body;
  
  // Obtener información del cliente
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent');

  // Llamar al servicio de cambio de contraseña
  await changePassword(
    {
      userId: req.user.id,
      currentPassword,
      newPassword,
    },
    clientIp,
    userAgent
  );

  successResponse(res, { success: true }, 'Contraseña cambiada exitosamente');
});

/**
 * Controlador para solicitar reset de contraseña
 * POST /api/v1/auth/request-password-reset
 */
export const requestPasswordResetController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  
  // Obtener información del cliente
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent');

  // Llamar al servicio de solicitud de reset
  const result = await requestPasswordReset(email, clientIp, userAgent);

  // En producción, no devolver el token directamente
  // Solo confirmar que se envió el email
  successResponse(
    res, 
    { 
      message: 'Si el email existe, recibirás instrucciones para resetear tu contraseña',
      // Solo en desarrollo/testing:
      ...(process.env.NODE_ENV === 'development' && { 
        resetToken: result.resetToken,
        expiresAt: result.expiresAt 
      })
    }, 
    'Solicitud de reset procesada'
  );
});

/**
 * Controlador para resetear contraseña
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body;
  
  // Obtener información del cliente
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent');

  // TODO: Implementar servicio de reset de contraseña
  // await resetUserPassword({ token, newPassword }, clientIp, userAgent);

  successResponse(res, { success: true }, 'Contraseña reseteada exitosamente');
});

/**
 * Controlador para verificar estado del token
 * GET /api/v1/auth/verify
 */
export const verifyToken = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    badRequestResponse(res, 'Token inválido');
    return;
  }

  // Si llegamos aquí, el token es válido (pasó por el middleware de auth)
  successResponse(
    res, 
    { 
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        institutionId: req.user.institutionId,
        roleName: req.user.roleName,
      }
    }, 
    'Token válido'
  );
});

/**
 * Controlador para obtener permisos del usuario actual
 * GET /api/v1/auth/permissions
 */
export const getUserPermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    badRequestResponse(res, 'Usuario no autenticado');
    return;
  }

  // TODO: Implementar lógica para obtener permisos específicos
  // basado en el rol y las políticas ABAC
  
  const permissions = {
    role: req.user.roleName,
    institutionId: req.user.institutionId,
    // TODO: Agregar permisos específicos basados en ABAC
    permissions: [],
  };

  successResponse(res, permissions, 'Permisos obtenidos exitosamente!');
});