import test from 'node:test';
import assert from 'node:assert/strict';
import {WebGLD3D9} from '../site/runtime/webgl.mjs';
import {Direct3D9} from '../site/runtime/d3d9.mjs';

function renderer() {
  const calls=[];
  const r=Object.create(WebGLD3D9.prototype);
  Object.assign(r,{stats:{calls:0},batchEnabled:true,stateValues:new Map(),uniformValues:new Map(),program:{},uniforms:new Map([['world',1]])});
  r.gl=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args])});
  r.draw=d=>calls.push({ ...d,vertices:d.vertices.slice(),instanceWorlds:d.instanceWorlds?.slice() });
  return {r,calls};
}
function packet(overrides={}) {
  return {fvf:0x44,stride:20,primitive:5,count:2,vertices:new Uint8Array(80).fill(7),
    viewport:new Uint8Array(24),states:new Map(),stages:new Map(),transforms:new Map(),...overrides};
}

test('uniform cache owns mutable matrices and is independent for each program',()=>{
  const {r,calls}=renderer(),matrix=new Float32Array(16),first=r.program;
  r.set('world','uniformMatrix4fv',false,matrix);
  r.set('world','uniformMatrix4fv',false,matrix);
  assert.equal(calls.length,1);
  matrix[12]=4;r.set('world','uniformMatrix4fv',false,matrix);
  assert.equal(calls.length,2);
  r.program={};r.set('world','uniformMatrix4fv',false,matrix);
  assert.equal(calls.length,3);
  r.program=first;r.set('world','uniformMatrix4fv',false,matrix);
  r.set('optimizedOut','uniform1i',1);
  assert.equal(calls.length,3);
  r.state('viewport',0,0,640,480);r.state('viewport',0,0,640,480);
  r.state('viewport',0,0,320,240);
  assert.equal(calls.length,5);
});

test('ordinary batches retain vertices when the native source is reused',()=>{
  const {r,calls}=renderer(),d=packet();r.queue(d);d.vertices.fill(9);r.queue(d);d.vertices.fill(0);r.flush();
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].vertices,new Uint8Array([...new Uint8Array(120).fill(7),...new Uint8Array(120).fill(9)]));
});

test('instanced batches retain geometry across source reuse and state boundaries',()=>{
  const {r,calls}=renderer(),d=packet({fvf:0x102,transforms:new Map([[256,new Uint8Array(64)]])});
  r.queue(d);r.queue({...d,transforms:new Map([[256,new Uint8Array(64).fill(1)]])});
  d.vertices.fill(9);r.queue(d);d.vertices.fill(0);r.flush();
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0].vertices,new Uint8Array(80).fill(7));
  assert.equal(calls[0].instanceWorlds.length,136);
  assert.deepEqual(calls[1].vertices,new Uint8Array(80).fill(9));
});

test('Direct3D keeps owned snapshots unless a synchronous renderer opts in',()=>{
  const bytes=new Uint8Array(200).fill(7),d=Object.create(Direct3D9.prototype);
  Object.assign(d,{m:{view:(a,n)=>bytes.subarray(a,a+n),bytes:(a,n)=>bytes.slice(a,a+n)},draws:[],device:{textures:new Map(),target:{address:1},states:new Map(),stages:new Map(),transforms:new Map()}});
  d.draw(4,1,0,20);bytes.fill(9);
  assert.deepEqual(d.draws[0].vertices,new Uint8Array(60).fill(7));
  d.borrowDrawVertices=true;d.draw(4,1,0,20);bytes.fill(8);
  assert.deepEqual(d.draws[1].vertices,new Uint8Array(60).fill(9),'record-only consumer must still own its data');
  d.onDraw=draw=>assert.equal(draw.vertices.buffer,bytes.buffer);
  d.draw(4,1,0,20);
});

test('FBO attachments track depth and stencil identity independently per target',()=>{
  const {r,calls}=renderer(),surfaces=new Map([[1,{}],[2,{}]]);
  r.gl={FRAMEBUFFER:1,DEPTH_ATTACHMENT:2,STENCIL_ATTACHMENT:3,RENDERBUFFER:4,
    bindFramebuffer(){},framebufferRenderbuffer:(_,attachment,__,buffer)=>calls.push([attachment,buffer])};
  r.d3d={com:new Map([[1,{address:1}],[2,{address:2}]])};r.surface=s=>surfaces.get(s.address);
  const depth={},stencil={};r.depths=new Map([[10,{buffer:depth}],[11,{buffer:stencil,stencil:true}]]);
  r.target(1,10);r.target(1,10);assert.equal(calls.length,2);
  r.target(2,10);assert.equal(calls.length,4);
  r.target(1,11);assert.deepEqual(calls.slice(-2),[[2,stencil],[3,stencil]]);
  r.target(1,10);assert.deepEqual(calls.slice(-2),[[2,depth],[3,null]]);
  r.target(1);assert.deepEqual(calls.at(-1),[2,null]);
});
