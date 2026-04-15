import { Node } from "./node";

export class DoublyLinkedList<T> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private current: Node<T> | null = null;
  private length = 0;
  private isCircular: boolean;
  private readonly getNodeId: (item: T) => string;

  constructor(getNodeId: (item: T) => string, isCircular = false) {
    this.getNodeId = getNodeId;
    this.isCircular = isCircular;
  }

  public insertAtStart(value: T): Node<T> {
    const newNode = new Node(value);

    if (this.head === null || this.tail === null) {
      this.head = newNode;
      this.tail = newNode;
      this.current ??= newNode;
      this.length += 1;
      this.syncCircularLinks();
      return newNode;
    }

    newNode.next = this.head;
    this.head.prev = newNode;
    this.head = newNode;
    this.length += 1;
    this.syncCircularLinks();
    return newNode;
  }

  public insertAtEnd(value: T): Node<T> {
    const newNode = new Node(value);

    if (this.head === null || this.tail === null) {
      this.head = newNode;
      this.tail = newNode;
      this.current ??= newNode;
      this.length += 1;
      this.syncCircularLinks();
      return newNode;
    }

    newNode.prev = this.tail;
    this.tail.next = newNode;
    this.tail = newNode;
    this.length += 1;
    this.syncCircularLinks();
    return newNode;
  }

  public insertAtPosition(index: number, value: T): Node<T> {
    if (index <= 0 || this.head === null || this.tail === null) {
      return this.insertAtStart(value);
    }

    if (index >= this.length) {
      return this.insertAtEnd(value);
    }

    const target = this.getNodeAt(index);

    if (target === null) {
      return this.insertAtEnd(value);
    }

    const newNode = new Node(value);
    const previousNode = target.prev;

    newNode.prev = previousNode;
    newNode.next = target;

    if (previousNode !== null) {
      previousNode.next = newNode;
    }

    target.prev = newNode;
    this.length += 1;
    this.syncCircularLinks();

    return newNode;
  }

  public removeById(id: string): T | null {
    const node = this.findNodeById(id);

    if (node === null) {
      return null;
    }

    const removedValue = node.value;
    const nextNode = this.getLinearNext(node);
    const previousNode = this.getLinearPrev(node);

    if (this.length === 1) {
      this.head = null;
      this.tail = null;
      this.current = null;
      this.length = 0;
      return removedValue;
    }

    if (node === this.head) {
      this.head = nextNode;
    }

    if (node === this.tail) {
      this.tail = previousNode;
    }

    if (previousNode !== null) {
      previousNode.next = nextNode;
    }

    if (nextNode !== null) {
      nextNode.prev = previousNode;
    }

    if (this.current === node) {
      this.current = nextNode ?? previousNode ?? null;
    }

    node.next = null;
    node.prev = null;
    this.length -= 1;
    this.syncCircularLinks();

    return removedValue;
  }

  public getNext(): T | null {
    if (this.current === null) {
      return null;
    }

    const nextNode = this.isCircular ? this.current.next : this.getLinearNext(this.current);

    if (nextNode === null) {
      return null;
    }

    this.current = nextNode;
    return nextNode.value;
  }

  public getPrevious(): T | null {
    if (this.current === null) {
      return null;
    }

    const previousNode = this.isCircular ? this.current.prev : this.getLinearPrev(this.current);

    if (previousNode === null) {
      return null;
    }

    this.current = previousNode;
    return previousNode.value;
  }

  public getCurrent(): T | null {
    return this.current?.value ?? null;
  }

  public setCurrentById(id: string): T | null {
    const node = this.findNodeById(id);

    if (node === null) {
      return null;
    }

    this.current = node;
    return node.value;
  }

  public clearCurrent(): void {
    this.current = null;
  }

  public toggleCircular(): void {
    this.isCircular = !this.isCircular;
    this.syncCircularLinks();
  }

  public clear(): void {
    this.head = null;
    this.tail = null;
    this.current = null;
    this.length = 0;
  }

  public toArray(): T[] {
    const items: T[] = [];
    let cursor = this.head;

    for (let index = 0; index < this.length && cursor !== null; index += 1) {
      items.push(cursor.value);
      cursor = this.getLinearNext(cursor);
    }

    return items;
  }

  public size(): number {
    return this.length;
  }

  public isEmpty(): boolean {
    return this.length === 0;
  }

  private findNodeById(id: string): Node<T> | null {
    let cursor = this.head;

    for (let index = 0; index < this.length && cursor !== null; index += 1) {
      if (this.getNodeId(cursor.value) === id) {
        return cursor;
      }

      cursor = this.getLinearNext(cursor);
    }

    return null;
  }

  private getNodeAt(index: number): Node<T> | null {
    let cursor = this.head;

    for (let currentIndex = 0; currentIndex < index && cursor !== null; currentIndex += 1) {
      cursor = this.getLinearNext(cursor);
    }

    return cursor;
  }

  private getLinearNext(node: Node<T>): Node<T> | null {
    return node === this.tail ? null : node.next;
  }

  private getLinearPrev(node: Node<T>): Node<T> | null {
    return node === this.head ? null : node.prev;
  }

  private syncCircularLinks(): void {
    if (this.head === null || this.tail === null) {
      return;
    }

    if (this.isCircular) {
      this.head.prev = this.tail;
      this.tail.next = this.head;
      return;
    }

    this.head.prev = null;
    this.tail.next = null;
  }
}
