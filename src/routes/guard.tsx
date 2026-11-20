import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guard")({
  head: () => ({
    meta: [
      { title: "Guard — TheftWatch Live Alerts" },
      { name: "description", content: "Live shoplifting incident feed for store guards, with evidence and review actions." },
      { property: "og:title", content: "Guard — TheftWatch Live Alerts" },
      { property: "og:description", content: "Live shoplifting incident feed for store guards, with evidence and review actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuardPage,
});

type Incident = {
  id: string;
  created_at: string | null;
  item: string | null;
  location: string | null;
  confidence: number | null;
  reason: string | null;
  evidence: string | null;
  status: string | null;
};

function sortNewest(list: Incident[]) {
  return [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

function pct(c: number | null) {
  if (c == null) return "—";
  const v = c <= 1 ? c * 100 : c;
  return `${Math.round(v)}%`;
}

function makeTestImage(): string {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 240;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#333";
  ctx.fillRect(0, 0, 320, 240);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TEST IMAGE", 160, 120);
  ctx.font = "16px sans-serif";
  ctx.fillText(new Date().toLocaleTimeString(), 160, 150);
  return c.toDataURL("image/jpeg", 0.7);
}

function GuardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [sending, setSending] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);

  const beep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || !soundRef.current) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }, []);

  useEffect(() => {
    let active = true;
    supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!active) return;
        setIncidents((prev) => {
          const map = new Map<string, Incident>();
          for (const r of (data ?? []) as Incident[]) map.set(r.id, r);
          for (const r of prev) map.set(r.id, r);
          return sortNewest([...map.values()]);
        });
        setLoading(false);
      });

    const channel = supabase
      .channel(`incidents-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as Incident;
          setIncidents((prev) => sortNewest([row, ...prev.filter((p) => p.id !== row.id)]));
          if (row.status === "new") {
            setAlert(true);
            beep();
          }
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as Incident;
          setIncidents((prev) => prev.map((p) => (p.id === row.id ? { ...p, ...row, evidence: row.evidence ?? p.evidence } : p)));
        } else if (payload.eventType === "DELETE") {
          const old = payload.old as { id?: string };
          setIncidents((prev) => prev.filter((p) => p.id !== old.id));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [beep]);

  const newCount = incidents.filter((i) => i.status === "new").length;
  useEffect(() => {
    if (newCount === 0) setAlert(false);
  }, [newCount]);

  const enableSound = async () => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    await audioRef.current.resume();
    soundRef.current = true;
    setSoundOn(true);
    beep();
  };

  const setStatus = async (id: string, status: "reviewed" | "false_alarm") => {
    setIncidents((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await supabase.from("incidents").update({ status }).eq("id", id);
  };

  const sendTest = async () => {
    setSending(true);
    await supabase.from("incidents").insert({
      item: "[TEST] Chocolate bar",
      location: "[TEST] Jacket pocket",
      confidence: 0.87,
      reason: "[TEST] This is a fake test incident, not a real detection.",
      evidence: makeTestImage(),
      status: "new",
    });
    setSending(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="brand-strip h-1" aria-hidden="true" />
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="TheftWatch" className="h-9 w-auto" />
            <div>
              <h1 className="text-lg font-bold leading-tight">TheftWatch</h1>
              <p className="text-xs text-muted-foreground">Guard · live incident feed</p>
            </div>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-sm font-semibold ${newCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}
            aria-label={`${newCount} new incidents`}
          >
            {newCount} new
          </div>
        </div>
        {alert && newCount > 0 && (
          <button
            type="button"
            onClick={() => setAlert(false)}
            className="block w-full animate-pulse bg-destructive px-4 py-3 text-center text-base font-bold uppercase tracking-wide text-destructive-foreground"
          >
            Review needed
          </button>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={soundOn ? "secondary" : "default"} className="h-12" onClick={enableSound} disabled={soundOn}>
            {soundOn ? "Sound on" : "Enable sound"}
          </Button>
          <Button variant="outline" className="h-12" onClick={sendTest} disabled={sending}>
            {sending ? "Sending…" : "Send test incident"}
          </Button>
        </div>

        <ul className="mt-4 space-y-4">
          {loading && <li className="text-center text-sm text-muted-foreground">Loading…</li>}
          {!loading && incidents.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No incidents yet.
            </li>
          )}
          {incidents.map((i) => {
            const isNew = i.status === "new";
            const isTest = (i.item ?? "").startsWith("[TEST]");
            return (
              <li
                key={i.id}
                className={`overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition ${isNew ? "border-destructive" : "border-border opacity-50 grayscale"}`}
              >
                {i.evidence && (
                  <img src={i.evidence} alt={`Evidence: ${i.item ?? "incident"}`} className="aspect-video w-full bg-muted object-cover" />
                )}
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{i.created_at ? new Date(i.created_at).toLocaleString() : ""}</span>
                    <span className="flex gap-1">
                      {isTest && <span className="rounded bg-accent px-2 py-0.5 font-semibold text-accent-foreground">TEST</span>}
                      <span className={`rounded px-2 py-0.5 font-medium ${isNew ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{i.status === "false_alarm" ? "False alarm" : i.status === "reviewed" ? "Reviewed" : "New"}</span>
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold">{i.item ?? "Unknown item"}</h2>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Hidden in</dt>
                      <dd className="font-medium">{i.location ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Confidence</dt>
                      <dd className="font-semibold text-primary">{pct(i.confidence)}</dd>
                    </div>
                  </dl>
                  {i.reason && <p className="text-sm text-muted-foreground">{i.reason}</p>}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button className="h-11" onClick={() => setStatus(i.id, "reviewed")} disabled={i.status === "reviewed"}>
                      Reviewed
                    </Button>
                    <Button variant="outline" className="h-11" onClick={() => setStatus(i.id, "false_alarm")} disabled={i.status === "false_alarm"}>
                      False alarm
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
