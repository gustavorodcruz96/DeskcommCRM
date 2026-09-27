import { describe, expect, it } from "vitest";

/**
 * A cor automática da etiqueta sem cor escolhida (pedido da operação BEW).
 * Ela precisa ser ESTÁVEL — a mesma etiqueta não pode mudar de cor entre telas,
 * sessões ou caixa/espaço diferentes — e nunca o cinza de "não sei".
 */
import { PALETA_DE_ETIQUETAS, corAutomaticaDaEtiqueta } from "@/lib/tags/cor-da-etiqueta";

describe("corAutomaticaDaEtiqueta", () => {
  it("é a mesma para a mesma etiqueta, com caixa ou espaço diferente", () => {
    expect(corAutomaticaDaEtiqueta("FABI")).toBe(corAutomaticaDaEtiqueta(" fabi "));
  });

  it("sai da paleta medida e nunca é o cinza", () => {
    for (const tag of ["fabi", "sara mandou", "pós-venda", "pos venda", "agendamento", "vip"]) {
      const cor = corAutomaticaDaEtiqueta(tag);
      expect(PALETA_DE_ETIQUETAS).toContain(cor);
      expect(cor).not.toBe("#6f6f6f");
    }
  });

  it("espalha as etiquetas pela paleta, em vez de pintar todas iguais", () => {
    const cores = new Set(
      ["fabi", "sara mandou", "pós-venda", "agendamento", "link da bio", "base varejo"].map(
        corAutomaticaDaEtiqueta,
      ),
    );
    expect(cores.size).toBeGreaterThan(2);
  });

  it("etiqueta vazia não tem cor", () => {
    expect(corAutomaticaDaEtiqueta("   ")).toBeNull();
  });
});
