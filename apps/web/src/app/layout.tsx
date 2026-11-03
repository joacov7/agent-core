import { SelectorLinea } from "@/components/SelectorLinea";
import { BarraSesion } from "@/components/BarraSesion";

export const metadata = {
  title: "agent-core SaaS",
  description: "Panel del equipo de agentes IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#0e1315", color: "#e7ecee" }}>
        <BarraSesion />
        <SelectorLinea />
        {children}
      </body>
    </html>
  );
}
