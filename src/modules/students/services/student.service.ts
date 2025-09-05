import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';
import { hashPassword } from '@/shared/utils/password';

/**
 * Servicio para gestión de estudiantes
 * Maneja creación y gestión de perfiles Student con User base
 */

/**
 * Interface para datos de creación de estudiante
 */
export interface CreateStudentData {
  // Datos del User base
  email: string;
  password?: string;
  fullName: string;
  ci?: string;
  phone?: string;
  institutionId: string;
  
  // Datos específicos del Student
  careerId?: string;
  enrollmentDate?: Date;
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'SUSPENDED';
  metadata?: any;
}

/**
 * Interface para datos de actualización de estudiante
 */
export interface UpdateStudentData {
  // Datos del User
  fullName?: string;
  ci?: string;
  phone?: string;
  isActive?: boolean;
  
  // Datos del Student
  careerId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'SUSPENDED';
  metadata?: any;
}

/**
 * Interface para filtros de estudiantes
 */
export interface StudentFilters {
  institutionId: string;
  careerId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'SUSPENDED';
  isActive?: boolean;
  search?: string;
  enrollmentYear?: number;
  page?: number;
  limit?: number;
}

/**
 * Generar número de estudiante único
 */
const generateStudentNumber = async (institutionId: string): Promise<string> => {
  const year = new Date().getFullYear();
  
  // Buscar el último número del año actual
  const lastStudent = await prisma.student.findFirst({
    where: {
      institutionId,
      studentNumber: {
        startsWith: `EST-${year}-`,
      },
    },
    orderBy: {
      studentNumber: 'desc',
    },
  });

  let nextNumber = 1;
  if (lastStudent && lastStudent.studentNumber) {
    const parts = lastStudent.studentNumber.split('-');
    if (parts.length === 3) {
      nextNumber = parseInt(parts[2]) + 1;
    }
  }

  return `EST-${year}-${nextNumber.toString().padStart(4, '0')}`;
};

/**
 * Crear un nuevo estudiante
 */
export const createStudent = async (data: CreateStudentData): Promise<any> => {
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

    // Verificar carrera si se proporciona
    let career = null;
    if (data.careerId) {
      career = await prisma.career.findFirst({
        where: {
          id: data.careerId,
          institutionId: data.institutionId,
        },
      });

      if (!career) {
        throw createAppError('Carrera no encontrada o no pertenece a la institución', 404);
      }
    }

    // Buscar el rol STUDENT
    const studentRole = await prisma.role.findFirst({
      where: {
        name: 'STUDENT',
        OR: [
          { institutionId: data.institutionId },
          { isSystem: true },
        ],
      },
    });

    if (!studentRole) {
      throw createAppError('Rol de estudiante no encontrado', 404);
    }

    // Hashear contraseña si se proporciona
    let hashedPassword = null;
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
    }

    // Generar número de estudiante
    const studentNumber = await generateStudentNumber(data.institutionId);

    // Crear estudiante en transacción
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

      // 2. Crear Student
      const newStudent = await tx.student.create({
        data: {
          userId: newUser.id,
          studentNumber,
          institutionId: data.institutionId,
          careerId: data.careerId,
          enrollmentDate: data.enrollmentDate || new Date(),
          status: data.status || 'ACTIVE',
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
          career: {
            select: { id: true, name: true, code: true, level: true },
          },
          institution: {
            select: { id: true, name: true },
          },
        },
      });

      // 3. Asignar rol STUDENT
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: studentRole.id,
          isPrimary: true,
        },
      });

      return newStudent;
    });

    logBusinessEvent('student_created', data.institutionId, result.userId, {
      studentNumber,
      careerId: data.careerId,
      method: 'admin_creation',
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error creando estudiante', 500);
  }
};

/**
 * Obtener estudiantes con filtros
 */
