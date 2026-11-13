export interface Crumb {
  id: number;
  name: string;
}

export type BreadcrumbItem =
  | { kind: "crumb"; crumb: Crumb; index: number; current: boolean }
  | { kind: "gap"; hidden: string };

const MAX_VISIBLE = 5;
const TAIL_COUNT = 3;

/**
 * Keeps the root and the tail of a deep path so the current folder stays
 * readable while the middle collapses into a single gap.
 */
export function breadcrumbItems(path: Crumb[]): BreadcrumbItem[] {
  const last = path.length - 1;
  if (last < 0) return [];

  const collapse = path.length > MAX_VISIBLE;
  const tailStart = collapse ? Math.max(1, path.length - TAIL_COUNT) : 1;
  const items: BreadcrumbItem[] = [];

  const first = path[0];
  if (first) {
    items.push({ kind: "crumb", crumb: first, index: 0, current: last === 0 });
  }

  if (collapse && tailStart > 1) {
    items.push({
      kind: "gap",
      hidden: path
        .slice(1, tailStart)
        .map((crumb) => crumb.name)
        .join(" / "),
    });
  }

  for (let index = tailStart; index <= last; index += 1) {
    const crumb = path[index];
    if (!crumb) continue;
    items.push({ kind: "crumb", crumb, index, current: index === last });
  }

  return items;
}
