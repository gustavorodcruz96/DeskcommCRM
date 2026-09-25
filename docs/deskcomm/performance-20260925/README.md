# Desempenho do Panda BEW — 25/09/2026

Avaliação da instalação 1.48.0-bew-ui.11 e publicação da r12. Medições iniciais em 25/09, aproximadamente 12h08–12h22 (America/Sao_Paulo); comparação após publicação entre 12h49–12h56. Não houve envio de mensagens de teste para clientes. Os IDs e textos de conversas não integram este relatório.

## Resultado publicado

**1.48.0-bew-ui.12 em produção desde aproximadamente 12h49.** App e worker em execução, sem reinícios/OOM na verificação; health público saudável, Supabase/Redis/WAHA OK; sessão WhatsApp WORKING e fila do worker sem jobs pendentes/running/dead naquele instante. CSS, configuração do proxy e favicon preservados por checksum.

| Consulta | Mediana antes | Mediana depois, aquecida | Variação |
|---|---:|---:|---:|
| Conversas | 1.565ms | 1.101ms | 29,6% menor |
| Contagens | 1.672ms | 1.256ms | 24,9% menor |
| Interface autenticada | 1.195ms | 901ms | 24,6% menor |

Três leituras por API em cada rodada, todas HTTP 200, mesmo browser autenticado e mesmos caminhos. Dados vivos e janelas diferentes: amostra pequena, sem p95 representativo nem garantia de estabilidade. Na primeira rodada após publicação, conversas tiveram 1.197/1.613/1.124ms; contagens 1.239/1.313/4.067ms; interface 3.224/1.312/1.532ms. **Os picos continuam presentes.** Rodada aquecida: conversas 1.053/1.101/1.795ms; contagens 1.292/1.225/1.256ms; interface 904/857/901ms. Todas as amostras estão em [measurements.json](./measurements.json).

Contatos, uma navegação por versão: TTFB 1.642→1.247ms, load 2.320→2.044ms e GET de contatos 1.579→1.416ms; 25 linhas renderizadas. Para as abas, seleção e URL mudaram corretamente sem requisição RSC a `/app/inbox`. Cronômetros baseados em listeners retornaram valores inconsistentes e foram descartados; não usamos um tempo numérico de clique como prova de ganho.

Não houve envio real autorizado para comparar antes/depois. Nenhum `messages.send.slow` apareceu na curta janela após a publicação; isso não comprova ausência de lentidão nem solução dos episódios de 95s.

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

## Envios com atraso confirmado

Dois textos humanos levaram 95,52s e 95,22s entre `messages.created_at` e a auditoria `message.sent`. Os registros são de 11h17 e 11h44 locais, fora da janela de erros acima. O WAHA aceitou esses envios aproximadamente 7,9s e 2,1s após a criação da linha, respectivamente; suas próprias chamadas duraram 245ms e 11ms. A maior espera ocorreu **depois do aceite da integração**. Isso confirma atraso interno grave, mas não identifica sozinho qual escrita/lock/retry ficou esperando. `messages.updated_at` pode ser alterado por ACK posterior e não substitui um trace de fases.

A nova instrumentação registra `messages.send.slow` para desfechos aceitos acima de 3s dentro do handler. Inclui apenas requestId, tipo, status e tempos: leituras, insert, preparação, adapter até aceite, recibo, efeitos posteriores e evento. Não inclui IDs de contato/conversa, telefone, texto, mídia ou credenciais. Não cobre a autorização anterior ao handler, a atribuição posterior da rota, nem entrega ao aparelho do destinatário; não é um cronômetro de toda a requisição. Envios interrompidos antes da conclusão precisam ser correlacionados aos logs de erro.

## Correções do núcleo

1. Quatro GETs de Inbox reutilizam a identidade validada e o mesmo cliente RLS. getUser dentro de cada rota cai de 2 para1. Suporte, memberships e administração são lidos em paralelo depois da identidade; sem cache entre usuários/requisições.
2. Filtros de abas mudam pela History API do Next, sem renderização RSC intermediária. Deep links, hash, seleção e histórico são preservados.
3. Assumir/fechar/arquivar/reabrir aplicam a resposta confirmada ao cache imediatamente. Respostas antigas não sobrescrevem estado mais novo; lista, filtros e contagens são reconciliados.
4. Após persistir o recibo de envio, conversa, contato e auditoria avançam em paralelo. Todos terminam antes do evento e da resposta HTTP. Sem reenvio, envio em segundo plano ou alteração de destinatário.

Essas mudanças reduzem esperas evitáveis; não há evidência ainda de que eliminem os picos de 95s. A medição por fase foi adicionada justamente para não confundir uma melhora da mediana com a correção do incidente intermitente.

## Pontos restantes

- Aproximar aplicação e banco geograficamente reduz a latência de todas as viagens remotas. Migração exige backup, ensaio, nova região/projeto conforme fornecedor, janela de corte e validação de Auth, Storage, Realtime, RLS e rollback. Confirmar a região do VPS e medir candidatos antes de escolher São Paulo ou mover a aplicação.
- Realtime ainda invalida histórico inteiro em eventos/ACKs. Reprodução local confirmou que três páginas carregadas são relidas e um envio otimista pode desaparecer durante uma releitura. Precisa de correção separada de reconciliação/outbox, não apenas esconder indicadores.
- Uploads/áudio não têm a mesma representação otimista do texto. Medir upload, transcodificação, aceite e ACK separadamente.
- Habilitar responsável padrão não exige IA. Já há roteamento por número, mas salvar responsáveis pode redistribuir a fila existente. A regra exata solicitada continua pendente de escolha; nenhuma distribuição em massa foi ativada.

