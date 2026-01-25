
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;

    constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 100) {
        this.factory = factory;
        this.reset = reset;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    get(): T {
        if (this.pool.length > 0) {
            const obj = this.pool.pop()!;
            this.reset(obj);
            return obj;
        }
        return this.factory();
    }

    release(obj: T) {
        this.pool.push(obj);
    }
}
