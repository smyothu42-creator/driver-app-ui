import { Headphones, RotateCcw, X } from "lucide-react";
import { useApp } from "../store";
import { DISPATCH, ROUTE_DATE } from "../data/route";
import { DriverProfile, DriverRequests, OpenHoursEditor, SkipRequests, TimeOffRequests, TodayChanges, UnassignedOrders } from "./DispatchBoard";
import { isOn } from "../data/sprints";

/* ------------------------------------------------------------------
 * Dispatch page (SFK Admin), shown beside the phone with the "Dispatch view" button.
 * Only the Schedule & assignment parts (Sprint 2): request statuses, reminders, the 48 h flag,
 * open hours and time-off approvals, plus (Profile) the driver's duty, live location and storage details, reusables pickup skip requests and (Notifications) time changes and cancels. It shares state with the phone, so every change shows on both.
 * ------------------------------------------------------------------ */
export function DispatchPage({ onClose }: { onClose: () => void }) {
  const { a } = useApp();
  return (
    <aside aria-label="Dispatch page" className="anim-fade flex h-[852px] w-[440px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-border-strong bg-card shadow-raised">
      <header data-dark-surface className="flex items-center gap-3 bg-teal-deep px-5 py-4 text-white">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-yellow text-teal-deep">
          <Headphones className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-tight">Dispatch · SFK Admin</span>
          <span className="block text-2xs text-sidebar-muted">
            {DISPATCH.name} · {ROUTE_DATE}
          </span>
        </span>
        <button onClick={a.resetDemo} aria-label="Reset demo" title="Reset demo" className="grid size-9 place-items-center rounded-full hover:bg-sidebar-active">
          <RotateCcw className="size-4" />
        </button>
        <button onClick={onClose} aria-label="Close dispatch view" className="grid size-9 place-items-center rounded-full hover:bg-sidebar-active">
          <X className="size-5" />
        </button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {isOn("profile") && <DriverProfile />}
        {isOn("notifications") && <TodayChanges />}
        <DriverRequests />
        <UnassignedOrders />
        <OpenHoursEditor />
        <TimeOffRequests />
        {isOn("reusables") && <SkipRequests />}
      </div>
    </aside>
  );
}
