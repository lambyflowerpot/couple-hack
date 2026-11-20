import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TheftWatch — Choose Camera or Guard" },
      { name: "description", content: "Pick Camera to watch the shop floor, or Guard to review live shoplifting alerts." },
      { property: "og:title", content: "TheftWatch — Choose Camera or Guard" },
      { property: "og:description", content: "Pick Camera to watch the shop floor, or Guard to review live shoplifting alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const cls =
    "flex h-40 w-64 items-center justify-center rounded-2xl text-3xl font-bold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-4 focus-visible:ring-ring/60";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-gradient-to-b from-secondary via-background to-background p-6">
      <img src="/logo.png" alt="TheftWatch" className="h-40 w-auto sm:h-52" />
      <div className="brand-strip h-1.5 w-64 rounded-full sm:w-80" aria-hidden="true" />
      <div className="flex flex-col items-center gap-8 sm:flex-row">
        <Link to="/camera" className={`${cls} bg-primary text-primary-foreground hover:bg-primary/90`}>Camera</Link>
        <Link to="/guard" className={`${cls} bg-accent text-accent-foreground hover:bg-accent/90`}>Guard</Link>
      </div>
    </main>
  );
}
