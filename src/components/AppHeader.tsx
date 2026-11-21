import { useState } from 'react';
import type { AppNotification, Profession, UserProfile } from '../types/kisan';
import { ResilientImage } from './ResilientImage';

export const KISAN_LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAyxq_uDfXrH5zC9ae9FeTr7NBUCL3xEfSgp3LcHBxRiv0j__pmJuGvs1WnIr0I-Dkf_ATBYKdiYTCCdOq4eYxJO7qBXlA9fx2oTPwTi2jjZ60K0BbbZ7uit9QizeB2VKglpK5uEV35DcvpWiC5qHUJeZoE4g0iScw_eV52NujL1ur1GKbekt_-P-_OjliaMpvSlI03t69L6jw7YJMOP0SA9QqZQ5hcbIPhg18Cxo9W';

const PROFESSION_LABELS: Record<Profession, string> = {
  farmer: 'Farmer',
  worker: 'Farm Worker',
  supplier: 'Supplier / Trader',
  expert: 'Agricultural Expert',
};

interface AppHeaderProps {
  subtitle: string;
  profile: UserProfile;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onSwitchRoleQuick: (profession: Profession) => void;
}

export function AppHeader({
  subtitle,
  profile,
  notifications,
  onMarkAllRead,
  onOpenProfile,
  onLogout,
  onSwitchRoleQuick,
}: AppHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-b border-outline-variant/20 pt-safe">
      <div className="max-w-5xl mx-auto h-16 px-4 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-surface-container-lowest p-0.5 shadow-sm flex items-center justify-center shrink-0">
            <ResilientImage
              src={KISAN_LOGO_URL}
              alt="KISAN SATHI Logo"
              className="h-8 w-8 rounded-md object-contain"
              fallbackIcon="eco"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[1.05rem] leading-5 font-bold text-primary tracking-tight truncate">
              KISAN SATHI
            </span>
            <span className="text-[11px] leading-3 font-semibold text-secondary truncate">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 relative shrink-0">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowProfileMenu(false);
            }}
            className="relative w-11 h-11 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-error text-on-error text-[10px] font-bold flex items-center justify-center rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="Open profile menu"
            onClick={() => {
              setShowProfileMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <ResilientImage
              src={profile.avatarUrl}
              alt={profile.name}
              className="w-8 h-8 rounded-full object-cover shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
              fallbackText={profile.name.slice(0, 2).toUpperCase()}
              fallbackClassName="bg-primary text-on-primary text-xs"
            />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-14 w-80 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/40 p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                <span className="text-sm font-bold text-on-surface">Updates &amp; Alerts</span>
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-xs font-semibold text-secondary hover:text-primary"
                >
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-outline-variant/20 max-h-64 overflow-y-auto">
                {notifications.map((item) => (
                  <div key={item.id} className="py-2.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-on-surface">{item.title}</span>
                      <span className="text-[11px] text-outline shrink-0">{item.timeAgo}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-snug">{item.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showProfileMenu && (
            <div className="absolute right-0 top-14 w-72 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/40 p-3.5 z-50 space-y-3">
              <div className="flex items-center gap-3 pb-2.5 border-b border-outline-variant/30">
                <ResilientImage
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                  fallbackText={profile.name.slice(0, 2).toUpperCase()}
                  fallbackClassName="bg-primary text-on-primary text-sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{profile.name}</p>
                  <p className="text-xs font-semibold text-secondary truncate">
                    {PROFESSION_LABELS[profile.profession]}
                  </p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {profile.taluk}, {profile.district}, {profile.state}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant block">
                  Quick Role View
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSwitchRoleQuick('worker');
                    }}
                    className="h-9 px-2.5 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold hover:bg-secondary-container/40 transition-colors text-left truncate"
                  >
                    Farm Worker Jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSwitchRoleQuick('supplier');
                    }}
                    className="h-9 px-2.5 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold hover:bg-secondary-container/40 transition-colors text-left truncate"
                  >
                    Trader Crop Lots
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenProfile();
                  }}
                  className="w-full h-10 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  <span>View Farmer Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full h-10 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
