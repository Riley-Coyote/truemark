import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { assetUrl } from "../assetUrl";

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
export type NavGroup = { label: string; items: NavItem[] };
export type Theme = "night" | "studio";

function readCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "collapsed";
  } catch {
    return false;
  }
}

function BrandMark() {
  return (
    <>
      <img className="kit-mark kit-mark-night" src={assetUrl("images/brand/monogram-white.svg")} alt="TrueMark" width="24" height="19" />
      <img className="kit-mark kit-mark-studio" src={assetUrl("images/brand/monogram.svg")} alt="TrueMark" width="24" height="19" />
    </>
  );
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <>
      {groups.map((group, index) => (
        <div
          key={group.label || index}
          className="kit-nav-group"
          role={group.label ? "group" : undefined}
          aria-label={group.label || undefined}
        >
          {group.label && (
            <p className="kit-nav-label" aria-hidden="true">
              {group.label}
            </p>
          )}
          <ul>
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink className="kit-nav-link" to={item.to} end={item.end} data-tip={item.label} onClick={onNavigate}>
                  <item.icon aria-hidden="true" strokeWidth={1.6} />
                  <span className="kit-nav-text">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * The application frame: a collapsible sidebar (remembered per browser), a top
 * bar with the page title, search and status, and a 12-column content field.
 * Below 900px the sidebar becomes a menu at the top.
 */
export function AppShell({
  theme,
  label,
  home,
  nav,
  footerNav = [],
  storageKey,
  title,
  search,
  tools,
  mobileTools,
  menuFooter,
  children,
}: {
  theme: Theme;
  label: string;
  home: string;
  nav: NavGroup[];
  footerNav?: NavItem[];
  storageKey: string;
  title: string;
  search?: ReactNode;
  tools?: ReactNode;
  mobileTools?: ReactNode;
  menuFooter?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const sidebarId = useId();
  const menuId = useId();
  const content = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const mbar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? "collapsed" : "expanded");
    } catch {
      /* The shell still works without storage; the choice just isn't remembered. */
    }
  }, [collapsed, storageKey]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (mbar.current && event.target instanceof Node && !mbar.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  return (
    <div className="kit" data-theme={theme}>
      <button type="button" className="kit-skip" onClick={() => content.current?.focus()}>
        Skip to content
      </button>
      <div className="kit-shell" data-collapsed={collapsed ? "true" : "false"}>
        <nav id={sidebarId} className="kit-sidebar" aria-label={label}>
          <div className="kit-sidebar-inner">
            <div className="kit-brand">
              <Link to={home}>
                <BrandMark />
                <span className="kit-brand-label">{label}</span>
              </Link>
            </div>
            <div className="kit-nav">
              <NavList groups={nav} />
            </div>
            <div className="kit-sidebar-foot">
              {footerNav.map((item) => (
                <NavLink key={item.to} className="kit-nav-link" to={item.to} end={item.end} data-tip={item.label}>
                  <item.icon aria-hidden="true" strokeWidth={1.6} />
                  <span className="kit-nav-text">{item.label}</span>
                </NavLink>
              ))}
              <button
                type="button"
                className="kit-collapse"
                aria-expanded={!collapsed}
                aria-controls={sidebarId}
                data-tip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed((c) => !c)}
              >
                {collapsed ? <PanelLeftOpen aria-hidden="true" strokeWidth={1.6} /> : <PanelLeftClose aria-hidden="true" strokeWidth={1.6} />}
                <span className="kit-collapse-text">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="kit-main">
          <div ref={mbar} className="kit-mbar">
            <Link className="kit-brand-link" to={home}>
              <BrandMark />
              <span className="kit-brand-label">{label}</span>
            </Link>
            <div className="kit-mbar-tools">
              {mobileTools}
              <button
                ref={menuButton}
                type="button"
                className="kit-iconbutton kit-mbar-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X aria-hidden="true" strokeWidth={1.6} /> : <Menu aria-hidden="true" strokeWidth={1.6} />}
              </button>
            </div>
            {menuOpen && (
              <div id={menuId} className="kit-mmenu">
                <nav className="kit-nav" aria-label={`${label} menu`}>
                  <NavList groups={[...nav, { label: "", items: footerNav }]} onNavigate={() => setMenuOpen(false)} />
                </nav>
                {menuFooter && <div className="kit-mmenu-foot">{menuFooter}</div>}
              </div>
            )}
          </div>

          <header className="kit-topbar">
            <h1 className="kit-title">{title}</h1>
            {search && <div className="kit-topbar-search">{search}</div>}
            {tools && <div className="kit-topbar-tools">{tools}</div>}
          </header>

          <div ref={content} className="kit-content" tabIndex={-1}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
