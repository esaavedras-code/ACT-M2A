"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ backgroundColor: 'darkred', color: 'white', padding: '50px' }}>
        <h2>CRITICAL SYSTEM FAILURE (GlobalError)</h2>
        <pre>{error.message}</pre>
        <button onClick={() => reset()}>Reiniciar Página</button>
      </body>
    </html>
  );
}
