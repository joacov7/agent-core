# @agent-core/ai-openai

`AiCompletionProvider` para cualquier API compatible con OpenAI (`POST /chat/completions`):
**Ollama**, llama.cpp, vLLM, LM Studio u OpenAI. Mismo código con un modelo local gratis o
uno pago — solo cambia la config. Sin dependencias.

```ts
import { crearAiProviderOpenAiCompat } from "@agent-core/ai-openai";
import { crearAiGateway } from "@agent-core/core";

const provider = crearAiProviderOpenAiCompat({
  baseUrl: "http://localhost:11434/v1", // Ollama
  model: "qwen2.5:1.5b",
});
const ai = crearAiGateway({ provider, presupuesto: { maxPorTenant: 5 } }); // presupuesto + atribución
```

Errores tipados (`ProveedorIAError.causa`): `inalcanzable`, `timeout`, `http`,
`respuesta_invalida`. El mensaje nunca incluye la `apiKey` y el `TenantCtx` no se envía al proveedor.
