import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, JwtPayload } from '@/shared/utils/jwt';
import { unauthorizedResponse, forbiddenResponse } from '@/shared/utils/response';
import { logAuthEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';

/**
 * Middleware de autenticación
 * Verifica tokens JWT y establece información del usuario en el request
 */

/**
 * Interface extendida para Request con información de autenticación
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    institutionId: string;
    roleId: string;
    roleName: string;
    isActive: boolean;
    attributes?: any;
  };
  token?: string;
}

/**
 * Middleware principal de autenticación
 * Verifica el token JWT y carga la información del usuario
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      logAuthEvent('missing_token', undefined, req.ip, req.get('User-Agent'));
      unauthorizedResponse(res, 'Token de acceso requerido');
      return;
    }

    // Verificar y decodificar el token
    let decoded: JwtPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token inválido';
      logAuthEvent('invalid_token', undefined, req.ip, req.get('User-Agent'), {
        error: errorMessage,
      });
      unauthorizedResponse(res, errorMessage);
      return;
    }

    // Verificar que el usuario existe y está activo
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        institution: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      logAuthEvent('user_not_found', decoded.userId, req.ip, req.get('User-Agent'));
      unauthorizedResponse(res, 'Usuario no encontrado');
      return;
    }

    if (!user.isActive) {
      logAuthEvent('user_inactive', user.id, req.ip, req.get('User-Agent'));
      unauthorizedResponse(res, 'Usuario inactivo');
      return;
    }

    // Verificar que la institución está activa
    if (user.institution?.status !== 'active') {
      logAuthEvent('institution_inactive', user.id, req.ip, req.get('User-Agent'), {
        institutionId: user.institutionId,
      });
      forbiddenResponse(res, 'Institución inactiva');
      return;
    }

    // Verificar que el usuario tiene al menos un rol activo
    const activeRole = user.userRoles.find(userRole => userRole.isPrimary) || user.userRoles[0];
    if (!activeRole) {
      logAuthEvent('no_active_role', user.id, req.ip, req.get('User-Agent'));
      forbiddenResponse(res, 'Usuario sin roles activos');
      return;
    }

    // Establecer información del usuario en el request
    req.user = {
      id: user.id,
      email: user.email,
      institutionId: user.institutionId as string,  
      roleId: activeRole.roleId,
      roleName: activeRole.role.name,
      isActive: user.isActive,
      attributes: user.attributes,
    };

    req.token = token;

    // Log de autenticación exitosa
    logAuthEvent('auth_success', user.id, req.ip, req.get('User-Agent'), {
      institutionId: user.institutionId,
      roleName: activeRole.role.name,
    });

    next();
  } catch (error) {
    logAuthEvent('auth_error', undefined, req.ip, req.get('User-Agent'), {
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
    unauthorizedResponse(res, 'Error de autenticación');
  }
};

/**
 * Middleware de autenticación opcional
 * Similar al authenticate pero no falla si no hay token
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    // Si no hay token, continuar sin autenticar
    if (!token) {
      next();
      return;
    }

    // Si hay token, intentar autenticar
    await authenticate(req, res, next);
  } catch (error) {
    // En caso de error, continuar sin autenticar
    next();
  }
};

/**
 * Middleware para verificar roles específicos
 * @param allowedRoles - Array de nombres de roles permitidos
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorizedResponse(res, 'Autenticación requerida');
      return;
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      logAuthEvent('insufficient_role', req.user.id, req.ip, req.get('User-Agent'), {
        requiredRoles: allowedRoles,
        userRole: req.user.roleName,
      });
      forbiddenResponse(res, 'Permisos insuficientes');
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario pertenece a una institución específica
 * @param institutionId - ID de la institución requerida (opcional, usa la del token si no se especifica)
 */
export const requireInstitution = (institutionId?: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorizedResponse(res, 'Autenticación requerida');
      return;
    }

    const requiredInstitutionId = institutionId || req.params.institutionId;
    
    if (requiredInstitutionId && req.user.institutionId !== requiredInstitutionId) {
      logAuthEvent('institution_mismatch', req.user.id, req.ip, req.get('User-Agent'), {
        userInstitution: req.user.institutionId,
        requiredInstitution: requiredInstitutionId,
      });
      forbiddenResponse(res, 'Acceso denegado a esta institución');
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario puede acceder a sus propios recursos
 * @param userIdParam - Nombre del parámetro que contiene el ID del usuario (por defecto 'userId')
 */
export const requireSelfOrRole = (allowedRoles: string[], userIdParam: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorizedResponse(res, 'Autenticación requerida');
      return;
    }

    const targetUserId = req.params[userIdParam];
    
    // Permitir si es el mismo usuario o tiene un rol permitido
    if (req.user.id === targetUserId || allowedRoles.includes(req.user.roleName)) {
      next();
      return;
    }

    logAuthEvent('access_denied', req.user.id, req.ip, req.get('User-Agent'), {
      targetUserId,
      userRole: req.user.roleName,
      allowedRoles,
    });
    forbiddenResponse(res, 'Acceso denegado');
  };
};

/**
 * Middleware para verificar que el usuario es administrador del sistema
 */
export const requireSystemAdmin = requireRole(['ADMIN']);

/**
 * Middleware para verificar que el usuario es administrador o director
 */
export const requireAdminOrDirector = requireRole(['ADMIN', 'DIRECTOR']);

/**
 * Middleware para verificar que el usuario es docente o superior
 */
export const requireTeacherOrAbove = requireRole(['ADMIN', 'DIRECTOR', 'TEACHER']);