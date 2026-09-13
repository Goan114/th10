import {InputSources,directionKeys} from './input-sources.mjs';
export {InputSources,directionKeys} from './input-sources.mjs';
const defaults={movement:'drag',fire:true,focus:'hold',sensitivity:100,profiles:{}};
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
export function normalizeTouchOptions(value){
  const v=value&&typeof value==='object'?value:{};
  const result={movement:v.movement==='joystick'?'joystick':'drag',fire:v.fire!==false,focus:['hold','toggle','two-finger'].includes(v.focus)?v.focus:'hold',sensitivity:clamp(Number(v.sensitivity)||100,50,300),profiles:{}};
  for(const orientation of ['portrait','landscape']){
    const profile=v.profiles?.[orientation];if(!profile||typeof profile!=='object')continue;
    const out={};for(const [id,p] of Object.entries(profile))if(['direction-pad','touch-shot','touch-bomb','touch-focus','touch-pause','touch-skip'].includes(id)&&p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.scale))out[id]={x:clamp(p.x,0,1),y:clamp(p.y,0,1),scale:clamp(p.scale,.6,1.8)};
    result.profiles[orientation]=out;
  }
  return result;
}
export function installTouchControls({root,input,onGesture=()=>{},send=()=>{},onSettings=()=>{}}){
  const panel=root.querySelector('#touch-controls'),stage=root.querySelector('#game-stage'),pad=root.querySelector('#direction-pad');
  const shot=root.querySelector('#touch-shot'),focus=root.querySelector('#touch-focus'),toggle=document.querySelector('#touch-toggle');
  const settings=document.querySelector('#touch-settings'),editor=document.querySelector('#touch-editor'),media=matchMedia('(any-pointer: coarse)');
  const controls=[...panel.querySelectorAll('[data-control]')],pointers=new Map();
  let options=normalizeTouchOptions(defaults),preference='auto',enabled=false,context='menu',padPointer=null,movePointer=null,focusToggle=false,editing=false,selected=focus;
  try{preference=localStorage.getItem('th10-touch-controls')??'auto';options=normalizeTouchOptions(JSON.parse(localStorage.getItem('th10-touch-options-v2')??'null'));}catch{}
  const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
  const positions={portrait:{'direction-pad':[.24,.8,1],'touch-focus':[.85,.86,1],'touch-bomb':[.64,.88,1],'touch-shot':[.86,.65,.8],'touch-pause':[.95,.12,.6],'touch-skip':[.95,.32,.6]},landscape:{'direction-pad':[.13,.67,1],'touch-focus':[.92,.79,1],'touch-bomb':[.79,.79,1],'touch-shot':[.93,.40,.8],'touch-pause':[.95,.10,.6],'touch-skip':[.79,.10,.6]}};
  function save(){try{localStorage.setItem('th10-touch-options-v2',JSON.stringify(options));}catch{}}
  function visible(){return !panel.hidden;}
  function configure(){send({type:'touch-options',enabled:enabled&&visible()&&!editing,fire:options.fire});}
  function render(){
    shot.setAttribute('aria-pressed',String(context==='gameplay'&&options.fire));shot.textContent=context==='gameplay'?(options.fire?'Shot on':'Shot off'):'Confirm';
    focus.setAttribute('aria-pressed',String(input.down.has('ShiftLeft')));focus.textContent='Focus';
    for(const button of controls)if(button.dataset.keys)button.classList.toggle('pressed',button.dataset.keys.split(' ').every(key=>input.down.has(key)));
    pad.hidden=options.movement!=='joystick'&&!editing;
    root.querySelector('#touch-hint').textContent=context==='gameplay'?(options.movement==='drag'?'Drag to move. Auto-fire is on.':'Use the pad to move. Auto-fire is on.'):context==='dialogue'?'Tap to continue. Hold to skip.':'Swipe to select. Tap to confirm. Two-finger tap to go back.';
  }
  function layout(){
    const key=orientation(),box=stage.getBoundingClientRect();if(!box.width||!box.height)return;
    for(const element of controls){const saved=options.profiles[key]?.[element.id],fallback=positions[key][element.id],p=saved??{x:fallback[0],y:fallback[1],scale:fallback[2]},size=(element===pad?130:64)*p.scale;
      element.style.width=element.style.height=`${size}px`;element.style.left=`${clamp(p.x*box.width,size/2,box.width-size/2)}px`;element.style.top=`${clamp(p.y*box.height,size/2,box.height-size/2)}px`;element.style.zIndex=element===selected&&editing?'5':'3';element.classList.toggle('selected',element===selected&&editing);
    }
  }
  function release(id,cancel=false){
    const p=pointers.get(id);if(!p)return;pointers.delete(id);clearTimeout(p.holdTimer);input.set('touch:'+id,[]);
    if(movePointer===id){movePointer=null;send({type:'touch-drag',action:'up'});}
    if(padPointer===id){padPointer=null;pad.style.removeProperty('--stick-x');pad.style.removeProperty('--stick-y');}
    if(p.element.hasPointerCapture(id))p.element.releasePointerCapture(id);
    if(!cancel&&p.kind==='surface'&&p.mode!=='gameplay'&&!p.moved&&!p.held&&!p.gesture?.moved&&!p.gesture?.sent){const code=p.two?'KeyX':'KeyZ';if(p.gesture)p.gesture.sent=true;send({type:'pulse',code,frames:2});}
    render();
  }
  function clear(){for(const id of [...pointers.keys()])release(id,true);focusToggle=false;input.set('touch:focus-toggle',[]);send({type:'touch-cancel'});render();}
  function visibility(){clear();const show=preference==='on'||(preference==='auto'&&media.matches);root.classList.toggle('touch-mode',show);panel.hidden=!show;toggle.setAttribute('aria-pressed',String(show));toggle.textContent=show?'Hide touch controls':'Show touch controls';document.querySelector('#touch-configure').hidden=!show;render();layout();configure();}
  function capture(element,event,p){event.preventDefault();onGesture();element.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{element,...p});}
  function movePad(event){if(event.pointerId!==padPointer)return;const box=pad.getBoundingClientRect(),x=(event.clientX-box.left-box.width/2)/(box.width/2),y=(event.clientY-box.top-box.height/2)/(box.height/2),length=Math.max(1,Math.hypot(x,y));input.set('touch:'+event.pointerId,directionKeys(x,y));pad.style.setProperty('--stick-x',`${x/length*26}px`);pad.style.setProperty('--stick-y',`${y/length*26}px`);render();}
  for(const element of controls){
    element.addEventListener('pointerdown',event=>{
      if(event.button!==0||(!enabled&&!editing))return;
      if(editing){selected=element;document.querySelector('#touch-size').value=options.profiles[orientation()]?.[element.id]?.scale??positions[orientation()][element.id][2];capture(element,event,{kind:'edit'});layout();return;}
      if(element===pad){if(padPointer!==null)return;padPointer=event.pointerId;capture(element,event,{kind:'pad'});movePad(event);return;}
      capture(element,event,{kind:'button'});
      if(element===shot&&context==='gameplay'){options.fire=!options.fire;save();configure();}
      else if(element===focus&&options.focus==='toggle'){focusToggle=!focusToggle;input.set('touch:focus-toggle',focusToggle?['ShiftLeft']:[]);}
      else input.set('touch:'+event.pointerId,element.dataset.keys.split(' '));render();
    });
    element.addEventListener('pointermove',event=>{
      const p=pointers.get(event.pointerId);if(p?.kind==='edit'){event.preventDefault();const box=stage.getBoundingClientRect(),key=orientation(),profile=options.profiles[key]??={},old=profile[element.id],scale=old?.scale??positions[key][element.id][2];profile[element.id]={x:clamp((event.clientX-box.left)/box.width,0,1),y:clamp((event.clientY-box.top)/box.height,0,1),scale};options.profiles[key]=profile;layout();}
      else if(element===pad)movePad(event);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>release(event.pointerId,type!=='pointerup'));
    element.addEventListener('contextmenu',event=>event.preventDefault());
    // Enter/Space still work when these controls are focused with a keyboard.
    element.addEventListener('keydown',event=>{if(enabled&&['Space','Enter'].includes(event.code)){event.preventDefault();input.set('button:'+element.id,element.dataset.keys?.split(' ')??[]);}});
    element.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();input.set('button:'+element.id,[]);}});
  }
  // Delegate to the container: restarting replaces the transferred canvas.
  stage.addEventListener('pointerdown',event=>{
    if(!enabled||!visible()||editing||event.target.closest('button,[data-control]')||event.button!==0)return;
    const p={kind:'surface',mode:context,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,two:false};capture(stage,event,p);const item=pointers.get(event.pointerId);
    const surfaces=[...pointers.values()].filter(p=>p.kind==='surface');item.gesture=surfaces[0].gesture??{};if(surfaces.length>1)for(const finger of surfaces){finger.two=true;finger.gesture=item.gesture;}
    if(context==='gameplay'){
      if(movePointer===null&&options.movement==='drag'){movePointer=event.pointerId;send({type:'touch-drag',action:'down'});}
      else if(options.focus==='two-finger')input.set('touch:'+event.pointerId,['ShiftLeft']);
    }else if(context==='dialogue')item.holdTimer=setTimeout(()=>{if(pointers.has(event.pointerId)&&!item.moved){item.held=true;input.set('touch:'+event.pointerId,['ControlLeft']);}},500);
  });
  stage.addEventListener('pointermove',event=>{
    const p=pointers.get(event.pointerId);if(p?.kind!=='surface')return;event.preventDefault();
    const dx=event.clientX-p.x,dy=event.clientY-p.y;p.x=event.clientX;p.y=event.clientY;
    if(Math.hypot(event.clientX-p.startX,event.clientY-p.startY)>10){p.moved=true;if(p.gesture)p.gesture.moved=true;}
    if(p.mode==='gameplay'&&movePointer===event.pointerId){const box=root.querySelector('#screen').getBoundingClientRect(),scale=640/box.width*options.sensitivity/100;send({type:'touch-drag',action:'move',dx:dx*scale,dy:dy*scale});}
    else if(p.mode==='menu'||p.mode==='replay'){
      const x=event.clientX-p.startX,y=event.clientY-p.startY,threshold=26;
      if(Math.hypot(x,y)>=threshold){send({type:'pulse',code:Math.abs(x)>Math.abs(y)?(x<0?'ArrowLeft':'ArrowRight'):(y<0?'ArrowUp':'ArrowDown'),frames:2});p.startX=event.clientX;p.startY=event.clientY;}
    }
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,event=>{if(pointers.get(event.pointerId)?.kind==='surface')release(event.pointerId,type!=='pointerup');});
  stage.addEventListener('contextmenu',event=>{if(visible())event.preventDefault();});
  toggle.onclick=()=>{preference=visible()?'off':'on';try{localStorage.setItem('th10-touch-controls',preference);}catch{}visibility();};
  document.querySelector('#touch-configure').onclick=()=>{clear();onSettings(true);document.querySelector('#touch-movement').value=options.movement;document.querySelector('#touch-focus-mode').value=options.focus;document.querySelector('#touch-sensitivity').value=options.sensitivity;document.querySelector('#touch-sensitivity-value').textContent=options.sensitivity+'%';settings.showModal();};
  settings.addEventListener('close',()=>{if(!editing){clear();onSettings(false);configure();}});
  settings.addEventListener('keydown',event=>event.stopPropagation());
  document.querySelector('#touch-settings-close').onclick=()=>settings.close();
  document.querySelector('#touch-movement').onchange=event=>{options.movement=event.target.value;save();render();};
  document.querySelector('#touch-focus-mode').onchange=event=>{options.focus=event.target.value;save();};
  document.querySelector('#touch-sensitivity').oninput=event=>{options.sensitivity=Number(event.target.value);document.querySelector('#touch-sensitivity-value').textContent=options.sensitivity+'%';save();};
  document.querySelector('#touch-edit').onclick=()=>{editing=true;settings.close();for(const element of controls)if(element.tagName==='BUTTON')element.disabled=false;root.classList.add('touch-editing');editor.hidden=false;render();layout();configure();};
  document.querySelector('#touch-size').oninput=event=>{const key=orientation(),profile=options.profiles[key]??={},b=selected.getBoundingClientRect(),box=stage.getBoundingClientRect();profile[selected.id]={x:(b.x+b.width/2-box.x)/box.width,y:(b.y+b.height/2-box.y)/box.height,scale:Number(event.target.value)};options.profiles[key]=profile;layout();};
  document.querySelector('#touch-layout-reset').onclick=()=>{delete options.profiles[orientation()];layout();};
  document.querySelector('#touch-edit-done').onclick=()=>{save();editing=false;for(const element of controls)if(element.tagName==='BUTTON')element.disabled=!enabled;root.classList.remove('touch-editing');editor.hidden=true;clear();render();layout();onSettings(false);configure();};
  // A drag followed by a range adjustment can suppress the browser's next
  // synthesized click. Complete editor toolbar taps on pointerup, and consume
  // the matching click if that browser does produce one. Keyboard clicks work.
  for(const id of ['touch-edit-done','touch-layout-reset']){
    const button=document.getElementById(id),action=button.onclick;let last=-Infinity;
    button.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse'&&event.button===0){const b=button.getBoundingClientRect();if(event.clientX>=b.left&&event.clientX<=b.right&&event.clientY>=b.top&&event.clientY<=b.bottom){event.preventDefault();last=event.timeStamp;action(event);}}});
    button.onclick=event=>{if(event.detail&&event.timeStamp-last<700)return;action(event);};
  }
  const rotate=()=>{clear();layout();};media.addEventListener('change',visibility);globalThis.screen?.orientation?.addEventListener('change',rotate);addEventListener('orientationchange',rotate);new ResizeObserver(layout).observe(stage);visibility();
  return {clear,render,get visible(){return visible();},setContext(value){if(context!==value){clear();context=value;render();}},setEnabled(value){enabled=value;if(!value)clear();for(const element of controls)if(element.tagName==='BUTTON')element.disabled=!value&&!editing;configure();}};
}
