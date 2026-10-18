import {RoundSetup} from './round-setup.mjs';
import {CornerPresentation} from './corner-presentation.mjs';
import {PostfightPresentation} from './postfight-presentation.mjs';
import {SpecialPasswordPresentation} from './special-password-presentation.mjs';
/** Main-thread fight lifecycle recovered from DEF A90B–A9AA / BF7E–BF96.
 * Start from a captured clock-started seed, already inside A90B's wait loop.
 * Later corner-screen and circuit progression are explicit host handoffs. */
export class RoundFlow {
  constructor({memory, onTransition} = {}) {
    if (!(memory instanceof Uint8Array) || memory.length < 2048) throw new TypeError('RoundFlow requires 2048 RAM bytes');
    this.memory = memory;
    this.onTransition = onTransition;
    this.stage = 'fight';
    this.result = null;
  }
  configureSetup({read, health}) {
    this.setup = new RoundSetup({memory:this.memory,read,health});
    this.presentation = new CornerPresentation({memory:this.memory,read}); return this;
  }
  beginOpening() {
    this.menu=null;
    this.specialPassword = null;
    this.postfight = null;
    this.result = null; this.setup.enterCorner(); this.presentation.enter();
    this.stage = 'corner'; this.memory[0x1f] = 1; return this.snapshot();
  }
  beginPostfight(pending) {
    this.menu=null;
    this.specialPassword = null;
    this.postfight = new PostfightPresentation({memory:this.memory});
    this.postfight.enter(pending); this.stage = 'postfight'; return this.snapshot();
  }
  beginSpecialPassword(special) {
    this.menu=null;
    this.postfight=null;this.result=null;
    this.specialPassword=new SpecialPasswordPresentation({memory:this.memory,...special});
    this.stage='password-special';return this.snapshot();
  }
  beginMenu(menu) {
    this.menu=menu;this.postfight=this.specialPassword=null;this.result=null;
    this.memory[4]=this.memory[0x1c]=1;this.memory[0x1d]=255;this.memory[0x4c8]=0;
    this.stage='menu';return this.snapshot();
  }
  /** The original background builders turn NMI off while writing tile data.
   * Their two (corner) / one (ring) visible-frame spans do not clock RAM/audio. */
  get suppressNMI() { return this.stage === 'corner-build-stall' || this.stage === 'round-build-stall'; }
  withoutNMITick() {
    if (!this.suppressNMI) return this.snapshot();
    if (--this.buildFrames) return this.snapshot();
    if (this.stage === 'corner-build-stall') this.beginOpening();
    else { this.setup.prepare(); this.stage = 'round-intro'; this.memory[0x1f] = 1; }
    return this.snapshot();
  }
  beginCornerBuild() {
    this.stage = 'corner-build-wait'; this.memory[0x1f] = 1;
    this.memory[4] = this.memory[0x1c] = 1; this.memory[0x1d] = 2;
  }
  /** Original main-thread corner work, once per non-combat NMI after input. */
  presentationTick() {
    if(this.stage==='menu')this.menu.tick();
    else if (this.stage === 'password-special') {
      this.specialPassword.tick();
    } else if (this.stage === 'postfight') {
      this.postfight.tick();
    } else if (this.stage === 'corner') {
      // A7A6 runs in NMI even while trainer text is still blocking Start.
      this.setup.cornerInput(false); this.presentation.tick();
    } else if (this.stage === 'corner-scroll') {
      this.presentation.frame++; this.presentation.scrollTick();
    } else if (this.stage.startsWith('corner-')) this.presentation.frame++;
  }
  /** NMI A774, after B530 state completion, before returning to main thread. */
  fadeTick() {
    const m = this.memory;
    if (!m[0x4c8] || (m[0x1e] & 7)) return;
    m[0x4c8] -= 16;
    for (let x = 31; x >= 0; x--) {
      const address = 0x480 + x, a = m[address];
      if (a & 128 || a < m[0x4c8]) continue;
      // The CMP supplying this SBC has carry set because a >= fade threshold.
      m[address] = a >= 16 ? a - 16 : 0x8f;
    }
    m[0x4a0] = 0x81;
  }
  /** Call once after each NMI/game tick, after the host decrements $1F. */
  afterFrame() {
    const m = this.memory;
    if(this.stage==='menu'||this.stage.startsWith('demo'))return this.snapshot();
    if(this.stage==='password-special'){
      if(this.specialPassword.completed){this.stage='handoff';this.onTransition?.({type:'special-password-complete',kind:this.specialPassword.kind,terminal:'title'});}
      return this.snapshot();
    }
    if (this.stage === 'postfight') {
      if (this.postfight.completed) {
        this.stage = 'handoff';
        this.onTransition?.({type:'postfight-complete',terminal:this.postfight.terminal,result:this.result});
      }
      return this.snapshot();
    }
    if (this.stage === 'corner-build-wait' || this.stage === 'round-build-wait') {
      if (!m[0x1f]) { this.buildFrames = this.stage === 'corner-build-wait' ? 2 : 1; this.stage = this.stage === 'corner-build-wait' ? 'corner-build-stall' : 'round-build-stall'; }
      return this.snapshot();
    }
    if (this.stage === 'handoff') return this.snapshot();
    if (this.stage === 'corner') {
      if (!this.presentation?.scene) { this.presentation.enter(); m[0x1f] = 1; return this.snapshot(); }
      this.presentation.next();
      if (this.presentation.awaitingStart && this.setup.cornerInput(true)) {
        this.presentation.exit(); this.stage = 'corner-scroll'; m[0x1f] = 1;
      }
      return this.snapshot();
    }
    if (this.stage === 'corner-scroll') {
      if (m[0x15]) { m[0x1f] = 64; this.stage = 'corner-exit-wait'; }
      return this.snapshot();
    }
    if (this.stage === 'corner-exit-wait') {
      if (!m[0x1f]) { m[0x4c8] = 64; this.stage = 'corner-fade'; }
      return this.snapshot();
    }
    if (this.stage === 'corner-fade') {
      if (!m[0x4c8]) { m[0x1f] = 8; this.stage = 'corner-fade-pause'; }
      return this.snapshot();
    }
    if (this.stage === 'corner-fade-pause') {
      if (!m[0x1f]) { m[0x1b] = 128; m[0x1f] = 8; this.stage = 'corner-hidden-pause'; }
      return this.snapshot();
    }
    if (this.stage === 'corner-hidden-pause') {
      if (!m[0x1f]) { this.stage = 'round-build-wait'; m[0x1f] = 1; m[4] = m[0x1c] = 1; m[0x1d] = 2; }
      return this.snapshot();
    }
    if (this.stage === 'setup-wait') {
      if (!m[0x1f]) { this.setup.prepare(); this.stage = 'round-intro'; m[0x1f] = 1; }
      return this.snapshot();
    }
    if (this.stage === 'round-intro') {
      if (m[0] === 1) { m[0x1f] = 2; this.stage = 'round-light-wait'; }
      else m[0x1f] = 1;
      return this.snapshot();
    }
    if (this.stage === 'round-light-wait') {
      if (!m[0x1f]) { m[0x1b] = 0x81; m[0x22] = 1; if (m[6] === 4) m[0xf3] = 1; this.stage = 'fight'; }
      return this.snapshot();
    }
    if (this.stage === 'fight') {
      if (!(m[0] & 128)) { m[0x1f] = 1; return this.snapshot(); }
      // A912 -> BF7E: begins the fade after the frame which ends the fight.
      this.result = m[0]; m[0x4c8] = 0x40; m[0x1f] = 1; this.stage = 'fade';
      return this.snapshot();
    }
    if (this.stage === 'fade') {
      if (m[0x4c8]) m[0x1f] = 1;
      else { m[0x1f] = 8; this.stage = 'fade-pause'; }
      return this.snapshot();
    }
    if (m[0x1f]) return this.snapshot();
    if (this.stage === 'fade-pause') {
      m[0x1b] = 0x80; m[0x1f] = 8; this.stage = 'hidden-pause';
    } else if (this.stage === 'hidden-pause') {
      // A915 AA1D: stop the main combat engine before clearing its workspace.
      m[4] = m[0x1c] = m[0x1d] = 1; m[0x1d] = 255;
      m.fill(0, 0x40, 0xf0); m[0x30] = m[0x38] = m[0x22] = 0;
      m.set([8,1,255], 0x80); m[0x10] &= 0xdf;
      m[0x1f] = 32; this.stage = 'result-pause';
    } else if (this.stage === 'result-pause') {
      m[8] = m[9];
      const result = m[0];
      if (result === 255) {
        m[6]++;
        if (this.setup) {
          if (m[6] === 4) { this.stage = 'setup-wait'; m[0x1f] = 1; }
          else { this.beginCornerBuild(); }
        } else this.stage = 'handoff';
        this.onTransition?.({type: m[6] === 4 ? 'decision-round-setup' : 'corner-round-setup', round:m[6], result});
      } else {
        this.stage = 'handoff';
        this.onTransition?.({type:'circuit-result', result, route:[0xfe,0xfc].includes(result) ? 0xa977 : result === 0xfa ? 0xa97c : 0xa952});
      }
    }
    return this.snapshot();
  }
  get engineRunning() { return this.memory[0x1c] === 0; }
  snapshot() { const corner = this.stage === 'corner' || this.stage.startsWith('corner-'),postfight=this.specialPassword?.snapshot()??this.postfight?.snapshot()??null,menu=this.stage==='menu'?this.menu?.snapshot():null; return {stage:this.stage, result:this.result, engineRunning:this.engineRunning, pendingSetup:this.stage === 'handoff', awaitingStart:menu?menu.awaitingStart:postfight?postfight.awaitingStart:this.stage === 'corner' && !!this.presentation?.awaitingStart, completed:postfight?.completed??false,terminal:postfight?.terminal??null,presentation:menu??postfight??(corner ? this.presentation?.snapshot() ?? null : null)}; }
}


