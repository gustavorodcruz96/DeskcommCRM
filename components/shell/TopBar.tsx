"use client";
import { usePathname } from "next/navigation";
import { useT } from "@/hooks/i18n/useT";
import { NAV_DESTINATIONS, NAV_GROUPS } from "@/lib/navigation/registry";
import { AlertsBell } from "./AlertsBell";
import { MobileSidebar } from "./MobileSidebar";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";

export function TopBar() {
  const pathname = usePathname();
  const t = useT();
  const destination = NAV_DESTINATIONS.filter(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  const hub = NAV_GROUPS.find((group) => group.hub?.href === pathname);
  const title = pathname.startsWith("/app/inbox")
    ? t("Conversas")
    : t(destination?.label ?? hub?.label ?? "Área de trabalho");
  return (
    <header className="crm-topbar sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-3 md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileSidebar />
        <h1 className="truncate text-xl font-bold">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <TenantSwitcher />
        <AlertsBell />
        <UserMenu />
      </div>
    </header>
  );
}
