import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';
import { hashPassword } from '@/shared/utils/password';

/**
 * Servicio para gestión de tutores
 * Maneja creación y gestión de perfiles TutorProfile con User base
 */

/**
 * Interface para datos de creación de tutor
 */
export interface CreateTutorData {
  // Datos del User base
  email: string;
  password?: string;
  fullName: string;
  ci?: string;
  phone?: string;
  institutionId: string;
  
  // Datos específicos del TutorProfile
  relationship?: string;
  address?: string;
  metadata?: any;
}

/**
 * Interface para datos de actualización de tutor
 */
export interface UpdateTutorData {
  // Datos del User
  fullName?: string;
  ci?: string;
  phone?: string;
  isActive?: boolean;
  
  // Datos del TutorProfile
  relationship?: string;
  address?: string;
  metadata?: any;
}

/**
 * Interface para filtros de tutores
 */
export interface TutorFilters {
  institutionId: string;
  isActive?: boolean;
  search?: string;
  relationship?: string;
  page?: number;
  limit?: number;
}

/**
 * Crear un nuevo tutor
 */
export const createTutor = async (data: CreateTutorData): Promise<any> => {
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

    // Buscar el rol TUTOR
    const tutorRole = await prisma.role.findFirst({
      where: {
        name: 'TUTOR',
        OR: [
          { institutionId: data.institutionId },
          { isSystem: true },
        ],
      },
    });

    if (!tutorRole) {
      throw createAppError('Rol de tutor no encontrado', 404);
    }

    // Hashear contraseña si se proporciona
    let hashedPassword = null;
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
    }

    // Crear tutor en transacción
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

      // 2. Crear TutorProfile
      const newTutor = await tx.tutorProfile.create({
        data: {
          userId: newUser.id,
          institutionId: data.institutionId,
          relationship: data.relationship,
          phone: data.phone, // TutorProfile también tiene phone
          address: data.address,
          metadata: data.metadata,
        },
        include: {
          user: {
            include: {
              institution: {
                select: { id: true, name: true },
              },
            },
          },
          institution: {
            select: { id: true, name: true },
          },
        },
      });

      // 3. Asignar rol TUTOR
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: tutorRole.id,
          isPrimary: true,
        },
      });

      return newTutor;
    });

    logBusinessEvent('tutor_created', data.institutionId, result.userId, {
      relationship: data.relationship,
      method: 'admin_creation',
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error creando tutor', 500);
  }
};

/**
 * Obtener tutores con filtros
 */
export const getTutors = async (filters: TutorFilters): Promise<any> => {
  try {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {
      institutionId: filters.institutionId,
    };

    if (filters.isActive !== undefined) {
      where.user = {
        isActive: filters.isActive,
      };
    }

    if (filters.search) {
      where.user = {
        ...where.user,
        OR: [
          { fullName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    if (filters.relationship) {
      where.relationship = {
        contains: filters.relationship,
        mode: 'insensitive',
      };
    }

    // Obtener tutores y total
    const [tutors, total] = await Promise.all([
      prisma.tutorProfile.findMany({
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
          institution: {
            select: { id: true, name: true },
          },
          tutorAssignments: {
            include: {
              student: {
                include: {
                  user: {
                    select: { id: true, fullName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tutorProfile.count({ where }),
    ]);

    return {
      tutors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo tutores', 500);
  }
};

/**
 * Obtener tutor por ID
 */
export const getTutorById = async (id: string, institutionId: string): Promise<any> => {
  try {
    const tutor = await prisma.tutorProfile.findFirst({
      where: {
        id,
        institutionId,
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
        institution: {
          select: { id: true, name: true },
        },
        tutorAssignments: {
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!tutor) {
      throw createAppError('Tutor no encontrado', 404);
    }

    return tutor;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo tutor', 500);
  }
};

/**
 * Actualizar tutor
 */
export const updateTutor = async (
  id: string,
  institutionId: string,
  data: UpdateTutorData
): Promise<any> => {
  try {
    // Verificar que el tutor existe
    const existingTutor = await prisma.tutorProfile.findFirst({
      where: {
        id,
        institutionId,
      },
      include: {
        user: true,
      },
    });

    if (!existingTutor) {
      throw createAppError('Tutor no encontrado', 404);
    }

    // Separar datos de User y TutorProfile
    const { fullName, ci, phone, isActive, ...tutorData } = data;
    const userData = { fullName, ci, phone, isActive };

    // Actualizar en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar User si hay datos
      if (Object.keys(userData).some(key => userData[key as keyof typeof userData] !== undefined)) {
        await tx.user.update({
          where: { id: existingTutor.userId },
          data: userData,
        });
      }

      // Actualizar TutorProfile
      const updatedTutor = await tx.tutorProfile.update({
        where: { id },
        data: {
          ...tutorData,
          // Si se actualiza phone en User, también actualizar en TutorProfile
          ...(phone && { phone }),
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
          institution: {
            select: { id: true, name: true },
          },
          tutorAssignments: {
            include: {
              student: {
                include: {
                  user: {
                    select: { id: true, fullName: true },
                  },
                },
              },
            },
          },
        },
      });

      return updatedTutor;
    });

    logBusinessEvent('tutor_updated', institutionId, existingTutor.userId, {
      updatedFields: Object.keys(data),
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando tutor', 500);
  }
};