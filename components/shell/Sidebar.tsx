"use client";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  Gear,
  ChartBar,
} from "@/lib/ui/icons";
import { SearchTrigger } from "@/components/shell/SearchTrigger";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toggleSidebar } from "@/app/actions/shell/toggleSidebar";
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
  showCollapseControl?: boolean;
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
export function SidebarContent({
  collapsed,
  showCollapseControl = true,
  onNavigate,
}: SidebarContentProps) {
  // A barra lateral aparece em TODA tela — traduzi-la aqui é o que faz a
  // escolha de idioma virar algo visível no primeiro clique.
  const t = useT();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
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
  const atalhos = [
    "/app/inbox",
    "/app/kanban",
    "/app/agenda",
    "/app/contacts",
    "/app/tasks",
    "/app/radar",
  ].flatMap((href) => grupos.flatMap((g) => g.items).filter((item) => item.href === href));
  const analise = grupos.find((g) => g.group.id === "analise")?.group.hub;
  const [ferramentasAbertas, setFerramentasAbertas] = useState(false);
  function navegar() {
    setFerramentasAbertas(false);
    onNavigate?.();
  }

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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={nome}
              className="app-brand-image h-10 w-10 shrink-0 rounded-xl object-contain"
            />
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
        {showCollapseControl && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => toggleSidebar(collapsed))}
            aria-label={collapsed ? t("Expandir sidebar") : t("Recolher sidebar")}
            aria-expanded={!collapsed}
            title={collapsed ? t("Expandir sidebar") : t("Recolher sidebar")}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            {collapsed ? (
              <CaretDoubleRight size={16} aria-hidden />
            ) : (
              <CaretDoubleLeft size={16} aria-hidden />
            )}
          </button>
        )}
      </div>
      <div className="crm-sidebar-search">
        <SearchTrigger compact={collapsed} />
      </div>
      <nav className="crm-primary-nav" aria-label={t("Navegação principal")}>
        {!collapsed && <p className="crm-nav-label">{t("Atendimento")}</p>}
        {atalhos.map((item) => {
          const Icon = item.icon;
          const label = item.href === "/app/inbox" ? t("Conversas") : t(item.label);
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn("crm-nav-link", collapsed && "crm-nav-icon")}
            >
              <Icon size={21} aria-hidden />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
        {!collapsed && <p className="crm-nav-label crm-nav-label-secondary">{t("Gestão")}</p>}
        <Popover open={ferramentasAbertas} onOpenChange={setFerramentasAbertas}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn("crm-nav-link w-full", collapsed && "crm-nav-icon")}
              aria-label={t("Ferramentas")}
              title={collapsed ? t("Ferramentas") : undefined}
            >
              <Gear size={21} aria-hidden />
              {!collapsed && (
                <>
                  <span>{t("Ferramentas")}</span>
                  <CaretDown size={13} className="ml-auto" aria-hidden />
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="crm-tools-menu max-h-[75dvh] w-80 overflow-y-auto p-3"
          >
            <nav className="space-y-2" aria-label={t("Todas as ferramentas")}>
              {grupos.map(({ group, items }) => {
                const aberto = !gruposFechados.has(group.id);
                const tituloId = `nav-grupo-${group.id}`;
                return (
                  <section key={group.id}>
                    <h2 id={tituloId}>
                      <button
                        type="button"
                        onClick={() => toggleGrupo(group.id)}
                        aria-expanded={aberto}
                        className="flex w-full items-center justify-between px-3 py-2"
                      >
                        {t(group.label)}
                        <CaretDown size={12} aria-hidden />
                      </button>
                    </h2>
                    {aberto && (
                      <ul aria-labelledby={tituloId}>
                        {items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={navegar}
                                aria-current={pathname === item.href ? "page" : undefined}
                              >
                                <Icon size={18} aria-hidden />
                                <span>{t(item.label)}</span>
                                {item.healthDot && <ConnectionHealthDot className="ml-auto" />}
                              </Link>
                            </li>
                          );
                        })}
                        {group.hub && (
                          <li>
                            <Link href={group.hub.href} onClick={navegar}>
                              <ArrowRight size={18} aria-hidden />
                              <span>{t(group.hub.label)}</span>
                            </Link>
                          </li>
                        )}
                      </ul>
                    )}
                  </section>
                );
              })}
            </nav>
          </PopoverContent>
        </Popover>
        {analise && (
          <Link
            href={analise.href}
            onClick={onNavigate}
            className={cn("crm-nav-link", collapsed && "crm-nav-icon")}
            aria-label={collapsed ? t("Relatórios") : undefined}
            title={collapsed ? t("Relatórios") : undefined}
            aria-current={pathname.startsWith(analise.href) ? "page" : undefined}
          >
            <ChartBar size={21} aria-hidden />
            {!collapsed && <span>{t("Relatórios")}</span>}
          </Link>
        )}
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

export function Sidebar({ collapsed }: { collapsed: boolean }) {
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
