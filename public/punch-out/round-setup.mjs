/** Gameplay RAM setup from DEF AB58–AC37 and AE5F–AE7E.
 * PPU tile construction is delegated to the ASCII presentation. */
import {rotateRandom} from './fight-control.mjs';
export class RoundSetup {
  constructor({memory, read, health}) {
    this.memory = memory; this.read = read; this.health = health;
    if (typeof read !== 'function' || typeof health !== 'function') throw new TypeError('RoundSetup requires mapped read(address, bank) and original health()');
  }
  word(address) { return this.memory[address] | (this.memory[address+1] << 8); }
  enterCorner() {
    const m = this.memory;
    // AB4E is called for rounds 1–3 before the corner presentation.
    m[0x8f] = m[0x3ca] = 0; m.set([8,1,255],0x80);
    if (!m[0x3d8]) m[0x3d8] = 128;
    m[0x1b] = 0x81;
  }
  cornerInput(allowStart = true) {
    const m = this.memory;
    // A7A6/A800: Select's refill is sampled once while the corner enables it.
    if ((m[0x3d8] & 128) && (m[0xdb] & 128)) {
      m[0xdb] &= 127; m[0x3d8] = 1; m[0x20b] = m[0x233] = 0x11;
      const sample = rotateRandom(m,0);
      const index = (((m[6]-1) << 3) + (sample & 7)) & 255;
      m[0x3d9] = this.read((this.word(0x5ee) + index) & 65535,m[2]);
    }
    if (!allowStart || !(m[0xd9] & 128)) return false;
    m[0xd9] &= 127; m[0x3d8] &= 1; m[0xf3] = 1;
    return true;
  }
  recoverHealth() {
    const m = this.memory, refill = m[0x3d9], sum = (refill + m[0x391]) & 255;
    if (refill & 128) m[0x397] = sum && !(sum & 128) ? sum : 1;
    else if (refill) m[0x397] = Math.min(sum,0x5f);
    else m[0x397] = sum;
    m[0x3d9] = 0; m[0x39e] = m[0x398];
  }
  decision() {
    const m = this.memory;
    let carry = true;
    for (let y = 0; y < 4; y++) {
      const a = m[0x3e8+y], b = m[0x5c8+y]; carry = a >= b;
      if (a !== b) break;
    }
    m[0xc0] = 1; m[0xc1] = carry ? 0xaa : 0xab; m[0xc2] = 0xea;
  }
  prepare() {
    const m = this.memory;
    // AA1D; AEF8 $40/$B0; BF3C AA0A + AF38.
    m[4] = m[0x1c] = m[0x1d] = 1;
    m.fill(0,0x40,0xf0);
    for (const a of [0x12,0x13,0x14,0x15,0x16,0x20,0x21]) m[a] = 0;
    m[0x1d] = 2; m[0x10] &= 0xfb; m.fill(0xf8,0x200,0x300);
    m[0xb0] = m[0xb1] = 0;
    m.set(m[0x5cc] ? [16,2,254] : [8,1,255],0x80);
    if (m[0x5cc]) m[0x10] |= 0x20;
    m.set([0x5d,0,0x20,0xfc,0,0xfd,0x20,0,0,0xfe,0x20,0],0x200);
    m[0xa9] = 5; m[0x10] |= 4;
    m[0xb0] = m[0x5ce]; m[0xb1] = m[0x5cf];
    m[0x14] = m[0x16] = 1; m[0x15] = 0xb0; m[0x13] = 0xb0-m[0x5cc];
    m[0x310]--; m[0x311] = 0xc0;
    for (const a of [0x300,5,0x4fd,0x4fe,0x4ff,0x9a,0x36,0x35]) m[a] = 0;
    m[0x39] = 255; m[0x40] = 0x81; m[0x37] = 128; m[0x3e0] = 1;
    this.health();
    m[0x392] = m[0x393] = m[0x399] = m[0x39a] = 0;
    let complete = false;
    for (let i = 0; i < 1024; i++) {
      this.health();
      // C041 acknowledges both health bar writes each busy-loop iteration.
      if (m[0x394] & 128) m[0x394] = 0;
      if (m[0x39b] & 128) m[0x39b] = 0;
      if (m[0x392] === m[0x393] && m[0x399] === m[0x39a]) { complete = true; break; }
    }
    if (!complete) throw new Error('Original ABF1 health-bar fill did not finish');
    this.recoverHealth();
    if (m[6] >= 4) this.decision();
    // AF5B: copy the fighter's actual 32-byte palette, retain flash color.
    const index = (6+m[3]) & 255;
    const pointer = this.read(0x8000+index,m[2]) | (this.read(0x8001+index,m[2]) << 8);
    for (let i = 0; i < 32; i++) m[0x480+i] = this.read((pointer+i)&65535,m[2]);
    m[0x4a1] = m[0x48d]; m[0x48d] = 0x20; m[0x4a0] = 0x81;
    m[0] = 0x30; m[0x30] = m[0x38] = 1;
    // A8E3–A8EB resume the native combat engine on the next NMI.
    m[4] = 255; m[0x1c] = m[0x1d] = 0;
  }
}
