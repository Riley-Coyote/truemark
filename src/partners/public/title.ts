import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Public partner pages name themselves in the tab, as shop pages do. */
export function useTitle(title: string) {
  const { key } = useLocation();
  useEffect(() => {
    document.title = `${title} — TrueMark BioLabs`;
  }, [title, key]);
}
