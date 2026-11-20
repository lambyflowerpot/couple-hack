export const SCAN_INSTRUCTION = `This is a CCTV view of a table or shelf of store stock, before anyone touches it. List each distinct item on it, at most 8, using short names a person would use, such as "blue crisps packet". Do not list people, furniture or the table itself. Reply with JSON only: {"items": [string]}`;

/** The per-check instruction, with the scanned shelf items when there are any. */
export function buildCheckInstruction(items: string[], frameCount: number): string {
  const stock = items.length
    ? `Store stock on the table or shelf: ${items.join(", ")}. Use one of these exact names for "item".`
    : "Items on the table or shelf are store stock.";
  return `These are ${frameCount} CCTV frames, numbered 1 to ${frameCount} in time order, shown as a grid read left to right, then top to bottom. They are cropped to where movement happened, and frame 1 is from just before the movement. ${stock} First track the stock item being handled: for each frame, say in 2 to 4 words where it is (on shelf, in hand, in pocket, in bag, under clothing, not visible). Then say what the person did with it. Reply with JSON only: {"track": [string, one per frame], "event": "none" | "picked_up" | "returned" | "concealed", "item": string, "location": string, "confidence": number from 0 to 1, "reason": string under 15 words}. "concealed" means a stock item taken from the table or shelf ends up hidden in a pocket, bag or under clothing. Putting it back is "returned". Holding it in view is "picked_up". If no stock item is involved, or a person puts away their own belongings such as their phone, reply "none".`;
}
