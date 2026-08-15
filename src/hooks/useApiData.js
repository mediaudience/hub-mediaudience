import { useEffect, useState } from "react";

export default function useApiData(url) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status} al cargar datos`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
