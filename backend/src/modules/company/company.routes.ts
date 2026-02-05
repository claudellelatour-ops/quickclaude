import { Router } from 'express';
import { companyController } from './company.controller';
import { validate, idParamSchema } from '../../middleware/validate';
import { authenticate, requireCompany, requireAdmin, requireOwner } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createCompanySchema,
  updateCompanySchema,
  inviteUserSchema,
  updateUserRoleSchema,
  companySettingsSchema,
} from './company.schema';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List user's companies
router.get(
  '/',
  asyncHandler(companyController.list.bind(companyController))
);

// Create company
router.post(
  '/',
  validate({ body: createCompanySchema }),
  asyncHandler(companyController.create.bind(companyController))
);

// Get company
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(companyController.get.bind(companyController))
);

// Update company
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateCompanySchema }),
  asyncHandler(companyController.update.bind(companyController))
);

// Update company settings
router.patch(
  '/:id/settings',
  validate({ params: idParamSchema, body: companySettingsSchema }),
  asyncHandler(companyController.updateSettings.bind(companyController))
);

// Delete company
router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(companyController.delete.bind(companyController))
);

// Set as default company
router.post(
  '/:id/set-default',
  validate({ params: idParamSchema }),
  asyncHandler(companyController.setDefault.bind(companyController))
);

// Company user management - requires company context
router.get(
  '/:id/users',
  validate({ params: idParamSchema }),
  requireCompany,
  asyncHandler(companyController.listUsers.bind(companyController))
);

router.post(
  '/:id/invite',
  validate({ params: idParamSchema, body: inviteUserSchema }),
  requireCompany,
  requireAdmin,
  asyncHandler(companyController.inviteUser.bind(companyController))
);

router.patch(
  '/:id/users/:userId',
  validate({
    params: z.object({
      id: z.string().uuid(),
      userId: z.string().uuid(),
    }),
    body: updateUserRoleSchema,
  }),
  requireCompany,
  requireOwner,
  asyncHandler(companyController.updateUserRole.bind(companyController))
);

router.delete(
  '/:id/users/:userId',
  validate({
    params: z.object({
      id: z.string().uuid(),
      userId: z.string().uuid(),
    }),
  }),
  requireCompany,
  asyncHandler(companyController.removeUser.bind(companyController))
);

export default router;
