import { createAppError } from '@/shared/middleware/error-handler.middleware';
import { logBusinessEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';

/**
 * Servicio para gestión de suscripciones de instituciones
 * Maneja planes, renovaciones y verificación de límites
 */

/**
 * Interface para datos de suscripción
 */
export interface CreateSubscriptionData {
  institutionId: string;
  planId: string;
  billingCycle?: string;
  autoRenew?: boolean;
}

/**
 * Interface para actualización de suscripción
 */
export interface UpdateSubscriptionData {
  planId?: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' | 'TRIAL';
  autoRenew?: boolean;
  billingCycle?: string;
}

/**
 * Crear nueva suscripción
 */
export const createSubscription = async (data: CreateSubscriptionData): Promise<any> => {
  try {
    // Verificar que la instituciónexiste
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
    });

    if (!plan) {
      throw createAppError('Plan no encontrado', 404);
    }

    // Verificar que no haya suscripción activa
    const activeSubscription = await prisma.institutionSubscription.findFirst({
      where: {
        institutionId: data.institutionId,
        status: 'ACTIVE',
      },
    });

    if (activeSubscription) {
      throw createAppError('Ya existe una suscripción activa para esta institución', 409);
    }

    // Crear suscripción
    const subscription = await prisma.institutionSubscription.create({
      data: {
        institutionId: data.institutionId,
        planId: data.planId,
        startDate: new Date(),
        status: 'ACTIVE',
       

 autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
        billingCycle: data.billingCycle,
      },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Actualizar plan en la institución
    await prisma.institution.update({
      where: { id: data.institutionId },
      data: { planId: data.planId },
    });

    logBusinessEvent('subscription_created', data.institutionId, undefined, {
      subscriptionId: subscription.id,
      planId: data.planId,
      planName: plan.name,
    });

    return subscription;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error creando suscripción', 500);
  }
};

/**
 * Obtener suscripción actual de la institución
 */
export const getCurrentSubscription = async (institutionId: string): Promise<any> => {
  try {
    const subscription = await prisma.institutionSubscription.findFirst({
      where: {
        institutionId,
        status: 'ACTIVE',
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            currency: true,
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
        institution: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    if (!subscription) {
      throw createAppError('No se encontró suscripción activa', 404);
    }

    return subscription;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error obteniendo suscripción', 500);
  }
};

/**
 * Actualizar suscripción
 */
export const updateSubscription = async (
  subscriptionId: string,
  data: UpdateSubscriptionData
): Promise<any> => {
  try {
    // Verificar que la suscripción existe
    const existingSubscription = await prisma.institutionSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        institution: true,
      },
    });

    if (!existingSubscription) {
      throw createAppError('Suscripción no encontrada', 404);
    }

    // Verificar plan si se está cambiando
    if (data.planId && data.planId !== existingSubscription.planId) {
      const newPlan = await prisma.plan.findUnique({
        where: { id: data.planId },
      });

      if (!newPlan) {
        throw createAppError('Nuevo plan no encontrado', 404);
     

 }

      // Verificar límites del nuevo plan
      const isValid = await validatePlanLimits(newPlan.id, existingSubscription.institutionId);
      if (!isValid) {
        throw createAppError('No se puede cambiar al nuevo plan: excede los límites actuales', 400);
      }
    }

    // Actualizar suscripción
    const updatedSubscription = await prisma.institutionSubscription.update({
      where: { id: subscriptionId },
      data,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        institution: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Si se cambió el plan, actualizar en la institución
    if (data.planId && data.planId !== existingSubscription.planId) {
      await prisma.institution.update({
        where: { id: existingSubscription.institutionId },
        data: { planId: data.planId },
      });

      logBusinessEvent('plan_changed', existingSubscription.institutionId, undefined, {
        oldPlanId: existingSubscription.planId,
        newPlanId: data.planId,
      });
    }

    logBusinessEvent('subscription_updated', existingSubscription.institutionId, undefined, {
      subscriptionId,
      updatedFields: Object.keys(data),
    });

    return updatedSubscription;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error actualizando suscripción', 500);
  }
};

/**
 * Cancelar suscripción
 */
export const cancelSubscription = async (subscriptionId: string): Promise<boolean> => {
  try {
    const subscription = await prisma.institutionSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        institution: true,
      },
    });

    if (!subscription) {
      throw createAppError('Suscripción no encontrada', 404);
    }

    // Actualizar estado a cancelado
    await prisma.institutionSubscription.update({
     

 where: { id: subscriptionId },
      data: { 
        status: 'CANCELLED',
        autoRenew: false,
      },
    });

    logBusinessEvent('subscription_cancelled', subscription.institutionId, undefined, {
      subscriptionId,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && (error as any).statusCode) {
      throw error;
    }
    throw createAppError('Error cancelando suscripción', 500);
  }
};

/**
 * Obtener historial de suscripciones
 */
export const getSubscriptionHistory = async (
  institutionId: string,
  page: number = 1,
  limit: number = 10
): Promise<any> => {
  try {
    const skip = (page - 1) * limit;

    // Verificar que la institución existe
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw createAppError('Institución no encontrada', 404);
    }

    const [subscriptions, total] = await Promise.all([
      prisma.institutionSubscription.findMany({
        where: {

 institutionId },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              currency: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.institutionSubscription.count({
        where: { institutionId },
      }),
    ]);

    return {
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo historial de suscripciones', 500);
  }
};

/**
 * Verificar límites del plan actual
 */
export const validatePlanLimits = async (planId: string, institutionId: string): Promise<boolean> => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return false;
    }

    // Obtener conteos actuales
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

    // Verificar límites (-1 significa ilimitado)
    const limits = [
      plan.studentLimit === -1 || currentStudents <= plan.studentLimit,
      plan.teacherLimit === -1 || currentTeachers <= plan.teacherLimit,
      plan.adminLimit === -1 || currentAdmins <= plan.adminLimit,
      plan.courseLimit === -1 || currentCourses <= plan.courseLimit,
    ];

    return limits.every(limit => limit);
  } catch (error) {
    return false;
  }
};



