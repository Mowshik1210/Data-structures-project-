'use strict';

/* ============================================================
 *  CO3 — INSERTION SORT on a singly linked list
 *
 *  Builds an ordered chain by taking each node out of the
 *  original list and inserting it into its correct position.
 *  Nodes are RELINKED in place → O(1) extra space (no array).
 *
 *  Two fast paths keep the common cases cheap:
 *    • node ≥ sorted TAIL  → append  (already-sorted bookings → ~1 comparison/node → ~O(n))
 *    • node < sorted HEAD  → prepend (reverse-sorted input)
 *  Worst case (scrambled order) is O(n²) comparisons — still O(1) space.
 *  Stable: equal keys keep their original relative order.
 * ============================================================ */

/**
 * @param {LinkedList} list  the list to sort (mutated in place)
 * @param {Function} keyFn   extracts the comparable key from node data
 * @returns {{comparisons:number, nodesProcessed:number}}
 */
function insertionSortList(list, keyFn) {
  if (!list.head || !list.head.next) return { comparisons: 0, nodesProcessed: list.size };

  let sorted = null;       // head of the growing sorted chain
  let sortedTail = null;   // tail of the sorted chain (fast-append path)
  let comparisons = 0;
  let nodesProcessed = 0;

  let cur = list.head;
  while (cur !== null) {
    const next = cur.next;              // remember the rest of the original chain
    nodesProcessed++;

    if (sorted === null) {              // first node starts the sorted chain
      cur.next = null;
      sorted = sortedTail = cur;
    } else {
      comparisons++;                    // compare with the sorted TAIL first
      if (keyFn(cur.data) >= keyFn(sortedTail.data)) {
        cur.next = null;                // append — best case for sorted input
        sortedTail.next = cur;
        sortedTail = cur;
      } else {
        comparisons++;                  // compare with the sorted HEAD
        if (keyFn(cur.data) < keyFn(sorted.data)) {
          cur.next = sorted;            // prepend — best case for reverse input
          sorted = cur;
        } else {                        // middle: walk to the insertion point
          let s = sorted;
          while (s.next !== null && keyFn(s.next.data) <= keyFn(cur.data)) {
            comparisons++;
            s = s.next;
          }
          comparisons++;
          cur.next = s.next;
          s.next = cur;
        }
      }
    }
    cur = next;
  }

  list.head = sorted;
  list.tail = sortedTail;               // repair the tail pointer in O(1)
  return { comparisons, nodesProcessed };
}

module.exports = { insertionSortList };