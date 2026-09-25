---
impacto: nada_mudou
secao: corrigido
titulo: Reduz esperas no carregamento e na confirmação de mensagens
---

As leituras de conversas validam a sessão uma vez por rota e reutilizam o mesmo cliente com RLS. As consultas independentes de acesso são executadas em paralelo, preservando a recusa quando a autorização não pode ser confirmada. Depois do recibo de envio persistido, atualização de conversa, contato e auditoria deixam de esperar uma pela outra; a resposta e o evento continuam aguardando a conclusão dos registros.
