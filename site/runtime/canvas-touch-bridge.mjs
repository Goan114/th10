// Own direct touch input that lands inside the TH10 Runtime iframe.
// Launcher-side forwarding remains responsible for platforms such as iOS
// where the parent document must own the complete multi-touch sequence.

function pointerMessage(event, viewport) {
  const width = Number(viewport.width);
  const height = Number(viewport.height);
  if (!(width > 0) || !(height > 0)) return null;
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
  return {
    id: event.pointerId,
    x: event.clientX / width,
    y: event.clientY / height,
  };
}

export function installCanvasTouchBridge({canvas, touch, getViewport, isActive = () => true, onInteraction = () => {}} = {}) {
  if (!canvas || typeof canvas.addEventListener !== 'function' || typeof canvas.removeEventListener !== 'function') {
    throw new TypeError('Canvas touch bridge requires an EventTarget canvas');
  }
  if (!touch || typeof touch.direct !== 'function' || typeof touch.cancel !== 'function') {
    throw new TypeError('Canvas touch bridge requires an EaglerTouch-compatible adapter');
  }
  if (typeof getViewport !== 'function' || typeof isActive !== 'function' || typeof onInteraction !== 'function') {
    throw new TypeError('Canvas touch bridge callbacks must be functions');
  }

  const pointers = new Set();

  const begin = event => {
    if (!isActive() || event.pointerType === 'mouse' || pointers.has(event.pointerId)) return;
    const viewport = getViewport(pointers.size === 0);
    const message = pointerMessage(event, viewport);
    if (!message || !touch.direct({type: 'down', ...message}, viewport)) return;
    pointers.add(event.pointerId);
    event.preventDefault?.();
    try { canvas.setPointerCapture?.(event.pointerId); } catch {}
    if (pointers.size === 1 && canvas.ownerDocument?.activeElement !== canvas) canvas.focus?.({preventScroll: true});
    onInteraction();
  };

  const move = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault?.();
    const viewport = getViewport();
    const message = pointerMessage(event, viewport);
    if (message) touch.direct({type: 'move', ...message}, viewport);
  };

  const end = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault?.();
    pointers.delete(event.pointerId);
    const viewport = getViewport();
    const message = pointerMessage(event, viewport);
    touch.direct(message ? {type: 'up', ...message} : {type: 'up', id: event.pointerId}, viewport);
    try { canvas.releasePointerCapture?.(event.pointerId); } catch {}
  };

  const cancel = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault?.();
    pointers.clear();
    touch.cancel();
  };

  canvas.addEventListener('pointerdown', begin);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);

  return {
    reset() { pointers.clear(); },
    dispose() {
      canvas.removeEventListener('pointerdown', begin);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', cancel);
      pointers.clear();
    },
  };
}
