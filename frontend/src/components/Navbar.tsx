import React from 'react';
import { LogOut, Coins } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <Coins size={28} color="var(--primary)" />
        <span>Centavo</span>
      </div>

      <div className="navbar-user">
        <div className="user-profile">
          <div className="user-avatar" title={user?.name}>
            {userInitial}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Usuario'}</span>
            <span className="user-email">{user?.email}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="btn-logout"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
};
