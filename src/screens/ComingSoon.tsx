import { Construction } from "lucide-react";
import { useApp, useT } from "../store";
import { Button, TopBar } from "../components/ui";
import type { AreaInfo } from "../data/sprints";

/** Placeholder for a feature area that isn't shown yet (see src/data/sprints.ts). */
export function ComingSoon({ f, back, skip }: { f: AreaInfo; back: boolean; skip?: { label: string; run: () => void } }) {
  const { a } = useApp();
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      {back && <TopBar title={t(f.feature)} onBack={a.back} />}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="hero-yellow grid size-20 place-items-center rounded-3xl text-teal-deep">
          <Construction className="size-10" />
        </span>
        <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight">{t("Coming soon")}</h1>
        <p className="mt-2 text-[17px] font-semibold text-teal-deep">{t(f.feature)}</p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {f.sprint ? `${t("Being designed in Sprint")} ${f.sprint}${f.due ? ` · ${f.due}` : ""}` : t("Not in the current design plan")}
        </p>
      </div>
      {/* Prototype only: lets a reviewer keep walking the route past a hidden step. */}
      {skip && (
        <div className="px-4 pb-8">
          <Button size="lg" variant="outline" className="w-full" onClick={skip.run}>
            {skip.label}
          </Button>
          <p className="mt-2 text-center text-2xs text-muted-foreground">Prototype only</p>
        </div>
      )}
    </div>
  );
}
