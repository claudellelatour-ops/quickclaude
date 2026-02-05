import { Response } from 'express';
import { authService } from './auth.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated } from '../../utils/response';
import { RegisterInput, LoginInput, RefreshTokenInput, ChangePasswordInput } from './auth.schema';

export class AuthController {
  /**
   * Register a new user
   */
  async register(req: AuthenticatedRequest, res: Response) {
    const input: RegisterInput = req.body;
    const result = await authService.register(input);
    return sendCreated(res, result, 'Registration successful');
  }

  /**
   * Login with email/password
   */
  async login(req: AuthenticatedRequest, res: Response) {
    const input: LoginInput = req.body;
    const result = await authService.login(input);
    return sendSuccess(res, result, 'Login successful');
  }

  /**
   * Refresh access token
   */
  async refresh(req: AuthenticatedRequest, res: Response) {
    const { refreshToken }: RefreshTokenInput = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    return sendSuccess(res, tokens);
  }

  /**
   * Logout (client-side token removal, but can be used for audit)
   */
  async logout(req: AuthenticatedRequest, res: Response) {
    // In a more complete implementation, we would invalidate the refresh token
    // by storing it in a blacklist (Redis) until it expires
    return sendSuccess(res, null, 'Logged out successfully');
  }

  /**
   * Get current authenticated user
   */
  async me(req: AuthenticatedRequest, res: Response) {
    const user = await authService.getCurrentUser(req.user!.id);
    return sendSuccess(res, user);
  }

  /**
   * Change password
   */
  async changePassword(req: AuthenticatedRequest, res: Response) {
    const { currentPassword, newPassword }: ChangePasswordInput = req.body;
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    return sendSuccess(res, null, 'Password changed successfully');
  }

  /**
   * Google OAuth callback
   */
  async googleCallback(req: AuthenticatedRequest, res: Response) {
    // This is handled by passport, user profile is in req.user
    const profile = req.user as any;
    const result = await authService.oauthLogin('google', {
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    });

    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${params}`);
  }

  /**
   * Microsoft OAuth callback
   */
  async microsoftCallback(req: AuthenticatedRequest, res: Response) {
    const profile = req.user as any;
    const result = await authService.oauthLogin('microsoft', {
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    });

    const params = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${params}`);
  }
}

export const authController = new AuthController();
