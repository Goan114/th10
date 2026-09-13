import test from 'node:test';
import assert from 'node:assert/strict';
import {EaglerTouch} from '../site/runtime/eagler-touch.mjs';
import {InputSources} from '../site/runtime/input-sources.mjs';
import {installCanvasTouchBridge} from '../site/runtime/canvas-touch-bridge.mjs';

function harness() {
  const messages = [];
  let clock = 0;
  const input = new InputSources(() => {});
  const touch = new EaglerTouch({input, send: message => messages.push(message), now: () => clock});
  const viewport = {width: 1000, height: 600, rect: {left: 100, top: 0, width: 800, height: 600}};
  return {touch, input, messages, viewport, advance(ms) {clock += ms;}};
}

test('touch sources own only their keys and duplicate sequences are ignored', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch', touchFocusMode: 'two-finger'});
  h.touch.setContext('gameplay');
  h.touch.direct({action: 'down', id: 1, seq: 1, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'down', id: 2, seq: 1, x: .6, y: .5}, h.viewport);
  assert.equal(h.input.down.has('ShiftLeft'), true);
  const before = h.messages.length;
  h.touch.direct({action: 'move', id: 1, seq: 1, x: .55, y: .5}, h.viewport);
  assert.equal(h.messages.length, before, 'same sequence must not resample a move');
  h.touch.direct({action: 'up', id: 2, seq: 2, x: .6, y: .5}, h.viewport);
  assert.equal(h.input.down.has('ShiftLeft'), false);
  assert.equal(h.input.down.has('KeyZ'), false, 'releasing touch must not release keyboard-owned KeyZ');
  h.touch.direct({action: 'up', id: 1, seq: 2, x: .5, y: .5}, h.viewport);
});

test('contained coordinates exclude letterbox and scale drag by sensitivity', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch', touchSensitivity: 200});
  h.touch.setContext('gameplay');
  assert.equal(h.touch.direct({action: 'down', id: 1, x: .05, y: .5}, h.viewport), false);
  assert.equal(h.touch.direct({action: 'down', id: 99, x: 100, y: 300}, h.viewport), false, 'direct coordinates are always normalized');
  h.touch.direct({action: 'down', id: 1, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'move', id: 1, x: .6, y: .5}, h.viewport);
  const move = h.messages.find(message => message.type === 'touch-drag' && message.action === 'move');
  assert.deepEqual(move, {type: 'touch-drag', action: 'move', dx: 160, dy: 0});
});

test('real host movement and focus modes preserve analog values and ownership', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'joystick-free', touchFocusMode: 'hold-button', touchSensitivity: 175});
  const options = h.messages.at(-1);
  assert.equal(options.touchEnabled, true);
  assert.equal(options.touchMovementMode, 'joystick-free');
  assert.equal(options.touchFocusMode, 'hold-button');
  assert.equal(options.enabled, true);
  assert.equal(options.fire, true);
  assert.equal(options.movement, 'joystick');
  assert.equal(options.unlimitedTouch, false);
  assert.equal(options.joystickFree, true);
  assert.equal(options.touchSensitivity, 175);
  h.touch.setContext('gameplay');
  h.touch.controls({fireEnabled: true, focusEnabled: true, bombSerial: 1, escapeSerial: 1, joystickX: 12345, joystickY: -23456});
  assert.equal(h.input.down.has('ShiftLeft'), true);
  assert.equal(h.input.down.has('ArrowRight'), false, 'gameplay analog input stays native-owned');
  const controls = h.messages.at(-1);
  assert.equal(controls.joystickX, 12345);
  assert.equal(controls.joystickY, -23456);
  h.touch.cancel();
  assert.equal(h.input.down.has('ShiftLeft'), false, 'cancel clears host focus latch');
  h.touch.setContext('menu');
  h.touch.configure({touchEnabled: true, touchMovementMode: 'joystick', touchFocusMode: 'toggle-button'});
  h.touch.controls({fireEnabled: true, focusEnabled: false, bombSerial: 1, escapeSerial: 1, joystickX: 32767, joystickY: 32767});
  assert.equal(h.input.down.has('ArrowRight'), true);
  assert.equal(h.input.down.has('ArrowDown'), true);
});

