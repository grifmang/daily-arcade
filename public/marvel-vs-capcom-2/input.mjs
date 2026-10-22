const KEYS = [
  {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',ArrowDown:'down',KeyZ:'light',KeyX:'heavy',KeyC:'special'},
  {KeyA:'left',KeyD:'right',KeyW:'jump',KeyS:'down',KeyF:'light',KeyG:'heavy',KeyH:'special'},
];
export class Inputs {
  constructor(canvas, onPause, onBlur) {
    this.canvas=canvas;this.keys=[new Set(),new Set()];this.pulses=[new Set(),new Set()];this.touch=new Map();this.connected=new Set();this.padPause=false;
    this.enabled=false;
    window.addEventListener('keydown',e=>{
      const focused=document.activeElement;
      if (focused?.matches('input,select,textarea') || focused?.closest('details')) return;
      if (e.code==='Escape' || e.code==='Enter') {
        if(e.code==='Enter' && focused?.matches('button,a,summary'))return;
        if (this.enabled && !e.repeat) {e.preventDefault();onPause();} return;
      }
      if (!this.enabled || (focused?.tagName==='BUTTON' && !focused.dataset.action)) return;
      KEYS.forEach((map,i)=>{if(map[e.code]){e.preventDefault();this.keys[i].add(map[e.code]);if(!e.repeat)this.pulses[i].add(map[e.code]);}});
    });
    window.addEventListener('keyup',e=>KEYS.forEach((map,i)=>{if(map[e.code])this.keys[i].delete(map[e.code]);}));
    window.addEventListener('blur',()=>{this.clear();onBlur();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();onBlur();}});
    window.addEventListener('gamepaddisconnected',()=>{this.clear();onBlur();});
    for (const button of document.querySelectorAll('[data-action]')) {
      button.addEventListener('pointerdown',e=>{if(!this.enabled)return;e.preventDefault();button.setPointerCapture(e.pointerId);this.touch.set(e.pointerId,button.dataset.action);this.pulses[0].add(button.dataset.action);button.classList.add('is-active');canvas.focus({preventScroll:true});});
      const release=e=>{this.touch.delete(e.pointerId);button.classList.remove('is-active');};
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
      button.addEventListener('contextmenu',e=>e.preventDefault());
      button.addEventListener('keydown',e=>{if(this.enabled&&(e.code==='Enter'||e.code==='Space')){e.preventDefault();this.touch.set(`key:${button.dataset.action}`,button.dataset.action);this.pulses[0].add(button.dataset.action);button.classList.add('is-active');}});
      button.addEventListener('keyup',e=>{if(e.code==='Enter'||e.code==='Space'){this.touch.delete(`key:${button.dataset.action}`);button.classList.remove('is-active');}});
      button.addEventListener('blur',()=>{this.touch.delete(`key:${button.dataset.action}`);button.classList.remove('is-active');});
    }
    this.onPause=onPause;
  }
  clear() {this.keys.forEach(s=>s.clear());this.consume();this.touch.clear();document.querySelectorAll('.is-active').forEach(b=>b.classList.remove('is-active'));}
  consume(){this.pulses.forEach(s=>s.clear());}
  read() {
    const result=this.keys.map(s=>new Set(s));
    this.pulses.forEach((s,i)=>{for(const action of s)result[i].add(action);});
    for(const action of this.touch.values())result[0].add(action);
    const pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p?.connected);
    pads.slice(0,2).forEach((pad,i)=>{
      const press=n=>pad.buttons[n]?.pressed;
      if(pad.axes[0]<-0.25||press(14))result[i].add('left');
      if(pad.axes[0]>0.25||press(15))result[i].add('right');
      if(pad.axes[1]>0.35||press(13))result[i].add('down');
      if(pad.axes[1]<-0.5||press(12)||press(3))result[i].add('jump');
      if(press(0))result[i].add('light');if(press(2))result[i].add('heavy');if(press(1))result[i].add('special');
    });
    const pause=pads.some(p=>p.buttons[9]?.pressed);
    if(pause&&!this.padPause&&this.enabled)this.onPause();
    this.padPause=pause;this.padCount=pads.length;
    return this.enabled?result:[new Set(),new Set()];
  }
}
