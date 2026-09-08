'use strict';

/* ============================================================
 *  CO1 — SINGLY LINKED LIST ADT
 *  Used for: confirmed reservations (head + tail) and the
 *  activity timeline. O(1) insertion at the tail.
 * ============================================================ */

/** A node wraps a payload (`data`) and a `next` pointer —
 *  the direct equivalent of the C struct: struct Passenger { …; struct Passenger *next; } */
class ListNode {
  constructor(data) { this.data = data; this.next = null; }
}

class LinkedList {
  constructor() { this.head = null; this.tail = null; this.size = 0; }

  isEmpty() { return this.head === null; }

  /** Append a node (or wrap raw data) at the TAIL — O(1). */
  insertTail(dataOrNode) {
    const node = dataOrNode instanceof ListNode ? dataOrNode : new ListNode(dataOrNode);
    node.next = null;
    if (this.tail === null) { this.head = this.tail = node; }          // empty list
    else { this.tail.next = node; this.tail = node; }                  // general case
    this.size++;
    return node;
  }

  /**
   * Remove and return the first node whose data satisfies `match(data)`.
   * Correctly handles: empty list, single node, head, middle and tail.
   * O(n) time, O(1) space. Returns null when nothing matches.
   */
  remove(match) {
    let prev = null, cur = this.head;
    while (cur !== null) {
      if (match(cur.data)) {
        if (prev === null) this.head = cur.next;   // deleting the head
        else prev.next = cur.next;                 // middle / tail
        if (cur === this.tail) this.tail = prev;   // deleting the tail
        cur.next = null;
        this.size--;
        return cur;
      }
      prev = cur; cur = cur.next;
    }
    return null;
  }

  /** Sequential traversal — O(n). */
  forEach(fn) {
    let cur = this.head, i = 0;
    while (cur !== null) { fn(cur.data, i, cur); cur = cur.next; i++; }
  }

  find(match) {
    let cur = this.head;
    while (cur !== null) { if (match(cur.data)) return cur; cur = cur.next; }
    return null;
  }

  toArray() { const out = []; this.forEach((d) => out.push(d)); return out; }
}

module.exports = { LinkedList, ListNode };