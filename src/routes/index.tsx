import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ShieldCheck, ScanEye, BellRing, FileCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TheftWatch — AI shoplifting detection for UK supermarkets" },
      {
        name: "description",
        content:
          "UK retailers lose £2.2bn a year to shoplifting, with 55,000 thefts a day. TheftWatch turns existing CCTV into real-time theft alerts for store guards.",
      },
      { property: "og:title", content: "TheftWatch — AI shoplifting detection for UK supermarkets" },
      {
        property: "og:description",
        content:
          "UK retailers lose £2.2bn a year to shoplifting, with 55,000 thefts a day. TheftWatch turns existing CCTV into real-time theft alerts for store guards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const STATS = [
  { value: "£2.2bn", label: "lost to customer theft by UK retailers in a single year", tone: "red" },
  { value: "55,000", label: "theft incidents every day — over 20 million a year", tone: "red" },
  { value: "529,994", label: "police-recorded shoplifting offences in the year to June 2025, up 13%", tone: "blue" },
  { value: "2,000+", label: "incidents of violence and abuse against shop staff every day", tone: "red" },
  { value: "£1.8bn", label: "spent by retailers on crime prevention in one year", tone: "blue" },
  { value: "61%", label: "of retailers rate the police response to incidents as poor or very poor", tone: "blue" },
] as const;

const FEATURES = [
  {
    icon: ScanEye,
    title: "Watches every aisle",
    text: "TheftWatch analyses your existing CCTV feeds and spots concealment the moment it happens — no new cameras needed.",
  },
  {
    icon: BellRing,
    title: "Alerts in seconds",
    text: "Guards get a live alert with the item, where it was hidden, a confidence score and photo evidence — straight to their phone.",
  },
  {
    icon: FileCheck,
    title: "Evidence, ready",
    text: "Every incident is logged with a snapshot and reason, so reviews and police reports take minutes, not hours.",
  },
] as const;

function Landing() {
  return (
    <main className="dark min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="brand-strip h-1" aria-hidden="true" />
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:justify-between sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-mark.png" alt="TheftWatch" className="h-12 w-auto shrink-0 sm:h-14" />
            <span className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">TheftWatch</span>
          </div>
          <Link
            to="/guard"
            className="shrink-0 rounded-xl bg-destructive px-4 py-2.5 text-base font-bold text-destructive-foreground transition hover:bg-destructive/90 sm:px-7 sm:py-3.5 sm:text-lg"
          >
            Guard demo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-10 text-center sm:pt-14">
        <p className="mx-auto inline-block rounded-full border border-border bg-card px-4 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          UK retail crime · 2025
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Supermarket theft is at <span className="text-destructive">record levels.</span>{" "}
          Your CCTV can <span className="text-primary">stop it.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          UK retailers lost <span className="font-bold text-destructive">£2.2bn</span> to shoplifting last year —{" "}
          <span className="font-bold text-destructive">55,000 thefts every day</span>, yet only{" "}
          <span className="font-bold text-primary">529,994 offences</span> were ever recorded by police. TheftWatch
          turns the cameras you already have into an always-on detection system that alerts your guards the moment an
          item is concealed.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/camera"
            className="flex h-14 w-64 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl"
          >
            <Camera className="h-5 w-5" /> Camera demo
          </Link>
          <Link
            to="/guard"
            className="flex h-14 w-64 items-center justify-center gap-2 rounded-xl bg-destructive text-lg font-bold text-destructive-foreground shadow-lg transition hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-xl"
          >
            <ShieldCheck className="h-5 w-5" /> Guard demo
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
            Figures from the British Retail Consortium's 2025 Crime Survey and the Office for National Statistics.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {STATS.map((s) => (
              <div
                key={s.value}
                className={`rounded-xl border bg-card p-4 shadow-sm sm:p-6 ${
                  s.tone === "red" ? "border-destructive/50" : "border-border"
                }`}
              >
                <dt className={`text-2xl font-extrabold tracking-tight sm:text-4xl ${s.tone === "red" ? "text-destructive" : "text-primary"}`}>
                  {s.value}
                </dt>
                <dd className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">How TheftWatch helps</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="brand-strip h-1" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-8 text-center">
          <img src="/logo-mark.png" alt="" className="h-8 w-auto" />
          <p className="text-xs text-muted-foreground">
            TheftWatch demo · Sources: BRC Retail Crime Survey 2025, ONS Crime in England and Wales (year ending June
            2025)
          </p>
        </div>
      </footer>
    </main>
  );
}
