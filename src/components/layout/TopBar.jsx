import { useState } from 'react'
import { Sun, Moon, Settings, LogOut, Heart, Minimize2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store/useStore'
import { Logo } from '@/components/common/Logo'
import { ConfirmLogoutModal } from '@/components/auth/ConfirmLogoutModal'
import { cn } from '@/utils/cn'

function IconButton({ label, onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl border border-line/70 bg-surface/50 text-muted backdrop-blur-xl transition-colors hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TopBar() {
  const { user, signOut } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setSupportOpen = useStore((s) => s.setSupportOpen)
  const fullscreen = useStore((s) => s.fullscreen)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  const firstName = (user?.displayName || 'Explorer').split(' ')[0]

  return (
    <header className="flex items-center justify-between gap-4">
      <ConfirmLogoutModal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={signOut}
        user={user}
      />
      <div className="flex items-center gap-3">
        <Logo className="h-10 w-10 shrink-0 drop-shadow" />
        <div>
          <p className="text-sm text-muted">Welcome back,</p>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {firstName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {fullscreen && (
          <IconButton
            label="Exit Full Screen"
            onClick={() => window.protrack?.window?.toggleFullScreen?.()}
            className="text-amber-400 hover:text-amber-500 border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10"
          >
            <Minimize2 className="h-5 w-5" />
          </IconButton>
        )}

        <IconButton
          label="Support Corner"
          onClick={() => setSupportOpen(true)}
          className="text-rose-400 hover:text-rose-500 border-rose-500/10 bg-rose-500/5 hover:bg-rose-500/10"
        >
          <Heart className="h-5 w-5 fill-rose-400/20" />
        </IconButton>

        <IconButton
          label={isDark ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </IconButton>

        <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </IconButton>

        {/* Avatar + sign out */}
        <div className="flex items-center gap-2 rounded-xl border border-line/70 bg-surface/50 p-1 pl-1 backdrop-blur-xl">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'You'}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-sm font-semibold text-accent">
              {firstName[0]}
            </div>
          )}
          <button
            onClick={() => setLogoutModalOpen(true)}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
