import { FLOOR } from './simulation.mjs';
// Frame selections are reviewed poses; preview animation timing is authored.
const ANIMATIONS={
  ryu:{idle:[65,66,67,68],walk:[70,71,72,73,74],jump:[90,91,92,93,94,95],crouch:[69],light:[200,201,202,203],heavy:[208,209,210,211,210,209],special:[276,277,278,279],hurt:[142,143],block:[110],win:[104,105,106],ko:[134,135,136,137]},
  cyclops:{idle:[97,98,99,100,101,102],walk:[117,118,119,120,121,122,123],jump:[125,126,127,128,129,130],crouch:[114],light:[272,273,274,275],heavy:[176,177,178,179],special:[195,196,197,198],hurt:[161,162],block:[144],win:[168,169,170],ko:[221,222]},
};
const NAMES={ryu:'RYU',cyclops:'CYCLOPS'};
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.assets={};this.clock=0;}
  async load(){
    await Promise.all(Object.keys(ANIMATIONS).map(async id=>{
      const response=await fetch(new URL(`assets/${id}.json`,import.meta.url));
      if(!response.ok)throw Error(`Could not load ${id} frames (${response.status})`);
      const data=await response.json();
      const images=await Promise.all(data.atlases.map(a=>new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error(`Could not load ${id} artwork`));image.src=new URL(`assets/${a.file}`,import.meta.url).href;
      })));
      this.assets[id]={data,images};
    }));
  }
  sprite(id,state,age,x,y,face=1,scale=1.85,attack=null){
    const entry=this.assets[id];if(!entry)return;
    const frames=ANIMATIONS[id][state]||ANIMATIONS[id].idle;
    let index;
    if(attack)index=Math.min(frames.length-1,Math.floor(attack.frame/attack.total*frames.length));
    else if(state==='ko')index=Math.min(frames.length-1,Math.floor(age/10));
    else index=Math.floor(age/(state==='idle'?9:6))%frames.length;
    const f=entry.data.frames[frames[index]];
    const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.scale(-face*scale,scale);
    c.drawImage(entry.images[f.atlas],f.x,f.y,f.w,f.h,Math.round(f.dx-entry.data.pivotX),Math.round(f.dy-entry.data.groundY),f.w,f.h);c.restore();
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
    const t=match?.tickCount||this.clock;this.arena(t);
    const fighters=match?.players||[{name:selection,x:245,y:0,face:1,state:'idle',age:this.clock},{name:selection==='ryu'?'cyclops':'ryu',x:525,y:0,face:-1,state:'idle',age:this.clock}];
    for(const p of fighters){
      c.fillStyle='rgba(23,27,31,.36)';c.beginPath();c.ellipse(p.x,FLOOR+5,42-Math.min(18,p.y*.04),8,0,0,Math.PI*2);c.fill();
      c.globalAlpha=p.flash%2?.65:1;
      this.sprite(p.name,p.state,p.age,p.x,FLOOR-p.y,p.face,1.85,p.attack);c.globalAlpha=1;
    }
    if(match){
      for(const shot of match.projectiles){
        c.save();c.translate(shot.x,shot.y);c.scale(shot.face,1);
        if(shot.name==='ryu'){
          c.fillStyle='#72daee';c.beginPath();c.ellipse(0,0,23,17,0,0,Math.PI*2);c.fill();
          c.fillStyle='#e9ffec';c.beginPath();c.ellipse(7,0,12,11,0,0,Math.PI*2);c.fill();
          c.fillStyle='#3298d5';c.beginPath();c.moveTo(-15,-12);c.lineTo(-42,-6);c.lineTo(-28,0);c.lineTo(-45,8);c.lineTo(-14,12);c.fill();
        }else{
          c.fillStyle='#ff652e';c.fillRect(-45,-9,66,18);c.fillStyle='#ffd580';c.fillRect(-41,-4,68,8);c.fillStyle='#fff7d0';c.fillRect(-25,-2,54,4);
        }c.restore();
      }
      for(const p of match.particles){
        const ratio=p.t/p.max;c.save();c.translate(p.x,p.y);c.strokeStyle=p.blocked?'#92d8ef':'#fff0ad';c.lineWidth=3;
        for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*5,Math.sin(a)*5);c.lineTo(Math.cos(a)*(35-20*ratio),Math.sin(a)*(35-20*ratio));c.stroke();}
        c.restore();
      }
      c.font='bold 11px monospace';
      for(let i=0;i<2;i++){
        const p=match.players[i],x=i?570:58;
        c.fillStyle='rgba(10,21,28,.7)';c.fillRect(x,389,140,8);c.fillStyle=i?'#ef825f':'#73c0d3';c.fillRect(x,389,p.meter*1.4,8);
        c.fillStyle='#f4e6c6';c.fillText(`${match.wins[i]} ROUND${match.wins[i]===1?'':'S'}`,x,418);
      }
      if(match.phase==='intro')this.word(match.delay>60?`ROUND ${match.round}`:'FIGHT!',match.delay>60?34:54);
      if(match.phase==='roundover')this.word(match.time<=0?'TIME UP':'K.O.',64);
      if(match.paused){c.fillStyle='rgba(11,20,25,.62)';c.fillRect(0,0,768,432);this.word('PAUSED',44);c.font='14px monospace';c.fillStyle='#efe4ca';c.textAlign='center';c.fillText('Enter / Start to resume',384,270);c.textAlign='left';}
    }
  }
  word(text,size){const c=this.ctx;c.save();c.textAlign='center';c.font=`italic 900 ${size}px Impact, sans-serif`;c.lineWidth=6;c.strokeStyle='#26323a';c.strokeText(text,384,218);c.fillStyle='#f1c863';c.fillText(text,384,218);c.restore();}
}
export {NAMES};
