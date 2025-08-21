import { Request, Response, NextFunction } from 'express';
import { TenantRequest } from './tenant.middleware';
import { forbiddenResponse, badRequestResponse } from '@/shared/utils/response';
import { logAuthEvent } from '@/shared/utils/logger';
import prisma from '@/shared/database/prisma';

/**
 * Middleware ABAC (Attribute-Based Access Control)
 * Controla permisos basado en planes, roles y atributos del usuario
 */

/**
 * Interface para contexto ABAC
 */
export interface ABACContext {
  user: {
    id: string;
    roleId: string;
    roleName: string;
    institutionId: string;
    attributes?: any;
  };
  institution: {
    id: string;
    planId: string | null;
    status: string;
  };
  plan?: {
    id: string;
    slug: string;
    features: any;
    studentLimit: number;
    teacherLimit: number;
    adminLimit: number;
    courseLimit: number;
    aiTeacherCallsMonthly: number;
    aiStudentMinutesMonthly: number;
    certificateMonthly: number;
    virtualClassroomLimit: number;
    storageMB: number;
  };
  resource?: {
    type: string;
    id?: string;
    attributes?: any;
  };
}

/**
 * Interface extendida para Request con contexto ABAC
 */
export interface ABACRequest extends TenantRequest {
  abac?: ABACContext;
}

/**
 * Middleware para establecer contexto ABAC
 * Carga información del plan y prepara el contexto para evaluación de políticas
 */
export const setupABACContext = async (
  req: ABACRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verificar que tengamos usuario y tenant
    if (!req.user || !req.tenant) {
      badRequestResponse(res, 'Contexto de usuario/tenant requerido para ABAC');
      return;
    }

    // Cargar información del plan si existe
    let plan = null;
    if (req.tenant.planId) {
      plan = await prisma.plan.findUnique({
        where: { id: req.tenant.planId },
        select: {
          id: true,
          slug: true,
          features: true,
          studentLimit: true,
          teacherLimit: true,
          adminLimit: true,
          courseLimit: true,
          aiTeacherCallsMonthly: true,
          aiStudentMinutesMonthly: true,
          certificateMonthly: true,
          virtualClassroomLimit: true,
          storageMB: true,
        },
      });
    }

    // Establecer contexto ABAC
    req.abac = {
      user: {
        id: req.user.id,
        roleId: req.user.roleId,
        roleName: req.user.roleName,
        institutionId: req.user.institutionId,
        attributes: req.user.attributes || {},
      },
      institution: {
        id: req.tenant.id,
        planId: req.tenant.planId,
        status: req.tenant.status,
      },
      plan: plan || undefined,
    };

    next();
  } catch (error) {
    logAuthEvent('abac_context_error', req.user?.id, req.ip, req.get('User-Agent'), {
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
    badRequestResponse(res, 'Error estableciendo contexto ABAC');
  }
};

/**
 * Middleware para verificar límites del plan
 * @param resourceType - Tipo de recurso a verificar
 * @param action - Acción a realizar (create, read, update, delete)
 */
export const checkPlanLimits = (resourceType: string, action: string = 'create') => {
  return async (req: ABACRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Solo verificar límites en operaciones de creación
      if (action !== 'create') {
        next();
        return;
      }

      if (!req.abac?.plan) {
        // Sin plan, usar límites por defecto muy restrictivos
        forbiddenResponse(res, 'Plan requerido para esta operación');
        return;
      }

      const { plan, institution } = req.abac;
      let currentCount = 0;
      let limit = 0;

      // Verificar límites según el tipo de recurso
      switch (resourceType) {
        case 'student':
          currentCount = await prisma.student.count({
            where: { institutionId: institution.id },
          });
          limit = plan.studentLimit;
          break;

        case 'teacher':
          currentCount = await prisma.teacher.count({
            where: { 
              user: { institutionId: institution.id },
            },
          });
          limit = plan.teacherLimit;
          break;

        case 'course':
          currentCount = await prisma.course.count({
            where: { 
              career: { institutionId: institution.id },
            },
          });
          limit = plan.courseLimit;
          break;

        case 'virtualClassroom':
          currentCount = await prisma.virtualClassroom.count({
            where: { 
              subject: { 
                course: { 
                  career: { institutionId: institution.id },
                },
              },
            },
          });
          limit = plan.virtualClassroomLimit;
          break;

        case 'certificate':
          // Verificar certificados generados este mes
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          currentCount = await prisma.certificate.count({
            where: {
              student: { institutionId: institution.id },
              issuedAt: { gte: startOfMonth },
            },
          });
          limit = plan.certificateMonthly;
          break;

        default:
          // Recurso no reconocido, permitir por defecto
          next();
          return;
      }

      // Verificar si se excede el límite (-1 significa ilimitado)
      if (limit !== -1 && currentCount >= limit) {
        logAuthEvent('plan_limit_exceeded', req.user?.id, req.ip, req.get('User-Agent'), {
          resourceType,
          currentCount,
          limit,
          planSlug: plan.slug,
        });
        forbiddenResponse(res, `Límite del plan excedido para ${resourceType} (${currentCount}/${limit})`);
        return;
      }

      next();
    } catch (error) {
      logAuthEvent('plan_limit_check_error', req.user?.id, req.ip, req.get('User-Agent'), {
        error: error instanceof Error ? error.message : 'Error desconocido',
        resourceType,
      });
      badRequestResponse(res, 'Error verificando límites del plan');
    }
  };
};

