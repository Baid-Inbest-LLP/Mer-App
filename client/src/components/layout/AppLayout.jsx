import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { fetchLookups } from '../../store/slices/commonSlice';
import { fetchMe } from '../../store/slices/authSlice';

export default function AppLayout() {
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchMe());
    dispatch(fetchLookups());
  }, [dispatch]);

  return (
    <div className="app-layout flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} />
      <div className="app-layout__column">
        <Navbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
