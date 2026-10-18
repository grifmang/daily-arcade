/** Native Little Mac state/data port, PRG bank $0B:$8119–$85D0.
 * read() supplies bank-$0B cartridge data, never executable CPU instructions.
 */
export class PlayerState {
  constructor({ memory = new Uint8Array(2048), read, hooks = {} } = {}) {
    if (!(memory instanceof Uint8Array) || memory.length < 2048) throw new TypeError('PlayerState requires 2048 RAM bytes');
    if (typeof read !== 'function') throw new TypeError('PlayerState requires read(address) for bank $0B data');
    this.memory = memory;
    this.read = read;
    this.hooks = hooks;
    this.frame = 0;
    this.events = [];
  }
  word(a) { return this.memory[a] | this.memory[a + 1] << 8; }
  setWord(a, v) { this.memory[a] = v; this.memory[a + 1] = v >> 8; }
  data(i) { return this.read((this.word(0x54) + (i & 255)) & 65535); }
  emit(type, detail = {}) { this.events.push({ frame: this.frame, type, ...detail }); }
  setExplicitUnsupported(address, reason) {
    const detail = { address, reason };
    this.emit('unsupported', detail);
    this.hooks.unsupported?.(detail);
    throw new Error(`Unsupported Little Mac path $${address.toString(16)}: ${reason}`);
  }
  snapshot() {
    const m = this.memory;
    return { frame: this.frame, state: m[0x50], status: m[0x51], timer: m[0x52],
      index: m[0x53], pointer: this.word(0x54), repeat: m[0x56], contact: m[0x58],
      punchAux: m[0x59], comboAtStart: m[0x5b], pose: m[0x61],
      displayPending: m[0x60], x: m[0x15], spriteX: m[0x70], spriteY: m[0x71],
      punchType: m[0x74], damage: m[0x75], defense: [m[0x76], m[0x77]],
      canPunch: m[0xbc], stars: m[0x342], starRequest: m[0x341] };
  }
  consume(a) {
    const m = this.memory;
    if (!(m[a] & 128)) return false;
    m[a] &= 127;
    return true;
  }
  /** $8119: call after the original controller-edge normalizer, before tick(). */
  input() {
    const m = this.memory;
    if (m[4] !== 255) return this.demoInput();
    if (!m[0x50] || m[0x50] >= 64 || (m[0x51] & 128)) return;
    if (m[0xbc]) {
      if (this.consume(0xd5)) {
        m[0x50] = m[0xd2] & 8 ? 0x8b : 0x89;
        m[0x6b] = m[0xd2] & 8 ? 1 : 0;
        return;
      }
      if (this.consume(0xd7)) {
        m[0x50] = m[0xd2] & 8 ? 0x8c : 0x8a;
        m[0x6b] = m[0xd2] & 8 ? 1 : 0;
        return;
      }
      if (m[0x342] && this.consume(0xd9)) {
        m[0x341] = 255;
        if (m[0x348]) m[0x348]--;
        m[0x50] = 0x8d;
        m[0x6b] = 0;
        return;
      }
    } else if (this.consume(0xd5) || this.consume(0xd7) || this.consume(0xd9)) {
      m[0x53] = 10;
      m[0x6b] = 0;
      return;
    }
    let directions;
    if (m[0xd3] & 128) directions = m[0xd2];
    else if (m[0x6b]) directions = m[0xd0] & 15;
    else return;
    const next = directions & 1 ? 0x83 : directions & 2 ? 0x85 : directions & 4 ? 0x87 : 0;
    if (next) { m[0x50] = next; m[0xd3] &= 127; }
    m[0x6b] = 0;
  }
  /** $8207: cartridge attract-mode input stream, distinct from live controls. */
  demoInput() {
    const m = this.memory;
    if (!m[0x4b0]) return;
    if (m[0x4b0] & 128) { m[0x4b0] = 1; m[0x4b2] = 0; m[0x4b1] = 1; }
    m[0xd3] = m[0xd5] = m[0xd7] = 0;
    if (m[0x50] !== 1 || (m[0x51] & 128)) return;
    m[0x4b1]--;
    if (m[0x4b1]) return;
    m[0x4b1]++;
    const command = this.read(0x9500 + m[0x4b2]);
    m[0x4b2]++;
    if (command === 128) {
      m[0x4b1] = this.read(0x9500 + m[0x4b2]); m[0x4b2]++; return;
    }
    if (!m[0xbc] && command >= 0x89 && command !== 0x8e) {
      m[0x53] = 10; m[0x6b] = 0; return;
    }
    if (m[0xbc] && command === 0x8d) {
      if (!m[0x342]) return;
      m[0x341] = 255;
      if (m[0x348]) m[0x348]--;
    }
    m[0x6b] = m[0xbc] && command >= 0x8b && command < 0x8d ? 1 : 0;
    m[0x50] = command;
  }
  initState() {
    const m = this.memory;
    m[0x50] &= 127; m[0x51] |= 128;
    m[0x52] = 1; m[0x53] = m[0x56] = m[0x58] = m[0x59] = 0;
    m[0x5b] = m[0x4a] && m[0x4b] ? 1 : 0;
    m.fill(0, 0x74, 0x78);
    const a = (m[0x50] < 64 ? 0x9800 + m[0x50] * 2 : 0x982c + (m[0x50] - 64) * 2);
    this.setWord(0x54, this.read(a) | this.read(a + 1) << 8);
    if (m[0x50] < 64 && !m[0x55]) this.setExplicitUnsupported(0x8308, 'zero-high state pointer falls through to secondary table');
    this.emit('state', { state: m[0x50], pointer: this.word(0x54) });
  }
  randomPass(threshold) {
    // $85E2: three RORs mutate shared entropy, but the sampled value is the
    // pre-rotation byte in A. Carry into the first ROR comes from CMP #$0F.
    const m = this.memory, sample = m[0x18];
    m[0xef] = threshold; m[0xee] = 15;
    if (threshold === 15) return true;
    let carry = threshold >= 15 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const nextCarry = m[0x18] & 1;
      m[0x18] = (m[0x18] >> 1) | carry << 7;
      carry = nextCarry;
    }
    m[0xee] = (sample & 15) + 1;
    return threshold >= m[0xee];
  }
  /** $8319: advance one original player-state invocation (no input/display). */
  tick() {
    const m = this.memory;
    this.frame++;
    if (!m[0x50]) return this.snapshot();
    if (m[0x50] & 128) this.initState();
    m[0x52]--;
    if (m[0x52]) return this.snapshot();
    m[0x52]++;
    for (let budget = 0; budget < 1024; budget++) {
      const command = this.data(m[0x53]++), x = command & 15, group = command >> 4;
      let y = m[0x53], direct = false;
      const next = () => { const v = this.data(y); y = (y + 1) & 255; return v; };
      const jump = () => { y = this.data(y); direct = true; };
      const show = () => { m[0x61] = next(); m[0x60] = 128; };
      if (group <= 2) {
        m[0x52] = x;
        if (group <= 1) show();
        if (group === 1) m[0x15] = next();
        if (group === 1 && !m[0x15]) this.setExplicitUnsupported(0x837d, 'zero display X follows unusual handler fall-through');
        if (group === 2) {
          m[0x15] += next();
          if (!m[0x15]) this.setExplicitUnsupported(0x8389, 'zero display X falls through to random-branch handler');
        }
      } else if (group === 3) {
        if (this.randomPass(x)) jump(); else { next(); direct = true; }
      } else if (group === 4) {
        show(); m[0x52] = x; m[0x15] += next();
        if (!m[0x15]) this.setExplicitUnsupported(0x8389, 'zero display X falls through to random-branch handler');
      } else if (group <= 8) {
        m[0x52] = next();
      } else if (group <= 14) {
        if (x <= 2) {
          if ((m[0xd3] & 128) && (m[0xd2] & [9, 10, 4][x])) { m[0xd3] &= 127; jump(); }
          else { next(); direct = true; }
        } else if (x === 3 || x === 13) {
          const address = next() | (x === 13 ? next() << 8 : 0), value = next();
          if (address >= m.length) this.setExplicitUnsupported(0x8404, `comparison outside supplied RAM at $${address.toString(16)}`);
          if (value === m[address]) jump(); else { next(); direct = true; }
        } else if (x === 4) {
          if (m[0x6a] === 0) {
            if (!(m[0xd3] & 129)) m[0x6a] = 1;
            next();
          } else if (m[0x6a] & 128) {
            if (!(m[0xd3] & 129)) m[0x50] = m[0xbc] ? 0x81 : 0x82;
            next();
          } else if ((m[0xd3] & 128) && (m[0xd2] & 4)) {
            m[0xd3] &= 127; m[0x50] = 14; jump();
          } else { next(); }
        } else if (x === 5) { m[0x99] = 1; m[0x74] = next(); this.emit('punch', { punchType: m[0x74] }); }
        else if (x === 6) {
          const value = next();
          if (value && !m[0x300]) m[0x300] = value;
          m[0x301] = (m[0x301] & 254) | (value ^ 1);
        } else if (x === 7 || x === 8) {
          const a = 0x70 + x - 7;
          m[a] += next(); m[0x61] = m[a]; m[0x60] = 128;
        }
        else if (x === 9) {
          this.setWord(0x7e, this.word(0x54));
          const lo = next(), hi = next(); m[0x7d] = y;
          this.setWord(0x54, lo | hi << 8); y = 0; direct = true;
        } else if (x === 10) { this.setWord(0x54, this.word(0x7e)); y = m[0x7d]; direct = true; }
        else if (x === 11) { m[0x391] = m[0x397]; m[0x398] = m[0x39e]; direct = true; }
        else if (x === 12) { const v = next(); m[0xf0 + (v & 3)] = v & 128 ? v & 252 : (v & 252) >> 2; direct = true; }
        else this.setExplicitUnsupported(0x83b2 + x * 2, `invalid extended command $${command.toString(16)}`);
      } else {
        switch (x) {
          case 0:
            if (!m[0x58] || (m[0x58] & 128)) {
              if (!m[0x58]) m[0x58] = m[0x5b] ? 129 : 128;
              m[0x53]--; return this.snapshot();
            }
            if (m[0x58] === 1) jump();
            else if (m[0x58] === 2) { next(); jump(); }
            else { next(); next(); direct = true; }
            m[0x58] = 0;
            break;
          case 1: {
            const lo = next(), hi = next(), index = next();
            if (!lo) this.setExplicitUnsupported(0x854b, 'zero low pointer follows unusual long-jump fall-through');
            this.setWord(0x54, lo | hi << 8); y = index; m[0x58] = 0; direct = true; break;
          }
          case 2: m[0x51] &= 127; direct = true; break;
          case 3: m[0x56]--; if (m[0x56]) jump(); else { next(); direct = true; } break;
          case 4: m[0x50] = 0x82 - m[0xbc]; break;
          case 5: m[0x56] = next(); break;
          case 6: m[0x75] = next(); break;
          case 7: m[0x76] = next(); m[0x77] = next(); break;
          case 8: { const a = next(); if (a === 0x53) y = (y + 1) & 255; else m[a]++; direct = true; break; }
          case 9: this.setExplicitUnsupported(0x8502, 'unused dispatch entry points at $0000'); break;
          case 10: { const a = next(), value = next(); if (a === 0x53) y = value; else m[a] = value; break; }
          case 11: m[0x48e] = 0x8f; m[0x48d] = 0x30; m[0x4a0] = 129; direct = true; break;
          case 12: m[0x48e] = m[0xbc] ? 0x8f : 0x14; m[0x48d] = m[0x4a1]; m[0x4a0] = 129; direct = true; break;
          case 13: m[0x59] = next(); direct = true; break;
          case 14: this.setExplicitUnsupported(0x850c, 'unused dispatch entry points at $0000'); break;
          case 15: m[0x53]--; m[0x51] = 0x83; return this.snapshot();
        }
      }
      m[0x53] = y;
      // Direct continuations at $8325 skip the zero marker test at $8358.
      if (direct) continue;
      if (this.data(m[0x53]) !== 0) return this.snapshot();
      m[0x53]++;
      if (!m[0x53]) return this.snapshot();
    }
    this.setExplicitUnsupported(0x8325, 'state script exceeded bounded same-frame continuation budget');
  }
  /** $8280: prepare cartridge pose descriptor for the native ASCII renderer. */
  prepareDisplay() {
    const m = this.memory;
    if (!(m[0x60] & 128)) return;
    this.hooks.render?.(m[0x61]);
    const index = (m[0x61] << 1) & 255;
    const table = m[0x61] & 128 ? 0x88c4 : 0x8800;
    const pointer = this.read(table + index) | this.read(table + index + 1) << 8;
    const tileIndex = this.read(pointer);
    this.setWord(0x63, this.read(0x8a3f + tileIndex) | this.read(0x8a40 + tileIndex) << 8);
    this.setWord(0x66, this.read(pointer + 1) | this.read(pointer + 2) << 8);
    m[0x60] = 1;
  }
}
