/**
 * Archivo de configuración para Prisma seed
 * Este archivo es requerido por Prisma para ejecutar seeds
 */

const { execSync } = require('child_process');

// Ejecutar el archivo de seed TypeScript usando ts-node
try {
  console.log('🚀 Ejecutando seeds con ts-node...');
  execSync('npx ts-node prisma/seeds/seed.ts', { stdio: 'inherit' });
} catch (error) {
  console.error('💥 Error ejecutando seeds:', error);
  process.exit(1);
}