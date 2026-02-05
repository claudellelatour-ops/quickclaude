import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
});

// Get user profile
router.get(
  '/profile',
  asyncHandler(async (req: any, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        oauthProvider: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    return sendSuccess(res, user);
  })
);

// Update user profile
router.patch(
  '/profile',
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req: any, res) => {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });
    return sendSuccess(res, user, 'Profile updated');
  })
);

// Get pending invitations
router.get(
  '/invitations',
  asyncHandler(async (req: any, res) => {
    const invitations = await prisma.companyUser.findMany({
      where: {
        userId: req.user.id,
        acceptedAt: null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    return sendSuccess(res, invitations.map((inv) => ({
      companyId: inv.company.id,
      companyName: inv.company.name,
      companyLogo: inv.company.logo,
      role: inv.role,
      invitedAt: inv.invitedAt,
    })));
  })
);

// Accept invitation
router.post(
  '/invitations/:companyId/accept',
  validate({ params: z.object({ companyId: z.string().uuid() }) }),
  asyncHandler(async (req: any, res) => {
    const invitation = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: req.params.companyId,
          userId: req.user.id,
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ success: false, error: { message: 'Invitation not found' } });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({ success: false, error: { message: 'Already accepted' } });
    }

    await prisma.companyUser.update({
      where: {
        companyId_userId: {
          companyId: req.params.companyId,
          userId: req.user.id,
        },
      },
      data: { acceptedAt: new Date() },
    });

    return sendSuccess(res, null, 'Invitation accepted');
  })
);

// Decline invitation
router.post(
  '/invitations/:companyId/decline',
  validate({ params: z.object({ companyId: z.string().uuid() }) }),
  asyncHandler(async (req: any, res) => {
    await prisma.companyUser.delete({
      where: {
        companyId_userId: {
          companyId: req.params.companyId,
          userId: req.user.id,
        },
      },
    });

    return sendSuccess(res, null, 'Invitation declined');
  })
);

export default router;
