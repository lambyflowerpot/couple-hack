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
  const cls = "flex h-40 w-64 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground hover:bg-primary/90";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background p-6">
      <img src="/logo.png" alt="TheftWatch" className="h-40 w-auto sm:h-52" />
      <div className="flex flex-col items-center gap-8 sm:flex-row">
        <Link to="/camera" className={cls}>Camera</Link>
        <Link to="/guard" className={cls}>Guard</Link>
      </div>
    </main>
  );
}
