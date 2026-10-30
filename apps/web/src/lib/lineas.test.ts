import { describe, it, expect } from "vitest";
import { leerCookie, leerLineas, resolverLinea } from "./lineas";

describe("leerLineas", () => {
  it("sin base de datos: una sola línea, 'demo'", () => {
    expect(leerLineas({})).toEqual([{ id: "demo", tenantId: "demo", nombre: "Demo", icono: "🧪" }]);
    expect(leerLineas({ DEV_TENANT: "mio" })[0]!.tenantId).toBe("mio");
    expect(leerLineas({ SEGURIDAD: "on" })).toHaveLength(1);                    // sin base no hay seguridad real
  });

  it("con la base: internet; con SEGURIDAD=on, además seguridad (otro tenant)", () => {
    const solo = leerLineas({ WISP_DATABASE_URL: "postgresql://x" });
    expect(solo.map((l) => [l.id, l.tenantId])).toEqual([["internet", "guaynet"]]);
    const dos = leerLineas({ WISP_DATABASE_URL: "postgresql://x", SEGURIDAD: "on", WISP_TENANT: "wisp1", SEGURIDAD_TENANT: "wisp1-alarmas" });
    expect(dos.map((l) => [l.id, l.tenantId, l.nombre])).toEqual([["internet", "wisp1", "Internet"], ["seguridad", "wisp1-alarmas", "Seguridad"]]);
    expect(leerLineas({ WISP_DATABASE_URL: "x", SEGURIDAD: "on" })[1]!.tenantId).toBe("guaynet-seguridad");
    expect(leerLineas({ WISP_DATABASE_URL: "x", SEGURIDAD: "off" })).toHaveLength(1);
  });

  it("dos líneas con el MISMO tenant es un error (compartirían bandeja y configuración)", () => {
    expect(() => leerLineas({ WISP_DATABASE_URL: "x", SEGURIDAD: "on", SEGURIDAD_TENANT: "guaynet" })).toThrow(/no puede ser igual/);
    expect(() => leerLineas({ WISP_DATABASE_URL: "x", SEGURIDAD: "on", DEV_TENANT: "guaynet-seguridad" })).toThrow(/no puede ser igual/);
  });
});

describe("resolverLinea", () => {
  const lineas = leerLineas({ WISP_DATABASE_URL: "x", SEGURIDAD: "on" });
  it("por defecto la primera; la cookie elige; el header (pruebas) manda sobre la cookie", () => {
    expect(resolverLinea(lineas, {}).id).toBe("internet");
    expect(resolverLinea(lineas, { cookie: "seguridad" }).id).toBe("seguridad");
    expect(resolverLinea(lineas, { cookie: "seguridad", tenantId: "guaynet" }).id).toBe("internet");
  });
  it("un valor desconocido NO crea un tenant: cae a la primera", () => {
    expect(resolverLinea(lineas, { tenantId: "otro-tenant" }).tenantId).toBe("guaynet");
    expect(resolverLinea(lineas, { cookie: "../../etc" }).id).toBe("internet");
    expect(resolverLinea(lineas, { cookie: "demo" }).id).toBe("internet");
  });
});

describe("leerCookie", () => {
  it("encuentra la cookie entre otras y decodifica", () => {
    expect(leerCookie("a=1; linea=seguridad; b=2", "linea")).toBe("seguridad");
    expect(leerCookie("linea=segu%72idad", "linea")).toBe("seguridad");
    expect(leerCookie("xlinea=zzz; a=1", "linea")).toBeUndefined();
    expect(leerCookie(null, "linea")).toBeUndefined();
    expect(leerCookie("", "linea")).toBeUndefined();
    expect(leerCookie("linea=%E0%A4%A", "linea")).toBeUndefined();              // %-secuencia inválida: no lanza
  });
});
