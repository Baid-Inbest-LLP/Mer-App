import { cloneElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import inbestTextLogo from '../../assets/inbest_text_logo.png';
import inbestWhiteLogo from '../../assets/white_inbest_logo.png';
import { isAdmin } from '../../constants/roles';

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
    to: '/reports/monthly',
    label: 'Monthly Report',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5M12 12.75h.008v.008H12v-.008z"
        />
      </svg>
    ),
  },
  {
    to: '/reports/financial-year',
    label: 'FY Report',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
        />
      </svg>
    ),
  },
  {
    to: '/reports/summary',
    label: 'Summary Report',
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
  },
  {
    to: '/companies',
    label: 'Companies',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    adminOnly: true,
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

const Sidebar = ({ isOpen = true }) => {
  const { user } = useSelector((state) => state.auth);
  const items = navItems.filter((item) => !item.adminOnly || isAdmin(user?.role));

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
            className={`object-contain object-center transition-[height,width] duration-200 ${
              isOpen ? 'h-9 w-auto max-w-[9.5rem]' : 'h-9 w-auto max-w-[3.25rem]'
            }`}
            decoding="async"
          />
        </div>
      </div>

      <nav className={`flex-1 py-4 space-y-1 ${isOpen ? 'px-3' : 'px-2'}`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={!isOpen ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-md font-medium transition-colors ${
                isOpen ? 'gap-3 justify-start px-3 py-2' : 'justify-center px-2 py-2.5'
              } ${
                isActive
                  ? 'bg-white/75 text-[#0b2f81] shadow-sm'
                  : 'text-primary-100 hover:bg-white/70 hover:text-[#0b2f81]'
              }`
            }
          >
            {cloneElement(item.icon, {
              className: `${isOpen ? 'w-5 h-5' : 'w-7 h-7'} flex-shrink-0`,
            })}
            {isOpen && <span className="whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`py-4 border-t border-primary-800 ${isOpen ? 'px-4' : 'px-2'}`}>
        <div
          className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}
          title={!isOpen ? user?.name : undefined}
        >
          <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-lg font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-md font-medium text-white truncate">{user?.name}</p>
              <p className="text-sm text-gray-400 truncate">{roleLabel(user?.role)}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
