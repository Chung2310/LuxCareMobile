export const CARD_WIDTH = 206;
export const CARD_MARGIN = 12;
export const ROOT_GAP = 32;
export const CANVAS_PADDING = 24;

type Branch = { emp: { uid: string }; children: Branch[] };

export function treeWidth(roots: Branch[], collapsed: Set<string>): number {
  const width = (node: Branch): number => collapsed.has(node.emp.uid) || !node.children.length
    ? CARD_WIDTH
    : Math.max(CARD_WIDTH, node.children.reduce((sum, child) => sum + width(child) + CARD_MARGIN * 2, 0));
  return roots.reduce((sum, root) => sum + width(root), 0) + Math.max(0, roots.length - 1) * ROOT_GAP;
}

export function fitTreeScale(viewport: { width: number; height: number }, content: { width: number; height: number }): number {
  if (content.width <= 0 || content.height <= 0 || viewport.width <= CANVAS_PADDING * 2 || viewport.height <= CANVAS_PADDING * 2) return 1;
  return Math.min(1, (viewport.width - CANVAS_PADDING * 2) / content.width, (viewport.height - CANVAS_PADDING * 2) / content.height);
}