import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';

/**
 * Servicio para gestión de instituciones
 * Maneja CRUD de instituciones con multi-tenancy y validaciones
 */

/**
 * Interface para datos de creación de institución
 */
export interface CreateInstitutionData {
  name: string;
  contactEmail: string;
  phone?: string;
  address?: any;
  slug?: string;
}

/**
 * Interface para datos de actualización de institución
 */
export interface UpdateInstitutionData {
  name?: string;
  contactEmail?: string;
  phone?: string;
  address?: any;
  status?: string;
}

/**
 * Interface para filtros de búsqueda
 */
export interface InstitutionFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Generar slug único para la institución
 */
const generateUniqueSlug = async (name: string): Promise<string> => {
  // Crear slug base
  const baseSlug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50); // Limitar longitud
  
  // Verificar si ya existe y generar variante única
  let slug = baseSlug;
  let counter = 1;
  
  while (await prisma.institution.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    // Prevenir bucle infinito
    if (counter > 1000) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }
  
  return slug;
};

/**
 * Configuración por defecto para nuevas instituciones
 */
const getDefaultSettings = (): any => ({
  timezone: 'America/La_Paz',
  currency: 'USD',
  language: 'es',
  branding: {
    primaryColor: '#007bff',
    logoUrl: null,
    faviconUrl: null
  },
  features: {
    aiEnabled: false,
    certificatesEnabled: false,
    virtualClassroomsEnabled: true,
    attendanceTracking: true,
    gradebook: true
  },
  notifications: {
    email: true,
    sms: false,
    push: true
  },
  security: {
    twoFactorAuth: false,
    sessionTimeout: 24, // horas
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  }
});

/**
 * Crear una nueva institución
 */
export const createInstitution = async (data: CreateInstitutionData): Promise<any> => {
  try {
    // Generar slug si no se proporciona
    const slug = data.slug || await generateUniqueSlug(data.name);

    // Verificar que el email de contacto no esté en uso como institución
    const existingInstitution = await prisma.institution.findFirst({
      where: { contactEmail: data.contactEmail },
    });

    if (existingInstitution) {
      throw createAppError('El email de contacto ya está registrado para otra institución', 409);
    }

    // Verificar que el slug sea único
    const existingSlug = await prisma.institution.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw createAppError('El slug ya está en uso', 409);
    }

    // Asignar plan FREE por defecto
    const freePlan = await prisma.plan.findUnique({
      where: { slug: 'free' },
    });

    if (!freePlan) {
      throw createAppError('Plan FREE no encontrado', 500);
    }

    // Crear institución
    const institution = await prisma.institution.create({
      data: {
        name: data.name,
        slug,
        contactEmail: data.contactEmail,
        phone: data.phone,
        address: data.address,
        planId: freePlan.id,
        settings: getDefaultSettings(),
        status: 'active',
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    logBusinessEvent('institution_created', institution.id, undefined, {
      name: data.name,
      contactEmail: data.contactEmail,
      planId: freePlan.id,
    });

    return institution;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error creando institución', 500);
  }
};

/**
 * Obtener instituciones con filtros
 */
export const getInstitutions = async (filters: InstitutionFilters): Promise<any> => {
  try {
    // Convertir y validar parámetros
    const page = Math.max(1, parseInt(String(filters.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit || 10), 10)));
    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { contactEmail: { contains: filters.search, mode:

 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Obtener instituciones y total
    const [institutions, total] = await Promise.all([
      prisma.institution.findMany({
        where,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.institution.count({ where }),
    ]);

    return {
      institutions: institutions.map(inst => ({
        ...inst,
        // No exponer información sensible
        contactEmail: undefined,
        phone: undefined,
        address: undefined,
        settings: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo instituciones', 500);
  }


};

/**
 * Obtener institución por ID
 */
export const getInstitutionById = async (id: string): Promise<any> => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            studentLimit: true,
            teacherLimit: true,
            courseLimit: true,
            aiTeacherCallsMonthly: true,
            certificateMonthly: true,
            storageMB: true,
          },
        },
      },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    return institution;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo institución', 500);
  }
};

/**
 * Obtener institución por slug
 */
export const getInstitutionBySlug = async (slug: string): Promise<any> => {
  try {
    const institution = await

 prisma.institution.findUnique({
      where: { slug },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    // Retornar información pública limitada
    return {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      plan: institution.plan,
      status: institution.status,
      createdAt: institution.createdAt,
    };
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo institución', 500);
  }
};

/**
 * Actualizar institución
 */
export const updateInstitution = async (
  id: string,
  data: UpdateInstitutionData
): Promise<any> => {
  try {
    // Verificar que la institución existe
    const existingInstitution = await prisma.institution.findUnique({
      where: {

 id },
    });

    if (!existingInstitution) {
      throw createAppError('Institución no encontrada', 404);
    }

    // Verificar unicidad de email si se actualiza
    if (data.contactEmail && data.contactEmail !== existingInstitution.contactEmail) {
      const emailExists = await prisma.institution.findFirst({
        where: {
          contactEmail: data.contactEmail,
          id: { not: id },
        },
      });

      if (emailExists) {
        throw createAppError('El email de contacto ya está registrado para otra institución', 409);
      }
    }
console.log("-------")
    // Actualizar institución
    const updatedInstitution = await prisma.institution.update({
      where: { id },
      data,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    logBusinessEvent('institution_updated', id, undefined, {
      updatedFields: Object.keys(data),
    });

    return updatedInstitution;
  } catch (error) {
   

 if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando institución', 500);
  }
};

/**
 * Eliminar institución (soft delete)
 */
export const deleteInstitution = async (id: string): Promise<boolean> => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    // Soft delete - marcar como inactiva
    await prisma.institution.update({
      where: { id },
      data: { status: 'inactive' },
    });

    logBusinessEvent('institution_deleted', id, undefined, {
      method: 'soft_delete',
      name: institution.name,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error eliminando institución', 500);
  }
};
/**
 * 
 * obtener solo datos basicos de institucion
 */
export const getBasicInstitutionData = async (institutionId: string): Promise<any> => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId }
    });
    return institution;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo institución actual', 500);
    }
  }

/**
 * Obtener institución del usuario actual
 */
export const getCurrentInstitution = async (institutionId: string): Promise<any> => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            studentLimit: true,
            teacherLimit: true,
            adminLimit: true,
            courseLimit: true,
            aiTeacherCallsMonthly: true,
            aiStudentMinutesMonthly: true,
            certificateMonthly: true,
            virtualClassroomLimit: true,
            storageMB: true,
            features: true,
          },
        },
      },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    return institution;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo institución actual', 500);
  }
};

/**
 * Obtener estadísticas básicas de la

 institución
 */
export const getInstitutionStats = async (institutionId: string): Promise<any> => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalCourses,
      totalSubjects,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.user.count({ where: { institutionId } }),
      prisma.student.count({ where: { institutionId } }),
      prisma.teacher.count({ where: { user: { institutionId } } }),
      prisma.course.count({ where: { career: { institutionId } } }),
      prisma.subject.count({ where: { course: { career: { institutionId } } } }),
      prisma.institutionSubscription.count({ 
        where: { 
          institutionId,
          status: 'ACTIVE' 
        } 
      }),
    ]);

    return {
      users: totalUsers,
      students: totalStudents,
      teachers: totalTeachers,
      courses: totalCourses,
      subjects: totalSubjects,
      activeSubscriptions,
    };
  } catch (error) {
    throw createAppError('Error obteniendo estadísticas de institución', 500);
  }
};