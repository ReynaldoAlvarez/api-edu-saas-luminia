import bcrypt from 'bcryptjs';
import { 
  hashPassword, 
  verifyPassword, 
  generateTemporaryPassword,
  generatePasswordResetToken,
  validatePassword 
} from '@/shared/utils/password';
import { 
  generateTokenPair, 
  verifyRefreshToken, 
  JwtPayload 
} from '@/shared/utils/jwt';
import { logAuthEvent, logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';
import { createAppError } from '@/shared/middleware/error-handler.middleware';

/**
 * Servicio de autenticación
 * Maneja login, registro, refresh tokens y gestión de contraseñas
 */

/**
 * Interface para datos de registro
 */
export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  ci?: string;
  phone?: string;
  institutionId: string;
  roleName: string;
}

/**
 * Interface para datos de login
 */
export interface LoginData {
  email: string;
  password: string;
}

/**
 * Interface para respuesta de autenticación
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    institutionId: string;
    roleName: string;
    isActive: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
    tokenType: 'Bearer';
  };
}

/**
 * Interface para datos de cambio de contraseña
 */
export interface ChangePasswordData {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Interface para datos de reset de contraseña
 */
export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

/**
 * Función para registrar un nuevo usuario
 * @param data - Datos del usuario a registrar
 * @param clientIp - IP del cliente
 * @param userAgent - User agent del cliente
 * @returns Respuesta de autenticación con tokens
 */
export const registerUser = async (
  data: RegisterData,
  clientIp?: string,
  userAgent?: string
): Promise<AuthResponse> => {
  try {
    // Validar que el email no esté en uso
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw createAppError('El email ya está registrado', 409);
    }

    // Validar que la institución existe y está activa
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
      select: { id: true, status: true, name: true },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    if (institution.status !== 'active') {
      throw createAppError('Institución no activa', 403);
    }

    // Validar que el rol existe
    const role = await prisma.role.findFirst({
      where: {
        name: data.roleName as any,
        OR: [
          { institutionId: data.institutionId },
          { isSystem: true },
        ],
      },
    });

    if (!role) {
      throw createAppError('Rol no encontrado', 404);
    }

    // Validar contraseña
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      throw createAppError(`Contraseña inválida: ${passwordValidation.errors.join(', ')}`, 400);
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(data.password);

    // Crear usuario en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          fullName: data.fullName,
          ci: data.ci,
          phone: data.phone,
          institutionId: data.institutionId,
          isActive: true,
        },
      });

      // Asignar rol al usuario
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
          isPrimary: true,
        },
      });

      // Crear perfil específico según el rol
      if (data.roleName === 'STUDENT') {
        await tx.student.create({
          data: {
            userId: newUser.id,
            institutionId: data.institutionId,
            status: 'ACTIVE',
          },
        });
      } else if (data.roleName === 'TEACHER') {
        await tx.teacher.create({
          data: {
            userId: newUser.id,
          },
        });
      } else if (data.roleName === 'TUTOR') {
        await tx.tutorProfile.create({
          data: {
            userId: newUser.id,
            institutionId: data.institutionId,
          },
        });
      }

      return newUser;
    });

    // Generar tokens
    const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: result.id,
      institutionId: data.institutionId,
      roleId: role.id,
      roleName: data.roleName,
      email: result.email,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Log del evento
    logAuthEvent('user_registered', result.id, clientIp, userAgent, {
      institutionId: data.institutionId,
      roleName: data.roleName,
    });

    logBusinessEvent('user_created', data.institutionId, result.id, {
      roleName: data.roleName,
      method: 'registration',
    });

    return {
      user: {
        id: result.id,
        email: result.email,
        fullName: result.fullName,
        institutionId: data.institutionId,
        roleName: data.roleName,
        isActive: result.isActive,
      },
      tokens,
    };
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error interno durante el registro', 500);
  }
};

/**
 * Función para autenticar un usuario
 * @param data - Datos de login
 * @param clientIp - IP del cliente
 * @param userAgent - User agent del cliente
 * @returns Respuesta de autenticación con tokens
 */
