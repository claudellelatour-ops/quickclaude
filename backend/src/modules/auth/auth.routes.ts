import { Router } from 'express';
import passport from 'passport';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from './auth.schema';
import './passport.config';

const router = Router();

// Public routes
router.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(authController.register.bind(authController))
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(authController.login.bind(authController))
);

router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  asyncHandler(authController.refresh.bind(authController))
);

// OAuth routes
router.get(
  '/oauth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/oauth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  asyncHandler(authController.googleCallback.bind(authController))
);

// Microsoft OAuth would be similar
router.get('/oauth/microsoft', (req, res) => {
  // Redirect to Microsoft OAuth URL
  // Implementation depends on passport-microsoft or manual OAuth
  res.status(501).json({ message: 'Microsoft OAuth not yet configured' });
});

router.get('/oauth/microsoft/callback', (req, res) => {
  res.status(501).json({ message: 'Microsoft OAuth not yet configured' });
});

// Protected routes
router.post(
  '/logout',
  authenticate,
  asyncHandler(authController.logout.bind(authController))
);

router.get(
  '/me',
  authenticate,
  asyncHandler(authController.me.bind(authController))
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword.bind(authController))
);

export default router;
