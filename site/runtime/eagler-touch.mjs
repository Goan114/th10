// Host touch adapter for the TH10 Eagler runtime.
//
import {directionKeys} from './input-sources.mjs';

// Pointer ownership stays in this module. Keyboard input therefore keeps its
// own InputSources entry, while touch focus and dialogue hold use entries that
// can be released without touching a physical keyboard key.

const CONTEXTS = new Set(['menu', 'gameplay', 'dialogue', 'replay']);
const ACTIONS = new Set(['down', 'move', 'up', 'cancel']);
const MENU_SWIPE = 26;
const TAP_MS = 220;
const DOUBLE_TAP_GAP_MS = 320;
const HOLD_MS = 500;
const DEFAULTS = {
  enabled: false,
  fire: true,
  focusEnabled: false,
  focus: 'two-finger',
  sensitivity: 100,
  doubleTapBombEnabled: false,
  movement: 'drag',
  unlimitedTouch: false,
  joystickFree: false,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback = 0) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;

function normalizedSensitivity(value) {
  return clamp(number(value, 100), 50, 300);
}

function movementMode(value) {
  if (value === 'touch-unlimited') return {movement: 'drag', unlimitedTouch: true, joystickFree: false};
  if (value === 'joystick-free') return {movement: 'joystick', unlimitedTouch: false, joystickFree: true};
  if (value === 'joystick') return {movement: 'joystick', unlimitedTouch: false, joystickFree: false};
  return {movement: 'drag', unlimitedTouch: false, joystickFree: false};
}

function movementModeName(options) {
  if (options.joystickFree) return 'joystick-free';
  if (options.movement === 'joystick') return 'joystick';
  if (options.unlimitedTouch) return 'touch-unlimited';
  return 'touch';
}

function focusMode(value) {
  if (value === 'hold-button') return 'hold';
  if (value === 'toggle-button') return 'toggle';
  return 'two-finger';
}

function focusModeName(value) {
  if (value === 'hold') return 'hold-button';
  if (value === 'toggle') return 'toggle-button';
  return 'two-finger';
}