export const getStudents = async (filters: StudentFilters): Promise<any> => {
  try {
    // Convertir y validar parámetros
    const page = Math.max(1, parseInt(String(filters.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit || 10), 10)));
    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {
      institutionId: filters.institutionId,
    };

    if (filters.careerId) {
      where.careerId = filters.careerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isActive !== undefined) {
      const isActiveValue = typeof filters.isActive === 'string' 
        ? filters.isActive === 'true' 
        : filters.isActive;
      where.user = {
        isActive: isActiveValue,
      };
    }

    if (filters.search) {
      where.OR = [
        { studentNumber: { contains: filters.search, mode: 'insensitive' } },
        { user: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
        { user: { ci: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters.enrollmentYear) {
      const startOfYear = new Date(filters.enrollmentYear, 0, 1);
      const endOfYear = new Date(filters.enrollmentYear, 11, 31, 23, 59, 59);
      where.enrollmentDate = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    // Obtener estudiantes y total
    const [students, total] = await Promise.all([
      prisma.student.findMany({
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
          career: {
            select: { id: true, name: true, code: true, level: true },
          },
          institution: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    return {
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo estudiantes', 500);
  }
};

/**
 * Obtener estudiante por ID
 */
export const getStudentById = async (id: string, institutionId: string): Promise<any> => {
  try {
    const student = await prisma.student.findFirst({
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
        career: {
          select: { id: true, name: true, code: true, level: true },
        },
        institution: {
          select: { id: true, name: true },
        },
        enrollments: {
          include: {
            course: {
              select: { id: true, name: true, code: true },
            },
            academicPeriod: {
              select: { id: true, name: true },
            },
          },
        },
        subjects: {
          include: {
            subject: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (!student) {
      throw createAppError('Estudiante no encontrado', 404);
    }

    return student;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo estudiante', 500);
  }
};

/**
 * Obtener estudiante por número
 */
export const getStudentByNumber = async (studentNumber: string, institutionId: string): Promise<any> => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        studentNumber,
        institutionId,
      },
      include: {
        user: {
          include: {
            institution: {
              select: { id: true, name: true },
            },
          },
        },
        career: {
          select: { id: true, name: true, code: true, level: true },
        },
      },
    });

    if (!student) {
      throw createAppError('Estudiante no encontrado', 404);
    }

    return student;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo estudiante por número', 500);
  }
};

/**
 * Actualizar estudiante
 */
export const updateStudent = async (
  id: string,
  institutionId: string,
  data: UpdateStudentData
): Promise<any> => {
  try {
    // Verificar que el estudiante existe
    const existingStudent = await prisma.student.findFirst({
      where: {
        id,
        institutionId,
      },
      include: {
        user: true,
      },
    });

    if (!existingStudent) {
      throw createAppError('Estudiante no encontrado', 404);
    }

    // Verificar carrera si se proporciona
    if (data.careerId) {
      const career = await prisma.career.findFirst({
        where: {
          id: data.careerId,
          institutionId,
        },
      });

      if (!career) {
        throw createAppError('Carrera no encontrada o no pertenece a la institución', 404);
      }
    }

    // Separar datos de User y Student
    const { fullName, ci, phone, isActive, ...studentData } = data;
    const userData = { fullName, ci, phone, isActive };

    // Actualizar en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar User si hay datos
      if (Object.keys(userData).some(key => userData[key as keyof typeof userData] !== undefined)) {
        await tx.user.update({
          where: { id: existingStudent.userId },
          data: userData,
        });
      }

      // Actualizar Student
      const updatedStudent = await tx.student.update({
        where: { id },
        data: studentData,
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
          career: {
            select: { id: true, name: true, code: true, level: true },
          },
          institution: {
            select: { id: true, name: true },
          },
        },
      });

      return updatedStudent;
    });

    logBusinessEvent('student_updated', institutionId, existingStudent.userId, {
      updatedFields: Object.keys(data),
    });

    return result;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando estudiante', 500);
  }
};

/**
 * Actualizar estado del estudiante
 */
export const updateStudentStatus = async (
  id: string,
  institutionId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'SUSPENDED'
): Promise<any> => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        id,
        institutionId,
      },
    });

    if (!student) {
      throw createAppError('Estudiante no encontrado', 404);
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    logBusinessEvent('student_status_changed', institutionId, student.userId, {
      oldStatus: student.status,
      newStatus: status,
    });

    return updatedStudent;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando estado del estudiante', 500);
  }
};

/**
 * Eliminar estudiante (soft delete)
 */
export const deleteStudent = async (id: string, institutionId: string): Promise<boolean> => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        id,
        institutionId,
      },
    });

    if (!student) {
      throw createAppError('Estudiante no encontrado', 404);
    }

    // Soft delete - marcar usuario como inactivo y estudiante como WITHDRAWN
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.userId },
        data: { isActive: false },
      });

      await tx.student.update({
        where: { id },
        data: { status: 'WITHDRAWN' },
      });
    });

    logBusinessEvent('student_deleted', institutionId, student.userId, {
      method: 'soft_delete',
      studentNumber: student.studentNumber,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error eliminando estudiante', 500);
  }
};

/**
 * Obtener estadísticas básicas de estudiantes
 */
export const getStudentStats = async (institutionId: string): Promise<any> => {
  try {
    const [
      totalStudents,
      activeStudents,
      inactiveStudents,
      graduatedStudents,
      withdrawnStudents,
      suspendedStudents,
    ] = await Promise.all([
      prisma.student.count({ where: { institutionId } }),
      prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
      prisma.student.count({ where: { institutionId, status: 'INACTIVE' } }),
      prisma.student.count({ where: { institutionId, status: 'GRADUATED' } }),
      prisma.student.count({ where: { institutionId, status: 'WITHDRAWN' } }),
      prisma.student.count({ where: { institutionId, status: 'SUSPENDED' } }),
    ]);

    return {
      total: totalStudents,
      byStatus: {
        active: activeStudents,
        inactive: inactiveStudents,
        graduated: graduatedStudents,
        withdrawn: withdrawnStudents,
        suspended: suspendedStudents,
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo estadísticas de estudiantes', 500);
  }
};