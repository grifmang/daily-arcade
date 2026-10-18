const CONTROLS=['b','a','up','down','left','right','start','select'];
const NAMES=['Left punch (B)','Right punch (A)','Face / Up','Block / Down','Dodge left','Dodge right','Start / star','Select / recovery'];
const button=index=>({type:'button',index});
const STANDARD={b:button(1),a:button(0),up:button(12),down:button(13),left:button(14),right:button(15),start:button(9),select:button(8)};
const active=b=>!!b&&(b.pressed||b.value>0.5);
const key=pad=>'ascii-punchout-controller-v1:'+encodeURIComponent(pad.id.slice(0,256))+':'+pad.buttons.length+':'+pad.axes.length;
function valid(map,pad){return map&&CONTROLS.every(name=>{const b=map[name];return b&&Number.isInteger(b.index)&&b.index>=0&&((b.type==='button'&&b.index<pad.buttons.length)||(b.type==='axis'&&b.index<pad.axes.length&&(b.sign===1||b.sign===-1)));})&&new Set(CONTROLS.map(name=>{const b=map[name];return `${b.type}:${b.index}:${b.type==='axis'?b.sign:0}`;})).size===8;}
function read(binding,pad){return binding?.type==='button'?active(pad.buttons[binding.index]):binding?.type==='axis'&&pad.axes[binding.index]*binding.sign>0.55;}
/** Poll fresh Gamepad objects, including while the simulation is paused. */
export class Controller {
 constructor({onInput,onAction,onLoss,onSetup}){
  Object.assign(this,{onInput,onAction,onLoss,onSetup});this.pad=null;this.previous=new Set();this.armed=false;this.focused=true;this.capture=null;
  this.status=document.querySelector('#controller-status');this.devices=document.querySelector('#controller-device');this.remap=document.querySelector('#controller-remap');this.defaults=document.querySelector('#controller-defaults');
  this.devices.addEventListener('change',()=>{const pad=this.pads.find(p=>String(p.index)===this.devices.value);this.choose(pad);this.onLoss();});
  this.remap.addEventListener('click',()=>{if(!this.pad)return;this.onSetup();this.capture={step:0,map:{}};this.neutralize();this.describe();});
  this.defaults.addEventListener('click',()=>{if(!this.pad)return;try{localStorage.removeItem(key(this.pad));}catch{}this.capture=null;this.load();this.neutralize();this.describe();});
  window.addEventListener('blur',()=>{this.focused=false;this.neutralize();});window.addEventListener('focus',()=>{this.focused=true;this.neutralize();});
  window.addEventListener('gamepaddisconnected',event=>{if(event.gamepad.index===this.pad?.index){this.choose(null);this.onLoss();}});
 }
 neutralize(){this.armed=false;this.previous.clear();this.onInput(new Set());}
 choose(pad){this.pad=pad||null;this.capture=null;this.load();this.neutralize();this.describe();}
 load(){this.map=null;this.custom=false;if(!this.pad)return;try{const saved=JSON.parse(localStorage.getItem(key(this.pad)));if(valid(saved,this.pad)){this.map=saved;this.custom=true;}}catch{}if(!this.map&&this.pad.mapping==='standard')this.map=STANDARD;}
 describe(){this.remap.disabled=this.defaults.disabled=!this.pad;this.status.textContent=!this.pad?'No controller. Connect one and press a button.':this.capture?`Release controls, then press: ${NAMES[this.capture.step]} (${this.capture.step+1}/8).`:`${this.pad.id.slice(0,160)} · ${this.custom?'Custom mapping':this.map?'Standard mapping':'Choose Remap to set up this device'}`;this.remap.textContent=this.capture?'Restart remapping':'Remap 8 controls';}
 poll(){
  try{this.pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p&&p.connected);}catch{this.pads=[];}
  const inventory=this.pads.map(p=>`${p.index}:${p.id}`).join('|');
  if(inventory!==this.inventory){this.inventory=inventory;this.devices.replaceChildren();for(const pad of this.pads){const option=document.createElement('option');option.value=String(pad.index);option.textContent=`${pad.index+1}: ${pad.id.slice(0,100)}`;this.devices.append(option);} }
  let current=this.pads.find(p=>p.index===this.pad?.index&&p.id===this.pad?.id&&p.mapping===this.pad?.mapping&&p.buttons.length===this.pad?.buttons.length&&p.axes.length===this.pad?.axes.length);
  if(this.pad&&!current){this.choose(null);this.onLoss();}
  if(!this.pad){current=this.pads.find(p=>p.buttons.some(active))||this.pads[0];if(current)this.choose(current);}
  if(!current||!this.focused)return;
  this.pad=current;this.devices.value=String(current.index);
  const physical=[];current.buttons.forEach((b,index)=>{if(active(b))physical.push(button(index));});current.axes.forEach((v,index)=>{if(Math.abs(v)>0.55)physical.push({type:'axis',index,sign:Math.sign(v)});});
  if(!this.armed){if(!physical.length&&current.axes.every(v=>Math.abs(v)<=0.25))this.armed=true;return;}
  if(this.capture){if(physical.length){const binding=physical[0];if(!Object.values(this.capture.map).some(b=>JSON.stringify(b)===JSON.stringify(binding))){this.capture.map[CONTROLS[this.capture.step++]]=binding;if(this.capture.step===8){this.map=this.capture.map;this.custom=true;try{localStorage.setItem(key(current),JSON.stringify(this.map));}catch{}this.capture=null;}}this.neutralize();this.describe();}return;}
  if(!this.map)return;
  const held=new Set(CONTROLS.filter(name=>read(this.map[name],current)));
  if(!this.custom&&current.mapping==='standard'){if(current.axes[0]<-0.25)held.add('left');if(current.axes[0]>0.25)held.add('right');if(current.axes[1]<-0.25)held.add('up');if(current.axes[1]>0.25)held.add('down');}
  const pause=(held.has('start')&&held.has('select'))||(!this.custom&&active(current.buttons[3]));
  if(pause)held.add('pause');
  if(held.has('select')&&held.has('up'))held.add('password');
  if(held.has('select')&&(held.has('a')||held.has('b')))held.add('special-password');
  const edges=new Set([...held].filter(name=>!this.previous.has(name)));this.previous=held;
  if(pause){this.onInput(new Set());if(edges.has('pause'))this.onAction('pause');return;}
  if(edges.has('special-password')&&this.onAction('special-password')){this.onInput(new Set());return;}
  if(edges.has('password')&&this.onAction('password')){this.onInput(new Set());return;}
  this.onInput(held);for(const action of ['start','select','left','right','up','down'])if(edges.has(action))this.onAction(action);
 }
}
