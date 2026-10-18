import {CORNER_ART} from './corner-art.mjs';
import {rotateRandom} from './fight-control.mjs';
const glyph=n=>n>=1&&n<=10?String(n-1):n>=11&&n<=36?String.fromCharCode(65+n-11):({0:'0',1:'1',2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'0',37:'.',38:"'",39:'!',40:'-',41:'"',42:'"',43:',',44:':',45:'#',46:'/',47:' ',48:'?',253:' ',255:' '})[n]??' ';
import {animateCorner,cornerPoseKey} from './corner-animation.mjs';
export {animateCorner,cornerPoseKey} from './corner-animation.mjs';
/** Bank A $8000–815A: original text commands and RAM-visible typewriter clock. */
export class CornerText {
 constructor(memory,read){this.m=memory;this.read=read;this.tiles=new Map();this.promptAddresses=new Set();this.fixedInks=new Map();this.messageId=null;}
 request(id){this.m[0x4b0]=id;this.messageId=id&127;}
 tick(){const m=this.m;if(!m[0x4b0])return;
  if(m[0x4b0]&128){const id=m[0x4b0]&127,offset=id*2;let p,address,sound;
   m[0x4b0]=id;m[0x4b2]=m[0x414]=m[0x415]=0;
   if(offset<0x42){p=0x815b+offset;address=0x2100;sound=10;}
   else if(offset<0xe2){p=0x8181+offset-0x40;address=0x2272;sound=11;}
   else{p=0x81e5+offset-0xe0;sound=128;}
   m[0x4b3]=this.read(p,10);m[0x4b4]=this.read(p+1,10);
   if(offset>=0xe2){const ptr=m[0x4b3]|m[0x4b4]<<8;address=this.read(ptr,10)<<8|this.read(ptr+1,10);m[0x4b2]=2;}
   m[0x4b5]=m[0x4b7]=m[0x411]=address>>>8;m[0x4b6]=m[0x4b8]=m[0x412]=address&255;m[0x4bd]=sound;
  }else{m[0x4b1]--;if(m[0x4b1])return;}
  m[0x4b1]=4;const ptr=m[0x4b3]|m[0x4b4]<<8;let y=m[0x4b2];
  for(let guard=0;guard<256;guard++){
   const v=this.read((ptr+y)&65535,10);y=(y+1)&255;
   if(!v){m[0x4b0]=0;return;}
   if(v<128||v===255||v===253){if(v<128)m[0xf0]=m[0x4bd];m[0x413]=v;m[0x4b2]=y;m[0x410]=0x81;this.tiles.set((m[0x411]<<8)|m[0x412],v);m[0x412]++;return;}
   if(v===128){const sum=m[0x4b6]+32;m[0x4b6]=m[0x412]=sum;m[0x4b5]=(m[0x4b5]+(sum>255?1:0))&255;m[0x411]=m[0x4b5];continue;}
   if(v===254){m[0x412]+=this.read((ptr+y)&65535,10);y=(y+1)&255;continue;}
   if(v===252){m[0x4b6]=m[0x412]=m[0x4b8];m[0x4b5]=m[0x411]=m[0x4b7];m[0x414]=m[0x415]=0;continue;}
   if(v===251||v===250){const w=v===251?8:6,h=v===251?11:12,base=(m[0x411]<<8)|m[0x412];for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)this.tiles.set(base+dy*32+dx,255);let b=0;for(let dy=0;dy<h;dy++){for(let dx=0;dx<w;dx++)m[0x413+b++]=255;m[0x413+b++]=0;}m[0x413+b]=0;m[0x4b2]=y;m[0x410]=129;m[0x412]++;return;}
   if(v===249){m[0x4bd]=this.read((ptr+y)&65535,10);y=(y+1)&255;continue;}
   m[0x4b1]=this.read((ptr+y)&65535,10);m[0x4b2]=(y+1)&255;return;
  }throw Error('Corner text command budget exceeded');
 }
 snapshot(){const chars=[...this.tiles].map(([a,tile])=>({x:(a&31)*8,y:(((a-0x2000)&0x3ff)>>>5)*8,char:glyph(tile),tile,ink:this.promptAddresses.has(a)?9:(this.fixedInks.get(a)??1)}));return{id:this.messageId,active:!!this.m[0x4b0],index:this.m[0x4b2],timer:this.m[0x4b1],chars};}
}
export class CornerPresentation {
 constructor({memory,read}){this.m=memory;this.read=read;this.frame=0;this.text=new CornerText(memory,read);}
 enter(){const m=this.m,key=`${m[1]}:${m[6]}:${Math.min(2,m[0x3d0])}`;this.scene=CORNER_ART.scenes[key];if(!this.scene)throw Error('Missing original corner scene '+key);this.frame=0;this.text=new CornerText(m,this.read);for(const label of this.scene.labels??[]){const address=0x2000+(label.y>>>3)*32+(label.x>>>3);this.text.tiles.set(address,label.tile);this.text.fixedInks.set(address,label.ink);}const records=[m[0x170]?m[0x170]+1:255,m[0x171]+1,40,m[0x172]?m[0x172]+1:255,m[0x173]+1,255,m[0x174]?m[0x174]+1:255,m[0x175]+1];records.forEach((tile,i)=>this.text.tiles.set(0x21c2+i,tile));m.set(this.scene.oam,0x200);m.set(this.scene.palette,0x480);m.set(this.scene.scroll,0x12);m[0x4a0]=129;m[0x4b0]=0;m[0x4c8]=0;m[0x20]=m[0x21]=0;m[0x15]=0;m[0x1b]=129;m[0]=255;m[4]=1;m[0x1c]=1;m[0x1d]=255;
  if(m[6]!==1){const seed=m[0x18],index=(seed&3)|(m[0x3d0]?4:0);m[0x4be]=m[0x5f8+index];rotateRandom(m,1);m[0x4bf]=m[0x5f0+(m[0x18]&7)];rotateRandom(m,(seed>>>2)&1);this.text.request(m[0x4be]);this.phase='trainer';}
  else this.phase='opening-wait';
 }
 tick(){this.frame++;if(this.phase==='trainer'||this.phase==='opponent')this.text.tick();animateCorner(this.m);}
 showPrompt(){const m=this.m,p=this.read(0x8006,12)|(this.read(0x8007,12)<<8),bytes=Array.from({length:27},(_,i)=>this.read(p+83+i,12));m.set(bytes,0x411);m[0x410]=129;let address=(bytes[0]<<8)|bytes[1],i=2;for(let guard=0;guard<27&&i<bytes.length;guard++){let row=0;while(bytes[i]){this.text.promptAddresses.add(address+row*32);this.text.tiles.set(address+row*32,bytes[i++]);row++;}i++;if(!bytes[i])break;address++;}}
 next(){const m=this.m;
  if(this.phase==='opening-wait'){this.showPrompt();this.phase='ready-wait';return;}
  if(this.phase==='ready-wait'){this.phase='ready';return;}
  if(this.phase==='trainer'&&!m[0x4b0]){this.phase='trainer-drain';return;}
  if(this.phase==='trainer-drain'){this.phase='trainer-pause';m[0x4c6]=32;return;}
  if(this.phase==='trainer-pause'){m[0x4c6]--;if(!m[0x4c6]){this.text.request(m[0x4bf]);this.text.tick();this.phase='opponent';}return;}
  if(this.phase==='opponent'&&!m[0x4b0]){this.phase='opponent-drain';return;}
  if(this.phase==='opponent-drain'){this.showPrompt();this.phase='ready-wait';}
 }
 get awaitingStart(){return this.phase==='ready';}
 exit(){const m=this.m;this.phase='exit-scroll';m[0x6c0]=this.read(0xa1be);m[0x6c1]=this.read(0xa1bf);m[0x6c2]=this.read(0xa1c0);this.lastPose=CORNER_ART.poses[cornerPoseKey(m)]??this.lastPose;}
 scrollTick(){const m=this.m;const old=m[0x6c0];m[0x6c0]=((old<<1)|(old>>>7))&255;if(!(old&128))return;const speed=m[0x6c1];for(let a=0x204;a<0x300;a+=4){if(m[a]>=240)continue;const n=m[a]-speed;m[a]=n<0?(a===0x204?0:248):n;}const n=m[0x20]+speed;m[0x20]=n;if(n>=m[0x6c2])m[0x15]=1;m[0x17]=1;}
 snapshot(){if(!this.scene)return null;const key=cornerPoseKey(this.m),pose=CORNER_ART.poses[key];if(pose)this.lastPose=pose;return{frame:this.frame,phase:this.phase,awaitingStart:this.awaitingStart,prompt:(this.awaitingStart||this.phase==='ready-wait')?'PUSH START':null,background:this.scene.background,portrait:pose??this.lastPose??null,message:this.text.snapshot(),scroll:this.m[0x20],hidden:!(this.m[0x1b]&1),poseKey:key,poseRecovered:!!pose,palette:[...this.m.slice(0x480,0x4a0)]};}
}




