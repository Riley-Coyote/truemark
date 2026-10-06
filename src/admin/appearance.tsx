import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Segmented } from "../app-kit";
import { storageKey } from "../platform/mode";

export type Appearance = "purple" | "dark" | "light" | "system";
export type CommandTheme = "violet" | "night" | "day";
// v2: Purple became the default (2026-10-05), so earlier device choices start over once.
const KEY = storageKey("tm-command-appearance-v2");
const QUERY = "(prefers-color-scheme: dark)";
const OPTIONS: { value: Appearance; label: string }[] = [
  { value: "purple", label: "Purple" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

function readAppearance(): Appearance {
  try {
    const value = localStorage.getItem(KEY);
    return value === "dark" || value === "light" || value === "system" ? value : "purple";
  } catch {
    return "purple";
  }
}

function systemIsDark() {
  return typeof window !== "undefined" && window.matchMedia?.(QUERY).matches === true;
}

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia?.(QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

const AppearanceContext = createContext<{
  appearance: Appearance;
  theme: CommandTheme;
  setAppearance: (appearance: Appearance) => void;
} | null>(null);

/** Storage and the OS are read during the first render, never after a default-theme frame. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setChoice] = useState(readAppearance);
  const darkSystem = useSyncExternalStore(subscribeSystem, systemIsDark, () => false);
  const theme: CommandTheme = appearance === "purple" ? "violet"
    : appearance === "dark" || (appearance === "system" && darkSystem) ? "night" : "day";

  useLayoutEffect(() => {
    // Paint the document and supply tokens to body portals in the same commit as the shell.
    const root = document.documentElement;
    const previous = root.getAttribute("data-command-theme");
    root.setAttribute("data-command-theme", theme);
    return () => {
      if (previous === null) root.removeAttribute("data-command-theme");
      else root.setAttribute("data-command-theme", previous);
    };
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) setChoice(readAppearance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setAppearance = (choice: Appearance) => {
    setChoice(choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Restricted storage still permits a choice for this visit.
    }
  };

  return <AppearanceContext.Provider value={{ appearance, theme, setAppearance }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("Appearance controls belong inside the command center.");
  return value;
}

export function AppearanceControl() {
  const { appearance, setAppearance } = useAppearance();
  return <Segmented label="Appearance" options={OPTIONS} value={appearance} onChange={setAppearance} />;
}

/** A small nonmodal account popover; native buttons retain all segmented-control states. */
export function AccountMenu({ initials, label }: { initials: string; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (open) root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div
      ref={root}
      className="cc-account"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="kit-avatar cc-account-trigger"
        aria-label={`${label}, account menu`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {initials}
      </button>
      {open && (
        <div id={id} className="cc-account-panel" role="dialog" aria-label="Account appearance">
          <p className="kit-label">Appearance</p>
          <AppearanceControl />
          <p className="cc-footnote">Applies to this device.</p>
        </div>
      )}
    </div>
  );
}
