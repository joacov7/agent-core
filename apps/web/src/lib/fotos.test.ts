import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearAlmacenFotos, detectarImagen, ErrorDeFoto, FOTO_MAX_BYTES, leerCuerpoAcotado, type AlmacenFotos } from "./fotos";

// Cabeceras reales mínimas de cada formato (+ relleno): alcanza para el reconocimiento por bytes.
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
const GIF = new TextEncoder().encode("GIF89a....");

let dir: string;
let a: AlmacenFotos;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "agentcore-fotos-")); a = crearAlmacenFotos(join(dir, "fotos")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const rechazo = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as ErrorDeFoto | null;

describe("detectarImagen (por bytes)", () => {
  it("reconoce PNG, JPEG y WebP", () => {
    expect(detectarImagen(PNG)).toEqual({ ext: "png", mime: "image/png" });
    expect(detectarImagen(JPG)).toEqual({ ext: "jpg", mime: "image/jpeg" });
    expect(detectarImagen(WEBP)).toEqual({ ext: "webp", mime: "image/webp" });
  });
  it("rechaza SVG (puede llevar scripts), GIF, texto, vacío y cabeceras truncadas", () => {
    for (const x of [SVG, GIF, new TextEncoder().encode("hola"), new Uint8Array(0), PNG.slice(0, 7), JPG.slice(0, 2), WEBP.slice(0, 11)]) {
      expect(detectarImagen(x)).toBeNull();
    }
  });
  it("un RIFF que no es WebP (p.ej. un WAV) no pasa", () => {
    const wav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(detectarImagen(wav)).toBeNull();
  });
});

describe("almacén de fotos", () => {
  it("guarda, lee y lista la foto de un agente de una línea", async () => {
    await a.guardar("guaynet", "cobros", PNG);
    const f = a.leer("guaynet", "cobros")!;
    expect(f.mime).toBe("image/png");
    expect(Array.from(f.bytes)).toEqual(Array.from(PNG));
    expect(a.urls("guaynet").cobros).toBe(`/api/agents/cobros/foto?v=${f.version}`);
  });

  it("cada línea tiene sus fotos: no se mezclan", async () => {
    await a.guardar("guaynet", "cobros", PNG);
    expect(a.leer("guaynet-seguridad", "cobros")).toBeNull();
    expect(a.urls("guaynet-seguridad")).toEqual({});
  });

  it("reemplazar con otro formato deja una sola foto (se va la anterior) y cambia la versión", async () => {
    await a.guardar("guaynet", "cobros", PNG);
    const v1 = a.leer("guaynet", "cobros")!.version;
    await new Promise((r) => setTimeout(r, 15));
    await a.guardar("guaynet", "cobros", JPG);
    expect(readdirSync(join(dir, "fotos", "guaynet"))).toEqual(["cobros.jpg"]);
    const f = a.leer("guaynet", "cobros")!;
    expect(f.mime).toBe("image/jpeg");
    expect(f.version).toBeGreaterThan(v1);
  });

  it("borrar quita la foto y avisa si había", async () => {
    await a.guardar("guaynet", "cobros", WEBP);
    expect(await a.borrar("guaynet", "cobros")).toBe(true);
    expect(a.leer("guaynet", "cobros")).toBeNull();
    expect(await a.borrar("guaynet", "cobros")).toBe(false);
    expect(await a.borrar("linea-sin-carpeta", "cobros")).toBe(false);
  });

  it("rechaza lo que no es imagen aceptada, con el código HTTP que corresponde", async () => {
    expect((await rechazo(a.guardar("guaynet", "cobros", SVG)))!.status).toBe(415);
    expect((await rechazo(a.guardar("guaynet", "cobros", GIF)))!.status).toBe(415);
    expect((await rechazo(a.guardar("guaynet", "cobros", new Uint8Array(0))))!.status).toBe(400);
    const grande = new Uint8Array(FOTO_MAX_BYTES + 1); grande.set(PNG);
    expect((await rechazo(a.guardar("guaynet", "cobros", grande)))!.status).toBe(413);
    expect(a.leer("guaynet", "cobros")).toBeNull(); // no quedó nada a medias
    const justo = new Uint8Array(FOTO_MAX_BYTES); justo.set(PNG);
    await a.guardar("guaynet", "cobros", justo); // el tope es inclusivo
  });

  it("no se puede salir de la carpeta: tenant y agente con formato estricto", async () => {
    for (const mal of ["../x", "..", "a/b", "a\\b", "", "x".repeat(41), "Cobros", "co bros", "cobros.png", "cobros\0"]) {
      expect(await rechazo(a.guardar("guaynet", mal, PNG)), `agente ${JSON.stringify(mal)}`).toBeInstanceOf(ErrorDeFoto);
      expect(() => a.leer("guaynet", mal), `leer ${JSON.stringify(mal)}`).toThrow(ErrorDeFoto);
    }
    for (const mal of ["../..", "a/b", "", "x".repeat(65), "ten ant"]) {
      expect(await rechazo(a.guardar(mal, "cobros", PNG)), `tenant ${JSON.stringify(mal)}`).toBeInstanceOf(ErrorDeFoto);
      expect(a.urls(mal)).toEqual({});
    }
    expect(existsSync(join(dir, "x"))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);   // ni siquiera creó la carpeta de fotos
  });

  it("permisos: archivo 600 y carpeta 700; sin temporales", async () => {
    await a.guardar("guaynet", "cobros", PNG);
    const carpeta = join(dir, "fotos", "guaynet");
    expect(statSync(join(carpeta, "cobros.png")).mode & 0o777).toBe(0o600);
    expect(statSync(carpeta).mode & 0o077).toBe(0);
    expect(readdirSync(carpeta).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("la lista ignora temporales y archivos ajenos; un enlace simbólico no la rompe", async () => {
    await a.guardar("guaynet", "crm", PNG);
    const carpeta = join(dir, "fotos", "guaynet");
    writeFileSync(join(carpeta, "cobros.png.123.tmp"), "x");
    writeFileSync(join(carpeta, "notas.txt"), "x");
    writeFileSync(join(carpeta, "MAYUS.png"), "x");
    symlinkSync("/nonexistent", join(carpeta, "roto.png"));
    expect(Object.keys(a.urls("guaynet"))).toEqual(["crm"]);
  });
});

describe("leerCuerpoAcotado", () => {
  const pedido = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new Request("http://x/api", { method: "PUT", body, headers, ...(body ? { duplex: "half" } : {}) } as RequestInit);

  it("lee el cuerpo entero si entra en el tope", async () => {
    expect(Array.from(await leerCuerpoAcotado(pedido(PNG)))).toEqual(Array.from(PNG));
  });
  it("sin cuerpo o vacío → 400", async () => {
    expect((await rechazo(leerCuerpoAcotado(pedido(null))))!.status).toBe(400);
    expect((await rechazo(leerCuerpoAcotado(pedido(new Uint8Array(0)))))!.status).toBe(400);
  });
  it("Content-Length declarado de más → 413 sin leer nada", async () => {
    const r = pedido(PNG, { "content-length": String(FOTO_MAX_BYTES + 1) });
    expect((await rechazo(leerCuerpoAcotado(r)))!.status).toBe(413);
  });
  it("corta aunque el Content-Length mienta o no venga (cuerpo en trozos): no bufferea de más", async () => {
    let leidos = 0;
    const flujo = new ReadableStream<Uint8Array>({
      pull(c) { leidos += 100_000; c.enqueue(new Uint8Array(100_000)); if (leidos > 10_000_000) c.close(); },
    });
    const e = await rechazo(leerCuerpoAcotado(pedido(flujo as never)));
    expect(e!.status).toBe(413);
    expect(leidos).toBeLessThan(2_000_000); // se detuvo cerca del tope de 512 KB, no leyó los 10 MB
  });
  it("el tope es configurable", async () => {
    expect((await rechazo(leerCuerpoAcotado(pedido(PNG), 8)))!.status).toBe(413);
    expect((await leerCuerpoAcotado(pedido(PNG), 16)).length).toBe(PNG.length);
  });
});