## Validação e continuidade

Testes focados: 52 de frontend, 91 de auth/rotas, 54 de envio (há possíveis arquivos comuns; não somar como casos únicos). Controles negativos: 8, 5 e 2 falhas respectivamente ao retirar os patches; todos restaurados e verdes.

A instrumentação passou em 53 testes focados, incluindo limites de 2.999/3.000/3.001ms, ausência de dados privados e preservação do retorno se o logger falhar. Typecheck global passou antes e depois da instrumentação. ESLint global: zero erros e 427 avisos preexistentes; os dois arquivos da instrumentação também passaram no lint focado. Build e instalação são registrados abaixo, separadamente da validação de envio real.

Build aprovado: [GitHub Actions 36155189897](https://github.com/gustavorodcruz96/DeskcommCRM/actions/runs/36155189897), commit `3de2aa0402ac7d459c058a6d2e1207387532708e`. Artefato verificado localmente e no VPS: SHA-256 `3b60ce1700d0c91570f2a63d0c11ac2c4da7e4f9006a557682a69996f1ac210b`. Backup `/opt/deskcomm-bew/backups/performance-r12-20260925`; ativação/reversão em `/opt/deskcomm-bew/releases/bew-performance-r12-20260925`. As três composições foram usadas, mantendo certificados e configuração de integração. Reversão restaura somente imagens/políticas de pull de app e worker, sem desfazer regras comerciais ou escrever no banco.

Revisão dos triggers em produção, em transação READ ONLY: contacts com 16 triggers; conversations com 7, incluindo minimização de URLs Meet apenas em `NEW`; nenhum trigger de aplicação em api_audit_log. Nenhum cruzamento de escrita entre os três efeitos paralelizados foi encontrado. A amostra posterior de CPU/RAM também não mostrou esgotamento sustentado: cerca de 3,5GB disponíveis, zero swap-in/out nas duas observações instantâneas, com CPU steal variando entre 1–7%.

## Critérios para a próxima etapa

Metas de experiência propostas, ainda não resultados medidos: resposta visual de botões/filtros abaixo de 100ms; APIs usuais aquecidas com p95 abaixo de 800ms; histórico em cache sem sumir ou recarregar integralmente por ACK; nenhum envio aceito apresentado como falha ou oferecido para reenvio. Medir p50/p95 e erros por 24h após as correções, separando upload, processamento de áudio, aceite do canal e entrega.

Prioridades: (1) identificar e remover a espera intermitente após aceite; (2) aproximar app/banco com ensaio de migração; (3) reconciliar Realtime e outbox por mensagem; (4) só dimensionar/isolar CPU/RAM após medir pressão sustentada. A avaliação desta sessão não ativou monitoramento recorrente, migração, novo custo ou envio de teste.

### Próxima correção de Realtime (não incluída na r12)

`hooks/inbox/useMessagesRealtime.ts` invalida todas as páginas e a lista em qualquer alteração. `useSendMessage.ts` coloca temporários nas páginas retornadas pelo servidor; refetch as substitui sem esses temporários. A proposta é atualizar apenas campos de entrega para ACK puro de mensagem já carregada, validando organização/conversa/ID e sem regredir status. Payload parcial, edição, revogação, inserção, exclusão e reconexão mantêm a busca autorizada.

Os envios pendentes devem ficar separados das páginas, identificados por operação. O POST substitui somente seu temporário pelo ID real; não deduplicar por texto. Testes necessários: ACK em página antiga sem GET nem mudança de cursores; dois envios simultâneos com evento/refetch sem perda do segundo; edição/exclusão/reconexão durante paginação mantendo reconciliação e isolamento.

### Como isolar os picos de envio

Se `persist_receipt` dominar o novo log, separar o DELETE de eco e o UPDATE do recibo. Se `post_effects` dominar, separar conversa, contato e auditoria; a auditoria inclui nova validação de sessão, contexto de suporte e INSERT. Capturar `pg_stat_activity.wait_event` e bloqueador durante a espera diferencia lock no banco de espera HTTP/Auth.

A revisão do SDK instalado não encontrou retries locais de DELETE/PATCH/POST nessas escritas; não há evidência para atribuir os 95s a três tentativas de 30s. Refresh de sessão e replay do gateway são hipóteses a verificar, não causas estabelecidas. A atribuição automática e `emit_event` vêm depois da inserção do audit, portanto não explicam os intervalos de 95s medidos até esse ponto.

Entrada/saída permanecem nas rotas existentes. Auditoria e eventos permanecem aguardados. A UI usa estados confirmados; refetch reconcilia divergências. Sem nova permissão, schema, canal, regra comercial ou automação. A operação comum permanece inteira sem extensões. Não há nova peça arquitetural.

Fontes de infraestrutura: [regiões do Supabase](https://supabase.com/docs/guides/platform/regions) e [mudança de região](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z). Trocar região exige novo projeto e migração; não é um ajuste direto do projeto existente.