/**
 * Obtener estadísticas de uso del plan
 */
export const getPlanUsageStats = async (institutionId: string): Promise<any> => {
  try {
    // Obtener institución con plan
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        plan: true,
      },
    });
    if (!institution || !institution.plan) {
      throw createAppError('Institución o plan no encontrado', 404);
    }
    const plan = institution.plan;
    // Obtener conteos actuales
    const [
      currentStudents,
      currentTeachers,
      currentAdmins,
      currentCourses,
      currentVirtualClassrooms,
      aiUsageThisMonth,
      certificatesThisMonth,
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
      prisma.virtualClassroom.count({ 
        where: { 
          subject: { 
            course: { 
              career: { institutionId } 
            } 
          } 
        } 
      }),
      // Uso de IA este mes
      prisma.aIUsageLog.count({
        where: {
          institutionId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      // Certificados este mes
      prisma.certificate.count({
        where: {
          student: { institutionId },
          issuedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
      },
      usage: {
        students: {
          current: currentStudents,
          limit:

 plan.studentLimit,
          percentage: plan.studentLimit === -1 ? 0 : Math.round((currentStudents / plan.studentLimit) * 100),
        },
        teachers: {
          current: currentTeachers,
          limit: plan.teacherLimit,
          percentage: plan.teacherLimit === -1 ? 0 : Math.round((currentTeachers / plan.teacherLimit) * 100),
        },
        admins: {
          current: currentAdmins,
          limit: plan.adminLimit,
          percentage: plan.adminLimit === -1 ? 0 : Math.round((currentAdmins / plan.adminLimit) * 100),
        },
        courses: {
          current: currentCourses,
          limit: plan.courseLimit,
          percentage: plan.courseLimit === -1 ? 0 : Math.round((currentCourses / plan.courseLimit) * 100),
        },
        virtualClassrooms: {
          current: currentVirtualClassrooms,
          limit: plan.virtualClassroomLimit,
          percentage: plan.virtualClassroomLimit === -1 ? 0 : Math.round((currentVirtualClassrooms / plan.virtualClassroomLimit) * 100),


        },
        aiUsage: {
          current: aiUsageThisMonth,
          limit: plan.aiTeacherCallsMonthly,
          percentage: plan.aiTeacherCallsMonthly === -1 ? 0 : Math.round((aiUsageThisMonth / plan.aiTeacherCallsMonthly) * 100),
        },
        certificates: {
          current: certificatesThisMonth,
          limit: plan.certificateMonthly,
          percentage: plan.certificateMonthly === -1 ? 0 : Math.round((certificatesThisMonth / plan.certificateMonthly) * 100),
        },
      },
    };
  } catch (error) {
    throw createAppError('Error obteniendo estadísticas de uso del plan', 500);
  }
};