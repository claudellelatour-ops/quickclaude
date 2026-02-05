import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  companyId?: string;
  companyRole?: UserRole;
}

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
}

/**
 * Extract company from header and verify user has access
 */
export async function requireCompany(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const companyId = req.headers['x-company-id'] as string;

    if (!companyId) {
      throw new ForbiddenError('Company ID required');
    }

    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: req.user.id,
        },
      },
      include: {
        company: true,
      },
    });

    if (!companyUser) {
      throw new ForbiddenError('Access denied to this company');
    }

    if (!companyUser.acceptedAt) {
      throw new ForbiddenError('Invitation not accepted');
    }

    req.companyId = companyId;
    req.companyRole = companyUser.role;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.companyRole) {
      return next(new ForbiddenError('Company access required'));
    }

    if (!allowedRoles.includes(req.companyRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Check if user has write access (not READONLY)
 */
export function requireWriteAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.companyRole === UserRole.READONLY) {
    return next(new ForbiddenError('Read-only access'));
  }
  next();
}

/**
 * Check if user is owner or admin
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.companyRole !== UserRole.OWNER && req.companyRole !== UserRole.ADMIN) {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}

/**
 * Check if user is company owner
 */
export function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.companyRole !== UserRole.OWNER) {
    return next(new ForbiddenError('Owner access required'));
  }
  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Ignore token errors for optional auth
  }

  next();
}
