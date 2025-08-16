import { PrismaClient } from '@prisma/client';
import { seedPlans } from './plans.seed';
import { seedRoles } from './roles.seed';
import { seedScopes } from './scopes.seed';

/**
 * Archivo principal de seeds
 * Ejecuta todos los seeds en el orden correcto
 */

// Crear instancia del cliente Prisma
const prisma = new PrismaClient();

/**
 * Función principal que ejecuta todos los seeds
 */
const main = async (): Promise<void> => {
  console.log('🌱 Iniciando proceso de seeding...');
  console.log('📅 Timestamp:', new Date().toISOString());
  
  try {
    // Verificar conexión a la base de datos
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos establecida');

    // Ejecutar seeds en orden de dependencias
    console.log('\n📦 Ejecutando seeds...');
    
    // 1. Crear planes (no tienen dependencias)
    await seedPlans(prisma);
    console.log('');

    // 2. Crear roles (no tienen dependencias)
    await seedRoles(prisma);
    console.log('');

    // 3. Crear scopes de API (no tienen dependencias)
    await seedScopes(prisma);
    console.log('');

    // TODO: Agregar más seeds según se vayan creando
    // await seedInstitutions(prisma);
    // await seedUsers(prisma);
    // await seedCareers(prisma);

    console.log('🎉 Proceso de seeding completado exitosamente');
    console.log('📊 Resumen:');
    console.log('   - Planes de suscripción: ✅');
    console.log('   - Roles del sistema: ✅');
    console.log('   - Scopes de API: ✅');

  } catch (error) {
    console.error('💥 Error durante el seeding:', error);
    throw error;
  } finally {
    // Cerrar conexión a la base de datos
    await prisma.$disconnect();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
};

/**
 * Función para limpiar la base de datos (útil para testing)
 * ⚠️ CUIDADO: Esta función elimina todos los datos
 */
export const cleanDatabase = async (): Promise<void> => {
  console.log('🧹 Limpiando base de datos...');
  
  try {
    // Eliminar en orden inverso de dependencias
    await prisma.apiScope.deleteMany();
    await prisma.role.deleteMany();
    await prisma.plan.deleteMany();
    
    console.log('✅ Base de datos limpiada');
  } catch (error) {
    console.error('❌ Error al limpiar base de datos:', error);
    throw error;
  }
};

/**
 * Función para resetear la base de datos (limpiar + seed)
 */
export const resetDatabase = async (): Promise<void> => {
  console.log('🔄 Reseteando base de datos...');
  
  await cleanDatabase();
  await main();
  
  console.log('✅ Base de datos reseteada exitosamente');
};

// Ejecutar main solo si este archivo es llamado directamente
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('💥 Error fatal en seeding:', error);
      process.exit(1);
    });
}

// Exportar funciones para uso en otros archivos
export { main as seedDatabase };
export default main;