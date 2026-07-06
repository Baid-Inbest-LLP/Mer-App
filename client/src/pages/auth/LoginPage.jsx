import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { login, clearError } from '../../store/slices/authSlice';
import inbestLogo from '../../assets/white_inbest_logo.png';
import PasswordInput from '../../components/common/PasswordInput';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);
  const { theme } = useSelector((state) => state.common);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
    return () => dispatch(clearError());
  }, [isAuthenticated, navigate, dispatch]);

  const onSubmit = async (data) => {
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      notifications.show({ message: 'Welcome back!', color: 'green' });
      navigate('/');
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        isDark
          ? 'bg-[#1a1b1e]'
          : 'bg-gradient-to-br from-[#0b2f81] via-[#1446a0] to-[#1d5fb3]'
      }`}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center mb-4">
            <img src={inbestLogo} alt="Inbest Logo" className="w-25 h-25 object-contain" />
          </div>
          <p className={`text-lg mt-1 ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>
            Monthly Expense Report System
          </p>
        </div>

        <div
          className={`rounded-2xl shadow-2xl p-8 ${
            isDark ? 'bg-[#25262b] border border-[#373a40]' : 'bg-white'
          }`}
        >
          <h2 className={`text-xl font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sign In
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Email
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="admin@mer.com"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Password
              </label>
              <PasswordInput
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full justify-center py-2.5 mt-2 inline-flex items-center rounded-lg px-4 text-sm font-semibold text-white bg-[#0b2f81] hover:bg-[#1446a0] active:bg-[#08306b] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <p className={`text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <Link to="/forgot-password" className="text-primary-600 hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
