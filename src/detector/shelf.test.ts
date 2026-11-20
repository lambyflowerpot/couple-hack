import { describe, expect, it } from "vitest";

import { matchItem, setItemState } from "./shelf";
import type { ShelfItem } from "./types";

const shelf: ShelfItem[] = [
  { name: "Blue crisps packet", state: "on_shelf" },
  { name: "water bottle", state: "on_shelf" },
];

describe("matchItem", () => {
  it("matches exactly, ignoring case and spaces", () => {
    expect(matchItem("  WATER BOTTLE ", shelf)?.name).toBe("water bottle");
  });

  it("matches when the AI uses a shorter or longer name", () => {
    expect(matchItem("crisps packet", shelf)?.name).toBe("Blue crisps packet");
    expect(matchItem("small water bottle", shelf)?.name).toBe("water bottle");
  });

  it("returns null for items not on the shelf", () => {
    expect(matchItem("phone", shelf)).toBeNull();
    expect(matchItem("", shelf)).toBeNull();
  });
});

describe("setItemState", () => {
  it("updates only the matched item", () => {
    expect(setItemState(shelf, "water bottle", "concealed")).toEqual([
      { name: "Blue crisps packet", state: "on_shelf" },
      { name: "water bottle", state: "concealed" },
    ]);
  });

  it("leaves the shelf unchanged for unknown items", () => {
    expect(setItemState(shelf, "phone", "concealed")).toBe(shelf);
  });
});
