export class Node<T> {
  public value: T;
  public next: Node<T> | null;
  public prev: Node<T> | null;

  constructor(value: T) {
    this.value = value;
    this.next = null;
    this.prev = null;
  }
}
