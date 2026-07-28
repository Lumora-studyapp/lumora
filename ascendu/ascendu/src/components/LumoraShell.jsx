import { memo } from "react";
import "./lumora-shell.css";

const NavItem = memo(function NavItem({ item, active, onSelect }) {
  return (
    <button
      type="button"
      className={`lm-shell-nav-item${active ? " is-active" : ""}`}
      onClick={() => onSelect(item.id)}
      aria-current={active ? "page" : undefined}
    >
      <span className="lm-shell-nav-icon" aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
});

export default function LumoraShell({
  children,
  navItems,
  activeNav,
  onNavigate,
  onOpenMenu,
  initials,
  coins,
  level,
  tierName,
  xpLabel,
  xpPercent,
  compact = false,
}) {
  return (
    <div className="lm-shell-layout">
      {!compact && (
        <aside className="lm-shell-rail" aria-label="Lumora navigation">
          <div className="lm-shell-brand">
            <span className="lm-shell-brand-mark" aria-hidden="true">✦</span>
            <span>Lumora</span>
          </div>
          <nav className="lm-shell-nav lm-shell-nav-desktop">
            {navItems.map(item => (
              <NavItem key={item.id} item={item} active={activeNav === item.id} onSelect={onNavigate}/>
            ))}
          </nav>
          <div className="lm-shell-rail-note">
            <span>Grow through focus</span>
            <strong>{tierName}</strong>
          </div>
        </aside>
      )}

      <div className="lm-shell-column">
        <header className="lm-shell-topbar">
          <div className="lm-shell-mobile-brand">
            <span aria-hidden="true">✦</span> Lumora
          </div>
          {!compact && (
            <div className="lm-shell-progress" aria-label={`Level ${level}, ${xpLabel}`}>
              <div className="lm-shell-progress-copy">
                <strong>Level {level} · {tierName}</strong>
                <span>{xpLabel}</span>
              </div>
              <div className="lm-shell-progress-track" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, xpPercent))}%` }}/>
              </div>
            </div>
          )}
          <div className="lm-shell-actions">
            {!compact && <div className="lm-shell-coins" aria-label={`${coins} coins`}>◉ {coins}</div>}
            <button type="button" className="lm-shell-profile" onClick={onOpenMenu} aria-label="Open profile and settings">
              <span>{initials}</span>
              <b aria-hidden="true">≡</b>
            </button>
          </div>
        </header>

        <main className="lm-shell-content">{children}</main>
      </div>

      {!compact && (
        <nav className="lm-shell-nav lm-shell-nav-mobile" aria-label="Lumora navigation">
          {navItems.map(item => (
            <NavItem key={item.id} item={item} active={activeNav === item.id} onSelect={onNavigate}/>
          ))}
        </nav>
      )}
    </div>
  );
}
