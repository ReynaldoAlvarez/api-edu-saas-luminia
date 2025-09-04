import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';
import { hashPassword } from '@/shared/utils/password';

/**
 * Servicio para gestión de usuarios
 * Maneja CRUD de usuarios con filtrado multi-tenant
 */

/**
 * Interface para datos de creación de usuario
 */
export interface CreateUserData {
  email: string;
  password?: string;
  fullName: string;
  ci?: string;
  phone?: string;
  institutionId: string;
  roleName: string;
  attributes?: any;
}

/**
 * Interface para datos de actualización de usuario
 */
export interface UpdateUserData {
  fullName?: string;
  ci?: string;
  phone?: string;
  isActive?: boolean;
  attributes?: any;
}

/**
 * Interface para filtros de búsqueda
 */
export interface UserFilters {
  institutionId: string;
  roleName?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Interface para respuesta paginada
 */
export interface PaginatedUsers {
  users: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Crear un nuevo usuario
 */
export const createUser = async (data: CreateUserData): Promise<any> => {
  try {
    // Verificar que el email no esté en uso
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw createAppError('El email ya está registrado', 409);
    }

    // Verificar que la institución existe
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
      select: { id: true, status: true },
    });

    if (!institution || institution.status !== 'active') {
      throw createAppError('Institución no encontrada o inactiva', 404);
    }

    // Buscar el rol
    console.log("ROLNAME ----")
    console.log(data.roleName)
    const role = await prisma.role.findFirst({
      where: {
        name: data.roleName as any,
        OR: [
          { institutionId: data.institutionId },
          { isSystem: true },
        ],
      },
    });
    console.log("get role:", role)
    if (!role) {
      throw createAppError('Rol no encontrado', 404);
    }

    // Hashear contraseña si se proporciona
    let hashedPassword = null;
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
    }

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
          attributes: data.attributes,
        },
        include: {
          institution: {
            select: { id: true, name: true },
          },
        },
      });

      // Asignar rol
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
          isPrimary: true,
        },
      });

      return newUser;
    });

    logBusinessEvent('user_created', data.institutionId, result.id, {
      roleName: data.roleName,
      method: 'admin_creation',
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error creando usuario', 500);
  }
};

/**
 * Obtener usuarios con filtros y paginación
 */
export const getUsers = async (filters: UserFilters): Promise<PaginatedUsers> => {
  try {
    const page = typeof filters.page === 'string' ? parseInt(filters.page, 10) : filters.page || 1;
const limit = typeof filters.limit === 'string' ? parseInt(filters.limit, 10) : filters.limit || 10;
const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {
      institutionId: filters.institutionId,
    };

    if (filters.isActive !== undefined) {
      where.isActive = typeof filters.isActive === 'string' ? filters.isActive === 'true' : filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { ci: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.roleName) {
      where.userRoles = {
        some: {
          role: {
            name: filters.roleName,
          },
        },
      };
    }

    // Obtener usuarios y total
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
          institution: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo usuarios', 500);
  }
};

/**
 * Obtener usuario por ID
 */
export const getUserById = async (id: string, institutionId: string): Promise<any> => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id,
        institutionId,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        institution: {
          select: { id: true, name: true },
        },
        student: true,
        teacher: true,
        tutorProfile: true,
      },
    });

    if (!user) {
      throw createAppError('Usuario no encontrado', 404);
    }

    return user;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo usuario', 500);
  }
};

/**
 * Actualizar usuario
 */
export const updateUser = async (
  id: string,
  institutionId: string,
  data: UpdateUserData
): Promise<any> => {
  try {
    // Verificar que el usuario existe y pertenece a la institución
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        institutionId,
      },
    });

    if (!existingUser) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        institution: {
          select: { id: true, name: true },
        },
      },
    });

    logBusinessEvent('user_updated', institutionId, id, {
      updatedFields: Object.keys(data),
    });

    return updatedUser;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando usuario', 500);
  }
};

/**
 * Eliminar usuario (soft delete)
 */
export const deleteUser = async (id: string, institutionId: string): Promise<boolean> => {
  try {
    // Verificar que el usuario existe
    const user = await prisma.user.findFirst({
      where: {
        id,
        institutionId,
      },
    });

    if (!user) {
      throw createAppError('Usuario no encontrado', 404);
    }

    // Soft delete - marcar como inactivo
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    logBusinessEvent('user_deleted', institutionId, id, {
      method: 'soft_delete',
    });

    return true;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error eliminando usuario', 500);
  }
};