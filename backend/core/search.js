'use strict';

/* ============================================================
 *  CO3 — LINEAR (SEQUENTIAL) SEARCH
 *  The correct search for linked structures, which have no
 *  random access. O(n) worst-case time, O(1) extra space.
 *
 *  `trail` records every node visited so the UI can visualise
 *  the actual traversal: HEAD → … → MATCH.
 * ============================================================ */

/**
 * @param {Array<{name:string, start:object}>} containers e.g. [{name:'confirmed list', start: list.head}]
 * @param {Function} match   receives node data → boolean
 * @param {Function} label   receives node data → short chip label for the trail
 */
function linearSearch(containers, match, label) {
  const trail = [];
  for (const container of containers) {
    let cur = container.start, index = 0;
    while (cur !== null) {
      trail.push(label(cur.data));
      if (match(cur.data)) {
        return { found: true, container: container.name, index, data: cur.data, trail };
      }
      cur = cur.next;
      index++;
    }
  }
  return { found: false, container: null, index: -1, data: null, trail };
}

module.exports = { linearSearch };