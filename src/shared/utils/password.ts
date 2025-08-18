import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '@/config/environment';
import logger from './logger';

/**
 * Utilidades para manejo seguro de contraseñas
 * Incluye hashing, verificación y generación de contraseñas temporales
 */

/**
 * Configuración para el hashing de contraseñas
 */
const HASH_CONFIG = {
  saltRounds: env.BCRYPT_ROUNDS,
  minPasswordLength: 8,
  maxPasswordLength: 128,
} as const;

/**
 * Expresiones regulares para validación de contraseñas
 */
const PASSWORD_PATTERNS = {
  // Al menos 8 caracteres, una mayúscula, una minúscula, un número
  strong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  // Al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial
  veryStrong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
} as const;

/**
 * Enum para niveles de fortaleza de contraseña
 */
export enum PasswordStrength {
  WEAK = 'weak',
  MEDIUM = 'medium',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong',
}

/**
 * Interface para el resultado de validación de contraseña
 */
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
  suggestions: string[];
}

/**
 * Función para hashear una contraseña
 * @param password - Contraseña en texto plano
 * @returns Hash de la contraseña
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    // Validar longitud de contraseña
    if (password.length < HASH_CONFIG.minPasswordLength) {
      throw new Error(`La contraseña debe tener al menos ${HASH_CONFIG.minPasswordLength} caracteres`);
    }

    if (password.length > HASH_CONFIG.maxPasswordLength) {
      throw new Error(`La contraseña no puede tener más de ${HASH_CONFIG.maxPasswordLength} caracteres`);
    }

    // Generar salt y hash
    const salt = await bcrypt.genSalt(HASH_CONFIG.saltRounds);
    const hash = await bcrypt.hash(password, salt);

    logger.debug('Contraseña hasheada exitosamente', {
      saltRounds: HASH_CONFIG.saltRounds,
      hashLength: hash.length,
    });

    return hash;
  } catch (error) {
    logger.error('Error hasheando contraseña:', error);
    throw new Error('Error al procesar la contraseña');
  }
};

/**
 * Función para verificar una contraseña contra su hash
 * @param password - Contraseña en texto plano
 * @param hash - Hash almacenado
 * @returns true si la contraseña coincide
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    // Validar parámetros
    if (!password || !hash) {
      return false;
    }

    const isMatch = await bcrypt.compare(password, hash);

    logger.debug('Verificación de contraseña', {
      isMatch,
      hashLength: hash.length,
    });

    return isMatch;
  } catch (error) {
    logger.error('Error verificando contraseña:', error);
    return false;
  }
};

/**
 * Función para evaluar la fortaleza de una contraseña
 * @param password - Contraseña a evaluar
 * @returns Nivel de fortaleza de la contraseña
 */
export const evaluatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return PasswordStrength.WEAK;
  }

  // Verificar patrones de fortaleza
  if (PASSWORD_PATTERNS.veryStrong.test(password)) {
    return PasswordStrength.VERY_STRONG;
  }

  if (PASSWORD_PATTERNS.strong.test(password)) {
    return PasswordStrength.STRONG;
  }

  // Verificar criterios básicos
  const hasMinLength = password.length >= HASH_CONFIG.minPasswordLength;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (hasMinLength && hasUpperCase && hasLowerCase && hasNumbers) {
    return PasswordStrength.MEDIUM;
  }

  return PasswordStrength.WEAK;
};

/**
 * Función para validar una contraseña con criterios específicos
 * @param password - Contraseña a validar
 * @param requireStrong - Si requiere contraseña fuerte (por defecto true)
 * @returns Resultado de validación con errores y sugerencias
 */
export const validatePassword = (
  password: string,
  requireStrong: boolean = true
): PasswordValidationResult => {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Validar longitud
  if (!password) {
    errors.push('La contraseña es requerida');
    return {
      isValid: false,
      strength: PasswordStrength.WEAK,
      errors,
      suggestions: ['Proporciona una contraseña válida'],
    };
  }

  if (password.length < HASH_CONFIG.minPasswordLength) {
    errors.push(`La contraseña debe tener al menos ${HASH_CONFIG.minPasswordLength} caracteres`);
  }

  if (password.length > HASH_CONFIG.maxPasswordLength) {
    errors.push(`La contraseña no puede tener más de ${HASH_CONFIG.maxPasswordLength} caracteres`);
  }

  // Validar caracteres
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[@$!%*?&]/.test(password);

  if (!hasUpperCase) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
    suggestions.push('Agrega al menos una letra mayúscula (A-Z)');
  }

  if (!hasLowerCase) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
    suggestions.push('Agrega al menos una letra minúscula (a-z)');
  }

  if (!hasNumbers) {
    errors.push('La contraseña debe contener al menos un número');
    suggestions.push('Agrega al menos un número (0-9)');
  }

  if (requireStrong && !hasSpecialChars) {
    errors.push('La contraseña debe contener al menos un carácter especial');
    suggestions.push('Agrega al menos un carácter especial (@$!%*?&)');
  }

  // Validar patrones comunes débiles
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('La contraseña contiene patrones comunes inseguros');
      suggestions.push('Evita usar patrones comunes como "123456", "password", etc.');
      break;
    }
  }

  const strength = evaluatePasswordStrength(password);
  const isValid = errors.length === 0;

  return {
    isValid,
    strength,
    errors,
    suggestions,
  };
};

/**
 * Función para generar una contraseña temporal segura
 * @param length - Longitud de la contraseña (por defecto 12)
 * @param includeSpecialChars - Si incluir caracteres especiales (por defecto true)
 * @returns Contraseña temporal generada
 */
export const generateTemporaryPassword = (
  length: number = 12,
  includeSpecialChars: boolean = true
): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specialChars = '@$!%*?&';

  let charset = lowercase + uppercase + numbers;
  if (includeSpecialChars) {
    charset += specialChars;
  }

  let password = '';

  // Asegurar que tenga al menos un carácter de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  if (includeSpecialChars) {
    password += specialChars[Math.floor(Math.random() * specialChars.length)];
  }

  // Completar el resto de la longitud
  const remainingLength = length - password.length;
  for (let i = 0; i < remainingLength; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Mezclar los caracteres para evitar patrones predecibles
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Función para generar un token de reset de contraseña
 * @returns Token seguro para reset de contraseña
 */
export const generatePasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Función para verificar si una contraseña necesita ser actualizada
 * @param hash - Hash actual de la contraseña
 * @returns true si el hash necesita ser actualizado
 */
export const needsPasswordRehash = (hash: string): boolean => {
  try {
    // Verificar si el hash fue creado con los rounds actuales
    const currentRounds = bcrypt.getRounds(hash);
    return currentRounds < HASH_CONFIG.saltRounds;
  } catch (error) {
    logger.error('Error verificando si el hash necesita actualización:', error);
    return true; // Si hay error, asumir que necesita actualización
  }
};