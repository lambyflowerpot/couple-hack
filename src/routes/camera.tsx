import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/camera")({
  head: () => ({
    meta: [
      { title: "Camera — Shoplifting Detection Demo" },
      { name: "description", content: "Camera view of the shoplifting detection demo." },
      { property: "og:title", content: "Camera — Shoplifting Detection Demo" },
      { property: "og:description", content: "Camera view of the shoplifting detection demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <main className="flex min-h-screen items-center justify-center bg-background text-4xl font-bold text-foreground">Camera</main>;
}
