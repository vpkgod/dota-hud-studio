// Состояние редактора. Значения не меняются на месте: каждая правка создаёт новый объект.
const MERGE_MS = 500;
const HISTORY = 100;

export function createStore(initial, defaults) {
  let values = initial;
  let past = [];
  let future = [];
  let lastId = null;
  let lastTime = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(values));

  function remember() {
    past = [...past.slice(-(HISTORY - 1)), values];
    future = [];
  }

  return {
    get: () => values,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    defaults: () => defaults,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(id, value) {
      const now = Date.now();
      if (id !== lastId || now - lastTime > MERGE_MS) remember();
      lastId = id;
      lastTime = now;
      values = { ...values, [id]: value };
      notify();
    },
    replace(next) {
      remember();
      lastId = null;
      values = next;
      notify();
    },
    undo() {
      if (!past.length) return;
      future = [values, ...future];
      values = past[past.length - 1];
      past = past.slice(0, -1);
      lastId = null;
      notify();
    },
    redo() {
      if (!future.length) return;
      past = [...past, values];
      values = future[0];
      future = future.slice(1);
      lastId = null;
      notify();
    },
  };
}
