interface Ordered {
  id: string;
  order: number;
}

/**
 * PUT plan for swapping two neighbours of an order-sorted list. Distinct orders swap
 * values directly; tied orders (e.g. both 0) can't be swapped, so the swapped list is
 * renumbered 1..n and only the rows whose order changes are returned.
 */
export function swapOrderUpdates(
  sorted: readonly Ordered[],
  firstId: string,
  secondId: string,
): Ordered[] {
  const first = sorted.find((item) => item.id === firstId);
  const second = sorted.find((item) => item.id === secondId);
  if (first === undefined || second === undefined) {
    return [];
  }
  if (first.order !== second.order) {
    return [
      { id: first.id, order: second.order },
      { id: second.id, order: first.order },
    ];
  }
  const swapped = sorted.map((item) =>
    item.id === first.id ? second : item.id === second.id ? first : item,
  );
  return swapped
    .map((item, index) => ({ id: item.id, order: index + 1 }))
    .filter((update, index) => swapped[index]?.order !== update.order);
}