/**
 * Middleware para verificar permisos de rol
 * @param allowedRoles - Roles permitidos para la acción
 * @param resource - Tipo de recurso (opcional)
 */
export const checkRolePermissions = (allowedRoles: string[], resource?: string) => {
  return (req: ABACRequest, res: Response, next: NextFunction): void => {
    if (!req.abac?.user) {
      badRequestResponse(res, 'Contexto ABAC requerido');
      return;
    }

    const userRole = req.abac.user.roleName;

    if (!allowedRoles.includes(userRole)) {
      logAuthEvent('role_permission_denied', req.user?.id, req.ip, req.get('User-Agent'), {
        userRole,
        allowedRoles,
        resource,
      });
      forbiddenResponse(res, 'Permisos de rol insuficientes');
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar funcionalidades del plan
 * @param feature - Funcionalidad a verificar
 */
export const checkPlanFeature = (feature: string) => {
  return (req: ABACRequest, res: Response, next: NextFunction): void => {
    if (!req.abac?.plan) {
      forbiddenResponse(res, 'Plan requerido para esta funcionalidad');
      return;
    }

    const { plan } = req.abac;
    const features = plan.features as any || {};

    // Verificar funcionalidades específicas
    switch (feature) {
      case 'ai_teacher':
        if (plan.aiTeacherCallsMonthly <= 0) {
          forbiddenResponse(res, 'Funcionalidad de IA para docentes no disponible en su plan');
          return;
        }
        break;

      case 'ai_student':
        if (plan.aiStudentMinutesMonthly <= 0) {
          forbiddenResponse(res, 'Funcionalidad de IA para estudiantes no disponible en su plan');
          return;
        }
        break;

      case 'certificates':
        if (plan.certificateMonthly <= 0) {
          forbiddenResponse(res, 'Generación de certificados no disponible en su plan');
          return;
        }
        break;

      default:
        // Verificar en features JSON
        if (!features[feature]) {
          forbiddenResponse(res, `Funcionalidad ${feature} no disponible en su plan`);
          return;
        }
        break;
    }

    next();
  };
};

/**
 * Middleware combinado para verificación completa ABAC
 * @param resourceType - Tipo de recurso
 * @param action - Acción a realizar
 * @param allowedRoles - Roles permitidos
 * @param requiredFeature - Funcionalidad requerida (opcional)
 */
export const requireABACPermission = (
  resourceType: string,
  action: string,
  allowedRoles: string[],
  requiredFeature?: string
) => {
  const middlewares = [
    setupABACContext,
    checkRolePermissions(allowedRoles, resourceType),
    checkPlanLimits(resourceType, action),
  ];

  if (requiredFeature) {
    middlewares.push(checkPlanFeature(requiredFeature));
  }

  return middlewares;
};

/**
 * Helper para verificar si el usuario puede acceder a un recurso específico
 * @param context - Contexto ABAC
 * @param resourceType - Tipo de recurso
 * @param action - Acción a realizar
 * @param resourceAttributes - Atributos del recurso (opcional)
 * @returns true si tiene acceso
 */
export const evaluateAccess = (
  context: ABACContext,
  resourceType: string,
  action: string,
  resourceAttributes?: any
): boolean => {
  // Lógica básica de evaluación
  // En una implementación completa, esto consultaría las políticas ABAC de la base de datos

  const { user, plan } = context;

  // Administradores tienen acceso completo
  if (user.roleName === 'ADMIN') {
    return true;
  }

  // Verificar límites del plan para operaciones de creación
  if (action === 'create' && plan) {
    // Esta lógica se maneja en checkPlanLimits
    return true;
  }

  // Lógica específica por rol y recurso
  switch (resourceType) {
    case 'student':
      return ['ADMIN', 'SECRETARY', 'DIRECTOR'].includes(user.roleName);
    
    case 'teacher':
      return ['ADMIN', 'DIRECTOR'].includes(user.roleName);
    
    case 'grade':
      return ['ADMIN', 'DIRECTOR', 'TEACHER'].includes(user.roleName);
    
    default:
      return false;
  }
};