import { describe, expect, it } from "vitest";

/**
 * A aba "Outros": as conversas dos OUTROS vendedores.
 *
 * Pedido da operação BEW (26/09/2026): Fila = lead novo, Minhas = o que é meu,
 * Outros = o que os colegas atendem, Arquivadas = concluído. "Outros" é o
 * espelho de "Minhas" com o dono trocado, e os três elos quebram separados:
 * o significado da aba, a query string e o predicado SQL.
 */

import { listConversationsHandler } from "@/app/api/v1/conversations/_handler";
import { tabToFilter } from "@/components/inbox/InboxLayout";
import { listConversationsQuerySchema } from "@/lib/schemas";

describe("tabToFilter — Outros", () => {
  it("pede dono humano que não sou eu, SEM as terminais", () => {
    expect(tabToFilter("others")).toEqual({ assigned_to: "others", exclude_finished: true });
  });
});

describe("schema da rota", () => {
  it("aceita assigned_to=others", () => {
    const r = listConversationsQuerySchema.safeParse({ assigned_to: "others" });
    expect(r.success && r.data.assigned_to).toBe("others");
  });
});

/** Registra a cadeia do PostgREST; resolve como lista vazia no `await`. */
function fakeSupabase() {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (ok: (v: unknown) => unknown) => ok({ data: [], error: null });
        }
        return (...args: unknown[]) => {
          chamadas.push({ metodo: String(prop), args });
          return proxy;
        };
      },
    },
  ) as Record<string, unknown>;
  return { client: { from: () => proxy } as never, chamadas };
}

async function rodar(q: Record<string, unknown>, actor: { type: string; id: string }) {
  const { client, chamadas } = fakeSupabase();
  const ctx = { organization_id: "org-1", requestId: "req-1", actor } as never;
  await listConversationsHandler(client, ctx, { limit: 50, ...q } as never);
  return chamadas;
}

describe("listConversationsHandler — assigned_to=others", () => {
  it("exige dono e exclui o próprio usuário, no BANCO", async () => {
    const chamadas = await rodar({ assigned_to: "others" }, { type: "user", id: "user-1" });
    expect(chamadas).toContainEqual({ metodo: "not", args: ["assigned_to_user_id", "is", null] });
    expect(chamadas).toContainEqual({ metodo: "neq", args: ["assigned_to_user_id", "user-1"] });
    // Não pode virar "as minhas" nem "sem dono".
    expect(chamadas).not.toContainEqual({ metodo: "eq", args: ["assigned_to_user_id", "user-1"] });
    expect(chamadas).not.toContainEqual({ metodo: "is", args: ["assigned_to_user_id", null] });
  });

  it("continua filtrando por organização", async () => {
    const chamadas = await rodar({ assigned_to: "others" }, { type: "user", id: "user-1" });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["organization_id", "org-1"] });
  });

  it("sem ator humano não há 'outros' — recusa em vez de devolver tudo", async () => {
    await expect(
      rodar({ assigned_to: "others" }, { type: "ai_agent", id: "agent-1" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("contador de Outros", () => {
  it("espelha a aba: dono presente, dono ≠ eu, sem terminais", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync("app/api/v1/conversations/counts/route.ts", "utf8");
    expect(fonte).toMatch(
      /not\("assigned_to_user_id", "is", null\)\s*\.neq\("assigned_to_user_id", user\.id\)\s*\.not\("status", "in"/,
    );
    expect(fonte).toMatch(/outros: outros\.count \?\? 0/);
  });
});
