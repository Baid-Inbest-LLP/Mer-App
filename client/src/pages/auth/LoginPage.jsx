import { Component, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { login, clearError } from '../../store/slices/authSlice';
import inbestLogo from '../../assets/white_inbest_logo.png';
import PasswordInput from '../../components/common/PasswordInput';
import Hyperspeed from '../../components/effects/Hyperspeed';

class HyperspeedBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[Hyperspeed] render error:', error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const HYPERSPEED_OPTIONS = {
  onSpeedUp: () => {},
  onSlowDown: () => {},
  distortion: 'turbulentDistortion',
  length: 400,
  roadWidth: 10,
  islandWidth: 2,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 150,
  speedUp: 2,
  carLightsFade: 0.4,
  totalSideLightSticks: 20,
  lightPairsPerRoadWay: 40,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [60, 80],
  movingCloserSpeed: [-120, -160],
  carLightsLength: [400 * 0.03, 400 * 0.2],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.8, 0.8],
  carFloorSeparation: [0, 5],
  colors: {
    roadColor: 0x080808,
    islandColor: 0x0a0a0a,
    background: 0x000000,
    shoulderLines: 0xffffff,
    brokenLines: 0xffffff,
    leftCars: [0x8eb8ff, 0x1446a0, 0x1d5fb3],
    rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
    sticks: 0x8eb8ff,
  },
};

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);
  const { register, handleSubmit, formState: { errors } } = useForm();

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
    <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="login-page__bg" aria-hidden="true">
        <HyperspeedBoundary>
          <Hyperspeed effectOptions={HYPERSPEED_OPTIONS} />
        </HyperspeedBoundary>
      </div>

      <div className="login-page__overlay" aria-hidden="true" />

      <div className="login-page__content w-full max-w-md">
        <div className="bg-transparent border-2 border-white/20 backdrop-blur-[13px] px-6 py-8 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)]">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-4">
              <img src={inbestLogo} alt="Inbest Logo" className="w-25 h-25 object-contain" />
            </div>
            <p className="text-white/90 text-lg mt-1">Monthly Expense Report System</p>
          </div>

          <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign In</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1">Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="admin@mer.com"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-1">Password</label>
              <PasswordInput
                className="login-input login-input--with-toggle"
                toggleClassName="text-white hover:text-white focus:ring-white/40"
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
              className="login-submit-btn"
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
          </form>
        </div>
      </div>
    </div>
  );
}
