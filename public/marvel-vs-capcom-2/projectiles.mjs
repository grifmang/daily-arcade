// Native projectile/linked-beam actors for SLUS_204.86. Callback addresses
// annotate the translated control flow. HIT/FΜ geometry comes from resources.
// Projection is a host boundary: io.projectBounds(actor, {optic}) can supply
// 00174470/003535B0 camera projection. The fallback uses io.bounds in world
// coordinates and preserves source margins; it is not a PS2 camera port.
import { Animation } from './animation.mjs';
import { contact, descriptor, rectangle } from './collision.mjs';
import { opticOrigin, opticFrame, opticChildPosition, OPTIC_TABLES } from './specials.mjs';
const f = Math.fround;
const signed = value => (value << 24) >> 24;
// 003DA4A0: 256 physical objects, ordinary allocation budget initially 0xF6.
export const PROJECTILE_POOL_BUDGET = 246;
const GROUND_ORIGINS = [[0,-144],[22,-141],[36,-135],[46,-122],[57,-104],[51,-85],[40,-73],[21,-66],[0,-61],[-21,-65],[-40,-73],[-50,-85],[-57,-103],[-46,-122],[-38,-135],[-22,-141]];
const AIR_ORIGINS = [[-4,-151],[22,-148],[38,-140],[48,-127],[58,-109],[50,-93],[40,-81],[21,-75],[-1,-73],[-24,-74],[-45,-82],[-54,-94],[-61,-109],[-49,-127],[-42,-139],[-26,-145]];
// 00462AF0/00462B20, signed frame selectors for 00354000.
const SUPER_FRAMES = [5,4,3,2,1,-1,-1,-1,-1,-1,-1,9,8,7,6,5,5,5,5,5,24,23,22,21,20,-1,-1,-1,-1,-1,-1,28,27,26,25,24,24,24,24,24];
const SUPER_CHILD_FRAMES = [14,13,12,11,10,-1,-1,-1,-1,-1,-1,18,17,16,15,14,14,14,14,14,33,32,31,30,29,-1,-1,-1,-1,-1,-1,37,36,35,34,33,33,33,33,33];
const PALETTE_CYCLE = [[2,16],[2,17],[1,18],[1,19],[1,20]]; // 00462AE0

