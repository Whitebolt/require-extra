'use strict';


class Private extends WeakMap {
  constructor(...params) {
    super(...params);
    this.Constructor = Map;
    this.constructorParams = [];
  }

  get(ref, key) {
    if (!super.has(ref)) super.set(ref, new this.Constructor(...this.constructorParams));
    if (!key) return super.get(ref);
    return super.get(ref).get(key);
  }

  set(ref, key, value) {
    return this.get(ref).set(key, value);
  }

  has(ref, key) {
    if (!key) return super.has(ref);
    if (super.has(ref)) return super.get(ref).has(key);
    return false;
  }

  delete(ref, key) {
    if (!key && super.has(ref)) return super.delete(ref);
    if (super.has(ref) && super.get(ref).has(ref)) return super.get(ref).delete(key);
    return false;
  }

  clear(ref) {
    if (!ref) throw new RangeError('A reference object must be supplied to the clear() method.');
    if (super.has(ref)) super.get(ref).clear();
  }

  values(ref) {
    if (!ref) throw new RangeError('A reference object must be supplied to the values() method.');
    return this.get(ref).values();
  }

  keys(ref) {
    if (!ref) throw new RangeError('A reference object must be supplied to the keys() method.');
    return this.get(ref).keys();
  }

  entries(ref) {
    if (!ref) throw new RangeError('A reference object must be supplied to the entries() method.');
    return this.get(ref).values();
  }

  get [Symbol.toStringTag]() {
    return 'Private';
  }
}

module.exports = Private;