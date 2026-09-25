# Desempenho do Panda BEW — 25/09/2026

Avaliação da instalação 1.48.0-bew-ui.11. Medições em 25/09, aproximadamente 12h08–12h22 (America/Sao_Paulo). Não houve envio de mensagens de teste para clientes. Os IDs e textos de conversas não integram este relatório.

## Evidência antes da correção

| Medida | Resultado | Limite da comparação |
|---|---|---|
| API de conversas Panda, 3 leituras sequenciais | 1.548 / 1.565 / 1.571 ms | Browser autenticado, consulta de leitura, sem simular rede da Fabiana |
| Contagens Panda, 3 leituras | 1.646 / 1.672 / 1.868 ms | Mesmo browser e período |
| Interface autenticada Panda, 3 leituras | 1.114 / 1.195 / 1.204 ms | Mesmo browser e período |
| Helena, consulta de sessões observada | 393 ms inicial; 734 ms em outra aba | Amostra pequena, produtos/dados distintos; abas já visitadas podem usar cache e não pedir rede |
| Documento inicial Panda / Helena | TTFB 2.990 / 578 ms; load 3.630 / 1.880 ms | Uma navegação autenticada de cada; não significa que toda tela terminou nesse instante |
| Banco: SELECT 1 na mesma conexão, 5 amostras | 183–194 ms | Inclui rede; região do pooler: us-west-2 |
| Banco: lista simples, 5 amostras | 183–244 ms | SQL de diagnóstico, não substitui a consulta completa com RLS da API |
| REST do banco aquecido, 4 amostras | 229–278 ms | Consulta simples, inclui rede |
| WAHA sendText, 6 requisições reais anteriores | mediana 240 ms; máximo 299 ms | Aceite pela integração; não comprova entrega ao aparelho do cliente |
| WAHA sendVoice, 1 requisição anterior | 4.791 ms | Uma amostra, sem generalizar |

O servidor tem 2 vCPU/8 GB. Na amostra havia cerca de 3,6 GB disponíveis; nenhum dos serviços app/worker/WhatsApp havia reiniciado ou sofrido OOM. Swap tinha 1,3 GB ocupado, com pouca paginação naquele instante. vmstat mostrou 1–7% de CPU steal: há contenção do host, mas a amostra não prova que ela causou as reclamações. Não há base para recomendar apenas comprar RAM.

## Episódio de indisponibilidade parcial

Logs do app registraram, aproximadamente 11h04–11h09, erros PostgreSQL 57014 e 55P03 ao inserir mensagens e resolver contato/conversa. Webhooks responderam 503 e o WAHA tentou novamente. Na janela 11h–12h, a mediana de atraso entre horário da mensagem recebida e INSERT foi 21,66s (28 inbound); p95 188,38s. Nas outras horas observadas a mediana ficou próxima de 2–3s.

Na leitura posterior não havia bloqueadores ativos nem webhooks em error/dead nas quatro horas consultadas. Isso não identifica quem segurou os locks durante o incidente. Não elevamos timeouts nem removemos travas: esconder a recusa não elimina contenção e pode piorar filas.

## Correções do núcleo preparadas

1. Quatro GETs de Inbox reutilizam a identidade validada e o mesmo cliente RLS. getUser dentro de cada rota cai de 2 para1. Suporte, memberships e administração são lidos em paralelo depois da identidade; sem cache entre usuários/requisições.
2. Filtros de abas mudam pela History API do Next, sem renderização RSC intermediária. Deep links, hash, seleção e histórico são preservados.
3. Assumir/fechar/arquivar/reabrir aplicam a resposta confirmada ao cache imediatamente. Respostas antigas não sobrescrevem estado mais novo; lista, filtros e contagens são reconciliados.
4. Após persistir o recibo de envio, conversa, contato e auditoria avançam em paralelo. Todos terminam antes do evento e da resposta HTTP. Sem reenvio, envio em segundo plano ou alteração de destinatário.

## Pontos restantes

- Aproximar aplicação e banco geograficamente elimina latência de todas as viagens remotas. Migração exige backup, ensaio, nova região/projeto conforme fornecedor, janela de corte e validação de Auth, Storage, Realtime, RLS e rollback.
- Realtime ainda invalida histórico inteiro em eventos/ACKs. Reprodução local confirmou que três páginas carregadas são relidas e um envio otimista pode desaparecer durante uma releitura. Precisa de correção separada de reconciliação/outbox, não apenas esconder indicadores.
- Uploads/áudio não têm a mesma representação otimista do texto. Medir upload, transcodificação, aceite e ACK separadamente.
- Habilitar responsável padrão não exige IA. Já há roteamento por número, mas salvar responsáveis pode redistribuir a fila existente. A regra exata solicitada continua pendente de escolha; nenhuma distribuição em massa foi ativada.

## Validação e continuidade

Testes focados:52 de frontend, 91 de auth/rotas, 54 de envio (há possíveis arquivos comuns; não somar como casos únicos). Controles negativos: 8, 5 e 2 falhas respectivamente ao retirar os patches; todos restaurados e verdes. Verificação global e produção são registradas abaixo quando concluídas.

Entrada/saída permanecem nas rotas existentes. Auditoria e eventos permanecem aguardados. A UI usa estados confirmados; refetch reconcilia divergências. Sem nova permissão, schema, canal, regra comercial ou automação. A operação comum permanece inteira sem extensões. Não há nova peça arquitetural.

Fontes de infraestrutura: [regiões do Supabase](https://supabase.com/docs/guides/platform/regions) e [mudança de região](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z). Trocar região exige novo projeto e migração; não é um ajuste direto do projeto existente.
