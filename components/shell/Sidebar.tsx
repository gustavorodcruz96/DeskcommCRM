"use client";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CaretDown, Gear } from "@/lib/ui/icons";
import { NavigationPending } from "@/components/shell/NavigationPending";
import { SearchTrigger } from "@/components/shell/SearchTrigger";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ConnectionHealthDot } from "@/components/connections/ConnectionHealthDot";
import { VersionFooter } from "@/components/shell/VersionFooter";
import { SimboloDoProduto } from "@/components/branding/MarcaDoProduto";
import { marcaEhADoProduto } from "@/lib/branding";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { GRUPO_NO_RODAPE, sidebarGroups } from "@/lib/navigation/registry";

const CHAVE_GRUPOS_FECHADOS = "sidebar-grupos-fechados";

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * Navegação principal, agrupada por objetivo.
 *
 * Não decide nada: `sidebarGroups()` (lib/navigation/registry.ts) resolve quais
 * grupos e destinos este papel vê, e este componente desenha. Antes, a lista de
 * itens e sete `usePermission()` viviam aqui — e divergiam do hub de
 * Configurações e das abas de IA, que mantinham suas próprias listas.
 */
export function SidebarContent({ collapsed, onNavigate }: SidebarContentProps) {
  // A barra lateral aparece em TODA tela — traduzi-la aqui é o que faz a
  // escolha de idioma virar algo visível no primeiro clique.
  const t = useT();
  const pathname = usePathname();
  const { user, activeOrg } = useAuth();
  const todos = sidebarGroups(
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.interface_settings,
    activeOrg?.modulos_ligados ?? [],
  );
  // Configurações sai da área que rola e vai para o rodapé fixo: medido em
  // 1280x768, ele caía fora da dobra mesmo em telas de 1080px.
  const grupos = todos.filter((g) => g.group.id !== GRUPO_NO_RODAPE);
  const rodape = todos.find((g) => g.group.id === GRUPO_NO_RODAPE)?.group.hub;

  /**
   * Grupo fechado é preferência POR NAVEGADOR, não por conta: começa vazio (tudo
   * aberto) em toda renderização — servidor, primeira pintura do cliente e nos
   * testes, que nunca clicam em nada — e só muda depois do mount, se o
   * `localStorage` tiver algo salvo. Guardar o CONJUNTO DOS FECHADOS, e não dos
   * abertos, é o que faz "sem preferência salva" já significar "tudo aberto".
   */
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_GRUPOS_FECHADOS);
      if (salvo) setGruposFechados(new Set(JSON.parse(salvo) as string[]));
    } catch {
      // Storage bloqueado (aba privada) — fica tudo aberto, que é o padrão.
    }
  }, []);
  function toggleGrupo(id: string) {
    setGruposFechados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(CHAVE_GRUPOS_FECHADOS, JSON.stringify([...next]));
      } catch {
        // Clique continua funcionando nesta sessão; só não sobrevive a um F5.
      }
      return next;
    });
  }

  const brand = useMarcaDaInstalacao();
  /**
   * O CONSUMIDOR do nome por organização.
   *
   * Sem ele, `settings.branding.app_name` seria campo decorativo: medido, o nome
   * da org não aparece em lugar nenhum da casca para o cliente típico de um
   * revendedor — o único leitor é o `TenantSwitcher`, e ele devolve `null` com
   * uma organização só.
   *
   * A marca da INSTALAÇÃO continua embaixo: a organização que não definiu nome
   * vê exatamente o que via antes. O que mudou é POR ONDE ela chega — era
   * `branding()`, que no navegador lê `window.__PUBLIC_ENV__` e no servidor lê
   * `process.env`, e essas duas fontes passaram a divergir quando o layout raiz
   * começou a injetar a marca do BANCO. Divergência entre SSR e cliente aqui não
   * é detalhe: com logo no banco e `APP_LOGO_URL` vazio, o servidor desenhava o
   * `<span>` de baixo e o cliente desenhava o `<img>` — React #418 em toda tela.
   * Hoje a marca vem por PROP do servidor (`useMarcaDaInstalacao`), pela mesma
   * rota de `activeOrg`, e os dois lados leem o mesmo objeto por construção.
   */
  const nome = activeOrg?.marca?.nome ?? brand.name;
  const [marcaPrincipal, ...marcaComplemento] = nome.split(/\s+/);
  /**
   * O mesmo desenho para o LOGO — e é este par de linhas que fecha o caminho do
   * `logo_url` gravado até a tela.
   *
   * `||` e não `??`: vazio é AUSÊNCIA de logo, não "logo em branco". É a regra
   * que `resolveBranding` e `primeiroDefinido` já aplicam nas camadas de baixo, e
   * com `??` um `""` vindo de cima apagaria o logo do revendedor em vez de
   * descer para ele — que é o contrário do que a precedência por campo promete.
   */
  const logo = activeOrg?.marca?.logoUrl || brand.logoUrl;
  // A versão para fundo escuro, com a mesma precedência da marca acima: a org
  // que enviou logo próprio sem versão escura não herda a do produto.
  const logoEscuro =
    activeOrg?.marca?.logoDarkUrl !== undefined
      ? activeOrg.marca.logoDarkUrl
      : activeOrg?.marca?.logoUrl
        ? null
        : brand.logoDarkUrl;
  const marcaDoProduto = marcaEhADoProduto({ name: nome, logoUrl: logo ?? null });

  return (
    <>
      <div
        className={cn(
          "app-brand flex items-center gap-2 border-b p-4",
          collapsed && "flex-col px-2",
        )}
      >
        <Link
          href="/app"
          aria-label={nome}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {logo ? (
            // Sem versão escura, o logo fica sobre um chip claro no tema escuro:
            // arte escura em fundo escuro some.
            <span className={cn("shrink-0 rounded-xl", !logoEscuro && "dark:bg-white")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt={nome}
                className={cn(
                  "app-brand-image h-10 w-10 rounded-xl object-contain",
                  logoEscuro && "dark:hidden",
                )}
              />
              {logoEscuro && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoEscuro}
                  alt={nome}
                  className="app-brand-image hidden h-10 w-10 rounded-xl object-contain dark:block"
                />
              )}
            </span>
          ) : marcaDoProduto ? (
            <SimboloDoProduto nome={nome} className="h-10 w-10 shrink-0" />
          ) : collapsed ? (
            <span aria-hidden className="text-lg font-bold">
              {[...nome][0]?.toUpperCase() ?? brand.initial}
            </span>
          ) : null}
          {!collapsed && (
            <span className="crm-brand-name">
              <strong>{marcaPrincipal}</strong>
              {marcaComplemento.length > 0 && <small>{marcaComplemento.join(" ")}</small>}
            </span>
          )}
        </Link>
      </div>
      <div className="crm-sidebar-search">
        <SearchTrigger compact={collapsed} />
      </div>
      <nav
        className="crm-sidebar-groups flex-1 space-y-2 overflow-y-auto p-2"
        aria-label={t("Navegação principal")}
      >
        {grupos.map(({ group, items }) => {
          const tituloId = `nav-grupo-${group.id}`;
          // Recolhido o sidebar inteiro (rail de 64px), o grupo sempre mostra
          // seus itens — não há onde desenhar cabeçalho nem seta para fechá-lo.
          const aberto = collapsed || !gruposFechados.has(group.id);
          return (
            <div key={group.id} className="space-y-1">
              {/* Colapsado, o sidebar tem 64px: seis rótulos ali seriam ilegíveis.
                  Vira um filete separador, que preserva o agrupamento sem texto. */}
              {collapsed ? (
                <div aria-hidden className="mx-2 border-t first:hidden" />
              ) : (
                <h2 id={tituloId}>
                  <button
                    type="button"
                    onClick={() => toggleGrupo(group.id)}
                    aria-expanded={aberto}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  >
                    {t(group.label)}
                    <CaretDown
                      size={12}
                      weight="bold"
                      className={cn(
                        "shrink-0 text-text-subtle transition-transform",
                        !aberto && "-rotate-90",
                      )}
                      aria-hidden
                    />
                  </button>
                </h2>
              )}
              {aberto && (
                <ul
                  aria-labelledby={collapsed ? undefined : tituloId}
                  aria-label={collapsed ? t(group.label) : undefined}
                  className="space-y-1"
                >
                  {items.map((original) => {
                    // No menu, o Inbox leva o mesmo nome do título da tela: "Conversas".
                    const item =
                      original.href === "/app/inbox"
                        ? { ...original, label: "Conversas" }
                        : original;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={collapsed ? t(item.label) : undefined}
                          aria-current={isActive ? "page" : undefined}
                          onClick={onNavigate}
                          className={cn(
                            "crm-group-link relative flex items-center gap-3 rounded-md px-3 py-1 text-sm transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                            collapsed && "justify-center px-2",
                          )}
                        >
                          <Icon size={20} weight="regular" aria-hidden />
                          {!collapsed && <span className="truncate">{t(item.label)}</span>}
                          <NavigationPending />
                          {item.healthDot && (
                            <ConnectionHealthDot
                              className={cn(collapsed ? "absolute top-1.5 right-1.5" : "ml-auto")}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                  {group.hub && (
                    <li>
                      <Link
                        href={group.hub.href}
                        title={collapsed ? t(group.hub.label) : undefined}
                        aria-current={pathname === group.hub.href ? "page" : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "crm-group-link flex items-center gap-3 rounded-md px-3 py-1 text-sm transition-colors",
                          pathname === group.hub.href
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          collapsed && "justify-center px-2",
                        )}
                      >
                        <ArrowRight size={18} aria-hidden />
                        {!collapsed && <span className="truncate">{t(group.hub.label)}</span>}
                        <NavigationPending />
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="crm-sidebar-footer border-t p-2">
        {rodape && (
          <Link
            href={rodape.href}
            title={collapsed ? t(rodape.label) : undefined}
            aria-current={pathname.startsWith(rodape.href) ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "mb-1 flex items-center gap-3 rounded-md px-3 py-1 text-sm transition-colors",
              pathname.startsWith(rodape.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Gear size={18} aria-hidden />
            {!collapsed && <span className="truncate">{t(rodape.label)}</span>}
          </Link>
        )}
        <VersionFooter collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </>
  );
}

export function Sidebar() {
  const collapsed = false;
  return (
    <aside
      data-shell-sidebar
      data-collapsed={collapsed}
      className={cn(
        // ⚠️ `sticky`, e NUNCA `fixed`.
        //
        // Com `fixed` a barra sai do fluxo: ela não ocupa lugar nenhum na linha,
        // e quem afastava o conteúdo era um `md:ml-16`/`md:ml-60` do lado de lá.
        // Duas medidas para a mesma coisa, em componentes diferentes — e no dia
        // em que discordassem (largura de 60 com margem de 16), a barra passava
        // POR CIMA da lista de conversas, escondendo o começo de cada linha.
        //
        // Foi assim que apareceu numa instalação real: a barra expandida, com as
        // etiquetas legíveis, e a lista atrás dela cortada. Um F5 "consertava",
        // que é a assinatura de servidor e navegador terem pintado estados
        // diferentes — e `AppShell` e `Sidebar` são ambos `"use client"`.
        //
        // `sticky top-0 h-screen` dá o mesmo efeito visual (a barra não rola com
        // a página) e ela VOLTA a ocupar lugar: sobra para o conteúdo exatamente
        // o que ela não usou, e não há segunda medida para discordar.
        //
        // `shrink-0` porque item de flex encolhe por padrão, e uma barra de 60
        // espremida para caber é o mesmo defeito por outro caminho.
        "sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-20" : "w-60",
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
