import { useState } from "react";
import { Lock, Minus, Plus, Truck } from "lucide-react";
import { routeOf, useApp, useT, type VehicleProfile } from "../store";
import { STORAGE_DETAILS, VEHICLES } from "../data/route";
import { ActionBar, Badge, Button, Card, cn, IconChip, SectionLabel, TopBar } from "../components/ui";

/* ------------------------------------------------------------------
 * #64 Vehicle and capacity in the driver's profile.
 *   Driver enters: make, model, year, headcount limit (people they can carry; never blocks assignment).
 *   Dispatch only: storage details (free text), shown read-only here.
 * #79 The driver's car is their default vehicle; dispatch can change the vehicle for a single delivery.
 * Headcount was only discussed as a possible field in the review, so it's marked optional.
 * ------------------------------------------------------------------ */
const YEARS = Array.from({ length: 20 }, (_, i) => 2026 - i);

export function VehicleScreen() {
  const { s, a } = useApp();
  const t = useT();
  const [v, setV] = useState<VehicleProfile>(s.vehicle);
  const dirty = JSON.stringify(v) !== JSON.stringify(s.vehicle);
  const changed = routeOf(s).filter((x) => s.vehicleFor[x.id]);
  const field = "h-12 w-full rounded-xl border border-control bg-card px-4 text-base outline-none focus:border-teal focus:ring-2 focus:ring-teal/30";

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t("Vehicle")} onBack={a.back} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {changed.length > 0 && (
          <section>
            <SectionLabel action={<span className="text-2xs font-semibold text-muted-foreground">Set by dispatch</span>}>Changed for a delivery</SectionLabel>
            <Card className="divide-y divide-border">
              {changed.map((x) => {
                const v = VEHICLES.find((y) => y.id === s.vehicleFor[x.id])!;
                return (
                  <div key={x.id} className="flex items-center gap-3 p-4">
                    <IconChip tone="dark">
                      <Truck />
                    </IconChip>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{v.name}</div>
                      <div className="truncate text-2xs text-muted-foreground">
                        Stop {x.seq} · {x.name} · {v.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
            <p className="mt-2 px-1 text-2xs text-muted-foreground">Every other delivery uses your default vehicle.</p>
          </section>
        )}

        <section>
          <SectionLabel action={<Badge tone="teal">Default vehicle</Badge>}>Your car</SectionLabel>
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-overline">
                Make
                <input value={v.make} onChange={(e) => setV({ ...v, make: e.target.value })} className={cn(field, "mt-1")} />
              </label>
              <label className="text-overline">
                Model
                <input value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} className={cn(field, "mt-1")} />
              </label>
            </div>
            <label className="text-overline block">
              Year
              <select value={v.year} onChange={(e) => setV({ ...v, year: Number(e.target.value) })} className={cn(field, "nums mt-1 font-semibold")}>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <div>
              <div className="text-overline">Headcount limit (optional)</div>
              <div className="mt-1 flex items-center gap-3">
                <button aria-label="Fewer people" onClick={() => setV({ ...v, headcount: Math.max(0, v.headcount - 1) })} className="grid size-12 place-items-center rounded-full border border-control bg-card">
                  <Minus className="size-5" />
                </button>
                <span className="nums w-10 text-center text-2xl font-bold">{v.headcount}</span>
                <button aria-label="More people" onClick={() => setV({ ...v, headcount: Math.min(8, v.headcount + 1) })} className="grid size-12 place-items-center rounded-full border border-control bg-card">
                  <Plus className="size-5" />
                </button>
                <span className="text-[13px] text-muted-foreground">people besides you</span>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel action={<span className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground"><Lock className="size-3" /> Dispatch edits</span>}>Storage details</SectionLabel>
          <Card className="bg-muted/60 p-4 text-[13px] leading-snug">{STORAGE_DETAILS}</Card>
        </section>
      </div>
      <ActionBar>
        <Button size="lg" className="w-full" disabled={!dirty} onClick={() => a.saveVehicle(v)}>
          {dirty ? "Save vehicle" : "Vehicle up to date"}
        </Button>
      </ActionBar>
    </div>
  );
}
