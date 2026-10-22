import { FLOOR } from './simulation.mjs';
import { Animation } from './animation.mjs';
const NAMES={ryu:'RYU',cyclops:'CYCLOPS'};
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.assets={};this.actions={};this.menuAnimations={};this.clock=0;this.menuTick=0;}
  async load(){
    const json=async file=>{
      const response=await fetch(new URL(`assets/${file}`,import.meta.url));
      if(!response.ok)throw Error(`Could not load ${file} (${response.status})`);
      return response.json();
    };
    this.system=await json('system.json');
    await Promise.all(['ryu','cyclops'].map(async id=>{
      const response=await fetch(new URL(`assets/${id}-fx.json`,import.meta.url));
      if(!response.ok)throw Error(`Could not load ${id} frames (${response.status})`);
      const data=await response.json();
      const images=await Promise.all(data.atlases.map(a=>new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error(`Could not load ${id} artwork`));image.src=new URL(`assets/${a.file}`,import.meta.url).href;
      })));
      this.assets[id]={data,images};
      this.actions[id]=await json(`${id}-actions.json`);
      this.menuAnimations[id]=new Animation(this.actions[id]);
    }));
    this.moves=await json('moves.json');
    this.optic={};this.ownerFlash={};
    const palettes=[['cyclops-optic.json',this.optic],['cyclops-owner-flash.json',this.ownerFlash]];
    await Promise.all(palettes.map(async([file,banks])=>{
    const palette=await json(file);
    await Promise.all(Object.entries(palette.variants).map(async([key,data])=>{
      const images=await Promise.all(data.atlases.map(a=>new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load Optic palette'));image.src=new URL(`assets/${a.file}`,import.meta.url).href;
      })));
      banks[key]={data,images};
    }));
    }));
  }
  sprite(id,animation,x,y,face=1,palette,rotation=0){
    const entry=id==='cyclops'&&palette?(this.optic[palette]||this.ownerFlash[palette]||this.assets[id]):this.assets[id];if(!entry)return;
    if(animation.record.cellRaw===0xffff)return;
    const cell=animation.record.spriteHighBit?animation.record.cellRaw&0x1ff:animation.cell;
    const f=entry.data.frames[cell];
    if(!f)throw Error(`Unexported original cell ${id}:${cell}`);
    const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));
    // Gene child352460 ->152D20 ->174F60: half-turn around the actor origin.
    if(rotation===0x8000)c.rotate(Math.PI);
    c.scale(-face*this.system.scaleX,this.system.scaleY);
    c.drawImage(entry.images[f.atlas],f.x,f.y,f.w,f.h,f.dx,f.dy,f.w,f.h);c.restore();
  }
  arena(t){
    const c=this.ctx;c.clearRect(0,0,768,432);
    const sky=c.createLinearGradient(0,0,0,352);sky.addColorStop(0,'#233a4c');sky.addColorStop(.6,'#a28b69');sky.addColorStop(1,'#dbab71');c.fillStyle=sky;c.fillRect(0,0,768,432);
    c.fillStyle='#f3c887';c.beginPath();c.arc(554,157,53,0,Math.PI*2);c.fill();
    c.fillStyle='#42545b';
    const heights=[54,78,58,95,71,112,61,82,45,87,63,99];
    heights.forEach((h,i)=>{c.fillRect(i*71-20,265-h,46,h);c.fillRect(i*71-12,259-h,12,10);});
    c.fillStyle='#688c95';c.fillRect(0,265,768,87);
    c.strokeStyle='#b7bbb0';c.lineWidth=2;
    for(let i=0;i<15;i++){const yy=277+i*5;c.beginPath();const xx=(i*97+t*(.1+i*.003))%870-70;c.moveTo(xx,yy);c.lineTo(xx+30+i*3,yy);c.stroke();}
    // Dock railing and mooring posts anchor the hand-built arena.
    c.strokeStyle='#29373a';c.lineWidth=5;c.beginPath();c.moveTo(0,307);c.lineTo(768,307);c.stroke();
    c.fillStyle='#35444a';for(let x=15;x<800;x+=108)c.fillRect(x,297,7,57);
    c.fillStyle='#a08059';c.fillRect(0,352,768,80);
    c.fillStyle='#654f3e';c.fillRect(0,352,768,7);
    c.strokeStyle='#725c46';c.lineWidth=1;
    for(let y=368;y<432;y+=16){c.beginPath();c.moveTo(0,y);c.lineTo(768,y);c.stroke();}
    for(let x=-768;x<1536;x+=64){c.beginPath();c.moveTo(384+(x-384)*.38,359);c.lineTo(x,432);c.stroke();}
    c.fillStyle='#313c40';c.fillRect(0,311,58,42);c.fillRect(718,321,50,32);
    c.strokeStyle='#ad9a77';c.lineWidth=3;c.beginPath();c.moveTo(1,314);c.lineTo(55,351);c.moveTo(55,314);c.lineTo(1,351);c.stroke();
    c.fillStyle='#e1bd75';c.font='bold 10px monospace';c.fillText('PORT 02',7,328);
    c.fillStyle='rgba(19,24,25,.10)';for(let y=0;y<432;y+=3)c.fillRect(0,y,768,1);
  }
  draw(match,selection='ryu'){
    this.clock++;const c=this.ctx;c.imageSmoothingEnabled=false;
    const now=Math.floor(performance.now()*60/1000);
    if(!this.menuTick)this.menuTick=now;
    for(let i=0;i<Math.min(8,now-this.menuTick);i++)for(const animation of Object.values(this.menuAnimations))animation.step();
    this.menuTick=now;
    const t=match?.tickCount||this.clock;
    const fighters=match?.players||[{name:selection,x:245,y:0,face:1,animation:this.menuAnimations[selection]},{name:selection==='ryu'?'cyclops':'ryu',x:525,y:0,face:-1,animation:this.menuAnimations[selection==='ryu'?'cyclops':'ryu']}];
    const cameraY=match?Math.max(0,...fighters.map(p=>p.y-130)):0;
    c.fillStyle='#233a4c';c.fillRect(0,0,768,432);c.save();c.translate(0,cameraY);
    this.arena(t);
    for(const p of fighters){
      c.fillStyle='rgba(23,27,31,.36)';c.beginPath();c.ellipse(p.x,FLOOR+5,42-Math.min(18,p.y*.04),8,0,0,Math.PI*2);c.fill();
      c.globalAlpha=p.flash%2?.65:1;
      this.sprite(p.name,p.animation,p.x,FLOOR-p.y,p.face,p.paletteVariant);c.globalAlpha=1;
    }
    if(match){
      for(const shot of match.projectiles){
        this.sprite(shot.name,shot.animation,shot.x,FLOOR-shot.y,shot.face,shot.paletteVariant??shot.root?.paletteVariant,shot.rotation);
      }
      for(const p of match.particles){
        const ratio=p.t/p.max;c.save();c.translate(p.x,p.y);c.strokeStyle=p.blocked?'#92d8ef':'#fff0ad';c.lineWidth=3;
        for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*5,Math.sin(a)*5);c.lineTo(Math.cos(a)*(35-20*ratio),Math.sin(a)*(35-20*ratio));c.stroke();}
        c.restore();
      }
      c.restore();
      c.font='bold 11px monospace';
      for(let i=0;i<2;i++){
        const p=match.players[i],x=i?570:58;
        c.fillStyle='rgba(10,21,28,.7)';c.fillRect(x,389,140,8);c.fillStyle=i?'#ef825f':'#73c0d3';c.fillRect(x,389,p.meter/144*140,8);
        c.fillStyle='#f4e6c6';c.fillText(`LEVEL ${p.bars} · ${match.wins[i]} ROUND${match.wins[i]===1?'':'S'}`,x,418);
        const victim=match.players[1-i];
        if(victim.combo>1){c.font='bold 18px monospace';c.fillText(`${victim.combo} HIT`,i?640:58,125);c.font='bold 11px monospace';}
      }
      if(match.phase==='intro')this.word(match.delay>60?`ROUND ${match.round}`:'FIGHT!',match.delay>60?34:54);
      if(match.phase==='roundover')this.word(match.time<=0?'TIME UP':'K.O.',64);
      if(match.paused){c.fillStyle='rgba(11,20,25,.62)';c.fillRect(0,0,768,432);this.word('PAUSED',44);c.font='14px monospace';c.fillStyle='#efe4ca';c.textAlign='center';c.fillText('Enter / Start to resume',384,270);c.textAlign='left';}
    }else c.restore();
  }
  word(text,size){const c=this.ctx;c.save();c.textAlign='center';c.font=`italic 900 ${size}px Impact, sans-serif`;c.lineWidth=6;c.strokeStyle='#26323a';c.strokeText(text,384,218);c.fillStyle='#f1c863';c.fillText(text,384,218);c.restore();}
}
export {NAMES};
