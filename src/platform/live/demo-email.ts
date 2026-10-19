import { useCallback, useEffect, useRef, useState } from "react";
import { LOCAL } from "../mode";

/**
 * The local platform sends no email; its worker opens each sign-up confirmation link as the
 * recipient would. Call watch() at sign-up so the screen can show the email step finish.
 * The password stays in this closure for the checks and is never kept in page state.
 */
export function useLocalConfirmation(): { confirmed: boolean; watch: (email: string, password: string) => void } {
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);
  const watch = useCallback((email: string, password: string) => {
    if (!LOCAL) return;
    window.clearTimeout(timer.current);
    const started = Date.now();
    const check = async () => {
      try {
        // A password sign-in succeeds only once the email is confirmed. The session is not kept.
        const response = await fetch(`${import.meta.env.VITE_REVIEW_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (response.ok) {
          if (mounted.current) setConfirmed(true);
          return;
        }
      } catch {
        // Check again shortly.
      }
      if (mounted.current && Date.now() - started < 120_000) timer.current = window.setTimeout(check, 1500);
    };
    // The worker opens the email about three seconds after it arrives; check just after that.
    timer.current = window.setTimeout(check, 4500);
  }, []);
  return { confirmed, watch };
}
