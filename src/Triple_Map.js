'use strict';


class Triple_Map extends Map {
  has(key1, key2, key3) {
    if (!key1) throw new RangeError('First key must be supplied to has() method.');
    if (!key2 && !key3) return super.has(key1);
    if (!key3) return (super.has(key1) && super.get(key1).has(key2));
    return (super.has(key1) && super.get(key1).has(key2) && super.get(key1).get(key2).has(key3));
  }

  get(key1, key2, key3) {
    if (!key1) throw new RangeError('First key must be supplied to get() method.');
    if (!this.has(key1)) super.set(key1, new Map());
    if (!!key1 && !!key2 && !this.has(key1, key2)) super.get(key1).set(key2, new Map());
    if (!key2 && !key3) return super.get(key1);
    if (!key3) return super.get(key1).get(key2);
    return super.get(key1).get(key2).get(key3);
  }

  set(key1, key2, key3, value) {
    if (!key1 || !key2 || !key3) throw new RangeError('All three keys must be supplied to set() method.');
    return this.get(key1, key2).set(key3, value);
  }

  delete(key1, key2, key3) {
    if (!key1 || !key2 || !key3) throw new RangeError('All three keys must be supplied to delete() method.');
    return this.get(key1, key2).delete(key3);
  }

  keys(key1, key2) {
    if (!key1) throw new RangeError('First key must be supplied to keys() method.');
    if (!key2) return this.get(key1).keys();
    return this.get(key1, key2).keys();
  }

  values(key1, key2) {
    if (!key1) throw new RangeError('First key must be supplied to values() method.');
    if (!key2) return this.get(key1).values();
    return this.get(key1, key2).values();
  }

  entries(key1, key2) {
    if (!key1) throw new RangeError('First key must be supplied to entries() method.');
    if (!key2) return this.get(key1).entries();
    return this.get(key1, key2).entries();
  }

  get size() {
    let size = 0;
    [...super.keys()].forEach(key1=>
      [...super.get(key1).keys()].forEach(key2=>{
        size += super.get(key1).get(key2).size;
      })
    );
    return size;
  }

  get [Symbol.toStringTag]() {
    return 'Triple_Map';
  }
}

module.exports = Triple_Map;