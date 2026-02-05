import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { UnauthorizedError, ConflictError, BadRequestError, NotFoundError } from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.schema';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
  };
  tokens: AuthTokens;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, AuthService.SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
      },
    });

    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      tokens,
    };
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      tokens,
    };
  }

  /**
   * OAuth login/register
   */
  async oauthLogin(
    provider: string,
    profile: { id: string; email: string; name: string; avatar?: string }
  ): Promise<AuthResponse> {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { oauthProvider: provider, oauthId: profile.id },
          { email: profile.email.toLowerCase() },
        ],
      },
    });

    if (user) {
      // Update OAuth info if logging in with new provider
      if (!user.oauthProvider || user.oauthProvider !== provider) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: provider,
            oauthId: profile.id,
            avatar: user.avatar || profile.avatar,
            lastLoginAt: new Date(),
          },
        });
      } else {
        // Just update last login
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          name: profile.name,
          avatar: profile.avatar,
          oauthProvider: provider,
          oauthId: profile.id,
          lastLoginAt: new Date(),
        },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as TokenPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      return this.generateTokens({ userId: user.id, email: user.email });
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        companyUsers: {
          where: { acceptedAt: { not: null } },
          select: {
            role: true,
            isDefault: true,
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      ...user,
      companies: user.companyUsers.map((cu) => ({
        id: cu.company.id,
        name: cu.company.name,
        logo: cu.company.logo,
        role: cu.role,
        isDefault: cu.isDefault,
      })),
      companyUsers: undefined,
    };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new BadRequestError('Cannot change password for OAuth users');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, AuthService.SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    // Parse expiration for response
    const expiresIn = this.parseExpiration(env.JWT_EXPIRES_IN);

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Parse JWT expiration string to seconds
   */
  private parseExpiration(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}

export const authService = new AuthService();
