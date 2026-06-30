import crypto from 'crypto';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/tokenUtils.js';

export const login = async (email, password) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password +refreshToken');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.unauthorized('Account is deactivated');
  }

  const payload = { id: user._id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return { user, accessToken, refreshToken };
};

export const refreshAccessToken = async (token) => {
  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const payload = { id: user._id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  return { accessToken, user };
};

export const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    return { message: 'If email exists, reset link has been sent' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save({ validateBeforeSave: false });

  return { resetToken, email: user.email, message: 'If email exists, reset link has been sent' };
};

export const resetPassword = async (token, password) => {
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+password +resetPasswordToken +resetPasswordExpires');

  if (!user) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshToken = undefined;
  await user.save();

  return user;
};

export const registerUser = async (data, requestedBy) => {
  const exists = await User.findOne({ email: data.email });
  if (exists) throw ApiError.conflict('Email already registered');

  const role = data.role || 'user';
  if (requestedBy.role === 'admin') {
    if (role !== 'user') {
      throw ApiError.forbidden('Admins can only create regular users');
    }
  }
  if (role === 'superadmin' && requestedBy.role !== 'superadmin') {
    throw ApiError.forbidden('Only superadmin can assign superadmin role');
  }

  return User.create({ ...data, role });
};
