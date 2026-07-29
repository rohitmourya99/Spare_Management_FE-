import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/response.util';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach(e => { errors[e.path.join('.')] = e.message; });
      ApiResponse.validationError(res, errors);
      return;
    }

    const result = await authService.login(
      parsed.data.email,
      parsed.data.password,
      req.ip
    );
    ApiResponse.success(res, result, 'Login successful');
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      ApiResponse.badRequest(res, 'Refresh token required');
      return;
    }
    const result = await authService.refreshToken(refreshToken);
    ApiResponse.success(res, result, 'Token refreshed');
  }

  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (refreshToken && req.user) {
      await authService.logout(refreshToken, req.user.userId, req.ip);
    }
    ApiResponse.success(res, null, 'Logged out successfully');
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach(e => { errors[e.path.join('.')] = e.message; });
      ApiResponse.validationError(res, errors);
      return;
    }

    await authService.changePassword(
      req.user!.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    ApiResponse.success(res, null, 'Password changed successfully');
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    const profile = await authService.getProfile(req.user!.userId);
    ApiResponse.success(res, profile);
  }
}

export const authController = new AuthController();
