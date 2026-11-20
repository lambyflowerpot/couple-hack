import type { ItemState, ShelfItem } from "./types";

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** The scanned item the AI meant: an exact match, else one name containing the other. */
export function matchItem(name: string, shelf: ShelfItem[]): ShelfItem | null {
  const wanted = normalize(name);
  if (!wanted) return null;
  return (
    shelf.find((item) => normalize(item.name) === wanted) ??
    shelf.find((item) => {
      const have = normalize(item.name);
      return have.includes(wanted) || wanted.includes(have);
    }) ??
    null
  );
}

export function setItemState(shelf: ShelfItem[], name: string, state: ItemState): ShelfItem[] {
  const match = matchItem(name, shelf);
  return match ? shelf.map((item) => (item === match ? { ...item, state } : item)) : shelf;
}