test('menu swipe pulses directions, single tap confirms, two-finger tap returns', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch', touchFocusMode: 'two-finger'});
  h.touch.direct({action: 'down', id: 1, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'move', id: 1, x: .7, y: .5}, h.viewport);
  h.touch.direct({action: 'up', id: 1, x: .7, y: .5}, h.viewport);
  assert.equal(h.messages.some(message => message.type === 'pulse' && message.code === 'ArrowRight'), true);
  h.touch.direct({action: 'down', id: 2, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'up', id: 2, x: .5, y: .5}, h.viewport);
  assert.equal(h.messages.some(message => message.type === 'pulse' && message.code === 'KeyZ'), true);
  h.touch.direct({action: 'down', id: 3, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'down', id: 4, x: .6, y: .5}, h.viewport);
  h.touch.direct({action: 'up', id: 3, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'up', id: 4, x: .6, y: .5}, h.viewport);
  assert.equal(h.messages.some(message => message.type === 'pulse' && message.code === 'KeyX'), true);
});

test('dialogue tap advances and hold owns ControlLeft until release', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch', touchFocusMode: 'two-finger'});
  h.touch.setContext('dialogue');
  h.touch.direct({action: 'down', id: 1, x: .5, y: .5}, h.viewport);
  h.advance(100);
  h.touch.direct({action: 'up', id: 1, x: .5, y: .5}, h.viewport);
  assert.equal(h.messages.some(message => message.type === 'pulse' && message.code === 'KeyZ'), true);
  h.touch.direct({action: 'down', id: 2, x: .5, y: .5}, h.viewport);
  h.advance(500);
  h.touch.direct({action: 'move', id: 2, x: .5, y: .5}, h.viewport);
  assert.equal(h.input.down.has('ControlLeft'), true);
  h.touch.direct({action: 'up', id: 2, x: .5, y: .5}, h.viewport);
  assert.equal(h.input.down.has('ControlLeft'), false);
});

test('controls snapshots dedupe serials and replay marks native policy context', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch', touchFocusMode: 'two-finger', fireEnabled: true});
  const first = {fireEnabled: true, focusEnabled: false, bombSerial: 4, escapeSerial: 2, joystickX: 32768, joystickY: -32768, touchSensitivity: 300};
  assert.equal(h.touch.controls(first), true);
  assert.equal(h.touch.controls(first), false);
  const snapshot = h.messages.at(-1);
  assert.equal(snapshot.joystickX, 32767);
  assert.equal(snapshot.joystickY, -32768);
  h.touch.setContext('replay');
  h.touch.controls({...first, bombSerial: 5});
  const replay = h.messages.at(-1);
  assert.equal(replay.type, 'eagler-controls');
  assert.equal(replay.context, 'replay');
  assert.equal(replay.fireEnabled, true);
  assert.equal(replay.joystickX, 32767);
  assert.equal(replay.joystickY, -32768);
  assert.equal(h.touch.direct({action: 'down', id: 9, x: .5, y: .5}, h.viewport), false);
});

test('bomb serial pulses only once in gameplay and escape remains available in replay', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch'});
  h.touch.setContext('gameplay');
  h.touch.controls({fireEnabled: true, focusEnabled: false, bombSerial: 0, escapeSerial: 0, joystickX: 0, joystickY: 0});
  h.touch.controls({fireEnabled: true, focusEnabled: false, bombSerial: 1, escapeSerial: 0, joystickX: 0, joystickY: 0});
  assert.equal(h.messages.filter(message => message.type === 'pulse' && message.code === 'KeyX').length, 1);
  h.touch.controls({fireEnabled: true, focusEnabled: false, bombSerial: 1, escapeSerial: 0, joystickX: 0, joystickY: 0});
  assert.equal(h.messages.filter(message => message.type === 'pulse' && message.code === 'KeyX').length, 1);
  h.touch.setContext('replay');
  h.touch.controls({fireEnabled: true, focusEnabled: false, bombSerial: 2, escapeSerial: 1, joystickX: 0, joystickY: 0});
  assert.equal(h.messages.filter(message => message.type === 'pulse' && message.code === 'KeyX').length, 1);
  assert.equal(h.messages.filter(message => message.type === 'pulse' && message.code === 'Escape').length, 1);
});

