import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';
import { hashPassword } from '@/shared/utils/password';

/**
 * Servicio para gestión de docentes
 * Maneja creación y gestión de perfiles Teacher con User base
 */

/**
 * Interface para datos de creación de docente
 */
export interface CreateTeacherData {
  // Datos del User base
  email: string;
  password?: string;
  fullName: string;
  ci?: string;
  phone?: string;
  institutionId: string;
  
  // Datos específicos del Teacher
  bio?: string;
  specialties?: string[];
  hireDate?: Date;
}

/**
 * Interface para datos de actualización de docente
 */
export interface UpdateTeacherData {
  // Datos del User
  fullName?: string;
  ci?: string;
  phone?: string;
  isActive?: boolean;
  
  // Datos del Teacher
  bio?: string;
  specialties?: string[];
  hireDate?: Date;
}

/**
 * Interface para filtros de docentes
 */
export interface TeacherFilters {
  institutionId: string;
  isActive?: boolean;
  search?: string;
  specialty?: string;
  page?: number;
  limit?: number;
}

/**
 * Crear un nuevo docente
 */
export const createTeacher = async (data: CreateTeacherData): Promise<any> => {
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

    // Buscar el rol TEACHER
    const teacherRole = await prisma.role.findFirst({
      where: {
        name: 'TEACHER',
        OR: [
          { institutionId: data.institutionId },
          { isSystem: true },
        ],
      },
    });

    if (!teacherRole) {
      throw createAppError('Rol de docente no encontrado', 404);
    }

    // Hashear contraseña si se proporciona
    let hashedPassword = null;
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
    }

    // Crear docente en transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear User
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

      // 2. Crear Teacher profile
      const newTeacher = await tx.teacher.create({
        data: {
          userId: newUser.id,
          bio: data.bio,
          specialties: data.specialties || [],
          hireDate: data.hireDate,
        },
        include: {
          user: {
            include: {
              institution: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      // 3. Asignar rol TEACHER
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: teacherRole.id,
          isPrimary: true,
        },
      });

      return newTeacher;
    });

    logBusinessEvent('teacher_created', data.institutionId, result.userId, {
      specialties: data.specialties,
      method: 'admin_creation',
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error creando docente', 500);
  }
};

/**
 * Obtener docentes con filtros
 */
export const getTeachers = async (filters: TeacherFilters): Promise<any> => {
  try {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {
      user: {
        institutionId: filters.institutionId,
      },
    };

    if (filters.isActive !== undefined) {
      where.user.isActive = filters.isActive;
    }

    if (filters.search) {
      where.user.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.specialty) {
      where.specialties = {
        has: filters.specialty,
      };
    }

    // Obtener docentes y total
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        include: {
          user: {
            include: {
              institution: {
                select: { id: true, name: true },
              },
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.teacher.count({ where }),
    ]);

    return {
      teachers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo docentes', 500);
  }
};

/**
 * Obtener docente por ID
 */
export const getTeacherById = async (id: string, institutionId: string): Promise<any> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id,
        user: {
          institutionId,
        },
      },
      include: {
        user: {
          include: {
            institution: {
              select: { id: true, name: true },
            },
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw createAppError('Docente no encontrado', 404);
    }

    return teacher;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo docente', 500);
  }
};

/**
 * Actualizar docente
 */
export const updateTeacher = async (
  id: string,
  institutionId: string,
  data: UpdateTeacherData
): Promise<any> => {
  try {
    // Verificar que el docente existe
    const existingTeacher = await prisma.teacher.findFirst({
      where: {
        id,
        user: {
          institutionId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!existingTeacher) {
      throw createAppError('Docente no encontrado', 404);
    }

    // Separar datos de User y Teacher
    const { fullName, ci, phone, isActive, ...teacherData } = data;
    const userData = { fullName, ci, phone, isActive };

    // Actualizar en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar User si hay datos
      if (Object.keys(userData).some(key => userData[key as keyof typeof userData] !== undefined)) {
        await tx.user.update({
          where: { id: existingTeacher.userId },
          data: userData,
        });
      }

      // Actualizar Teacher
      const updatedTeacher = await tx.teacher.update({
        where: { id },
        data: teacherData,
        include: {
          user: {
            include: {
              institution: {
                select: { id: true, name: true },
              },
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      });

      return updatedTeacher;
    });

    logBusinessEvent('teacher_updated', institutionId, existingTeacher.userId, {
      updatedFields: Object.keys(data),
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando docente', 500);
  }
};