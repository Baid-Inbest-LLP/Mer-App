import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';
import { config } from '../config/index.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  ApiResponse.success(res, result, 'Login successful');
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  const result = await authService.refreshAccessToken(token);
  ApiResponse.success(res, result, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  ApiResponse.success(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req, res) => {
  ApiResponse.success(res, req.user, 'User profile');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  const resetUrl = result.resetToken
    ? `${config.clientUrl}/reset-password?token=${result.resetToken}`
    : null;
  ApiResponse.success(res, { resetUrl: config.env === 'development' ? resetUrl : undefined }, result.message);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await authService.resetPassword(req.body.token, req.body.password);
  ApiResponse.success(res, { id: user._id }, 'Password reset successful');
});

export const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body, req.user);
  ApiResponse.created(res, user, 'User registered');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id, currentPassword, newPassword);
  ApiResponse.success(res, null, 'Password updated successfully');
});
