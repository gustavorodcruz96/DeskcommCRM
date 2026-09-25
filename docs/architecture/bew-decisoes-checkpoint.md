# Correção da integração BEW em v1.48

Destino: núcleo, adaptador opcional. Instalações sem Jev/DeepSeek continuam no caminho existente.

Entrada: `classifyIntent` passa intenções configuradas e contexto curto ao `runModelCall`. O seam resolve credencial, provedor, modelo, orçamento e registra `llm_calls`. Jev usa exclusivamente a API decisions oficial, com abort/timeout, allowlist, alternativas fechadas e validação da distribuição. Saída: `parseIntentVerdict` e o roteador existente; falha conserva fallback e posse humana.

Checkpoint DeepSeek recebe `Output.json()` no mesmo seam; Zod continua validando no consumidor. Não altera regras comerciais, publicação de agentes ou envio.

Operação: a configuração segue em Roteadores/Provedores; erros e custos continuam no log de IA. Testes: adapter com AI SDK real, seam com fetch simulado, endpoint customizado recusado, contexto e protocolo JSON. Prova real é feita pelo botão/API de teste sem mensagens reais.

Referência: https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request
