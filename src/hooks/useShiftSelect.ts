import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reusable shift-click multi-select for table rows.
 *
 * @param getKey - Extract the unique identifier from a row object.
 * @returns `{ selected, handleRowClick, toggleAll, clearSelection }`
 *
 * Usage:
 *   const { selected, handleRowClick, toggleAll, clearSelection } = useShiftSelect<MyRow>((r) => r.id);
 *   // In the checkbox:  onChange={() => handleRowClick(idx, row, filteredRows)}
 *   // Select-all:       onChange={() => toggleAll(filteredRows)}
 */
export function useShiftSelect<T>(getKey: (row: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const shiftHeld = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handleRowClick = useCallback(
    (index: number, row: T, filteredRows: T[]) => {
      const key = getKey(row);
      if (shiftHeld.current && lastClickedIndex.current !== null) {
        const start = Math.min(lastClickedIndex.current, index);
        const end = Math.max(lastClickedIndex.current, index);
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(getKey(filteredRows[i]));
          }
          return next;
        });
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }
      lastClickedIndex.current = index;
    },
    [getKey],
  );

  const toggleAll = useCallback(
    (filteredRows: T[]) => {
      setSelected((prev) => {
        const allSelected = filteredRows.length > 0 && filteredRows.every((r) => prev.has(getKey(r)));
        if (allSelected) {
          const next = new Set(prev);
          for (const r of filteredRows) next.delete(getKey(r));
          return next;
        }
        const next = new Set(prev);
        for (const r of filteredRows) next.add(getKey(r));
        return next;
      });
    },
    [getKey],
  );

  const allSelected = useCallback(
    (filteredRows: T[]) => filteredRows.length > 0 && filteredRows.every((r) => selected.has(getKey(r))),
    [selected, getKey],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  return { selected, setSelected, handleRowClick, toggleAll, allSelected, clearSelection };
}
