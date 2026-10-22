// Native selected-character execution inside the existing two-player cabinet.
// Match format, arena and CPU remain cabinet scaffolding; action records,
// movement, collision data and character callbacks come from SLUS_204.86.
import {Animation} from './animation.mjs';
import {chooseNormal} from './actions.mjs';
import {Motions,OriginalRandom,inputMask,BUTTON_BITS,stepSuperJump,canSuperJump} from './motions.mjs';
import {contact,descriptor,rectangle,originalDamage} from './collision.mjs';
import {integrate,jumpMotion,walkVelocity,airMotion,superJumpSteer,superJumpFall,hitTier,pushProfile,applyPush,guardAllows,blockTicks,launchVector} from './physics.mjs';
import {createSpecial,updateSpecial} from './specials.mjs';
import {createHyper,updateHyper} from './hypers.mjs';
import {Projectiles} from './projectiles.mjs';
import {createNormalUpdate,updateNormal,startGroundNormal,recoverAirNormal,landNormalMotion} from './normal-updates.mjs';
import {createReaction,initializeReaction,updateReaction,SUPPORTED_REACTION_TYPES} from './reactions.mjs';
export const RATE=60,FLOOR=352;
const f=Math.fround, empty=()=>new Set(), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export class Match {
  constructor(fighter='ryu',mode='cpu',resources){
    if(!resources?.system || !resources?.actions || !resources?.moves)throw Error('Original character data is required');
    this.resources=resources;this.mode=mode;
    this.names=[fighter,fighter==='ryu'?'cyclops':'ryu'];
    this.wins=[0,0];this.round=0;this.events=[];this.particles=[];this.paused=false;
    this.random=new OriginalRandom();this.unsupportedEffects=new Set();this.roundStart();
  }
  roundStart(){
    this.round++;this.time=99*RATE;this.tickCount=0;this.phase='intro';this.delay=150;
    this.players=this.names.map((name,index)=>({
      name,index,x:index?558:210,y:0,ground:0,face:index?-1:1,vx:0,vy:0,ax:0,ay:0,
      // One-fighter cabinet: the two unavailable teammate slots are eliminated.
      health:144,meter:0,bars:1,defeatedTeamCount:2,state:'idle',age:0,attack:null,controller:null,
      animation:new Animation(this.resources.actions[name]),motions:new Motions(name,this.resources.system,this.random),
      hitstop:0,stun:0,block:false,crouch:false,walk:false,airborne:false,superJump:false,
      inputSet:empty(),previousMask:0,pendingButtons:empty(),punchEdges:0,attackEdges:0,latchedEdges:0,
      combo:0,comboDamage:0,flash:0,superFlash:0,hitFlags:0,pushQueue:[],pushFace:1,actionName:'',
    }));
    this.shots=new Projectiles(this.resources);this.projectiles=this.shots.actors;
    this.events.push({type:'round',round:this.round});
  }
  select(p,group,variant=0){p.animation.select(group,variant);p.age=0;}
  clearInput(){for(const p of this.players){p.previousMask=p.punchEdges=p.attackEdges=p.bufferedPunch=p.bufferedAttack=p.latchedEdges=0;p.superJumpCommand=null;p.pendingButtons.clear();for(const command of p.motions.commands)command.state=0;}}
  finish(p,mode=p.y>0?'air':'ground'){
    if(p.controller?.control)p.controller.control.active=0;
    if(p.reaction){p.combo=0;p.comboDamage=0;}
    p.attack=null;p.controller=null;p.reaction=null;p.hitFlags=0;p.actionName='';p.paletteVariant=null;
    if(mode==='air' && p.y>0){p.state='jump';const pose=recoverAirNormal(p,p.jumpDirection);this.select(p,pose.group,pose.variant);p.jumpDirection=pose.jumpDirection;}
    else {p.y=0;p.vx=p.vy=p.ax=p.ay=0;p.airborne=false;p.superJump=false;p.state='idle';this.select(p,0,0);}
  }
  meter(p,amount){
    // 0018C510 uses strict >144, not >=144, and caps at five whole bars.
    if(p.bars>=5){p.meter=0;return;}
    p.meter+=amount;
    if(p.meter>144){p.meter-=144;p.bars++;if(p.bars>=5){p.bars=5;p.meter=0;}}
  }
  setAttack(p,id){
    p.attack={...p.attack,attackId:id,contacted:false,hitSet:new Set()};p.hitFlags=0;
  }
  startNormal(p,button){
    if(p.y>0&&!p.superJump&&p.airActionUsed)return false;
    const action=chooseNormal(p,button,this.resources);
    if(!action)return false;
    p.attack={...action,contacted:false,hitSet:new Set()};p.controller=null;p.state='normal';
    p.latchedEdges=0; // 00186440 clears native364/366 on every normal entry.
    p.normalUpdate=createNormalUpdate(p.name,action,{air:p.y>0,crouch:p.crouch});
    p.actionName=action.name;this.select(p,action.group,action.variant);
    if(p.y<=0)startGroundNormal(p,this.resources.system);
    this.meter(p,this.resources.system.normalMeter[action.strength]);
    this.events.push({type:'swing',kind:action.strength===2?'heavy':'light'});
    return true;
  }
  allowMotion(p,selection){
    if(p.state==='hurt'||p.state==='knockdown'||(p.state==='block'&&p.stun>0)||p.health<=0)return false;
    const air=p.y>0, flags=selection.flags;
    if((flags&0x1000)&&air)return false;
    if((flags&0x2000)&&!air)return false;
    if(selection.profile.bars && p.bars<selection.profile.bars)return false;
    if(p.y>0&&!p.superJump&&p.airActionUsed&&['airTatsu','airHadouken'].includes(selection.key))return false;
    if(p.name==='ryu'&&selection.key==='hadouken'&&!p.superJump&&this.shots.actors.some(a=>a.ownerIndex===p.index&&a.kind==='hadouken'&&a.slotActive))return false;
    if(p.animation.cancelFlags&0x20)return false;
    if(p.attack){
      // 0018A580 has no normal hit-confirm requirement; frame20 is the no-cancel gate.
      if(p.attack.kind==='normal')return true;
      // 0018A7A0's hyper cancel accepts the original active cancel window.
      return Boolean(flags&0x100) && (p.animation.cancelFlags&0xe0)===0x80;
    }
    return true;
  }
  startMotion(p,selection,{defer=false}={}){
    const hyper=Boolean(selection.profile.bars);
    if(p.controller?.control)p.controller.control.active=0;
    if(p.y>0&&!p.superJump&&['airTatsu','airHadouken'].includes(selection.key))p.airActionUsed=true;
    p.controller=hyper?createHyper(p.name,selection.key,selection.strength,{air:p.y>0}):createSpecial(p.name,selection.key,selection.strength,{air:p.y>0});
    p.attack={kind:hyper?'hyper':'special',key:selection.key,contacted:false,hitSet:new Set()};
    p.state=hyper?'hyper':'special';p.actionName=selection.key.replace(/([A-Z])/g,' $1');
    if(!defer)this.updateController(p);
    this.events.push({type:'special',name:p.name});
  }
  controllerIO(p){
    const other=this.players[1-p.index];
    return {
      motion:p,target:other,inputSet:p.inputSet,edgeMask:p.attackEdges|p.latchedEdges,inputFacing:p.face<0?0:1,
      select:(g,v)=>this.select(p,g,v),advance:()=>p.animation.step(),get:i=>p.animation.bytes[i]||0,
      consume:i=>p.animation.consume(i),finish:mode=>this.finish(p,mode),
      setAttack:id=>this.setAttack(p,id),spawn:spec=>this.shots.spawn(p.index,spec,this.players),
      hitFlags:()=>p.hitFlags,airborne:value=>{p.airborne=value;},
      consumePunch:()=>{const result=Boolean(p.punchEdges);p.punchEdges=0;return result;},clearPunch:()=>{p.punchEdges=0;},
      consumeAttack:()=>{const result=Boolean(p.attackEdges);p.attackEdges=0;return result;},
      consumeHK:()=>{const result=Boolean((p.attackEdges|p.latchedEdges)&0x20);if(result)p.latchedEdges=0;return result;},
      attackFlags:value=>{if(p.attack)p.attack.flags=value;},
      airMotion:()=>{superJumpSteer(p,this.resources.system);airMotion(p,this.resources.system);},superJumpFall:()=>superJumpFall(p,this.resources.system),
      landCheck:(_address,state)=>p.y<=p.ground+(state===20&&!p.hitFlags?-42.85713958740234:0),
      landNormal:()=>{const pose=landNormalMotion(p,p.jumpDirection);p.attack=null;p.controller=null;p.state='landing';this.select(p,pose.group,pose.variant);},
      // 00183210's16 is actor-local flash lifetime, not a proven global freeze.
      superFlash:(bars,offset)=>{p.bars=Math.max(0,p.bars-bars);p.superFlash=16;this.events.push({type:'super',name:p.name,offset});},
      effect:(address,args)=>{
        if(address==='0018C4B0')this.meter(p,args[0]);
        else if(address==='001861B0')startGroundNormal(p,this.resources.system);
        else if(address==='001855D0')this.meter(p,this.resources.system.normalMeter[p.attack?.strength??2]);
        else if(address==='00176160'&&args[0]===0)p.paletteVariant=args[1];
        else if(address==='00175C00')p.paletteVariant=null;
        else if(!['00185490','00183D10','00183D50','00175C00','001861B0','001E3710','001E3210','001E3240','001E2490'].includes(address))this.unsupportedEffects.add(address);
      },
    };
  }
  updateController(p){const controller=p.controller;if(controller)(p.attack?.kind==='hyper'?updateHyper:updateSpecial)(controller,this.controllerIO(p));}
  ai(){
    // Cabinet CPU chooses real inputs; it does not bypass the native action gates.
    const me=this.players[1],other=this.players[0],keys=empty(),toward=other.x>me.x?'right':'left';
    if(Math.abs(other.x-me.x)>125)keys.add(toward);
    else if(other.attack && this.tickCount%90<28)keys.add(toward==='left'?'right':'left');
    if(Math.abs(other.x-me.x)<175 && this.tickCount%14===0)keys.add(this.tickCount%56===0?'hp':this.tickCount%28===0?'lk':'lp');
    return keys;
  }
  stepActor(p,other,keys){
    p.inputSet=keys;p.age++;p.flash=Math.max(0,p.flash-1);p.superFlash=Math.max(0,p.superFlash-1);
    const mask=inputMask(keys,p.face),edges=mask&~p.previousMask;
    for(const [button,bit] of Object.entries(BUTTON_BITS))if(edges&bit)p.pendingButtons.add(button);
    p.punchEdges=(p.bufferedPunch||0)|(edges&0x300);p.attackEdges=(p.bufferedAttack||0)|(edges&0x360);
    const previous=p.previousMask;p.previousMask=mask;
    // 00179590 calls the character command chain before its hitstop early return.
    const motion=p.motions.check(mask,previous,selection=>this.allowMotion(p,selection));
    if(motion){p.pendingButtons.clear();this.startMotion(p,motion,{defer:p.hitstop>0});}
    else stepSuperJump(p,edges); // character slot1 reaches188330 after motion predicates.
    if(p.hitstop>0){p.hitstop--;p.latchedEdges|=edges;p.bufferedPunch=p.punchEdges;p.bufferedAttack=p.attackEdges;return;}
    p.bufferedPunch=p.bufferedAttack=0;
    if(motion)return;
    if(p.y<=0&&!p.airborne)p.crouch=keys.has('down');
    if(p.state==='hurt'||p.state==='knockdown'){
      if(p.reaction){updateReaction(p.reaction,this.controllerIO(p));p.pendingButtons.clear();return;}
      applyPush(p,this.resources.system);
      if(p.airborne){integrate(p);if(p.y<=0 && p.vy<0){p.y=0;p.airborne=false;p.vx=p.vy=p.ax=p.ay=0;this.finish(p);p.combo=0;p.comboDamage=0;return;}}
      if(p.animation.step().jumped && !p.airborne){this.finish(p);p.combo=0;p.comboDamage=0;}
      p.pendingButtons.clear();return;
    }
    if(p.state==='block'){
      const desired=keys.has('down')?5:1;
      if((p.animation.variant>=4)!==p.crouch)this.select(p,5,desired);
      applyPush(p,this.resources.system);p.animation.step();
      if(p.stun>0){p.stun--;p.pendingButtons.clear();return;}
      this.finish(p);
    }
    if(canSuperJump(p,other,this.resources)){
      if(p.controller?.control)p.controller.control.active=0;
      p.attack=p.controller=p.normalUpdate=null;p.hitFlags=0;p.pendingButtons.clear();p.superJumpCommand.ready=0;
      const horizontal=Number(keys.has('right'))-Number(keys.has('left'));
      const variant=jumpMotion(p,horizontal,this.resources.system,true);
      p.state='jump';p.actionName='super jump';this.select(p,1,6+variant);return;
    }
    if(p.controller){this.updateController(p);p.pendingButtons.clear();return;}
    if(p.attack?.kind==='normal')for(const [button,bit]of Object.entries(BUTTON_BITS))if(p.latchedEdges&bit)p.pendingButtons.add(button);
    for(const button of ['hk','hp','lk','lp'])if(p.pendingButtons.has(button) && this.startNormal(p,button)){p.pendingButtons.clear();return;}
    p.pendingButtons.clear();
    if(p.attack){
      updateNormal(p.normalUpdate,this.controllerIO(p));
      return;
    }
    if(p.state==='landing'){if(p.animation.step().jumped)this.finish(p);return;}
    if(Math.abs(other.x-p.x)>23.333332061767578)p.face=other.x>p.x?1:-1;
    const horizontal=Number(keys.has('right'))-Number(keys.has('left'));
    p.block=horizontal===-p.face;p.crouch=keys.has('down')&&p.y<=0;
    if(p.y>0 || p.vy>0){
      superJumpSteer(p,this.resources.system);airMotion(p,this.resources.system);superJumpFall(p,this.resources.system);p.animation.step();
      if(p.y<=0){p.y=0;this.finish(p);}
      return;
    }
    if(edges&0x2000){
      const variant=jumpMotion(p,horizontal,this.resources.system,false);
      p.state='jump';this.select(p,1,variant);return;
    }
    if(p.crouch){
      if(p.state!=='crouch'){p.state='crouch';this.select(p,3,0);}
      else if(p.animation.step().jumped)this.select(p,3,1);
    }else if(horizontal){
      const variant=horizontal===p.face?2:3;
      if(p.state!=='walk'||p.animation.variant!==variant){p.state='walk';this.select(p,0,variant);}
      else p.animation.step();
      p.x=f(p.x+walkVelocity(p,horizontal,this.resources.system));
    }else{
      if(p.state!=='idle'){p.state='idle';this.select(p,0,0);}
      else p.animation.step();
    }
  }
  impact(attacker,target,row){
    const owner=this.players[attacker.ownerIndex??attacker.index],blocked=guardAllows(target,row),system=this.resources.system;
    attacker.hitFlags=blocked?1:0x80;if(owner)owner.hitFlags=attacker.hitFlags;
    if(attacker.attack)attacker.attack.contacted=true;
    if(owner?.attack)owner.attack.contacted=true;
    attacker.hitstop=row[5];target.hitstop=row[5];
    if(target.controller?.control)target.controller.control.active=0;
    target.controller=null;target.attack=null;target.paletteVariant=null;target.pushFace=owner?.face??attacker.face;
    target.pushQueue=pushProfile(row,system);
    if(blocked){
      target.state='block';target.stun=blockTicks(row);this.select(target,5,target.crouch?7:3);
      // Native chip calculation is tracked separately from base damage.
      // 0018D340: native-scaled base damage /8, minimum1; flag18&2 disables chip.
      const chip=row[0]&&!(row[18]&2)?Math.max(1,Math.trunc(originalDamage(target,row,target.combo,system)/8)):0;
      target.health=Math.max(0,target.health-chip);
    }else{
      const damage=originalDamage(target,row,target.combo,system);
      target.health=Math.max(0,target.health-damage);target.combo++;target.comboDamage+=damage;
      target.state='hurt';target.actionName='';target.flash=5;
      if(SUPPORTED_REACTION_TYPES.includes(row[1]&31)){
        target.reaction=createReaction(target,row,attacker,this.resources);
        initializeReaction(target.reaction,this.controllerIO(target));
      }else if(target.y>0 || (row[1]&31)===1){
        const strength=clamp(row[9]+system.facingKnockbackAdjust[7],0,15),vector=launchVector(row[8],strength,system);
        target.vx=f((owner?.face??attacker.face)*Math.abs(vector.vx));target.vy=vector.vy;target.ax=0;target.ay=f(-0.8035714030265808);
        target.airborne=true;this.select(target,13,10+hitTier(row));
      }else{
        target.vx=target.vy=target.ax=target.ay=0;
        this.select(target,13,(target.crouch?6:3)+hitTier(row));
      }
    }
    this.events.push({type:blocked?'block':'hit',x:target.x,y:FLOOR-target.y-100,kind:row[0]>=10?'heavy':'light'});
    this.particles.push({x:target.x,y:FLOOR-target.y-100,t:14,max:14,blocked});
    return {blocked,hitFlags:attacker.hitFlags};
  }
  resolveBodyPush(){
    const [a,b]=this.players,sys=this.resources;
    const ar=rectangle(a,descriptor(a,sys)[6]||0,sys),br=rectangle(b,descriptor(b,sys)[6]||0,sys);
    if(!ar||!br||Math.abs(ar.y-br.y)>ar.ry+br.ry)return;
    const overlap=ar.rx+br.rx-Math.abs(ar.x-br.x);
    if(overlap>0){const sign=ar.x<br.x?-1:1;a.x+=sign*overlap/2;b.x-=sign*overlap/2;}
  }
  tick(given=[empty(),empty()]){
    if(this.paused||this.phase==='result')return;
    this.tickCount++;
    this.particles=this.particles.filter(p=>--p.t>0);
    if(this.phase==='intro'){
      this.players.forEach(p=>p.animation.step());
      if(--this.delay<=0){this.phase='active';this.events.push({type:'fight'});}return;
    }
    if(this.phase==='roundover'){
      this.players.forEach(p=>p.animation.step());
      if(--this.delay<=0){if(Math.max(...this.wins)>=2){this.phase='result';this.events.push({type:'result',winner:this.winner});}else this.roundStart();}return;
    }
    this.time--;
    const inputs=[given[0]||empty(),this.mode==='cpu'?this.ai():(given[1]||empty())];
    // Current inputs defend for both players before resolving either contact.
    this.players.forEach((p,i)=>{p.inputSet=inputs[i];const horizontal=Number(inputs[i].has('right'))-Number(inputs[i].has('left'));p.block=horizontal===-p.face&&!p.attack&&p.state!=='hurt';});
    this.players.forEach((p,i)=>this.stepActor(p,this.players[1-i],inputs[i]));
    this.resolveBodyPush();
    const contacts=[];
    this.players.forEach((p,i)=>{
      if(!p.attack || p.attack.attackId==null || p.hitstop>0 || p.attack.hitSet.has(1-i))return;
      if(contact(p,this.players[1-i],this.resources)){
        p.attack.hitSet.add(1-i);contacts.push([p,this.players[1-i],this.resources.actions[p.name].hitData[p.attack.attackId&127]]);
      }
    });
    for(const args of contacts)this.impact(...args);
    this.shots.tick(this.players,{impact:(...args)=>this.impact(...args),resetAttack:(actor,id)=>this.setAttack(actor,id),frame:this.tickCount,bounds:{left:0,right:768,bottom:0,top:800}});
    this.projectiles=this.shots.actors;
    this.players.forEach(p=>{p.x=clamp(p.x,45,723);});
    const [a,b]=this.players;
    if(a.health<=0||b.health<=0||this.time<=0){
      this.winner=a.health===b.health?-1:a.health>b.health?0:1;
      if(this.winner>=0)this.wins[this.winner]++;
      this.phase='roundover';this.delay=135;
      this.players.forEach((p,i)=>{if(p.controller?.control)p.controller.control.active=0;p.controller=null;p.attack=null;p.state=this.winner<0?'idle':i===this.winner?'win':'ko';this.select(p,p.state==='ko'?17:p.state==='win'?18:0,0);});
      this.events.push({type:'ko',winner:this.winner});
    }
  }
}
