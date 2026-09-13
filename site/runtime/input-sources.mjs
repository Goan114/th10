// Track each finger/keyboard key independently, feeding the original DirectInput keys.
export class InputSources {
  constructor(emit){this.emit=emit;this.sources=new Map();this.down=new Set();}
  set(source,codes){
    const next=new Set(codes);if(next.size)this.sources.set(source,next);else this.sources.delete(source);
    const combined=new Set();for(const keys of this.sources.values())for(const key of keys)combined.add(key);
    for(const key of this.down)if(!combined.has(key))this.emit(key,false,source);
    for(const key of combined)if(!this.down.has(key))this.emit(key,true,source);
    this.down=combined;
  }
  clear(){for(const key of this.down)this.emit(key,false);this.sources.clear();this.down.clear();}
}
export function directionKeys(x,y,deadZone=.18){
  const length=Math.hypot(x,y);if(!Number.isFinite(length)||length<deadZone)return [];
  const keys=[],edge=Math.SQRT2-1;
  if(Math.abs(x)>=Math.abs(y)*edge)keys.push(x<0?'ArrowLeft':'ArrowRight');
  if(Math.abs(y)>=Math.abs(x)*edge)keys.push(y<0?'ArrowUp':'ArrowDown');
  return keys;
}

