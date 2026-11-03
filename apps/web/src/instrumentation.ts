// Next ejecuta esto una vez al arrancar el server (dev y prod). Lo de verdad vive en `instrumentation-node.ts`
// (estado del acceso en el log y programador de avisos del Asistente, solo con SCHEDULER=on).
//
// El import tiene que estar DENTRO del `if (NEXT_RUNTIME === "nodejs")`: con un middleware, Next compila este archivo
// también para Edge, y solo así el empaquetador descarta esa rama (con un `return` anticipado intenta empaquetar `pg` y `fs`).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { arrancar } = await import("./instrumentation-node");
    arrancar();
  }
}
