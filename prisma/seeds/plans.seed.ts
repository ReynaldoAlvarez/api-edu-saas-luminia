import { PrismaClient } from '@prisma/client';

/**
 * Seed para los planes de suscripción
 * Define los diferentes niveles de servicio disponibles
 */

/**
 * Datos de los planes de suscripción según tu propuesta de pricing
 */

const plansData = [
  {
    id: 'plan-free',
    name: 'Free',
    slug: 'free',
    description: 'Plan gratuito para adquisición de usuarios',
    price: 0,
    currency: 'USD',
    studentLimit: 25,
    teacherLimit: 1,
    adminLimit: 1,
    courseLimit: 3,
    aiTeacherCallsMonthly: 0,
    aiStudentMinutesMonthly: 0,
    certificateMonthly: 0,
    virtualClassroomLimit: 1,
    storageMB: 100,
    features: [
      'Hasta 25 estudiantes',
      '1 docente y 1 administrador',
      'Hasta 3 cursos',
      'Reportes básicos',
      'Soporte por email (72h)',
    ],
    isActive: true,
  },
  {
    id: 'plan-basic',
    name: 'Básico',
    slug: 'basic',
    description: 'Ideal para pequeños institutos con pocos estudiantes',
    price: 19,
    currency: 'USD',
    studentLimit: 100,
    teacherLimit: 5,
    adminLimit: 2,
    courseLimit: 20,
    aiTeacherCallsMonthly: 10,
    aiStudentMinutesMonthly: 30,
    certificateMonthly: 20,
    virtualClassroomLimit: 10,
    storageMB: 1000,
    features: [
      'Hasta 100 estudiantes',
      'Hasta 5 docentes y 2 administradores',
      'Hasta 20 cursos',
      'IA con límite mensual',
      'Certificados PDF (20/mes)',
      'Soporte por email (48h)',
    ],
    isActive: true,
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    slug: 'pro',
    description: 'Para instituciones medianas con múltiples niveles',
    price: 49,
    currency: 'USD',
    studentLimit: 500,
    teacherLimit: 20,
    adminLimit: 5,
    courseLimit: 100,
    aiTeacherCallsMonthly: 50,
    aiStudentMinutesMonthly: 60,
    certificateMonthly: 100,
    virtualClassroomLimit: 50,
    storageMB: 5000,
    features: [
      'Hasta 500 estudiantes',
      'Hasta 20 docentes y 5 administradores',
      'Hasta 100 cursos',
      'IA ampliada',
      'Certificados PDF (100/mes)',
      'Soporte chat/email (24h)',
    ],
    isActive: true,
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    slug: 'premium',
    description: 'Para grandes instituciones o seminarios con múltiples niveles',
    price: 99,
    currency: 'USD',
    studentLimit: -1,
    teacherLimit: -1,
    adminLimit: -1,
    courseLimit: -1,
    aiTeacherCallsMonthly: -1,
    aiStudentMinutesMonthly: -1,
    certificateMonthly: -1,
    virtualClassroomLimit: -1,
    storageMB: -1,
    features: [
      'Estudiantes ilimitados',
      'Docentes y administradores ilimitados',
      'Cursos ilimitados',
      'IA sin límite',
      'Certificados PDF ilimitados',
      'Soporte prioritario (<12h)',
    ],
    isActive: true,
  },
];

/**
 * Función para crear los planes de suscripción
 * @param prisma - Cliente de Prisma
 */
export const seedPlans = async (prisma: PrismaClient): Promise<void> => {
  console.log('🔄 Creando planes de suscripción...');

  try {
    // Crear cada plan usando upsert para evitar duplicados
    for (const planData of plansData) {
      await prisma.plan.upsert({
        where: { id: planData.id },
        update: planData,
        create: planData,
      });
      
      console.log(`✅ Plan "${planData.name}" creado/actualizado`);
    }

    console.log(`🎉 ${plansData.length} planes de suscripción procesados exitosamente`);
  } catch (error) {
    console.error('❌ Error al crear planes:', error);
    throw error;
  }
};