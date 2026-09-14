import { expect, it } from "vitest";
import { CARD_WIDTH, CARD_MARGIN, ROOT_GAP, treeWidth, fitTreeScale } from "./layout";
const leaf = (uid: string) => ({ emp: { uid }, children: [] });
it("reserves full width for sibling subtrees and collapsed branches", () => {
  const root = { emp: { uid: "root" }, children: [leaf("a"), { emp: { uid: "b" }, children: [leaf("c"), leaf("d")] }] };
  const nestedWidth = 2 * (CARD_WIDTH + 2 * CARD_MARGIN);
  expect(treeWidth([root], new Set())).toBe(CARD_WIDTH + nestedWidth + 4 * CARD_MARGIN);
  expect(treeWidth([root], new Set(["root"]))).toBe(CARD_WIDTH);
  expect(treeWidth([leaf("a"), leaf("b")], new Set())).toBe(2 * CARD_WIDTH + ROOT_GAP);
});
it("fits wide and tall trees inside measured viewport with padding", () => {
  expect(fitTreeScale({ width: 360, height: 600 }, { width: 1200, height: 400 })).toBeCloseTo(312 / 1200);
  expect(fitTreeScale({ width: 600, height: 360 }, { width: 400, height: 1200 })).toBeCloseTo(312 / 1200);
  expect(fitTreeScale({ width: 600, height: 600 }, { width: 206, height: 150 })).toBe(1);
  expect(fitTreeScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toBe(1);
});