"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GLOBAL ERROR CAPTURED:", error);
  }, [error]);

  return (
    <div style={{ padding: '100px', backgroundColor: 'black', color: 'white', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '2rem', color: 'red' }}>¡ALGO SALIÓ MAL (CAPA GLOBAL)!</h2>
      <pre style={{ backgroundColor: '#222', padding: '20px', borderRadius: '10px' }}>
        {error.message}
      </pre>
      <button
        onClick={() => reset()}
        style={{ padding: '10px 20px', backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