function normalizedId(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

export function normalizedAction(message) {
  const value = String(message?.action ?? message?.type ?? '').toLowerCase();
  if (value === 'pointerdown') return 'down';
  if (value === 'pointermove') return 'move';
  if (value === 'pointerup' || value === 'pointercancel' || value === 'lostpointercapture') return 'up';
  return ACTIONS.has(value) ? value : null;
}

function equalSnapshot(a, b) {
  return !!a && !!b && Object.keys(b).every(key => a[key] === b[key]);
}

export class EaglerTouch {
  constructor({input, send = () => {}, now = () => globalThis.performance?.now?.() ?? Date.now()} = {}) {
    if (!input || typeof input.set !== 'function' || !(input.down instanceof Set)) {
      throw new TypeError('EaglerTouch requires InputSources-compatible input');
    }
    if (typeof send !== 'function' || typeof now !== 'function') {
      throw new TypeError('EaglerTouch send and now must be functions');
    }
    this.input = input;
    this.send = send;
    this.now = now;
    this.context = 'menu';
    this.options = {...DEFAULTS};
    this.pointers = new Map();
    this.menuGesture = null;
    this.movePointer = null;
    this.lastTap = null;
    this.lastSequences = new Map();
    this.lastControls = null;
    this.controlsApplied = false;
    this.disposed = false;
  }

  configure(options = {}) {
    if (this.disposed) return this;
    if (typeof options !== 'object' || options === null) options = {};
    const wasEnabled = this.options.enabled;
    const oldMode = movementModeName(this.options);
    if ('enabled' in options) this.options.enabled = !!options.enabled;
    if ('touchEnabled' in options) this.options.enabled = !!options.touchEnabled;
    if ('fire' in options) this.options.fire = !!options.fire;
    if ('fireEnabled' in options) this.options.fire = !!options.fireEnabled;
    if ('focusEnabled' in options) this.options.focusEnabled = !!options.focusEnabled;
    const oldFocus = this.options.focus;
    if ('touchFocusMode' in options) this.options.focus = focusMode(options.touchFocusMode);
    if ('touchMovementMode' in options) Object.assign(this.options, movementMode(options.touchMovementMode));
    if ('movement' in options && ['drag', 'joystick'].includes(options.movement)) this.options.movement = options.movement;
    if ('unlimitedTouch' in options) this.options.unlimitedTouch = !!options.unlimitedTouch;
    if ('joystickFree' in options) this.options.joystickFree = !!options.joystickFree;
    if ('touchSensitivity' in options) {
      this.options.sensitivity = normalizedSensitivity(options.touchSensitivity);
    }
    if ('doubleTapBombEnabled' in options) this.options.doubleTapBombEnabled = !!options.doubleTapBombEnabled;

    const modeChanged = oldMode !== movementModeName(this.options);
    if (oldFocus !== this.options.focus || modeChanged || (wasEnabled && !this.options.enabled)) this.cancel();
    this.syncOptions();
    return this;
  }

  setContext(context) {
    if (!CONTEXTS.has(context)) throw new RangeError(`invalid touch context: ${context}`);
    if (this.disposed) return this;
    if (context === this.context) {
      this.reapplyControls();
      return this;
    }
    this.cancel();
    this.context = context;
    this.lastTap = null;
    this.syncOptions();
    this.reapplyControls();
    return this;
  }

  // Forward the host's control snapshot without reducing an analog vector to
  // direction keys. The native-game owner applies replay and movement policy.
  controls(message = {}) {
    if (this.disposed || !message || typeof message !== 'object') return false;
    const oldSensitivity = this.options.sensitivity;
    if ('fireEnabled' in message && this.options.fire !== !!message.fireEnabled) {
      this.options.fire = !!message.fireEnabled;
      this.syncOptions();
    }
    if ('focusEnabled' in message) this.options.focusEnabled = !!message.focusEnabled;
    if ('touchSensitivity' in message) {
      this.options.sensitivity = normalizedSensitivity(message.touchSensitivity);
      if (this.options.sensitivity !== oldSensitivity) this.syncOptions();
    }
    const snapshot = {
      fireEnabled: 'fireEnabled' in message ? !!message.fireEnabled : this.options.fire,
      focusEnabled: 'focusEnabled' in message ? !!message.focusEnabled : this.options.focusEnabled,
      bombSerial: integer(message.bombSerial, this.lastControls?.bombSerial ?? 0),
      escapeSerial: integer(message.escapeSerial, this.lastControls?.escapeSerial ?? 0),
      joystickX: clamp(integer(message.joystickX), -32768, 32767),
      joystickY: clamp(integer(message.joystickY), -32768, 32767),
      touchSensitivity: this.options.sensitivity,
      context: this.context,
    };
    const previous = this.lastControls;
    const same = equalSnapshot(previous, snapshot);
    if (same && this.controlsApplied) return false;
    this.lastControls = snapshot;
    this.applyControls(snapshot);
    const previousBombSerial = previous?.bombSerial ?? 0;
    const previousEscapeSerial = previous?.escapeSerial ?? 0;
    if (!same && previousBombSerial !== snapshot.bombSerial && this.context === 'gameplay') this.pulse('KeyX');
    if (!same && previousEscapeSerial !== snapshot.escapeSerial) this.pulse('Escape', 2, {allowReplay: true});
    this.send({type: 'eagler-controls', command: 'touch-controls', context: this.context, ...snapshot});
    return true;
  }

  // Receive a host direct-touch event. x/y are normalized to the viewport;
  // rect describes the contained 4:3 game image and excludes letterbox bars.
  direct(message = {}, viewport = {}) {
    if (this.disposed || !message || typeof message !== 'object') return false;
    const action = normalizedAction(message);
    if (!action) return false;
    if (action === 'cancel') {
      this.cancel();
      return true;
    }
    const id = normalizedId(message.id ?? message.pointerId);
    if (id === null) return false;

    if (this.context === 'replay' || !this.options.enabled) return false;
    const point = this.point(message, viewport);
    const pointer = this.pointers.get(id);
    if (action === 'down' && !point) return false;

    const sequence = message.sequence ?? message.seq ?? message.eventSequence;
    const hasSequence = Number.isSafeInteger(Number(sequence));
    const seq = hasSequence ? Number(sequence) : null;
    const previousSequence = this.lastSequences.get(id);
    if (hasSequence && action !== 'down' && previousSequence !== undefined && seq <= previousSequence) return false;
    if (hasSequence && action === 'down' && previousSequence !== undefined && seq <= previousSequence) return false;
    if (hasSequence) this.lastSequences.set(id, seq);
    if (action === 'down') {
      if (!point) return false;
      if (pointer) this.dropPointer(id);
      return this.beginPointer(id, point);
    }
    if (!pointer) return false;
    if (action === 'move') {
      if (!point) return false;
      return this.movePointerEvent(id, pointer, point);
    }
    // An UP outside the contained image still terminates the owned gesture.
    return this.endPointer(id, pointer, point ?? {x: pointer.x, y: pointer.y});
  }

  cancel() {
    if (this.disposed) return this;
    for (const id of [...this.pointers.keys()]) this.dropPointer(id);
    this.pointers.clear();
    this.menuGesture = null;
    this.movePointer = null;
    this.lastTap = null;
    this.setHostFocus(false);
    this.input.set('touch:joystick', []);
    this.lastSequences.clear();
    this.controlsApplied = false;
    this.send({type: 'touch-cancel'});
    return this;
  }

  dispose() {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    this.send({type: 'touch-options', enabled: false, fire: false,
      focusEnabled: false, touchSensitivity: this.options.sensitivity,
      movement: this.options.movement, touchEnabled: false,
      touchMovementMode: movementModeName(this.options), touchFocusMode: focusModeName(this.options.focus),
      unlimitedTouch: this.options.unlimitedTouch,
      joystickFree: this.options.joystickFree, doubleTapBombEnabled: this.options.doubleTapBombEnabled});
    this.lastControls = null;
  }

  syncOptions() {
    if (this.disposed) return;
    const enabled = this.options.enabled && this.context !== 'replay';
    this.send({type: 'touch-options', enabled, fire: enabled && this.options.fire,
      focusEnabled: this.options.focusEnabled,
      touchSensitivity: this.options.sensitivity,
      movement: this.options.movement,
      touchEnabled: enabled, touchMovementMode: movementModeName(this.options),
      touchFocusMode: focusModeName(this.options.focus), unlimitedTouch: this.options.unlimitedTouch,
      joystickFree: this.options.joystickFree,
      doubleTapBombEnabled: this.options.doubleTapBombEnabled});
  }

  applyControls(snapshot) {
    this.setHostFocus(snapshot.focusEnabled);
    this.setMenuJoystick(snapshot.joystickX, snapshot.joystickY);
    this.controlsApplied = true;
  }

  reapplyControls() {
    if (!this.lastControls) return;
    const snapshot = {...this.lastControls, context: this.context};
    this.lastControls = snapshot;
    this.applyControls(snapshot);
    this.send({type: 'eagler-controls', command: 'touch-controls', context: this.context, ...snapshot});
  }

  source(id) {
    return `touch:pointer:${id}`;
  }

  setSource(id, codes) {
    this.input.set(this.source(id), codes);
  }

  pulse(code, frames = 2, {allowReplay = false} = {}) {
    if ((this.context === 'replay' && !allowReplay) || this.disposed) return false;
    // This message has independent duration semantics from InputSources, so
    // a touch pulse cannot release a simultaneously held keyboard key.
    this.send({type: 'pulse', code, frames});
    return true;
  }

  point(message, viewport) {
    const width = number(viewport.width, 0);
    const height = number(viewport.height, 0);
    const rect = viewport.rect && typeof viewport.rect === 'object' ? viewport.rect : {};
    const rectWidth = number(rect.width, width);
    const rectHeight = number(rect.height, height);
    if (!(width > 0 && height > 0 && rectWidth > 0 && rectHeight > 0)) return null;
    const x = number(message.x ?? message.clientX, NaN);
    const y = number(message.y ?? message.clientY, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // Host direct-touch is always normalized to the viewport. Do not accept
    // client pixels here: that would make black-bar containment ambiguous.
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    const px = x * width;
    const py = y * height;
    const left = number(rect.left, 0);
    const top = number(rect.top, 0);
    if (px < left || py < top || px > left + rectWidth || py > top + rectHeight) return null;
    return {
      x: clamp((px - left) / rectWidth, 0, 1),
      y: clamp((py - top) / rectHeight, 0, 1),
    };
  }

  setHostFocus(enabled) {
    this.input.set('touch:host-focus', enabled && this.context === 'gameplay' ? ['ShiftLeft'] : []);
  }

  setMenuJoystick(x, y) {
    if (this.context !== 'menu') {
      this.input.set('touch:joystick', []);
      return;
    }
    const horizontal = clamp(x / 32768, -1, 1);
    const vertical = clamp(y / 32768, -1, 1);
    this.input.set('touch:joystick', directionKeys(horizontal, vertical));
  }

  beginPointer(id, point) {
    const started = this.now();
    const pointer = {id, x: point.x, y: point.y, startX: point.x, startY: point.y, started, moved: false, held: false, timer: null, gesture: null};
    this.pointers.set(id, pointer);
    if (this.context === 'menu') {
      if (!this.menuGesture) this.menuGesture = {ids: new Set(), max: 0, moved: false};
      pointer.gesture = this.menuGesture;
      this.menuGesture.ids.add(id);
      this.menuGesture.max = Math.max(this.menuGesture.max, this.menuGesture.ids.size);
      return true;
    }
    if (this.context === 'dialogue') {
      pointer.timer = setTimeout(() => {
        if (this.pointers.get(id) === pointer && !pointer.moved) {
          pointer.held = true;
          this.setSource(id, ['ControlLeft']);
        }
      }, HOLD_MS);
      return true;
    }
    if (this.context !== 'gameplay') return true;
    if (this.movePointer === null) {
      this.movePointer = id;
      this.send({type: 'touch-drag', action: 'down'});
    } else if (this.options.focus === 'two-finger') {
      this.setSource(id, ['ShiftLeft']);
    }
    return true;
  }

  movePointerEvent(id, pointer, point) {
    if (this.context === 'dialogue' && !pointer.held && !pointer.moved && this.now() - pointer.started >= HOLD_MS) {
      pointer.held = true;
      if (pointer.timer) clearTimeout(pointer.timer);
      pointer.timer = null;
      this.setSource(id, ['ControlLeft']);
    }
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    pointer.x = point.x;
    pointer.y = point.y;
    const moved = Math.hypot((point.x - pointer.startX) * 640, (point.y - pointer.startY) * 480) >= MENU_SWIPE;
    if (moved) pointer.moved = true;
    if (this.context === 'dialogue') {
      if (pointer.moved && pointer.timer) {
        clearTimeout(pointer.timer);
        pointer.timer = null;
      }
      return true;
    }
    if (this.context === 'menu') {
      const gesture = pointer.gesture;
      if (moved) gesture.moved = true;
      if (!gesture || gesture.ids.size > 1) return true;
      const totalX = (point.x - pointer.startX) * 640;
      const totalY = (point.y - pointer.startY) * 480;
      if (Math.abs(totalX) >= MENU_SWIPE || Math.abs(totalY) >= MENU_SWIPE) {
        gesture.moved = true;pointer.moved = true;
        this.pulse(Math.abs(totalX) > Math.abs(totalY) ? (totalX < 0 ? 'ArrowLeft' : 'ArrowRight') : (totalY < 0 ? 'ArrowUp' : 'ArrowDown'));
        pointer.startX = point.x;
        pointer.startY = point.y;
      }
      return true;
    }
    if (this.context === 'gameplay' && this.movePointer === id) {
      const sensitivity = this.options.sensitivity / 100;
      const dragX = clamp(dx * 640 * sensitivity, -640, 640);
      const dragY = clamp(dy * 480 * sensitivity, -480, 480);
      if (dragX || dragY) this.send({type: 'touch-drag', action: 'move', dx: dragX, dy: dragY});
    }
    return true;
  }

  endPointer(id, pointer, point) {
    if (this.context === 'dialogue') {
      if (pointer.timer) clearTimeout(pointer.timer);
      const elapsed = Math.max(0, this.now() - pointer.started);
      const stationary = !pointer.moved && Math.hypot((point.x - pointer.startX) * 640, (point.y - pointer.startY) * 480) <= MENU_SWIPE;
      if (pointer.held) this.setSource(id, []);
      else if (elapsed < HOLD_MS && stationary) this.pulse('KeyZ');
    } else if (this.context === 'menu') {
      const gesture = pointer.gesture;
      if (gesture) {
        gesture.ids.delete(id);
        if (gesture.ids.size === 0) {
          if (!gesture.moved) this.pulse(gesture.max >= 2 ? 'KeyX' : 'KeyZ');
          this.menuGesture = null;
        }
      }
    } else if (this.context === 'gameplay') {
      if (this.movePointer === id) {
        this.movePointer = null;
        this.send({type: 'touch-drag', action: 'up'});
      }
      this.setSource(id, []);
      const elapsed = Math.max(0, this.now() - pointer.started);
      const stationary = !pointer.moved && Math.hypot((point.x - pointer.startX) * 640, (point.y - pointer.startY) * 480) <= MENU_SWIPE;
      if (this.options.doubleTapBombEnabled && stationary && elapsed <= TAP_MS) {
        const current = {x: point.x, y: point.y, time: this.now()};
        const close = this.lastTap && current.time - this.lastTap.time <= DOUBLE_TAP_GAP_MS &&
          Math.hypot((current.x - this.lastTap.x) * 640, (current.y - this.lastTap.y) * 480) <= 52;
        if (close) {
          this.pulse('KeyX');
          this.lastTap = null;
        } else this.lastTap = current;
      }
    }
    this.pointers.delete(id);
    return true;
  }

  dropPointer(id) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    if (pointer.timer) clearTimeout(pointer.timer);
    this.setSource(id, []);
    if (this.movePointer === id) {
      this.movePointer = null;
      this.send({type: 'touch-drag', action: 'up'});
    }
    if (pointer.gesture) pointer.gesture.ids.delete(id);
    this.pointers.delete(id);
  }
}
