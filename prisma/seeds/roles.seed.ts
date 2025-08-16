import { PrismaClient } from '@prisma/client';

/**
 * Seed para los roles del sistema
 * Define los diferentes tipos de usuarios y sus permisos básicos
 */

/**
 * Datos de los roles del sistema
 * Cada rol tiene permisos específicos y nivel de acceso
 */
const rolesData = [
  {
    id: 'role-super-admin',
    name: 'ADMIN' as const, // Usar valores del enum RoleName
    description: 'Administrador global del sistema con acceso completo',
    isSystem: true, // Cambiar de isSystemRole a isSystem
    // Remover: level, isActive, permissions (no existen en el schema)
  },
  {
    id: 'role-institution-admin',
    name: 'ADMIN' as const,
    description: 'Administrador de una institución específica',
    isSystem: false,
  },
  {
    id: 'role-academic-coordinator',
    name: 'DIRECTOR' as const, // Usar DIRECTOR del enum
    description: 'Coordinador de programas académicos y currículum',
    isSystem: false,
  },
  {
    id: 'role-teacher',
    name: 'TEACHER' as const,
    description: 'Profesor que imparte clases y evalúa estudiantes',
    isSystem: false,
  },
  {
    id: 'role-student',
    name: 'STUDENT' as const,
    description: 'Estudiante inscrito en la institución',
    isSystem: false,
  },
  {
    id: 'role-tutor',
    name: 'TUTOR' as const,
    description: 'Tutor o padre de familia con acceso a información del estudiante',
    isSystem: false,
  },
  {
    id: 'role-secretary',
    name: 'SECRETARY' as const,
    description: 'Personal administrativo con acceso a gestión estudiantil',
    isSystem: false,
  },
  {
    id: 'role-accountant',
    name: 'FINANCE' as const, // Usar FINANCE del enum
    description: 'Encargado de la gestión financiera y contable',
    isSystem: false,
  },
  {
    id: 'role-support',
    name: 'SUPPORT' as const,
    description: 'Personal de soporte técnico',
    isSystem: true,
  },
];

/**
 * Función para crear los roles del sistema
 * @param prisma - Cliente de Prisma
 */
export const seedRoles = async (prisma: PrismaClient): Promise<void> => {
  console.log('🔄 Creando roles del sistema...');

  try {
    // Crear cada rol usando upsert para evitar duplicados
    for (const roleData of rolesData) {
      await prisma.role.upsert({
        where: { id: roleData.id },
        update: {
          name: roleData.name,
          description: roleData.description,
          isSystem: roleData.isSystem,
        },
        create: roleData,
      });
      
      console.log(`✅ Rol "${roleData.name}" creado/actualizado`);
    }

    console.log(`🎉 ${rolesData.length} roles procesados exitosamente`);
  } catch (error) {
    console.error('❌ Error al crear roles:', error);
    throw error;
  }
};