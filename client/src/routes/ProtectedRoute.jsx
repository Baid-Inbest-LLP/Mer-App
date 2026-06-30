import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loader, Center } from '@mantine/core';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
