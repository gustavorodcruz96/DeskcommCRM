import { describe, expect, it } from "vitest";

/**
 * A linha da lista mostra as etiquetas da CONVERSA e do CONTATO.
 *
 * Mostrava só as do contato: a etiqueta posta na conversa filtrava a lista mas
 * não aparecia nela. São as mesmas duas caixas que o filtro por tag consulta.
 */

import { etiquetasDaLinha } from "@/components/inbox/ConversationListItem";

describe("etiquetasDaLinha", () => {
  it("junta as duas caixas, a da conversa primeiro", () => {
    expect(etiquetasDaLinha(["Agendamento"], ["Base Varejo"])).toEqual([
      "Agendamento",
      "Base Varejo",
    ]);
  });

  it("não repete a mesma etiqueta escrita com caixa ou espaço diferente", () => {
    expect(etiquetasDaLinha(["FABI", " vip "], ["fabi", "VIP", "Link da bio"])).toEqual([
      "FABI",
      "vip",
      "Link da bio",
    ]);
  });

  it("ignora vazio e aceita caixa ausente", () => {
    expect(etiquetasDaLinha(null, ["", "  ", "Varejo"])).toEqual(["Varejo"]);
    expect(etiquetasDaLinha(undefined, undefined)).toEqual([]);
  });
});
