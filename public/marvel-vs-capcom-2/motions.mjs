// Native command-descriptor recognizer: 00189390/001893E0/00189500,
// 0018A380/0018A460 and 0018A920. Directions retain the original relative bits.
import {SPECIALS} from './specials.mjs';
import {HYPERS} from './hypers.mjs';
export const BUTTON_BITS={lp:0x200,hp:0x100,lk:0x40,hk:0x20};
export function inputMask(keys,face) {
  let mask=0;
  const horizontal=Number(keys.has('right'))-Number(keys.has('left'));
  if(horizontal)mask|=horizontal===face?0x800:0x400;
  if(keys.has('down'))mask|=0x1000;
  if(keys.has('jump'))mask|=0x2000;
  for(const [button,bit] of Object.entries(BUTTON_BITS))if(keys.has(button))mask|=bit;
  return mask;
}
export class OriginalRandom {
  constructor(seed=0x51a7){this.low=seed&255;this.high=(seed>>>8)&255;}
  next(){const step=Math.floor((this.low+(this.high<<8))*3/256);this.low=(this.low+step)&255;this.high=step&255;return this.low;}
}
export class Motions {
  constructor(fighter,system,random,level=0){
    this.system=system;this.random=random;this.level=level;
    this.olderMask=0;
    const order=fighter==='ryu'?['shinShoryuken','shinkuHadouken','shinkuTatsu','shoryuken','hadouken','tatsu','airHadouken','airTatsu']:['superOpticBlast','megaOpticBlast','geneSplice','opticBlast','cycloneKick'];
    this.commands=order.map(name=>({name,profile:HYPERS[fighter]?.[name]||SPECIALS[fighter]?.[name],state:0,timer:0,index:0})).filter(c=>c.profile).map(c=>({...c,words:c.profile.words}));
  }
  timer(command){command.timer=this.level*10+this.system.motionStepTimers[this.random.next()&31];}
  check(current,previous,allow){
    const older=this.olderMask;this.olderMask=previous;
    for(const command of this.commands){
      const words=command.words, count=words[0], flags=words[1], directions=words.slice(4);
      if(command.state===3){
        command.state=0;
        const required=directions[command.index];
        const changed=required&((older^previous)|(previous^current));
        if(changed===required){
          const selection={key:command.name,strength:changed&0x120?1:0,buttonMask:changed,flags,profile:command.profile};
          if(allow(selection))return selection;
        }
        continue;
      }
      if(command.state===0){
        command.index=0;
        if((current&0x3c00)===directions[0]){this.timer(command);command.state=1;command.index=1;}
        continue;
      }
      if(command.state===1){
        if(--command.timer<=0){command.state=0;continue;}
        if((current&0x3c00)!==directions[command.index])continue;
        this.timer(command);command.index++;
        if(command.index!==count)continue;
        command.state=2;command.timer=this.level*10+15;
      }
      if(command.state!==2)continue;
      if(--command.timer<=0){command.state=0;continue;}
      let changed=(current^previous)&directions[command.index];
      if(!changed)continue;
      if((flags&0x8000)&&changed!==directions[command.index]){command.state=3;continue;}
      if(!(flags&0x40)){
        if(changed&0x120 && command.timer<this.level*10+4){
          if(!(flags&0x8600))changed&=0xfedf;
        }
        if(!((changed&0x120 && command.timer>=this.level*10+4)||(changed&0x2d0 && command.timer>=this.level*10+2))){command.state=0;continue;}
      }
      const selection={key:command.name,strength:changed&0x120?1:0,buttonMask:changed,flags,profile:command.profile};
      if(allow(selection)){command.state=0;return selection;}
    }
    return null;
  }
}
