import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Cada gancho `crm-*` de `app/interface.css` precisa existir em algum componente.
 *
 * O CSS pinta por classe que o componente põe. Renomear a classe no componente
 * e esquecer o CSS não quebra nada visível de imediato: a tela continua de pé,
 * só perde a geometria — o tipo de regressão que ninguém vê no review.
 */

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

const codigo = ["app", "components"]
  .flatMap(arquivos)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const ganchos = [
  ...new Set(readFileSync("app/interface.css", "utf8").match(/\.crm-[a-z-]+/g) ?? []),
].map((g) => g.slice(1));

describe("app/interface.css só usa ganchos que os componentes põem", () => {
  it("encontra ganchos no CSS", () => {
    expect(ganchos.length).toBeGreaterThan(10);
  });

  it.each(ganchos)("%s existe em algum componente", (gancho) => {
    expect(codigo, `nenhum componente usa a classe "${gancho}"`).toMatch(
      new RegExp(`\\b${gancho}\\b`),
    );
  });
});
