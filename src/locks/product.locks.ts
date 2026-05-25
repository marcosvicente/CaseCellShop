import { Mutex } from "async-mutex";

export class ProductLockManager {
  private readonly locks = new Map<string, Mutex>();

  getMutex(productId: string): Mutex {
    let mutex = this.locks.get(productId);
    if (!mutex) {
      mutex = new Mutex();
      this.locks.set(productId, mutex);
    }
    return mutex;
  }
}