export const loginUser = async (
  data: LoginData,
  clientIp?: string,
  userAgent?: string
): Promise<AuthResponse> => {
  try {
    // Buscar usuario con sus roles
    const user = await prisma.user.findUnique({
      where: { email: data.email },
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
            name: true,
          },
        },
      },
    });

    if (!user) {
      logAuthEvent('login_failed', undefined, clientIp, userAgent, {
        email: data.email,
        reason: 'user_not_found',
      });
      throw createAppError('Credenciales inválidas', 401);
    }

    // Verificar que el usuario esté activo
    if (!user.isActive) {
      logAuthEvent('login_failed', user.id, clientIp, userAgent, {
        reason: 'user_inactive',
      });
      throw createAppError('Usuario inactivo', 401);
    }

    // Verificar que la institución esté activa
    if (!user.institution || user.institution.status !== 'active') {
      logAuthEvent('login_failed', user.id, clientIp, userAgent, {
        reason: 'institution_inactive',
      });
      throw createAppError('Institución inactiva', 403);
    }

    // Verificar contraseña
    if (!user.password) {
      logAuthEvent('login_failed', user.id, clientIp, userAgent, {
        reason: 'no_password_set',
      });
      throw createAppError('Credenciales inválidas', 401);
    }

    const isPasswordValid = await verifyPassword(data.password, user.password);
    if (!isPasswordValid) {
      logAuthEvent('login_failed', user.id, clientIp, userAgent, {
        reason: 'invalid_password',
      });
      throw createAppError('Credenciales inválidas', 401);
    }

    // Obtener rol primario
    const primaryRole = user.userRoles.find(ur => ur.isPrimary) || user.userRoles[0];
    if (!primaryRole) {
      logAuthEvent('login_failed', user.id, clientIp, userAgent, {
        reason: 'no_role_assigned',
      });
      throw createAppError('Usuario sin roles asignados', 403);
    }

    // Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generar tokens
    const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      institutionId: user.institutionId!,
      roleId: primaryRole.roleId,
      roleName: primaryRole.role.name,
      email: user.email,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Log del evento exitoso
    logAuthEvent('login_success', user.id, clientIp, userAgent, {
      institutionId: user.institutionId,
      roleName: primaryRole.role.name,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        institutionId: user.institutionId!,
        roleName: primaryRole.role.name,
        isActive: user.isActive,
      },
      tokens,
    };
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error interno durante el login', 500);
  }
};

/**
 * Función para refrescar tokens
 * @param refreshToken - Token de refresh
 * @param clientIp - IP del cliente
 * @param userAgent - User agent del cliente
 * @returns Nuevos tokens
 */
export const refreshTokens = async (
  refreshToken: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: string; tokenType: 'Bearer' }> => {
  try {
    // Verificar refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Buscar usuario y verificar que sigue activo
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
            status: true,
          },
        },
      },
    });

    if (!user || !user.isActive || user.institution?.status !== 'active') {
      logAuthEvent('refresh_failed', decoded.userId, clientIp, userAgent, {
        reason: 'user_or_institution_inactive',
      });
      throw createAppError('Token de refresh inválido', 401);
    }

    // Obtener rol primario
    const primaryRole = user.userRoles.find(ur => ur.isPrimary) || user.userRoles[0];
    if (!primaryRole) {
      throw createAppError('Usuario sin roles asignados', 403);
    }

    // Generar nuevos tokens
    const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      institutionId: user.institutionId!,
      roleId: primaryRole.roleId,
      roleName: primaryRole.role.name,
      email: user.email,
    };

    const tokens = generateTokenPair(tokenPayload);

    logAuthEvent('token_refreshed', user.id, clientIp, userAgent);

    return tokens;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error refrescando tokens', 500);
  }
};

/**
 * Función para cambiar contraseña
 * @param data - Datos de cambio de contraseña
 * @param clientIp - IP del cliente
 * @param userAgent - User agent del cliente
 * @returns true si el cambio fue exitoso
 */
export const changePassword = async (
  data: ChangePasswordData,
  clientIp?: string,
  userAgent?: string
): Promise<boolean> => {
  try {
    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, password: true, email: true },
    });

    if (!user || !user.password) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await verifyPassword(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      logAuthEvent('password_change_failed', user.id, clientIp, userAgent, {
        reason: 'invalid_current_password',
      });
      throw createAppError('Contraseña actual incorrecta', 400);
    }

    // Validar nueva contraseña
    const passwordValidation = validatePassword(data.newPassword);
    if (!passwordValidation.isValid) {
      throw createAppError(`Nueva contraseña inválida: ${passwordValidation.errors.join(', ')}`, 400);
    }

    // Hashear nueva contraseña
    const hashedNewPassword = await hashPassword(data.newPassword);

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: data.userId },
      data: { password: hashedNewPassword },
    });

    logAuthEvent('password_changed', user.id, clientIp, userAgent);

    return true;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error cambiando contraseña', 500);
  }
};

/**
 * Función para solicitar reset de contraseña
 * @param email - Email del usuario
 * @param clientIp - IP del cliente
 * @param userAgent - User agent del cliente
 * @returns Token de reset (en producción se enviaría por email)
 */
export const requestPasswordReset = async (
  email: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ resetToken: string; expiresAt: Date }> => {
  try {
    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // Por seguridad, no revelar si el email existe o no
      logAuthEvent('password_reset_requested', undefined, clientIp, userAgent, {
        email,
        found: false,
      });
      
      // Simular tiempo de procesamiento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        resetToken: 'dummy-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
      };
    }

    // Generar token de reset
    const resetToken = generatePasswordResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Guardar token en atributos del usuario (en producción usar tabla separada)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        attributes: {
          ...((user as any).attributes || {}),
          passwordResetToken: resetToken,
          passwordResetExpires: expiresAt.toISOString(),
        },
      },
    });

    logAuthEvent('password_reset_requested', user.id, clientIp, userAgent, {
      email,
      found: true,
    });

    // TODO: Enviar email con el token
    // await sendPasswordResetEmail(user.email, resetToken);

    return { resetToken, expiresAt };
  } catch (error) {
    throw createAppError('Error procesando solicitud de reset', 500);
  }
};