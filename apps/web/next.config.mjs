/** @type {import('next').NextConfig} */
const nextConfig = {
  // Driver de Postgres (adapter WISP): que Node lo cargue tal cual, sin empaquetarlo.
  serverExternalPackages: ["pg"],
  // Cabeceras de seguridad. `no-store` en las páginas: tras "Salir", el botón Atrás no debe mostrar datos de clientes desde la caché.
  async headers() {
    const seguras = [
      { key: "X-Frame-Options", value: "DENY" },            // la app no se puede meter en un iframe de otro sitio (clickjacking)
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ];
    return [
      { source: "/:path*", headers: seguras },
      { source: "/((?!api|_next).*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  // Los paquetes @agent-core/* se consumen ya compilados (dist), no hace falta
  // transpilarlos. Si en algún momento consumís su fuente TS, agregá acá:
  //   transpilePackages: ["@agent-core/core", "@agent-core/agents", ...],
};

export default nextConfig;
