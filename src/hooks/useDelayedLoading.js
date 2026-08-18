import { useEffect, useState } from "react";

// Avoids flashing a skeleton on fast responses: only flips true if `loading`
// is still true after `delay` ms. Fast loads finish before that and never show it.
export default function useDelayedLoading(loading, delay = 300) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return showLoading;
}
