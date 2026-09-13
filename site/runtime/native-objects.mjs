// Browser objects use opaque handles, never original addresses or vtables.
export class NativeObjects {
  constructor(label='platform'){this.label=label;this.objects=new Map();this.nextHandle=1;}
  create(kind,handlers,state={}){const object={...state,address:this.nextHandle++,kind,refs:1,handlers};this.objects.set(object.address,object);return object;}
  get(handle){const object=this.objects.get(handle>>>0);if(!object)throw new Error('Unknown native '+this.label+' handle '+handle);return object;}
  addRef(value){const object=typeof value==='number'?this.get(value):value;return ++(object.refOwner??object).refs;}
  release(value){const object=typeof value==='number'?this.get(value):value;if(object.refOwner)return this.release(object.refOwner);if(object.refs<=0)throw new Error('Native object already released');const refs=--object.refs;if(!refs){object.destroy?.();this.forget(object);}return refs;}
  forget(object){this.objects.delete(object.address);}
}
