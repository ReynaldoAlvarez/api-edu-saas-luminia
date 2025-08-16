import { PrismaClient } from '@prisma/client';

/**
 * Seed para los scopes de API
 * Define los permisos granulares disponibles para clientes API
 */

/**
 * Datos de los scopes de API
 * Cada scope define un permiso específico que puede ser asignado a clientes API
 */
const scopesData = [
  // ========================================
  // SCOPES DE LECTURA (READ)
  // ========================================
  {
    id: 'scope-read-students',
    name: 'read:students',
    description: 'Leer información de estudiantes',

  },
  {
    id: 'scope-read-teachers',
    name: 'read:teachers',
    description: 'Leer información de docentes',
 
  },
  {
    id: 'scope-read-courses',
    name: 'read:courses',
    description: 'Leer información de cursos',

  },
  {
    id: 'scope-read-grades',
    name: 'read:grades',
    description: 'Leer calificaciones',

  },
  {
    id: 'scope-read-attendance',
    name: 'read:attendance',
    description: 'Leer registros de asistencia',

  },
  {
    id: 'scope-read-payments',
    name: 'read:payments',
    description: 'Leer información de pagos',

  },
  {
    id: 'scope-read-reports',
    name: 'read:reports',
    description: 'Acceder a reportes',

  },

  // ========================================
  // SCOPES DE ESCRITURA (WRITE)
  // ========================================
  {
    id: 'scope-write-students',
    name: 'write:students',
    description: 'Crear y actualizar estudiantes',

  },
  {
    id: 'scope-write-teachers',
    name: 'write:teachers',
    description: 'Crear y actualizar docentes',

  },
  {
    id: 'scope-write-courses',
    name: 'write:courses',
    description: 'Crear y actualizar cursos',

  },
  {
    id: 'scope-write-grades',
    name: 'write:grades',
    description: 'Crear y actualizar calificaciones',

  },
  {
    id: 'scope-write-attendance',
    name: 'write:attendance',
    description: 'Registrar asistencia',

  },
  {
    id: 'scope-write-payments',
    name: 'write:payments',
    description: 'Procesar pagos',

  },

  // ========================================
  // SCOPES DE ELIMINACIÓN (DELETE)
  // ========================================
  {
    id: 'scope-delete-students',
    name: 'delete:students',
    description: 'Eliminar estudiantes',

  },
  {
    id: 'scope-delete-teachers',
    name: 'delete:teachers',
    description: 'Eliminar docentes',

  },
  {
    id: 'scope-delete-courses',
    name: 'delete:courses',
    description: 'Eliminar cursos',

  },

  // ========================================
  // SCOPES ESPECIALES
  // ========================================
  {
    id: 'scope-admin-full',
    name: 'admin:full',
    description: 'Acceso administrativo completo',

  },
  {
    id: 'scope-ai-access',
    name: 'ai:access',
    description: 'Acceso a funciones de IA',

  },
  {
    id: 'scope-webhooks-manage',
    name: 'webhooks:manage',
    description: 'Gestionar webhooks',

  },
  {
    id: 'scope-analytics-read',
    name: 'analytics:read',
    description: 'Acceder a analytics y métricas',

  },
  {
    id: 'scope-certificates-generate',
    name: 'certificates:generate',
    description: 'Generar certificados',

  },
  {
    id: 'scope-notifications-send',
    name: 'notifications:send',
    description: 'Enviar notificaciones',

  },

  // ========================================
  // SCOPES POR PLAN
  // ========================================
  {
    id: 'scope-basic-api',
    name: 'basic:api',
    description: 'Acceso básico a la API (Plan Básico)',

  },
  {
    id: 'scope-pro-api',
    name: 'pro:api',
    description: 'Acceso avanzado a la API (Plan Pro)',

  },
  {
    id: 'scope-premium-api',
    name: 'premium:api',
    description: 'Acceso completo a la API (Plan Premium)',
    //resource: 'api',
    //action: 'premium',
    //isActive: true,
  },
];

/**
 * Función para crear los scopes de API
 * @param prisma - Cliente de Prisma
 */
export const seedScopes = async (prisma: PrismaClient): Promise<void> => {
  console.log('🔄 Creando scopes de API...');

  try {
    // Crear cada scope usando upsert para evitar duplicados
    for (const scopeData of scopesData) {
      await prisma.apiScope.upsert({
        where: { id: scopeData.id },
        update: {
          name: scopeData.name,
          description: scopeData.description
        },
        create: scopeData,
      });
      
      console.log(`✅ Scope "${scopeData.name}" creado/actualizado`);
    }

    console.log(`🎉 ${scopesData.length} scopes de API procesados exitosamente`);
  } catch (error) {
    console.error('❌ Error al crear scopes:', error);
    throw error;
  }
};