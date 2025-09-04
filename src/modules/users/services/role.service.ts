import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';

/**
 * Servicio para gestión de roles de usuarios
 * Maneja asignación, remoción y gestión de roles UserRole
 */

/**
 * Interface para asignación de rol
 */
export interface AssignRoleData {
  userId: string;
  roleId: string;
  isPrimary?: boolean;
  institutionId: string;
}

/**
 * Interface para filtros de roles de usuario
 */
export interface UserRoleFilters {
  userId: string;
  institutionId: string;
}

/**
 * Asignar rol a usuario
 */
export const assignRoleToUser = async (data: AssignRoleData): Promise<any> => {
  try {
    // Verificar que el usuario existe y pertenece a la institución
    const user = await prisma.user.findFirst({
      where: {
        id: data.userId,
        institutionId: data.institutionId,
      },
    });

    if (!user) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Verificar que el rol existe
    const role = await prisma.role.findFirst({
      where: {
        id: data.roleId,
        OR: [
          { institutionId: data.institutionId },
          { isSystem: true },
        ],
      },
    });

    if (!role) {
      throw createAppError('Rol no encontrado', 404);
    }

    // Verificar que el usuario no tenga ya este rol
    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: data.userId,
        roleId: data.roleId,
      },
    });

    if (existingUserRole) {
      throw createAppError('El usuario ya tiene este rol asignado', 409);
    }

    // Si se marca como primario, desmarcar otros roles primarios
    if (data.isPrimary) {
      await prisma.userRole.updateMany({
        where: {
          userId: data.userId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Crear la asignación de rol
    const userRole = await prisma.userRole.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        isPrimary: data.isPrimary || false,
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    logBusinessEvent('role_assigned', data.institutionId, data.userId, {
      roleId: data.roleId,
      roleName: role.name,
      isPrimary: data.isPrimary,
    });

    return userRole;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error asignando rol', 500);
  }
};

/**
 * Remover rol de usuario
 */
export const removeRoleFromUser = async (
  userId: string,
  roleId: string,
  institutionId: string
): Promise<boolean> => {
  try {
    // Verificar que el usuario existe y pertenece a la institución
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        institutionId,
      },
    });

    if (!user) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Verificar que la asignación de rol existe
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw createAppError('Asignación de rol no encontrada', 404);
    }

    // Verificar que no sea el único rol del usuario
    const userRoleCount = await prisma.userRole.count({
      where: { userId },
    });

    if (userRoleCount <= 1) {
      throw createAppError('No se puede remover el único rol del usuario', 400);
    }

    // Si era el rol primario, asignar otro como primario
    if (userRole.isPrimary) {
      const otherRole = await prisma.userRole.findFirst({
        where: {
          userId,
          id: { not: userRole.id },
        },
      });

      if (otherRole) {
        await prisma.userRole.update({
          where: { id: otherRole.id },
          data: { isPrimary: true },
        });
      }
    }

    // Eliminar la asignación de rol
    await prisma.userRole.delete({
      where: { id: userRole.id },
    });

    logBusinessEvent('role_removed', institutionId, userId, {
      roleId,
      roleName: userRole.role.name,
      wasPrimary: userRole.isPrimary,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error removiendo rol', 500);
  }
};

/**
 * Obtener roles de un usuario
 */
export const getUserRoles = async (filters: UserRoleFilters): Promise<any[]> => {
  try {
    // Verificar que el usuario existe y pertenece a la institución
    const user = await prisma.user.findFirst({
      where: {
        id: filters.userId,
        institutionId: filters.institutionId,
      },
    });

    if (!user) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Obtener roles del usuario
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: filters.userId,
      },
      include: {
        role: true,
      },
      orderBy: [
        { isPrimary: 'desc' },
        { assignedAt: 'desc' },
      ],
    });

    return userRoles;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo roles del usuario', 500);
  }
};

/**
 * Cambiar rol primario de usuario
 */
export const setPrimaryRole = async (
  userId: string,
  roleId: string,
  institutionId: string
): Promise<any> => {
  try {
    // Verificar que el usuario existe y pertenece a la institución
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        institutionId,
      },
    });

    if (!user) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Verificar que el usuario tiene este rol asignado
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw createAppError('El usuario no tiene este rol asignado', 404);
    }

    // Actualizar roles en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Desmarcar todos los roles como primarios
      await tx.userRole.updateMany({
        where: {
          userId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });

      // Marcar el rol especificado como primario
      const updatedUserRole = await tx.userRole.update({
        where: { id: userRole.id },
        data: { isPrimary: true },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      return updatedUserRole;
    });

    logBusinessEvent('primary_role_changed', institutionId, userId, {
      newPrimaryRoleId: roleId,
      newPrimaryRoleName: userRole.role.name,
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error cambiando rol primario', 500);
  }
};

/**
 * Obtener roles disponibles para una institución
 */
export const getAvailableRoles = async (institutionId: string): Promise<any[]> => {
  try {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { institutionId },
          { isSystem: true },
        ],
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });

    return roles;
  } catch (error) {
    throw createAppError('Error obteniendo roles disponibles', 500);
  }
};