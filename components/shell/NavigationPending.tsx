"use client";
import { useLinkStatus } from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { CircleNotch } from "@/lib/ui/icons";

/** Retorno imediato ao clique enquanto o servidor prepara a próxima tela. */
export function NavigationPending({ overlay = false }: { overlay?: boolean }) {
  const { pending } = useLinkStatus();
  const t = useT();
  if (!pending) return null;
  return (
    <span
      role="status"
      className={
        overlay
          ? "absolute inset-0 inline-flex items-center justify-center rounded-md bg-card"
          : "ml-auto inline-flex shrink-0"
      }
    >
      <CircleNotch size={16} className="animate-spin" aria-hidden />
      <span className="sr-only">{t("Carregando...")}</span>
    </span>
  );
}
