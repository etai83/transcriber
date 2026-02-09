import { NavLink, useLocation } from 'react-router-dom'

function BottomNav() {
    const location = useLocation()

    const navItems = [
        { path: '/', icon: 'dashboard', label: 'Dashboard' },
        { path: '/files', icon: 'folder_open', label: 'Files' },
        { path: '/settings', icon: 'settings', label: 'Settings' },
    ]

    return (
        <nav className="shrink-0 w-full bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-6 pt-3 px-6 flex justify-between items-center z-50">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                    (item.path === '/files' && location.pathname.startsWith('/transcription')) ||
                    (item.path === '/files' && location.pathname.startsWith('/conversation'))

                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center gap-1 transition-colors ${isActive
                                ? 'text-primary'
                                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <span className={`material-symbols-outlined text-[26px] ${isActive ? 'fill-current' : ''}`}>
                            {item.icon}
                        </span>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </NavLink>
                )
            })}
        </nav>
    )
}

export default BottomNav
