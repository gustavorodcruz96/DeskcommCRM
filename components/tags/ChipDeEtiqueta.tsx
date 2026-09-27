"use client";
/**
 * O chip de etiqueta — o `Badge` do design system, agora pintado (issue #1271,
 * fatia S6 da #852).
 *
 * ─── Por que um componente, e não a cor em cada tela ────────────────────────
 *
 * A mesma etiqueta aparece em oito lugares (lista de conversas, editores do
 * Inbox, painel do CRM, ficha e lista de contatos, kanban). Oito cópias da
 * mesma regra de cor divergem na primeira correção — e a regra aqui tem duas
 * partes que precisam andar juntas: a cor da etiqueta e o texto que fica legível
 * sobre ela.
 *
 * ─── Por que o texto NÃO é escolha de quem usa ──────────────────────────────
 *
 * `melhorFrenteSobre` decide preto ou branco pela razão de contraste — a mesma
 * função que decide o texto dos botões da marca. Deixar a cor do texto para
 * quem escolhe a etiqueta é o caminho mais curto para um chip ilegível, e quem
 * paga é quem atende, não quem configurou.
 *
 * ─── Sem cor escolhida, a cor automática ────────────────────────────────────
 *
 * Com o vocabulário lido, etiqueta sem cor escolhida em Tags ganha a cor
 * automática derivada do nome (`corAutomaticaDaEtiqueta`) — cinza sumia na lista
 * de atendimento. Enquanto o vocabulário não chega, se a leitura falha ou fora do
 * provider, `variant="secondary"` continua sendo o padrão, sem estilo inline.
 */
import type { ReactNode } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { estiloDoChip } from "@/lib/tags/cor-da-etiqueta";
import { useCorDoChipDaEtiqueta } from "@/components/tags/CoresDasEtiquetas";

interface Props extends Omit<BadgeProps, "children"> {
  /** O nome como está no dado — a cor é buscada pela chave canônica. */
  tag: string;
  /**
   * Cor FORÇADA, para quem já tem o dado em mãos: a lista da tela de Tags (que
   * leu o vocabulário do servidor) e a prévia do seletor (que mostra o tom
   * escolhido antes de salvar). `undefined` = usa o mapa do provider, que é o
   * caso de todos os chips de lista.
   */
  cor?: string | null;
  /** Conteúdo extra ao lado do nome (o botão de remover dos editores). */
  children?: ReactNode;
}

export function ChipDeEtiqueta({ tag, cor, className, children, ...props }: Props) {
  const corDoProvider = useCorDoChipDaEtiqueta(tag);
  const efetiva = cor === undefined ? corDoProvider : cor;
  return (
    <Badge variant="secondary" className={cn(className)} style={estiloDoChip(efetiva)} {...props}>
      {tag}
      {children}
    </Badge>
  );
}
