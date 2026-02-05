import { prisma } from '../../config/database';
import { UserRole } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../../utils/errors';
import { CreateCompanyInput, UpdateCompanyInput, InviteUserInput, CompanySettingsInput } from './company.schema';

export class CompanyService {
  /**
   * Get all companies for a user
   */
  async getUserCompanies(userId: string) {
    const companyUsers = await prisma.companyUser.findMany({
      where: {
        userId,
        acceptedAt: { not: null },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            logo: true,
            baseCurrency: true,
          },
        },
      },
      orderBy: {
        company: { name: 'asc' },
      },
    });

    return companyUsers.map((cu) => ({
      ...cu.company,
      role: cu.role,
      isDefault: cu.isDefault,
    }));
  }

  /**
   * Create a new company
   */
  async createCompany(userId: string, input: CreateCompanyInput) {
    const company = await prisma.company.create({
      data: {
        ...input,
        companyUsers: {
          create: {
            userId,
            role: UserRole.OWNER,
            acceptedAt: new Date(),
            isDefault: true,
          },
        },
      },
      include: {
        companyUsers: {
          where: { userId },
          select: { role: true, isDefault: true },
        },
      },
    });

    return {
      ...company,
      role: company.companyUsers[0].role,
      isDefault: company.companyUsers[0].isDefault,
      companyUsers: undefined,
    };
  }

  /**
   * Get company by ID
   */
  async getCompany(companyId: string, userId: string) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
      include: {
        company: true,
      },
    });

    if (!companyUser) {
      throw new NotFoundError('Company not found');
    }

    return {
      ...companyUser.company,
      role: companyUser.role,
    };
  }

  /**
   * Update company
   */
  async updateCompany(companyId: string, userId: string, input: UpdateCompanyInput) {
    // Verify access
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });

    if (!companyUser) {
      throw new NotFoundError('Company not found');
    }

    if (companyUser.role !== UserRole.OWNER && companyUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Admin access required');
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: input,
    });

    return company;
  }

  /**
   * Update company settings
   */
  async updateSettings(companyId: string, userId: string, settings: CompanySettingsInput) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });

    if (!companyUser) {
      throw new NotFoundError('Company not found');
    }

    if (companyUser.role !== UserRole.OWNER && companyUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Admin access required');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    const currentSettings = company?.settings as Record<string, any> || {};
    const newSettings = { ...currentSettings, ...settings };

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { settings: newSettings },
    });

    return updated.settings;
  }

  /**
   * Delete company (only owner)
   */
  async deleteCompany(companyId: string, userId: string) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });

    if (!companyUser) {
      throw new NotFoundError('Company not found');
    }

    if (companyUser.role !== UserRole.OWNER) {
      throw new ForbiddenError('Only the owner can delete a company');
    }

    // Delete company (cascades to all related data)
    await prisma.company.delete({
      where: { id: companyId },
    });
  }

  /**
   * Get company users
   */
  async getCompanyUsers(companyId: string) {
    const users = await prisma.companyUser.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { user: { name: 'asc' } },
      ],
    });

    return users.map((cu) => ({
      id: cu.user.id,
      email: cu.user.email,
      name: cu.user.name,
      avatar: cu.user.avatar,
      role: cu.role,
      invitedAt: cu.invitedAt,
      acceptedAt: cu.acceptedAt,
    }));
  }

  /**
   * Invite user to company
   */
  async inviteUser(companyId: string, inviterUserId: string, input: InviteUserInput) {
    // Check inviter permissions
    const inviter = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId: inviterUserId },
      },
    });

    if (!inviter) {
      throw new NotFoundError('Company not found');
    }

    if (inviter.role !== UserRole.OWNER && inviter.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Admin access required to invite users');
    }

    // Can't invite with higher role than yourself (except owner can do anything)
    if (inviter.role !== UserRole.OWNER) {
      if (input.role === 'ADMIN' && inviter.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Cannot invite users with higher role');
      }
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      // Create placeholder user (will complete registration on first login)
      user = await prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.email.split('@')[0], // Temporary name
        },
      });
    }

    // Check if already a member
    const existing = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId: user.id },
      },
    });

    if (existing) {
      throw new ConflictError('User is already a member of this company');
    }

    // Create invitation
    const companyUser = await prisma.companyUser.create({
      data: {
        companyId,
        userId: user.id,
        role: UserRole[input.role as keyof typeof UserRole],
        invitedAt: new Date(),
        // Auto-accept if user already exists with password
        acceptedAt: user.passwordHash ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // TODO: Send invitation email

    return {
      id: companyUser.user.id,
      email: companyUser.user.email,
      name: companyUser.user.name,
      role: companyUser.role,
      invitedAt: companyUser.invitedAt,
      acceptedAt: companyUser.acceptedAt,
    };
  }

  /**
   * Update user role in company
   */
  async updateUserRole(
    companyId: string,
    targetUserId: string,
    currentUserId: string,
    newRole: UserRole
  ) {
    const currentUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId: currentUserId },
      },
    });

    if (!currentUser) {
      throw new NotFoundError('Company not found');
    }

    const targetUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId: targetUserId },
      },
    });

    if (!targetUser) {
      throw new NotFoundError('User not found in company');
    }

    // Only owner can change roles
    if (currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenError('Only owner can change user roles');
    }

    // Cannot change own role
    if (currentUserId === targetUserId) {
      throw new BadRequestError('Cannot change your own role');
    }

    // If transferring ownership
    if (newRole === UserRole.OWNER) {
      // Demote current owner to admin
      await prisma.companyUser.update({
        where: {
          companyId_userId: { companyId, userId: currentUserId },
        },
        data: { role: UserRole.ADMIN },
      });
    }

    const updated = await prisma.companyUser.update({
      where: {
        companyId_userId: { companyId, userId: targetUserId },
      },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      id: updated.user.id,
      email: updated.user.email,
      name: updated.user.name,
      role: updated.role,
    };
  }

  /**
   * Remove user from company
   */
  async removeUser(companyId: string, targetUserId: string, currentUserId: string) {
    const currentUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId: currentUserId },
      },
    });

    if (!currentUser) {
      throw new NotFoundError('Company not found');
    }

    const targetUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId: targetUserId },
      },
    });

    if (!targetUser) {
      throw new NotFoundError('User not found in company');
    }

    // Owner cannot be removed
    if (targetUser.role === UserRole.OWNER) {
      throw new BadRequestError('Cannot remove the company owner');
    }

    // Only owner/admin can remove users, or users can remove themselves
    if (currentUserId !== targetUserId) {
      if (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Admin access required');
      }
    }

    await prisma.companyUser.delete({
      where: {
        companyId_userId: { companyId, userId: targetUserId },
      },
    });
  }

  /**
   * Set default company for user
   */
  async setDefaultCompany(userId: string, companyId: string) {
    // Verify access
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });

    if (!companyUser) {
      throw new NotFoundError('Company not found');
    }

    // Clear other defaults
    await prisma.companyUser.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.companyUser.update({
      where: {
        companyId_userId: { companyId, userId },
      },
      data: { isDefault: true },
    });
  }
}

export const companyService = new CompanyService();
