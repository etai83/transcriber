import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const isActive = (route) => {
    if (route === '/' && path === '/') return true;
    if (route !== '/' && path.startsWith(route)) return true;
    return false;
  };

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard', route: '/' }, // Screen 3 calls it 'Live' in one place but 'Dashboard' in another. I'll use Dashboard as per title. Actually Screen 2 calls it 'Live'. Screen 3 calls it 'Dashboard'. I'll stick to 'Dashboard' for home.
    { name: 'Files', icon: 'folder_open', route: '/files' },
    { name: 'Insights', icon: 'analytics', route: '/insights' },
    { name: 'Settings', icon: 'settings', route: '/settings' },
  ];

  return (
    <nav className="shrink-0 w-full bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-5 pt-3 px-6 flex justify-between items-center z-20 sticky bottom-0">
      {navItems.map((item) => (
        <Link
          key={item.name}
          to={item.route}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isActive(item.route)
              ? 'text-primary'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <span className={`material-symbols-outlined text-[26px] ${isActive(item.route) ? 'fill-current' : ''}`}>
            {item.icon}
          </span>
          <span className="text-[10px] font-medium">{item.name}</span>
        </Link>
      ))}
    </nav>
  );
}
