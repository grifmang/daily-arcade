/** Native translations of fixed-bank fight control, PRG_BankDEF B069–B277,
 * B457–B665 and C27B–C3D8. All timers count original game ticks. */
const byte = n => n & 255;
export function rotateRandom(memory, carry = 0) {
  const sample = memory[0x18];
  for (let i = 0; i < 3; i++) {
    const next = memory[0x18] & 1;
    memory[0x18] = (memory[0x18] >>> 1) | (carry << 7);
    carry = next;
  }
  return sample;
}
export function thresholdRandom(memory, threshold, mask = 15) {
  threshold &= 255;
  memory[0xef] = threshold; memory[0xee] = mask;
  if (threshold === mask) return true;
  const sample = rotateRandom(memory, threshold >= mask ? 1 : 0);
  mask &= sample;
  memory[0xee] = mask;
  // AEC4 returns CMP carry, but the equality path explicitly clears it.
  return threshold > mask;
}
export class FightControl {
  constructor({ memory = new Uint8Array(2048), read, random, onGetUpDisplay } = {}) {
    if (!(memory instanceof Uint8Array) || memory.length < 2048) throw new TypeError('FightControl requires 2048 RAM bytes');
    if (typeof read !== 'function') throw new TypeError('FightControl requires read(address)');
    this.memory = memory; this.read = read; this.random = random; this.onGetUpDisplay = onGetUpDisplay;
  }
  word(p) { return this.memory[p] | (this.memory[(p + 1) & 0x7ff] << 8); }
  setWord(p, v) { this.memory[p] = v; this.memory[p + 1] = v >> 8; }
  data(p, y = 0) { return this.read((this.word(p) + byte(y)) & 65535); }
  rng(t, mask = 15) { return thresholdRandom(this.memory, t, mask); }
  unsupported(where, value) { throw new Error(`Unrecovered fight-control ${where}: $${value.toString(16)}`); }
  clockEvents() {
    const m = this.memory;
    if (!m[0x30]) return;
    let y = 0;
    let a = this.data(0x31, y);
    if (a < 0xd0) { if (a !== m[0x311]) return; a = this.data(0x31, ++y); }
    for (let guard = 0; guard < 1024; guard++) {
      y = byte(y + 1);
      if (a < 0xe0) { m[0x37] = a & 0x87; if (!m[0x37]) this.unsupported('B086 zero command fallthrough', a); }
      else if (a < 0xf0) {
        if (a !== 0xe0) {
          let count = a & 15; m[0xe0] = count;
          m[0xe1] = this.data(0x31, y++); m[0xe2] = this.data(0x31, y++);
          let x = 0;
          do {
            const address = this.word(byte(0xe1 + x));
            if (address >= 2048) this.unsupported('clock write address', address);
            m[address] = this.data(0x31, y++); x = byte(x + 1);
            m[0xe0] = byte(--count);
          } while (count);
        }
      } else if (a === 0xff) {
        let x = this.data(0x31, y++); let count = this.data(0x31, y++); m[0xe2] = count;
        const offset = this.data(0x31, y++); m[0xe3] = y;
        const p = this.data(0x33, offset) | (this.data(0x33, byte(offset + 1)) << 8);
        this.setWord(0xe0, p);
        let i = 0;
        do { m[0x500 + x] = this.read((p + i) & 65535); i = byte(i + 1); x = byte(x + 1); count = byte(count - 1); m[0xe2] = count; } while (count);
      } else if (a === 0xfe || a === 0xfd) {
        let count = a === 0xfe ? 1 : 2; m[0xe0] = count;
        let x = this.data(0x31, y++);
        do { m[0x500 + x] = this.data(0x31, y++); x = byte(x + 1); m[0xe0] = --count; } while (count);
      }
      y = byte(y);
      a = this.data(0x31, y);
      if (a === 0) { y = byte(y + 1); a = this.data(0x31, y); continue; }
      this.setWord(0x31, (this.word(0x31) + y) & 65535); return;
    }
    throw new Error('Clock script exceeded bounded command budget');
  }
  loadPattern(a) {
    const m = this.memory;
    a &= 7; m[0x35] = a;
    const x = (a & 6) << 4, y = x + ((a & 1) << 1);
    m[0xee] = x;
    m[0x3b] = m[0x500 + y]; m[0x3c] = m[0x501 + y];
    m[0x3a] = m[0x37] = 0; m[0x39] = 1;
    m[0x584] = m[0x504 + x]; m[0x580] = m[0x581] = m[0x505 + x];
    m[0x582] = m[0x506 + x] & 7; m[0x583] = m[0x506 + x] >>> 3;
    for (let i = 0; i < 8; i++) m[0x585 + i] = m[0x507 + x + i];
    m[0x36] = 0x80;
  }
  selectPattern() {
    const m = this.memory, request = m[0x36];
    if ((m[0x90] & 127) !== 1 || request & 128) return;
    if (!request) { if (m[0x37] & 128) this.loadPattern(m[0x37]); return; }
    for (const [bit, pattern] of [[1,1], [2,7], [4,6], [8,2]]) if (request & bit) { this.loadPattern(pattern); return; }
  }
  patternTick() {
    const m = this.memory;
    if (!m[0x38] || m[0x90] !== 1) return;
    m[0x39]--; if (m[0x39]) return; m[0x39]++;
    for (let guard = 0; guard < 1024; guard++) {
      let y = m[0x3a], a = this.data(0x3b, y), x = a & 15;
      m[0x3a]++; y = byte(y + 1);
      if (a < 0x80) {
        if (a < 0x10) { m[0x39] = x; m[0x3a]++; m[0x90] = this.data(0x3b, y); m[0x92] = 1; return; }
        if (a < 0x20) { m[0x3a] = this.rng(x) ? this.data(0x3b, y) : byte(y + 1); continue; }
        if (a < 0x30) {
          m[0x39] = x;
          const sample = rotateRandom(m, 0); // CMP #$80 left carry clear.
          const sum = (sample & 7) + m[0x3a]; y = byte(sum); m[0x3a] += 8 + (sum > 255 ? 1 : 0);
          m[0x90] = this.data(0x3b, y); m[0x92] = 1; return;
        }
        this.unsupported('pattern jump table', a);
      }
      if (a < 0x90) {
        if (x === 0) { m[0x39] = this.data(0x3b, y++); m[0x3a] = y; return; }
        if (x === 1) {
          rotateRandom(m, 1); // CMP #$01 equality leaves carry set; BMI sees final RAM ROR flags.
          const index = byte(y + 2); if (!(m[0x18] & 128)) y++;
          const delay = this.data(0x3b, y); m[0x39] = delay; m[0x3a] = index; return;
        }
        m[0x39] = byte(x << 2); return;
      }
      if (a < 0xf0) {
        let count = x; m[0xe0] = count;
        m[0xe1] = this.data(0x3b, y++); m[0xe2] = this.data(0x3b, y++);
        do {
          const address = this.word(0xe1); if (address >= 2048) this.unsupported('pattern write address', address);
          m[address] = this.data(0x3b, y++); m[0xe1]++; count = byte(count - 1); m[0xe0] = count;
        } while (count);
        m[0x3a] = y; continue;
      }
      if (x === 0) { this.loadPattern(m[0x584]); return; }
      if (x === 1) { m[0x36] &= 127; continue; }
      if (x === 2) {
        const address = this.data(0x3b, y++), value = this.data(0x3b, y++);
        m[0x3a] = value === m[address] ? this.data(0x3b, y) : byte(y + 1); continue;
      }
      if (x === 3) { m[0x3d] = this.data(0x3b, y); m[0x3a]++; continue; }
      if (x === 4) { m[0x3d]--; m[0x3a] = m[0x3d] ? this.data(0x3b, y) : byte(y + 1); continue; }
      this.unsupported('pattern special opcode', a);
    }
    throw new Error('Pattern script exceeded bounded command budget');
  }
  guardCompare() { const m = this.memory; m[0xe7] = m[0x4ff] & 127; return (m[0xd2] >>> 3) === m[0xe7]; }
  updateGuard() { this.guardCompare(); this.memory[0x4ff] = (this.memory[0xd2] >>> 3) | 128; }
  react() {
    const m = this.memory;
    if (!m[0x90]) return;
    if (m[0x90] === 0x81) { if (!(m[0xac] & 128)) { m[0x4fe] = m[0xac] = 0; m[0x4ff] |= 128; } }
    else if (m[0x90] === 1) {
      if (m[0x4fd]) {
        let t = byte(m[0x4fd] - 1); if (t === 128) t = 0; m[0x4fd] = t;
        if (!t) this.updateGuard();
      } else if (m[0xac] && !(m[0xac] & 128)) {
        if (!m[0x4fe]) {
          if ((m[0x50] & 127) === 1 && !this.guardCompare()) {
            if (m[0x5bc] & 128) {
              m[0x4fd] = m[0x5b8];
              if (!m[0x4fd]) { m[0x4fe]--; if (!this.guardCompare()) { m[0x4fd] = m[0x5b8]; m[0x4fe] = 0; } }
            }
            else { m[0x4fe] = m[0x5bc]; this.updateGuard(); }
          }
        } else {
          m[0x4fe]--;
          if (!this.guardCompare()) { m[0x4fd] = m[0x5b8]; m[0x4fe] = 0; }
        }
      }
    }
    if (!m[0x99]) return;
    m[0xe5] = m[0x99]; m[0x99] = m[0xe7] = 0;
    if (m[0x4fd]) { if (!(m[0x4fd] & 128)) m[0x4fd] = m[0x4fd] >= m[0x5b9] ? m[0x5ba] : m[0x5bb]; return; }
    if (m[0x97] || m[0x4a]) return;
    const punch = m[0x74];
    if (!m[0x348] && punch & 128) { m[0x90] = 0x83; return; }
    if (m[0x3cb] === 1) { if (punch & 128) return; }
    else if (m[0x3cb] === 7 && punch & 128) { m[0x90] = 0x83; return; }
    if (punch & 128) { m[0x90] = 0x89; return; }
    const x = punch & 2; m[0xe6] = (x ^ 2) >>> 1;
    if (m[0xe5] & 128 && ((m[0xe5] & 127) & m[0x58a]) && this.rng(m[0x58b],255) && m[0x58c]) { m[0x90] = m[0x58c]; return; }
    if (!(m[0xac] & 128) && (m[0x90] & 127) === 1 && (m[0x4ff] & 127) === m[0xe6]) m[0xe7]++;
    if (x) {
      if (!m[0xe7] && !this.rng(m[0x587],255)) return;
      if (this.rng(m[0x589] & 127,127)) m[0xab] = 1;
      m[0x90] = byte(0x89 + (punch & 3));
    } else {
      if (!m[0xe7] && !this.rng(m[0x586],255)) return;
      const threshold = m[0x588];
      if (threshold & 128) { if (this.rng(threshold & 127,127)) m[0xab] = 1; m[0x90] = byte(0x89 + (punch & 3)); }
      else { if (this.rng(threshold,127)) m[0xab] = 128; m[0x90] = byte(0x83 + (punch & 1)); }
    }
  }
  refillHealth(y, x) {
    const m = this.memory;
    m[0x39e] = m[0x398]; m[0x397] = m[0x391];
    m[0x397 + x] = (this.data(0xe6, y) & 15) << 3;
  }
  knockedDown() {
    const m = this.memory;
    if (m[5] === 2) {
      m.set([0x0f, 0x99, 0x80, 5, 0xea], 0xc0);
      m[0x8f]++; m[0x3d0]++; m[0x3dc + m[6]]++;
      if (m[0x8f] === 3) { m[0xc0] = 0; return; }
      this.setWord(0xe6, this.word(0x5d0));
      let y = m[0x3c1]; m[0x3c4] = m[0x5d2] = this.data(0xe6, y++);
      const threshold = this.data(0xe6, y++);
      m[0x3c3] = m[0x3b1] < threshold ? 127 : this.data(0xe6, y);
      m[0x3c1] = y; m[0x70] = 0x43; return;
    }
    if (m[5] !== 1) return;
    m.set([0x0f, 0x99, 0xe3, 0xc1, 0, 7, 0xea, 0xfa, 0x7d, 5, 0xea], 0xc0);
    m[0x3ca]++; m[0x3d1]++;
    if (m[0x3ca] === 3) { m[0xc0] = 0; return; }
    const old = m[0xba]; m[0xba] = 0; if (old === 255) return;
    this.setWord(0xe6, this.word(0x5d5));
    let y = m[0x3c9], threshold = this.data(0xe6, y), select = false, carry = m[0x3ca] >= 3 ? 1 : 0;
    if (!threshold) { select = m[0x50] === 0x0d; carry = m[0x50] >= 0x0d ? 1 : 0; }
    else if (!(threshold & 128) || (m[6] === 1 && m[0x302] === 0)) {
      threshold &= 127; select = threshold <= m[0x391]; carry = threshold >= m[0x391] ? 1 : 0;
    }
    if (select) y = byte(y + 1);
    else {
      let sample = rotateRandom(m, carry) & 7;
      if (sample >= 6) sample &= 1;
      y = byte(sample + 2 + m[0x3c9]);
    }
    const a = this.data(0xe6, y); if (!a) return;
    this.refillHealth(y, 7);
    let count = a >>> 4;
    if (count) {
      if ([1,7,9].includes(count)) m[0x3cb] = count;
      count += 0x99;
    } else {
      const sample = rotateRandom(m, (a >>> 3) & 1);
      count = m[0x5e0 + (sample >>> 5)];
    }
    m[0xc4] = count; m[0x3c9] += 8;
  }
  startCombo() {
    const m = this.memory;
    let x = m[0x5c4] ? 0 : 128;
    if (m[0x5c4]) {
      let y = 0, a = this.data(0x4e, y);
      if ((a & 128) || a === m[0x3b0]) {
        a = this.data(0x4e, ++y);
        if ((a & 128) || a === m[0x74]) { m[0x4d] = ++y; m[0x3b0] = m[0x74]; x++; }
      }
    }
    m[0x4c] = x;
    this.setWord(0xe6, this.word(0x5c2));
    for (let y = 0; y < 256; y += 2) {
      if (m[0x4a] <= this.data(0xe6, y)) { m[0x4b] = this.data(0xe6, y + 1); return; }
    }
    // B3E3 falls through to B3E5 with wrapped Y on a malformed table.
    m[0x4b] = this.data(0xe6, 1);
  }
  advanceCombo() {
    const m = this.memory;
    for (let guard = 0; guard < 256; guard++) {
      let y = m[0x4d], a = this.data(0x4e, y);
      if (!(a & 128)) {
        if ((m[0x74] & 0x83) === a) { m[0x4d]++; m[0x3b0] = m[0x74]; }
        else m[0x4c] &= 0xfe;
        return;
      }
      if (a === 0xfe) return;
      if (a === 0xfd) {
        if ((m[0x3b0] ^ 1) === m[0x74]) { m[0x4d]++; m[0x3b0] = m[0x74]; }
        else m[0x4c] &= 0xfe;
        return;
      }
      y = byte(y + 1); m[0x4d] = this.data(0x4e, y);
      if (!m[0x4d]) {
        if ((m[0x3b0] ^ 1) === m[0x74]) { m[0x4d]++; m[0x3b0] = m[0x74]; }
        else m[0x4c] &= 0xfe;
        return;
      }
    }
    throw new Error('Combo script exceeded bounded command budget');
  }
  recoveryTick() {
    const m = this.memory;
    if (!m[0xcf] || !m[0x3c3]) return;
    const display = () => {
      if (m[0x60]) { m[0x3c3] |= 128; return; }
      m[0x61] = m[0x70]; m[0x60] = 0x81;
      // AA96 is the shared renderer, outside combat control.
      this.onGetUpDisplay?.();
    };
    const countDisplay = () => { m[0x70] = byte(0x48 - m[0x3c3]); display(); };
    if (m[0x3c3] & 128) { m[0x3c3] &= 127; display(); return; }
    let pressed = false;
    if (m[0xd5] & 128) { m[0xd5] &= 127; m[0xd7] &= 127; pressed = true; }
    else if (m[0xd7] & 128) { m[0xd7] &= 127; pressed = true; }
    if (!pressed) {
      if (m[0x3c3] >= 5) {
        if (!m[0xd4] && !m[0xd6] && m[0x70] === 0x3a) { m[0x70] = 0x43; display(); }
      } else {
        m[0x3c4]--; if (!m[0x3c4]) { m[0x3c4] = m[0x5d2]; m[0x3c3]++; if (m[0x3c3]) countDisplay(); }
      }
      return;
    }
    m[0x3c3]--;
    if (m[0x3c3] >= 5) { m[0x70] = 0x3a; display(); return; }
    if (!m[0x3c3]) {
      const y = byte(byte(m[0xc1] - 0x99) + m[0x3c1]);
      this.setWord(0xe6, this.word(0x5d0));
      m[0x39e] = m[0x398]; m[0x397] = m[0x391];
      const a = this.data(0xe6, y);
      m[0x397] = (a & 15) << 3;
      const e = (a & 0x30) >>> 3; m[0xe0] = e;
      m[0x322] = e + (e >>> 1) || 1; m[0x321] = 0;
      m[0x3c5] = (a >>> 6) & 1;
      if (a & 128) m[0x3cb] = 1;
      m[0x36] = 2; m[0x3c1] += 10;
    }
    countDisplay();
  }
  combos() { return this.recoveryTick(); }
  completeStates() {
    const m = this.memory;
    if (m[0] & 128) return;
    const mode = m[0] >>> 4;
    if (mode === 0) {
      if (m[0x301] & 128) { m[0] = 0x40; return; }
      if (!m[0x90] || (m[0x343] && !(m[0x343] & 128))) return;
      if (!m[5]) {
        const combined = m[0x91] & m[0x51];
        if (combined & 1) {
          // ROR then ROL restores the exact AND byte.
          if (combined === 0x83) { m[0x91] = 0; m[0x90] = 0x81; m[0x50] = byte(0x82 - m[0xbc]); m[0x51] = 0x80; }
        } else if (m[0x91] === 0x82 && m[0x51] === 0x83) { m[0x50] = byte(0x82 - m[0xbc]); m[0x51] = 0x80; }
      } else if (m[5] === 2) {
        if (m[0x91] === 0x83) { m[0x90] = 0xc1; m[0x91] = 0x81; }
      } else if (m[0x51] === 0x83) { m[0x50] = 0xc1; m[0x51] = 0x81; }
      return;
    }
    if (mode === 1 || mode === 2) return;
    if (mode === 3) {
      m[0xbc] = 1;
      if (m[6] < 4) {
        let x = byte(m[6] * 3), a = m[0x5a3 + x], upper = a >>> 4, lower = a & 15;
        if (x === 3 || upper > m[0x323]) { m[0x323] = upper; m[0x324] = lower; }
        else if (upper === m[0x323] && lower >= m[0x324]) m[0x324] = lower;
        for (let i = 0; i < 4; i += 2) { a = m[0x5a3 + ++x]; m[0x32d + i] = a >>> 4; m[0x32e + i] = a & 15; }
        x = byte(m[6] << 1); m[0x308] = m[0x5d8 + x]; m[0x309] = m[0x5d9 + x];
        m[0x4e] = m[0x5c0]; m[0x4f] = m[0x5c1];
      }
      m[0x300] = m[0x340] = 128; m[0x320] = 129;
      m[0x50] = m[0x90] = 0xc0; m[0x51] = m[0x91] = 0x81; m[0] = 1;
      return;
    }
    if (mode === 4) { if (!m[0x306] && !m[0x30a]) { m[5] = 3; m[0] = 255; } return; }
    this.unsupported('completion jump table', mode);
  }
  snapshot() {
    const m = this.memory;
    return { pattern: m[0x35], request: m[0x36], clockRequest: m[0x37], enabled: m[0x38],
      delay: m[0x39], index: m[0x3a], pointer: this.word(0x3b), repeat: m[0x3d],
      state: m[0x90], status: m[0x91], vulnerable: m[0x4fd], guard: m[0x4ff], seed: m[0x18] };
  }
}






