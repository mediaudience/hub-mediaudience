import { useEffect, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Generic "is this view still settling in" flag, keyed off whatever changes
// (a route pathname today, a real API request key once the sidebar is wired
// to live data later). Callers just render a skeleton while this is true.
export default function usePageTransition(key, duration = 400) {
  const [loading, setLoading] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), duration);
    return () => clearTimeout(timer);
  }, [key, duration]);

  return loading;
}
