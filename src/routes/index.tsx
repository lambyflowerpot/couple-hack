import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shoplifting Detection Demo" },
      { name: "description", content: "Choose Camera or Guard mode for the shoplifting detection demo." },
      { property: "og:title", content: "Shoplifting Detection Demo" },
      { property: "og:description", content: "Choose Camera or Guard mode for the shoplifting detection demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const cls = "flex h-40 w-64 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground hover:bg-primary/90";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6 sm:flex-row">
      <Link to="/camera" className={cls}>Camera</Link>
      <Link to="/guard" className={cls}>Guard</Link>
    </main>
  );
}
