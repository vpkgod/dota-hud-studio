// Работа мышью в превью: выбор элемента, перетаскивание блоков, зум и движение вида.
const MAX_ZOOM = 6;
const FOCUS_MAX_ZOOM = 2.4;
const WHEEL_STEP = 1.15;
const SNAP_PX = 8;
const TOP_BAND_PX = 0; // кнопки вида стоят над сценой отдельной строкой и худ не закрывают
const DRAG_START_PX = 5;

export function createView(wrap, stage, getRatio, onChange) {
  let fit = 1;
  let zoom = 1;
  let tx = 0;
  let ty = 0;
  const stageWidth = () => Math.round(1080 * getRatio());

  function paint() {
    const scale = fit * zoom;
    stage.style.width = `${stageWidth()}px`;
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    onChange(zoom);
  }

  function center() {
    tx = (wrap.clientWidth - stageWidth() * fit) / 2;
    ty = TOP_BAND_PX + (wrap.clientHeight - TOP_BAND_PX - 1080 * fit) / 2;
  }

  function refit() {
    fit = Math.min(wrap.clientWidth / stageWidth(), (wrap.clientHeight - TOP_BAND_PX) / 1080);
    if (zoom === 1) center();
    paint();
  }

  function zoomAt(cx, cy, factor) {
    const next = Math.min(MAX_ZOOM, Math.max(1, zoom * factor));
    if (next === 1) { zoom = 1; center(); paint(); return; }
    const ratio = next / zoom;
    tx = cx - (cx - tx) * ratio;
    ty = cy - (cy - ty) * ratio;
    zoom = next;
    paint();
  }

  function fly() {
    stage.classList.add('flying');
    clearTimeout(fly.timer);
    fly.timer = setTimeout(() => stage.classList.remove('flying'), 400);
  }

  function focusOn(element) {
    fly();
    const box = wrap.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const scale = fit * zoom;
    const width = rect.width / scale;
    const height = rect.height / scale;
    const left = (rect.left - box.left - tx) / scale;
    const top = (rect.top - box.top - ty) / scale;
    const wanted = Math.min(wrap.clientWidth / (width * 1.25), wrap.clientHeight / (height * 1.25));
    zoom = Math.min(FOCUS_MAX_ZOOM, Math.max(1, wanted / fit));
    const finalScale = fit * zoom;
    tx = (wrap.clientWidth - width * finalScale) / 2 - left * finalScale;
    ty = (wrap.clientHeight - height * finalScale) / 2 - top * finalScale;
    paint();
  }

  return {
    refit, zoomAt, focusOn,
    scale: () => fit * zoom,
    zoom: () => zoom,
    reset() { fly(); zoom = 1; center(); paint(); },
    pan(dx, dy) { tx += dx; ty += dy; paint(); },
  };
}

const snap = (value, enabled) => (enabled && Math.abs(value) < SNAP_PX ? 0 : value);

function describeTarget(target, byId, groupsById) {
  const cid = target.dataset.c;
  if (cid && byId[cid]) return { name: byId[cid].label, where: byId[cid].sub || '' };
  const group = groupsById[target.closest('[data-tab]')?.dataset.tab];
  return { name: group ? group.title : '', where: '' };
}

