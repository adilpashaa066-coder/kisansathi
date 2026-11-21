import type { MainTab } from '../types/kisan';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

const NAV_ITEMS: Array<{ id: MainTab; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: 'agriculture' },
  { id: 'workers', label: 'Workers', icon: 'group' },
  { id: 'expert-sathi', label: 'Expert Sathi', icon: 'support_agent' },
  { id: 'market', label: 'Market', icon: 'storefront' },
  { id: 'insights', label: 'Crop Advisor', icon: 'psychology_alt' },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)] pb-safe">
      <div className="max-w-5xl mx-auto flex items-center justify-around h-16 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center px-0.5 h-12 transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${
                  isActive ? 'material-symbols-filled' : ''
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[10px] sm:text-[11px] leading-4 mt-0.5 truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
