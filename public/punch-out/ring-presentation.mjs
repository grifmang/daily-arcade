/** Original fight scenery/HUD as authored ASCII data, with original upload cadence. */
import {RING_ART} from './ring-art.mjs';
import {DEMO_RING_ART} from './demo-art.mjs';
const ART={scenes:{...RING_ART.scenes,...DEMO_RING_ART.scenes},backgrounds:{...RING_ART.backgrounds,...DEMO_RING_ART.backgrounds},glyphs:{...RING_ART.glyphs,...DEMO_RING_ART.glyphs}};

const hudGroups={clock:[0x30a,0x30b,0x2070,4],hearts:[0x325,0x326,0x247d,2],stars:[0x349,0x34a,0x247a,1],points:[0x3f0,0x3f1,0x2088,6]};
const backgroundCache=new Map();
const word=(m,a)=>(m[a]<<8)|m[a+1];
function healthTiles(tiles,value,base,reverse){
 const filled=Math.max(0,Math.min(48,Math.ceil(value/2)));
 for(let i=0;i<6;i++){const n=Math.max(0,Math.min(8,filled-i*8));tiles[0x2060+(reverse?6-i:8+i)]=n?base+(n&7):0xfc;}
}
function background(scene,m){
 const top=m[0x13]|((m[0x14]&1)<<8),body=m[0x15]|((m[0x16]&1)<<8),key=scene.backgrounds.join('/')+'/'+top+'/'+body+'/'+scene.splitY;
 if(backgroundCache.has(key))return backgroundCache.get(key);
 const halves=scene.backgrounds.map(key=>ART.backgrounds[key]),rows=[],inks=[],{width,height}=halves[0],cellWidth=halves[0].cellWidth??2,cellHeight=halves[0].cellHeight??3;
 for(let y=0;y<height;y++){
  const offset=Math.floor((y*cellHeight<scene.splitY?top:body)/cellWidth);let row='',ink='';
  for(let x=0;x<width;x++){const world=(x+offset)%(width*2),half=halves[Math.floor(world/width)],column=world%width;row+=half.rows[y][column];ink+=half.inks[y][column];}
  rows.push(row);inks.push(ink);
 }
 const details=(halves[0].details??[]).map((detail,index)=>{
  const rows=[],inks=[];
  for(let y=0;y<detail.height;y++){
   const offset=detail.y+y<scene.splitY?top:body;let row='',ink='';
   for(let x=0;x<256;x++){
    const world=(x+offset)&511,source=halves[world>>>8].details[index],column=(world&255)-source.x;
    row+=source.rows[y][column];ink+=source.inks[y][column];
   }
   rows.push(row);inks.push(ink);
  }
  return{...detail,x:0,width:256,rows,inks};
 });
 const value={x:0,y:0,width,height,cellWidth,cellHeight,rows,inks,details};
 // Intro scroll can visit many offsets; bound retained presentation data.
 if(backgroundCache.size>=64)backgroundCache.delete(backgroundCache.keys().next().value);
 backgroundCache.set(key,value);return value;
}
function view(scene,m,tiles){
 const top=m[0x13]|((m[0x14]&1)<<8),body=m[0x15]|((m[0x16]&1)<<8),parts=[],labels=[];
 for(const label of scene.labels){const x=(label.worldX-top+512)&511;if(x<256)labels.push({...label,x,char:label.roundNumber?String(Math.max(1,Math.min(3,m[6]))):label.char});}
 for(const [raw,tile]of Object.entries(tiles)){
  const address=Number(raw),index=(address-0x2000)&1023,y=(index>>>5)*8,worldX=(((address-0x2000)>>>10)&1)*256+(index&31)*8;
  let x=(worldX-(y<scene.splitY?top:body)+512)&511;if(x>=504)x-=512;if(x>=256)continue;
  const palette=scene.attributes[address]??0,bank=scene.banks[y<96?0:1],matrix=ART.glyphs[`${bank}/${tile}/${palette}`];
  if(matrix)parts.push({x,y,matrix});
 }
 return{background:background(scene,m),parts,labels,cellWidth:2,cellHeight:3,recovered:true,geometry:{topScroll:top,bodyScroll:body,splitY:scene.splitY}};
}

/** Hook beforeFrame() before acknowledgeDisplays(), then commit(acknowledged)
 * with that same acknowledgement array. Snapshot is read-only and inexpensive
 * when scroll/committed tiles have not changed. Reset at each prepared bout. */
export class RingPresentation{
 constructor(memory,fighter=memory[1]){this.memory=memory;this.reset(fighter);}
 reset(fighter=this.memory[1]){
  this.fighter=fighter;this.scene=ART.scenes[fighter]??ART.scenes[0];this.tiles={...this.scene.tiles};this.pending=new Map();this.revision=0;this.cached=null;
  const m=this.memory;
  healthTiles(this.tiles,m[0x393],0x80,true);healthTiles(this.tiles,m[0x39a],0x88,false);
  for(const [,source,address,length]of Object.values(hudGroups))for(let i=0;i<length;i++)this.tiles[address+i]=m[source+i];
 }
 beforeFrame(){
  const m=this.memory;this.pending=new Map();
  for(const [flag,source,address,length]of Object.values(hudGroups))if(m[flag]&128)this.pending.set(flag,Array.from({length},(_,i)=>[address+i,m[source+i]]));
  for(const flag of[0x394,0x39b])if(m[flag]&128)this.pending.set(flag,[[0x2000+m[flag+1],m[flag+2]]]);
  if(m[0x410]&128){
   const writes=[],step=m[0x10]&4?32:1;let pointer=0,column=0,address=word(m,0x411);
   // DEF C24A writes zero-terminated column runs and advances the low
   // address byte between columns. Protect the small original tile buffer.
   while(pointer<0x6b){const tile=m[0x413+pointer++];if(tile){writes.push([address,tile]);address=(address+step)&0x3fff;}else{if(!m[0x413+pointer])break;column++;address=(word(m,0x411)&0xff00)|((m[0x412]+column)&255);}}
   this.pending.set('tile-buffer',writes);
  }
 }
 commit(acknowledged=[]){
  let changed=false;
  for(const flag of acknowledged)for(const [address,tile]of this.pending.get(flag)??[]){
   // PLAYER_ART owns the Mac/referee stream; this small upload buffer owns
   // the original announcer text. Only known background tile addresses.
   if(address>=0x2000&&address<0x2800&&this.tiles[address]!==tile){this.tiles[address]=tile;changed=true;}
  }
  if(changed){this.revision++;this.cached=null;}
  this.pending.clear();
 }
 snapshot(){
  const m=this.memory,key=[this.revision,m[0x13],m[0x14],m[0x15],m[0x16]].join('/');
  if(this.cached?.key!==key)this.cached={key,value:view(this.scene,m,this.tiles)};
  return this.cached.value;
 }
}

/** Stateless fallback for display consumers without upload acknowledgements.
 * Engine integrations should use RingPresentation for exact pending uploads. */
export function ringPresentation(memory,fighter=memory[1]){return new RingPresentation(memory,fighter).snapshot();}