export function wireStage({ wrap, stage, tip, view, store, byId, groupsById, groupOf, onPick }) {
  let drag = null;
  let pan = null;
  let spaceHeld = false;
  let selectedBlock = null;
  const offsetOf = (block) => (block && byId[`${block.dataset.b}.offset`] ? `${block.dataset.b}.offset` : null);

  function highlight(node) {
    stage.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
    if (node) node.classList.add('sel');
  }

  function select(event) {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const target = hit && hit.closest('[data-c],[data-b]');
    selectedBlock = hit ? hit.closest('[data-b]') : null;
    highlight(target);
    if (!target) return;
    const cid = target.dataset.c;
    const tab = (cid && groupOf[cid]) || target.closest('[data-tab]')?.dataset.tab;
    if (tab) onPick(tab, cid);
  }

  function startDrag(event, block) {
    const id = offsetOf(block);
    if (!id) return;
    drag = { id, x: event.clientX, y: event.clientY, start: store.get()[id], moved: false };
    stage.setPointerCapture(event.pointerId);
  }

  function startPan(event) {
    pan = { x: event.clientX, y: event.clientY };
    stage.classList.add('panning');
    stage.setPointerCapture(event.pointerId);
  }

  stage.addEventListener('pointerdown', (event) => {
    if (event.button === 1 || spaceHeld) { event.preventDefault(); startPan(event); return; }
    if (event.button !== 0) return;
    const block = event.target.closest('[data-b]');
    if (block) startDrag(event, block);
    else if (view.zoom() > 1) startPan(event);
  });

  stage.addEventListener('pointermove', (event) => {
    if (pan) {
      view.pan(event.clientX - pan.x, event.clientY - pan.y);
      pan = { x: event.clientX, y: event.clientY };
      return;
    }
    if (drag) { moveDrag(event); return; }
    showTip(event);
  });

  function moveDrag(event) {
    const dx = (event.clientX - drag.x) / view.scale();
    const dy = (event.clientY - drag.y) / view.scale();
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
    drag.moved = true;
    tip.hidden = true;
    const { min, max } = byId[drag.id];
    const place = (n) => snap(Math.round(Math.max(min, Math.min(max, n))), !event.altKey);
    store.set(drag.id, { x: place(drag.start.x + dx), y: place(drag.start.y + dy) });
  }

  function showTip(event) {
    const target = event.target.closest('[data-c],[data-b]');
    stage.querySelectorAll('.hover').forEach((n) => n.classList.remove('hover'));
    if (!target) { tip.hidden = true; return; }
    target.classList.add('hover');
    const { name, where } = describeTarget(target, byId, groupsById);
    tip.textContent = name;
    if (where) tip.append(Object.assign(document.createElement('small'), { textContent: where }));
    const box = wrap.getBoundingClientRect();
    tip.hidden = !name;
    tip.style.left = `${Math.min(event.clientX - box.left + 14, box.width - tip.offsetWidth - 6)}px`;
    tip.style.top = `${Math.max(4, event.clientY - box.top - 30)}px`;
  }

  stage.addEventListener('pointerup', (event) => {
    if (pan) { pan = null; stage.classList.remove('panning'); return; }
    const moved = drag && drag.moved;
    drag = null;
    if (!moved && event.button === 0) select(event);
  });
  stage.addEventListener('pointercancel', () => { drag = null; pan = null; stage.classList.remove('panning'); });
  wrap.addEventListener('pointerleave', () => {
    tip.hidden = true;
    stage.querySelectorAll('.hover').forEach((n) => n.classList.remove('hover'));
  });

  wrap.addEventListener('wheel', (event) => {
    event.preventDefault();
    const box = wrap.getBoundingClientRect();
    view.zoomAt(event.clientX - box.left, event.clientY - box.top, event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP);
  }, { passive: false });

  stage.addEventListener('dblclick', (event) => {
    const element = event.target.closest('[data-b]') || event.target.closest('[data-c]');
    if (element) view.focusOn(element);
  });

  const typing = (event) => event.target.matches('input,select,textarea');
  const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !typing(event)) { spaceHeld = true; event.preventDefault(); return; }
    const step = NUDGE[event.key];
    const id = offsetOf(selectedBlock);
    if (!step || !id || typing(event)) return;
    event.preventDefault();
    const size = event.shiftKey ? 10 : 1;
    const { x, y } = store.get()[id];
    store.set(id, { x: x + step[0] * size, y: y + step[1] * size });
  });
  window.addEventListener('keyup', (event) => { if (event.code === 'Space') spaceHeld = false; });
  return { highlight };
}
