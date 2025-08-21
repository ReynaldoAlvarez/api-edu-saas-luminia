import jwt from 'jsonwebtoken';
import { env } from '@/config/environment';
import logger from './logger';

/**
 * Utilidades para manejo de JSON Web Tokens
 * Incluye generación, verificación y refresh de tokens
 */

/**
 * Interface para el payload del JWT
 */
export interface JwtPayload {
  userId: string;
  institutionId: string;
  roleId: string;
  roleName: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Interface para el payload del refresh token
 */
export interface RefreshTokenPayload {
  userId: string;
  institutionId: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

/**
 * Interface para el resultado de generación de tokens
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
}

/**
 * Función para generar un access token
 * @param payload - Datos del usuario para incluir en el token
 * @returns Token JWT firmado
 */
export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  
  try {
     
    const token = jwt.sign(
      payload,
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
        issuer: 'educational-saas-api',
        audience: 'educational-saas-client',
    
      }as jwt.SignOptions
    );

    logger.debug('Access token generado', {
      userId: payload.userId,
      institutionId: payload.institutionId,
      expiresIn: env.JWT_EXPIRES_IN,
    });

    return token;
  } catch (error) {
    logger.error('Error generando access token:', error);
    throw new Error('Error al generar token de acceso');
  }
};

/**
 * Función para generar un refresh token
 * @param payload - Datos básicos del usuario para el refresh token
 * @returns Refresh token JWT firmado
 */
export const generateRefreshToken = (payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string => {
  try {
    const token = jwt.sign(
      payload,
      env.JWT_REFRESH_SECRET,
      {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
        issuer: 'educational-saas-api',
        audience: 'educational-saas-client',
      } as jwt.SignOptions
    );

    logger.debug('Refresh token generado', {
      userId: payload.userId,
      institutionId: payload.institutionId,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    return token;
  } catch (error) {
    logger.error('Error generando refresh token:', error);
    throw new Error('Error al generar token de actualización');
  }
};

/**
 * Función para generar un par de tokens (access + refresh)
 * @param userPayload - Datos del usuario
 * @returns Par de tokens con información adicional
 */
export const generateTokenPair = (userPayload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair => {
  const accessToken = generateAccessToken(userPayload);
  const refreshToken = generateRefreshToken({
    userId: userPayload.userId,
    institutionId: userPayload.institutionId,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_EXPIRES_IN,
    tokenType: 'Bearer',
  };
};

/**
 * Función para verificar un access token
 * @param token - Token a verificar
 * @returns Payload decodificado del token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'educational-saas-api',
      audience: 'educational-saas-client',
    }) as JwtPayload;

    logger.debug('Access token verificado', {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
    });

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Access token expirado', { error: error.message });
      throw new Error('Token expirado');
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Access token inválido', { error: error.message });
      throw new Error('Token inválido');
    }

    logger.error('Error verificando access token:', error);
    throw new Error('Error al verificar token');
  }
};

/**
 * Función para verificar un refresh token
 * @param token - Refresh token a verificar
 * @returns Payload decodificado del refresh token
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'educational-saas-api',
      audience: 'educational-saas-client',
    }) as RefreshTokenPayload;

    logger.debug('Refresh token verificado', {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
    });

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Refresh token expirado', { error: error.message });
      throw new Error('Refresh token expirado');
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Refresh token inválido', { error: error.message });
      throw new Error('Refresh token inválido');
    }

    logger.error('Error verificando refresh token:', error);
    throw new Error('Error al verificar refresh token');
  }
};

/**
 * Función para extraer el token del header Authorization
 * @param authHeader - Header de autorización
 * @returns Token extraído o null si no es válido
 */
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) {
    return null;
  }

  // Verificar formato "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Función para decodificar un token sin verificar (útil para debugging)
 * @param token - Token a decodificar
 * @returns Payload decodificado sin verificación
 */
export const decodeTokenWithoutVerification = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch (error) {
    logger.error('Error decodificando token:', error);
    return null;
  }
};

/**
 * Función para verificar si un token está próximo a expirar
 * @param token - Token a verificar
 * @param thresholdMinutes - Minutos antes de expiración para considerar "próximo"
 * @returns true si el token expira pronto
 */
export const isTokenExpiringSoon = (token: string, thresholdMinutes: number = 15): boolean => {
  try {
    const decoded = decodeTokenWithoutVerification(token);
    if (!decoded || !decoded.exp) {
      return true; // Si no se puede decodificar, asumir que expira pronto
    }

    const now = Math.floor(Date.now() / 1000);
    const threshold = thresholdMinutes * 60; // Convertir a segundos
    
    return (decoded.exp - now) <= threshold;
  } catch (error) {
    logger.error('Error verificando expiración de token:', error);
    return true;
  }
};