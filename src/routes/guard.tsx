import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guard")({
  head: () => ({
    meta: [
      { title: "Guard — Shoplifting Detection Demo" },
      { name: "description", content: "Guard view of the shoplifting detection demo." },
      { property: "og:title", content: "Guard — Shoplifting Detection Demo" },
      { property: "og:description", content: "Guard view of the shoplifting detection demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <main className="flex min-h-screen items-center justify-center bg-background text-4xl font-bold text-foreground">Guard</main>;
}