test('cancel and context changes reapply held controls without replaying serial edges', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch'});
  h.touch.setContext('gameplay');
  const controls = {fireEnabled: true, focusEnabled: true, bombSerial: 3, escapeSerial: 4, joystickX: 0, joystickY: 0};
  h.touch.controls(controls);
  const pulsesBefore = h.messages.filter(message => message.type === 'pulse').length;
  h.touch.cancel();
  assert.equal(h.input.down.has('ShiftLeft'), false);
  h.touch.controls(controls);
  assert.equal(h.input.down.has('ShiftLeft'), true);
  assert.equal(h.messages.filter(message => message.type === 'pulse').length, pulsesBefore);
  h.touch.setContext('menu');
  assert.equal(h.input.down.has('ShiftLeft'), false);
  h.touch.controls(controls);
  assert.equal(h.input.down.has('ArrowUp'), false);
  assert.equal(h.messages.filter(message => message.type === 'pulse').length, pulsesBefore);
});

test('cancel releases touch ownership and sends one native cancellation', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true, touchMovementMode: 'touch', touchFocusMode: 'two-finger'});
  h.touch.setContext('gameplay');
  h.touch.direct({action: 'down', id: 1, x: .5, y: .5}, h.viewport);
  h.touch.direct({action: 'down', id: 2, x: .6, y: .5}, h.viewport);
  h.touch.cancel();
  assert.equal(h.input.down.size, 0);
  assert.equal(h.messages.at(-1).type, 'touch-cancel');
  assert.equal(h.touch.direct({action: 'move', id: 1, seq: 4, x: .7, y: .5}, h.viewport), false);
});

test('a swipe made of small pointer deltas does not confirm on release', () => {
  const h=harness();h.touch.configure({touchEnabled:true});
  h.touch.direct({type:'down',id:1,x:.5,y:.5},h.viewport);
  for(let i=1;i<=8;i++)h.touch.direct({type:'move',id:1,x:.5+i*.01,y:.5},h.viewport);
  h.touch.direct({type:'up',id:1,x:.58,y:.5},h.viewport);
  const pulses=h.messages.filter(m=>m.type==='pulse');
  assert(pulses.some(m=>m.code==='ArrowRight'));assert(!pulses.some(m=>m.code==='KeyZ'));h.touch.dispose();
});

test('runtime canvas forwards ordinary touch pointers into menu gestures', () => {
  const h = harness();
  h.touch.configure({touchEnabled: true});
  const listeners = new Map();
  const captured = new Set();
  const viewportRefreshes = [];
  const canvas = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    setPointerCapture(id) { captured.add(id); },
    releasePointerCapture(id) { captured.delete(id); },
    focus() {},
  };
  const bridge = installCanvasTouchBridge({
    canvas,
    touch: h.touch,
    getViewport: force => { viewportRefreshes.push(force === true); return h.viewport; },
  });
  const event = (pointerId, clientX, clientY, pointerType = 'touch') => ({
    pointerId, clientX, clientY, pointerType, preventDefault() {},
  });

  listeners.get('pointerdown')(event(7, 500, 300));
  listeners.get('pointermove')(event(7, 700, 300));
  listeners.get('pointerup')(event(7, 700, 300));
  assert.equal(h.messages.some(message => message.type === 'pulse' && message.code === 'ArrowRight'), true);
  assert.equal(captured.has(7), false);
  assert.deepEqual(viewportRefreshes, [true, false, false], 'only the first pointer refreshes layout during a gesture');

  const before = h.messages.length;
  listeners.get('pointerdown')(event(8, 500, 300, 'mouse'));
  listeners.get('pointerup')(event(8, 500, 300, 'mouse'));
  assert.equal(h.messages.length, before, 'mouse input must stay with the keyboard/mouse path');
  bridge.dispose();
  assert.equal(listeners.size, 0);
});
