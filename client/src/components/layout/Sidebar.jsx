import { cloneElement, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import inbestTextLogo from '../../assets/inbest_text_logo.png';
import inbestWhiteLogo from '../../assets/white_inbest_logo.png';
import { isAdmin } from '../../constants/roles';

const chevronIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    to: '/entries',
    label: 'Expense Entries',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    label: 'Reports & Insights',
    basePath: '/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    children: [
      { to: '/reports/monthly', label: 'Monthly Report' },
      { to: '/reports/financial-year', label: 'FY Report' },
      { to: '/reports/summary', label: 'Summary Report' },
    ],
  },
  {
    to: '/control-center',
    label: 'Control Center',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const roleLabel = (role) => {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'user') return 'User';
  return role || '';
};

const linkClass = (isOpen, isActive) =>
  `flex min-w-0 items-center overflow-hidden rounded-lg text-md font-medium transition-colors ${
    isOpen ? 'gap-3 justify-start px-3 py-2' : 'justify-center px-2 py-2.5'
  } ${
    isActive
      ? 'bg-white/75 text-[#0b2f81] shadow-sm'
      : 'text-primary-100 hover:bg-white/70 hover:text-[#0b2f81]'
  }`;

const Sidebar = ({ isOpen = true }) => {
  const { user, avatarPreview } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const items = navItems.filter((item) => !item.adminOnly || isAdmin(user?.role));
  const [reportsOpen, setReportsOpen] = useState(() => location.pathname.startsWith('/reports'));
  const showPhoto = Boolean(user?.hasAvatar && avatarPreview);

  useEffect(() => {
    if (location.pathname.startsWith('/reports')) {
      setReportsOpen(true);
    }
  }, [location.pathname]);

  return (
    <aside
      data-open={isOpen}
      className={`flex-shrink-0 bg-gradient-to-br from-[#0b2f81] via-[#1446a0] to-[#1d5fb3] text-white flex flex-col h-full transition-[width] duration-300 ease-in-out will-change-[width] ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      <div
        className={`flex flex-col items-center justify-center border-b border-primary-800 transition-all duration-200 ${
          isOpen ? 'px-3 py-2' : 'px-2 py-2'
        }`}
      >
        <div className="flex w-full min-w-0 items-center justify-center gap-4">
          <img
            src={isOpen ? inbestTextLogo : inbestWhiteLogo}
            alt="inbest"
            className={`sidebar-brand-logo object-contain object-center transition-[height,width] duration-200 ${
              isOpen ? 'h-9 w-auto max-w-[9.5rem]' : 'h-9 w-auto max-w-[3.25rem]'
            }`}
            decoding="async"
          />
        </div>
      </div>

      <nav className={`flex-1 overflow-x-hidden overflow-y-auto py-4 space-y-1 ${isOpen ? 'px-3' : 'px-2'}`}>
        {items.map((item) => {
          if (item.children) {
            const isGroupActive = location.pathname.startsWith(item.basePath);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  title={!isOpen ? item.label : undefined}
                  onClick={() =>
                    isOpen ? setReportsOpen((prev) => !prev) : navigate(item.children[0].to)
                  }
                  className={`w-full border-0 cursor-pointer ${linkClass(isOpen, isGroupActive)}`}
                >
                  {cloneElement(item.icon, {
                    className: `${isOpen ? 'w-5 h-5' : 'w-7 h-7'} flex-shrink-0`,
                  })}
                  {isOpen && (
                    <span className="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {isOpen &&
                    cloneElement(chevronIcon, {
                      className: `w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                        reportsOpen ? 'rotate-90' : ''
                      }`,
                    })}
                </button>

                {isOpen && reportsOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg pl-4 pr-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-white/75 text-[#0b2f81] shadow-sm'
                              : 'text-primary-100 hover:bg-white/70 hover:text-[#0b2f81]'
                          }`
                        }
                      >
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />
                        <span className="whitespace-nowrap">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={!isOpen ? item.label : undefined}
              className={({ isActive }) => linkClass(isOpen, isActive)}
            >
              {cloneElement(item.icon, {
                className: `${isOpen ? 'w-5 h-5' : 'w-7 h-7'} flex-shrink-0`,
              })}
              {isOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className={`py-4 border-t border-primary-800 ${isOpen ? 'px-4' : 'px-2'}`}>
        <div
          className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}
          title={!isOpen ? user?.name : undefined}
        >
          <div className="sidebar-user-avatar text-lg font-semibold">
            {showPhoto ? (
              <img
                src={avatarPreview}
                alt={user?.name || 'Profile'}
              />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-md font-medium text-white truncate">{user?.name}</p>
              <p className="sidebar-user-role text-sm truncate">{roleLabel(user?.role)}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
