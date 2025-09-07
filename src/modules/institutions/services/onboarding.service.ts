import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';
import { hashPassword } from '@/shared/utils/password';

/**
 * Servicio para flujo de onboarding de instituciones
 * Maneja la creación completa de instituciones con usuarios admin
 */

/**
 * Interface para datos de onboarding
 */
export interface OnboardingData {
  institution: {
    name: string;
    contactEmail: string;
    phone?: string;
    address?: any;
    slug?: string;
  };
  adminUser: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  };
  planSlug?: 'free' | 'basic' | 'pro' | 'premium';
}

/**
 * Interface para respuesta de onboarding
 */
export interface OnboardingResponse {
  institution: any;
  adminUser: any;
  credentials: {
    email: string;
    password: string; // Solo se devuelve en el onboarding inicial
  };
}

/**
 * Flujo completo de onboarding
 */
export const onboardInstitution = async (data: OnboardingData): Promise<OnboardingResponse> => {
  try {
    // Verificar que el email de contacto no esté en uso
    const existingInstitution = await prisma.institution.findFirst({
      where: { contactEmail: data.institution.contactEmail },
    });

    if (existingInstitution) {
      throw createAppError('El email de contacto ya está registrado para otra institución', 409);
    }

    // Verificar que el email de admin no esté en uso
    const existingUser = await prisma.user.findUnique({
      where: { email: data.adminUser.email },
    });

    if (existingUser) {
      throw createAppError('El email del administrador ya está registrado', 409);
    }

    // Obtener el plan solicitado o FREE por defecto
    const planSlug = data.planSlug || 'free';
    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan) {
      throw createAppError(`Plan ${planSlug} no encontrado`, 404);
    }

    // Hashear contraseña del admin
    const hashedPassword = await hashPassword(data.adminUser.password);

    // Configuración por defecto
    const defaultSettings = {
      timezone: 'America/La_Paz',
      currency: 'USD',
      language: 'es',
      branding: {
        primaryColor: '#007bff',
        logoUrl: null,
        faviconUrl: null
      },
      features: {
        aiEnabled: planSlug !== 'free',
        certificatesEnabled: planSlug !== 'free',
        virtualClassroomsEnabled: true,
        attendanceTracking: true,
        gradebook: true
      },
      notifications: {
        email: true,
        sms: planSlug === 'pro' || planSlug === 'premium',
        push: true
      },
      security: {
        twoFactorAuth: planSlug === 'pro' || planSlug === 'premium',
        sessionTimeout: 24,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialChars: planSlug !== 'free'
        }
      }
    };

    // Crear todo en transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear institución
      const institution = await tx.institution.create({
        data: {
          name: data.institution.name,
          slug: data.institution.slug as string, // Se generará automáticamente si no se proporciona
          contactEmail: data.institution.contactEmail,
          phone: data.institution.phone,
          address: data.institution.address,
          planId: plan.id,
          settings: defaultSettings,
          status: 'active',
        },
      });

      // 2. Crear usuario admin
      const adminUser = await tx.user.create({
        data: {
          email: data.adminUser.email,
          password: hashedPassword,
          fullName: data.adminUser.fullName,
          phone: data.adminUser.phone,
          institutionId: institution.id,
          isActive: true,
        },
      });

      // 3. Asignar rol ADMIN
      const adminRole = await tx.role.findFirst({
        where: {
          name: 'ADMIN',
          OR: [
            { institutionId: institution.id },
            { isSystem: true },
          ],
        },
      });

      if (!adminRole) {
        throw createAppError('Rol de administrador no encontrado', 500);
      }

      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
          isPrimary: true,
        },
      });

      // 4. Crear suscripción inicial
      const subscription = await tx.institutionSubscription.create({
        data: {
          institutionId: institution.id,
          planId: plan.id,
          startDate: new Date(),
          status: 'ACTIVE',
          autoRenew: true,
        },
      });

      return {
        institution: {
          ...institution,
          plan: {
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
          },
        },
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          fullName: adminUser.fullName,
          institutionId: adminUser.institutionId,
          isActive: adminUser.isActive,
        },
        subscription,
      };
    });

    logBusinessEvent('institution_onboarded', result.institution.id, result.adminUser.id, {
      planSlug,
      institutionName: data.institution.name,
    });

    return {
      institution: result.institution,
      adminUser: result.adminUser,
      credentials: {
        email: data.adminUser.email,
        password: data.adminUser.password, // Solo para onboarding inicial
      },
    };
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error en el proceso de onboarding', 500);
  }
};

/**
 * Generar slug único para la institución
 */
export const generateUniqueSlug = async (name: string): Promise<string> => {
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
 * Validar disponibilidad de recursos según plan
 */
export const validatePlanResources = async (planSlug: string, institutionId: string): Promise<boolean> => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan) {
      return false;
    }

    // Verificar límites actuales
    const [
      currentStudents,
      currentTeachers,
      currentAdmins,
      currentCourses,
    ] = await Promise.all([
      prisma.student.count({ where: { institutionId } }),
      prisma.teacher.count({ where: { user: { institutionId } } }),
      prisma.user.count({ 
        where: { 
          institutionId,
          userRoles: {
            some: {
              role: {
                name: 'ADMIN',
              },
            },
          },
        },
      }),
      prisma.course.count({ where: { career: { institutionId } } }),
    ]);

    // Verificar si se exceden límites
    if (
      (plan.studentLimit !== -1 && currentStudents > plan.studentLimit) ||
      (plan.teacherLimit !== -1 && currentTeachers > plan.teacherLimit) ||
      (plan.adminLimit !== -1 && currentAdmins > plan.adminLimit) ||
      (plan.courseLimit !== -1 && currentCourses > plan.courseLimit)
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};