export class Projectiles {
  constructor(resources) { this.resources=resources; this.head=null; this.tail=null; this.count=0; this.frame=0;this.paletteSlots=[]; }
  get actors() { const result=[]; for(let a=this.head;a;a=a.next)if(a.alive&&a.visible)result.push(a); return result; }
  clear() { for(let a=this.head;a;a=a.next){a.alive=false;a.visible=false;a.slotActive=false;}this.head=this.tail=null;this.count=0; }
  allocate(ownerIndex, spec, players, {after=null, tail=false}={}) {
    if(this.count>=PROJECTILE_POOL_BUDGET)return null;
    const owner=players[ownerIndex];
    const a={...spec,ownerIndex,name:owner.name,face:owner.face,x:owner.x,y:owner.y,alive:true,visible:false,
      initialized:false,hitFlags:0,blockFlags:0,hitstop:0,marginX:spec.marginX??64,marginY:spec.marginY??64,
      attack:{kind:'projectile',attackId:spec.attackId??owner.attack?.attackId??0,contacted:false,hitSet:new Set()},prev:null,next:null};
    a.animation=new Animation(this.resources.actions[a.name],0,0);
    // Allocator initializer0=head, 1=tail, 2=after(context), 3=before.
    if(after){a.prev=after;a.next=after.next;if(after.next)after.next.prev=a;else this.tail=a;after.next=a;}
    else if(tail){a.prev=this.tail;if(this.tail)this.tail.next=a;else this.head=a;this.tail=a;}
    else {a.next=this.head;if(this.head)this.head.prev=a;else this.tail=a;this.head=a;}
    this.count++;return a;
  }
  spawn(ownerIndex,spec,players) {
    if(!['hadouken','cyclopsNormalBeam','cyclopsGeneBeam','opticBeam','megaOpticBeam','shinkuHadouken','superOpticBeam'].includes(spec.kind))throw Error(`Unsupported native projectile ${spec.kind}`);
    const a=this.allocate(ownerIndex,spec,players);
    if(a){
      a.spec=spec;a.ownerSelection=[players[ownerIndex].animation.group,players[ownerIndex].animation.variant];
      if(['hadouken','cyclopsNormalBeam','cyclopsGeneBeam'].includes(spec.kind)){a.launchOffsetX=f(spec.x-players[ownerIndex].x);a.launchOffsetY=f(spec.y-players[ownerIndex].y);}
    }
    return a;
  }
  remove(a) {
    if(!a.alive)return;
    a.alive=false;a.visible=false;a.slotActive=false;a.retiredFrame=this.frame;
  }
  release(a) {
    // Native state2 cleanup returns the object to the pool on its next callback.
    if(a.prev)a.prev.next=a.next;else this.head=a.next;
    if(a.next)a.next.prev=a.prev;else this.tail=a.prev;
    this.count--;
  }
  palette(a,io) {
    // 00353690 updates the owner's shared channel2, not a random tint.
    if(--a.paletteWait<=0){
      const [ticks,variant]=PALETTE_CYCLE[a.paletteIndex];a.paletteWait=ticks;
      this.paletteSlots[a.ownerIndex]=variant;a.paletteIndex=(a.paletteIndex+1)%5;
      io.effect?.('00176160',[a.ownerIndex,2,variant,1]);
    }
  }
  reset(a,id,io) {
    a.attack.attackId=id;a.attack.contacted=false;a.attack.hitSet.clear();a.hitFlags=a.blockFlags=0;
    io.resetAttack?.(a,id);
  }
  queue(a) {
    // 001E7F60: native per-side collision-enqueue ceiling.
    if(this.queued[a.ownerIndex]>=94)return;
    a.blockFlags=0;this.queued[a.ownerIndex]++;this.collisionQueue.push(a);
  }
  inBounds(a,io,optic=false) {
    if(io.projectBounds)return io.projectBounds(a,{optic});
    const b=io.bounds;
    if(!b)throw new TypeError('Projectile runtime requires world bounds or native projectBounds');
    const xMargin=f(a.marginX*this.resources.system.scaleX),yMargin=f(a.marginY*this.resources.system.scaleY);
    return a.x>=b.left-xMargin&&a.x<=b.right+xMargin&&(!optic||a.y+yMargin>b.bottom);
  }
  frozen(a,io) { return typeof io.hitstop==='function'?io.hitstop(a):Boolean(io.hitstop); }
  select(a,group,variant,index) {
    if(index===undefined)a.animation.select(group,variant);else a.animation.seek(group,variant,index);
    a.visible=true;
  }
  opticSpawnChild(root,players,{terminal=false,collisionEnabled=false}={}) {
    return this.allocate(root.ownerIndex,{kind:'opticNode',root,terminal,collisionEnabled,nodeKind:1,
      attackId:root.attack.attackId,variation:root.variation,phase:0,cachedDirection:0},players,{after:root});
  }
  initialize(a,players,io) {
    a.initialized=true;
    const owner=players[a.ownerIndex];
    if(a.kind==='hadouken') {
      if(owner.animation.group!==a.ownerSelection[0]||owner.animation.variant!==a.ownerSelection[1]){this.remove(a);return;}
      Object.assign(a,{x:f(owner.x+a.launchOffsetX),y:f(owner.y+a.launchOffsetY),vx:a.spec.vx,vy:a.spec.vy,ax:a.spec.ax??0,ay:a.spec.ay??0,face:a.spec.face,phase:0,slotActive:Boolean(a.spec.ownerSlot)});
      this.select(a,a.spec.group,a.spec.variant);return;
    }
    if(a.kind==='cyclopsNormalBeam'||a.kind==='cyclopsGeneBeam') {
      const gene=a.kind==='cyclopsGeneBeam';
      Object.assign(a,{x:f(owner.x+a.launchOffsetX),y:f(owner.y+a.launchOffsetY),vx:a.spec.vx,vy:a.spec.vy??0,ax:0,ay:0,
        timer:gene?120:60,face:owner.face,paletteWait:1,paletteIndex:1,rotation:gene?32768:0});
      this.select(a,20,gene?1:0);this.normalBeam(a,io);return;
    }
    if(a.kind==='opticBeam'||a.kind==='megaOpticBeam') {
      Object.assign(a,{width:0,wait:4,phase:0,remaining:2,cooldown:0,timer:0,reload:0,
        quota:a.control.quota,collisionTimer:0,variation:a.kind==='megaOpticBeam'?2:0,
        special:false,toggle:0,groundImpact:false,paletteWait:1,paletteIndex:1});
      this.opticSpawnChild(a,players,{terminal:true,collisionEnabled:true});
      this.opticRoot(a,owner,players,io);return;
    }
    if(a.kind==='opticNode') { this.opticNode(a,owner,players,io);return; }
    if(a.kind==='shinkuHadouken') {
      Object.assign(a,{command:0,length:0,lengthWait:2,cycleWait:2,retract:false,hitSignal:false});
      a.x=f(owner.x+a.spec.offsetX);a.y=f(owner.y+a.spec.offsetY);a.face=a.spec.face;
      for(let i=0;i<12;i++)this.allocate(a.ownerIndex,{kind:'shinkuNode',root:a,index:i,phase:1,
        cachedCommand:-1,hitCycle:0,attackId:86},players,{after:a});
      return;
    }
    if(a.kind==='shinkuNode') { a.face=a.root.face;this.shinkuPosition(a);this.reset(a,86,io);this.shinkuPose(a);return; }
    if(a.kind==='superOpticBeam') {
      Object.assign(a,{command:0,remaining:2,limit:0,upper:0,lower:0,heightWait:0,collisionTimer:0,nodeKind:0});
      // 3537B0: initial terminal, advancing child and its own terminal.
      this.allocate(a.ownerIndex,{kind:'superTerminal',source:a,nodeKind:1,phase:2},players,{tail:true});
      const child=this.superSpawnChild(a,players,{terminal:true,initial:true});
      if(child)this.allocate(a.ownerIndex,{kind:'superTerminal',source:child,nodeKind:1,phase:2},players,{tail:true});
      this.superRoot(a,owner,players,io);return;
    }
    if(a.kind==='superNode') { this.superNode(a,owner,players,io);return; }
    if(a.kind==='superTerminal')this.superTerminal(a,io);
  }
  hadouken(a,io) {
    // 345A10: hit/block feedback is consumed on the following callback.
    if(a.phase===1){if(a.animation.step().jumped)this.remove(a);return;}
    if(!this.inBounds(a,io)){a.slotActive=false;this.remove(a);return;}
    if(a.hitFlags||a.blockFlags){a.slotActive=false;a.phase=1;this.select(a,21,13);a.attack.contacted=true;return;}
    a.x=f(a.x+a.vx);a.vx=f(a.vx+a.ax);a.y=f(a.y+a.vy);a.vy=f(a.vy+a.ay);
    a.animation.step();this.queue(a);
  }
  normalBeam(a,io) {
    // 00352540, including the immediate callback from initializer003521F0.
    this.palette(a,io);
    const ceiling=io.projectCeiling?io.projectCeiling(a):
      !io.bounds||a.y+f(f(this.resources.system.scaleY*a.marginY)-f(34.28571319580078))<=io.bounds.top;
    if(--a.timer<0||a.hitFlags||a.blockFlags||!this.inBounds(a,io)||!ceiling){
      this.paletteSlots[a.ownerIndex]=2;io.effect?.('00176090',[a.ownerIndex,2,2,1]);this.remove(a);return;
    }
    a.animation.step();a.x=f(a.x+a.vx);a.vx=f(a.vx+a.ax);a.y=f(a.y+a.vy);a.vy=f(a.vy+a.ay);this.queue(a);
  }
  opticPosition(root,owner) {
    if(root.kind==='opticBeam')Object.assign(root,opticOrigin(owner,root.ownerVariant));
    else {
      const pair=(owner.y>(owner.ground??0)?AIR_ORIGINS:GROUND_ORIGINS)[root.direction];
      let x=f(this.resources.system.scaleX*pair[0]);if(owner.face>0)x=-x;
      root.x=f(owner.x+x);root.y=f(owner.y-f(this.resources.system.scaleY*pair[1]));
    }
  }
  opticPose(a) {
    const root=a.root??a;
    this.select(a,21,8,opticFrame(a.direction,root.width,{child:Boolean(a.root),terminal:a.terminal}));
  }
  opticRoot(a,owner,players,io) {
    if(!a.control.active){this.remove(a);return;}
    if(this.frozen(a,io))return;
    if(a.special)a.width=a.control.target;
    if(a.width!==a.control.target&&--a.wait<0){a.wait=1;a.width+=a.width<a.control.target?16:-16;}
    if(a.cooldown)--a.cooldown;
    this.palette(a,io);
    a.phase^=2;a.hitSignal=false;a.direction=a.control.direction;a.face=owner.face;
    if(a.direction<8)a.face=-a.face;
    if(--a.timer<=0){
      if(a.timer<0)a.timer=a.reload;
      if(a.timer===0&&(!a.special||a.quota)){
        if(a.quota)--a.quota;
        const child=this.opticSpawnChild(a,players);
        if(child&&--a.remaining<0){a.remaining=2;child.collisionEnabled=true;}
      }
    }
    if(--a.collisionTimer<0){a.collisionTimer=10;
      if(!a.special){
        let id=owner.attack?.attackId??a.attack.attackId;
        if(a.variation){a.toggle=(a.toggle+1)&1;id+=a.toggle;}
        this.reset(a,id,io);this.queue(a);
      }
    }
    this.opticPosition(a,owner);this.opticPose(a);
  }
  opticNode(a,owner,players,io) {
    const root=a.root,previous=a.prev;
    if(!root.alive||!previous||previous.terminal){this.remove(a);return;}
    if(!root.special||root.timer===0)a.nodeKind++;
    a.direction=previous.direction;a.face=owner.face;
    const place=()=>Object.assign(a,opticChildPosition(previous,a.direction,root.width,
      {kind:a.nodeKind,terminal:a.terminal,face:owner.face}));
    place();this.opticPose(a);
    if(a.y<=(owner.ground??0)){
      a.direction=OPTIC_TABLES.reflection[a.direction];root.groundImpact=true;
      root.reflectedX=a.x;root.reflectedY=owner.ground??0;if(!root.cooldown)root.cooldown=30;
      if(root.special){this.remove(a);return;}
      place();a.y=f(a.y-f(34.28571319580078));this.opticPose(a);
    }
    if(a.direction<8)a.face=-a.face;
    if(!this.inBounds(a,io,true)){this.remove(a);return;}
    if(a.hitFlags||a.blockFlags){a.hitFlags=a.blockFlags=0;a.terminal=true;a.collisionEnabled=false;root.timer=6;return;}
    if(!root.special){
      let enabled=a.collisionEnabled;
      if(a.terminal){if(root.timer)return;enabled=true;}
      let id=owner.attack?.attackId??a.attack.attackId;
      if(a.variation){a.toggle=((a.toggle??0)+1)&1;id+=a.toggle;}
      this.reset(a,id,io);
      if(enabled)this.queue(a);
    }
  }
  shinkuPosition(a) { a.x=f(a.root.x+a.root.face*f(48*a.index));a.y=a.root.y; }
  shinkuPose(a) {
    const root=a.root;
    if(a.cachedCommand!==root.command){a.cachedCommand=root.command;this.select(a,25,(root.command*3+(a.index?a.phase:0))&255);}
  }
  shinkuRoot(a,owner,io) {
    if(owner.animation.group!==22){this.remove(a);return;}
    a.x=f(owner.x+a.spec.offsetX);a.y=f(owner.y+a.spec.offsetY);
    if(!a.retract&&(owner.animation.variant!==4&&owner.animation.variant!==6||a.ownerState.timer<=0)){
      a.retract=true;a.command=4;a.cycleWait=2;
    }
    if(this.frozen(a,io))return;
    a.hitSignal=false;
    if(a.retract){if(--a.cycleWait<=0){a.cycleWait=2;if(--a.command<0)this.remove(a);}return;}
    if(a.length<12&&--a.lengthWait<=0){a.lengthWait=2;a.length++;}
    if(--a.cycleWait<=0){a.cycleWait=2;if(++a.command>=8)a.command=5;}
  }
  shinkuNode(a,owner,io) {
    const root=a.root;if(!root.alive){this.remove(a);return;}
    if(this.frozen(a,io))return;
    this.shinkuPosition(a);a.visible=true;a.phase=1;
    if(root.length<a.index){a.visible=false;return;}
    if(root.length===a.index){a.phase=2;a.cachedCommand=-1;}
    if(a.hitFlags){root.hitSignal=true;
      if(--a.hitstop===0){a.hitCycle=(a.hitCycle+1)%3;this.reset(a,a.hitCycle===0?85:86,io);}
    }
    this.shinkuPose(a);if(!root.hitSignal)this.queue(a);
  }
  superSpawnChild(root,players,{terminal=false,initial=false}={}) {
    return this.allocate(root.ownerIndex,{kind:'superNode',root,nodeKind:1,age:1,
      command:0,terminal,collisionEnabled:terminal,textureChild:initial,upper:0,lower:0,initial,attackId:root.attack.attackId},players,{after:root});
  }
  superPose(a) {
    let index=a.command;
    if(index===0){
      let band=(((this.frame&1)^((a.phase??1)>>1))!==0)?a.lower+20:a.upper;
      index=(a.textureChild?SUPER_CHILD_FRAMES:SUPER_FRAMES)[band];
      if(index<0){a.visible=false;return;}
      if(index===undefined)throw Error(`Native Super Optic height band ${band} outside recovered table`);
    }
    this.select(a,22,2,index);
  }
  superRoot(a,owner,players,io) {
    if(owner.animation.group!==22||![0,8,9].includes(owner.animation.variant)||signed(a.control.target)<0){this.remove(a);return;}
    a.command=signed(a.control.target);
    if(this.frozen(a,io))return;
    if(a.heightWait&&--a.heightWait<=0)a.limit=a.upper=a.lower=0;
    const child=this.superSpawnChild(a,players);
    if(child){if(--a.remaining<0){a.remaining=5;child.collisionEnabled=true;}
      this.allocate(a.ownerIndex,{kind:'superTerminal',source:child,nodeKind:1,phase:2},players,{tail:true});}
    if(--a.collisionTimer<0){a.collisionTimer=4;this.reset(a,owner.attack?.attackId??56,io);}
    const air=owner.y>(owner.ground??0);
    a.face=owner.face;a.x=f(owner.x+owner.face*(air?65:f(93.33332824707031)));
    a.y=f(owner.y+(air?f(229.28570556640625):f(192.8571319580078)));
    this.select(a,22,2,(this.frame&1)*19);
  }
  heightBands(a,target) {
    let upper=-500,lower=500;
    for(const index of descriptor(target,this.resources).slice(2,6))if(index){
      const box=rectangle(target,index&0x1fff,this.resources);
      if(!box)continue;
      upper=Math.max(upper,f(box.y+box.ry));lower=Math.min(lower,f(box.y-box.ry));
    }
    const inside=y=>y<upper&&y>lower;
    const band=start=>{
      let y=f(a.y+f(start));
      if(inside(y)){for(let count=1;count<=4;count++){y=f(y-f(34.28571319580078));if(!inside(y))return count;}return 10;}
      for(let count=11;count<=14;count++){y=f(y-f(34.28571319580078));if(inside(y))return count;}return 0;
    };
    a.upper=band(154.28570556640625);a.lower=band(17.14285659790039);
  }
  superNode(a,owner,players,io) {
    const root=a.root,previous=a.prev;
    a.visible=false;
    // A predecessor marked for state2 cleanup still participates this frame;
    // native353C80 rejects stage>=3, rather than a merely hidden predecessor.
    if(!root.alive||!previous){this.remove(a);return;}
    a.command=root.command;
    if(root.limit>=a.age)a.upper=a.lower=0;else{a.upper=root.upper;a.lower=root.lower;}
    a.face=root.face;
    const distance=previous.nodeKind?32:56;
    a.x=f(previous.x+f(f(0.9)*f(this.resources.system.scaleX*distance))*a.face);a.y=previous.y;
    this.superPose(a,io);a.age++;
    if(!this.inBounds(a,io)){this.remove(a);return;}
    if(a.blockFlags){a.blockFlags=0;a.collisionEnabled=false;return;}
    if(a.hitFlags){
      a.hitFlags=0;a.collisionEnabled=false;
      const target=players[1-a.ownerIndex];this.heightBands(a,target);
      if(a.age>=root.limit){root.limit=Math.max(1,a.age-1);root.upper=a.upper;root.lower=a.lower;root.heightWait=8;}
      return;
    }
    this.reset(a,owner.attack?.attackId??root.attack.attackId,io);
    if(a.textureChild||a.collisionEnabled)this.queue(a);
  }
  superTerminal(a,io) {
    const source=a.source;
    if(!source.alive){this.remove(a);return;}
    a.x=source.x;a.y=source.y;a.face=source.face;a.visible=source.visible;
    a.command=source.command;a.upper=source.upper;a.lower=source.lower;a.textureChild=source.textureChild;
    if(source.nodeKind)this.superPose(a,io);else this.select(a,22,2,(1-(this.frame&1))*19);
  }
  tick(players,io) {
    this.frame=io.frame??this.frame+1;this.queued=[0,0];this.collisionQueue=[];
    for(let a=this.head;a;){
      if(!a.alive){if(a.retiredFrame<this.frame)this.release(a);}
      else if(!a.initialized)this.initialize(a,players,io);
      else if(a.kind==='hadouken')this.hadouken(a,io);
      else if(a.kind==='cyclopsNormalBeam'||a.kind==='cyclopsGeneBeam')this.normalBeam(a,io);
      else if(a.kind==='opticBeam'||a.kind==='megaOpticBeam')this.opticRoot(a,players[a.ownerIndex],players,io);
      else if(a.kind==='opticNode')this.opticNode(a,players[a.ownerIndex],players,io);
      else if(a.kind==='shinkuHadouken')this.shinkuRoot(a,players[a.ownerIndex],io);
      else if(a.kind==='shinkuNode')this.shinkuNode(a,players[a.ownerIndex],io);
      else if(a.kind==='superOpticBeam')this.superRoot(a,players[a.ownerIndex],players,io);
      else if(a.kind==='superNode')this.superNode(a,players[a.ownerIndex],players,io);
      else if(a.kind==='superTerminal')this.superTerminal(a,io);
      a=a.next;
    }
    // Channel2 is shared by the owner's resource block. The last native update
    // in list order supplies the palette for every corresponding beam actor.
    for(let a=this.head;a;a=a.next)if(a.alive&&a.name==='cyclops'&&a.kind!=='superOpticBeam'&&a.kind!=='superNode'&&a.kind!=='superTerminal')a.paletteVariant=this.paletteSlots[a.ownerIndex];
    // Native callbacks enqueue; contacts are resolved after the actor pass.
    for(const a of this.collisionQueue){
      if(!a.alive)continue;
      const targetIndex=1-a.ownerIndex,target=players[targetIndex];
      if(target.health<=0||a.attack.hitSet.has(targetIndex)||!contact(a,target,this.resources))continue;
      const hit=this.resources.actions[a.name].hitData[a.attack.attackId&127];
      const result=io.impact(a,target,hit,{projectile:true});
      if(result===null||result===false)continue;
      a.attack.hitSet.add(targetIndex);a.attack.contacted=true;
      a.hitFlags=result?.hitFlags??(result?.blocked?1:128);a.blockFlags=result?.blocked?1:0;
      if(a.kind==='shinkuNode')a.hitstop=hit[5];
    }
  }
}
