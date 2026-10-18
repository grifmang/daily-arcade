/** Native opponent state-data interpreter; source: PRG_BankDEF C46B–C827. */
export const RAM = Object.freeze({
  fightOffset: 0x03, ppuControl: 0x10, random: 0x18,
  comboTimer: 0x4a, comboCount: 0x4b, comboAux: 0x4c,
  state: 0x90, status: 0x91, timer: 0x92, index: 0x93, pointer: 0x94,
  repeat: 0x96, punching: 0x97, punchStatus: 0x98, segments: 0x9a,
  segmentTimer: 0x9b, outlineTimer: 0x9c, returnIndex: 0x9d, returnPointer: 0x9e,
  animationFlags: 0xa0, pose: 0xa1, spriteMode: 0xa2, fixedBank: 0xaf,
  x: 0xb0, y: 0xb1, punchSide: 0xb4, damage: 0xb5, defense: 0xb6,
  roundStart: 0x300, roundControl: 0x301, roundTimerUpper: 0x306,
  moveTarget: 0x4d0, moveSpeed: 0x4d2, waitDefense: 0x4ff,
  variableTimer: 0x581, specialTimer: 0x585, largeSprites: 0x5cc,
});

const u8 = value => value & 255;
const signedNibble = value => (value & 8) ? (value & 15) - 16 : value & 15;

export class OpponentVM {
  constructor({ read, memory = new Uint8Array(2048), random, render } = {}) {
    if (typeof read !== 'function') throw new TypeError('OpponentVM requires read(address)');
    if (!(memory instanceof Uint8Array) || memory.length < 2048) {
      throw new TypeError('OpponentVM memory must contain 2048 RAM bytes');
    }
    this.read = read;
    this.memory = memory;
    this.random = random;
    this.render = render;
    this.frame = 0;
    this.events = [];
  }

  initialize(stateId) {
    this.memory[RAM.state] = (stateId & 0x7f) | 0x80;
    return this.snapshot();
  }

  word(address) { return this.memory[address] | (this.memory[address + 1] << 8); }
  setWord(address, value) {
    this.memory[address] = value;
    this.memory[address + 1] = value >> 8;
  }
  data(index) { return this.read((this.word(RAM.pointer) + u8(index)) & 0xffff); }
  emit(type, detail = {}) { this.events.push({ frame: this.frame, type, ...detail }); }
  unsupported(command, address, detail) {
    throw new Error(`Unsupported opponent command $${command.toString(16).padStart(2, '0')} at $${address.toString(16).padStart(4, '0')}: ${detail}`);
  }

  snapshot() {
    const m = this.memory;
    return {
      frame: this.frame, state: m[RAM.state], status: m[RAM.status],
      pointer: this.word(RAM.pointer), index: m[RAM.index], timer: m[RAM.timer],
      pose: m[RAM.pose], animationFlags: m[RAM.animationFlags],
      x: m[RAM.x], y: m[RAM.y], defense: Array.from(m.slice(RAM.defense, RAM.defense + 4)),
      punching: m[RAM.punching], punchStatus: m[RAM.punchStatus],
      punchSide: m[RAM.punchSide], damage: m[RAM.damage],
      segments: m[RAM.segments], segmentTimer: m[RAM.segmentTimer],
      comboTimer: m[RAM.comboTimer], repeat: m[RAM.repeat], fixedBank: m[RAM.fixedBank],
    };
  }

  initState() {
    const m = this.memory;
    m[RAM.state] &= 0x7f;
    m[RAM.status] |= 0x80;
    m.fill(0, 0x92, 0x9b);
    m.fill(0, 0xb4, 0xba);
    m[RAM.outlineTimer] = 1;
    m[RAM.fixedBank] = m[0x5a] = 0;
    m[RAM.timer]++;
    const state = m[RAM.state];
    const tableAddress = (state < 0x40 ? 0x8002 : 0x8004) + m[RAM.fightOffset];
    const table = this.read(tableAddress) | (this.read(tableAddress + 1) << 8);
    if (state < 0x40 && (table >> 8) === 0) {
      this.unsupported(0x80 | state, tableAddress, 'C4A4 falls through for zero high state-table pointer');
    }
    const offset = u8((state < 0x40 ? state : state - 0x40) * 2);
    this.setWord(RAM.pointer, this.read((table + offset) & 0xffff) |
      (this.read((table + u8(offset + 1)) & 0xffff) << 8));
    this.emit('state', { state, pointer: this.word(RAM.pointer) });
    if (state === 1) {
      m[0xba] = 0;
      m[RAM.waitDefense] &= 0x7f;
      if (m[RAM.largeSprites]) {
        m[RAM.ppuControl] |= 0x20;
        m[0x80] = 0x10;
      }
      this.waitPose(0x0a);
      return true;
    }
    return false;
  }

  waitPose(base) {
    const m = this.memory;
    // Two consecutive SBC instructions share carry, including the borrow edge case.
    const first = base - m[RAM.waitDefense];
    m[RAM.pose] = first - m[RAM.waitDefense] - (first < 0 ? 1 : 0);
    m[RAM.animationFlags] = 0x81;
    this.emit('render', { pose: m[RAM.pose], flags: 0x81, immediate: true });
    this.render?.();
    m[RAM.punchSide] = m[RAM.damage] = 0;
    let y = u8(m[RAM.waitDefense] << 2);
    for (let i = 0; i < 4; i++) m[RAM.defense + i] = this.read(0xc828 + u8(y + i));
  }

  tick() {
    const m = this.memory;
    this.frame++;
    const before = this.snapshot();
    const state = m[RAM.state];
    if (!state) return before;
    let initialWait = false;
    if (state & 0x80) initialWait = this.initState();
    if (!initialWait) {
      if (!m[RAM.state]) return this.snapshot();
      if (m[RAM.comboTimer]) {
        m[RAM.comboTimer]--;
        if (!m[RAM.comboTimer]) m[RAM.comboCount] = m[RAM.comboAux] = 0;
      }
      m[RAM.timer]--;
      if (m[RAM.timer]) return this.snapshot();
      if (m[RAM.state] === 1 && (m[RAM.waitDefense] & 0x80)) {
        m[RAM.waitDefense] &= 0x7f;
        this.waitPose(0x82);
      }
    }
    m[RAM.timer]++;
    if (m[RAM.fixedBank]) this.emit('bank', { bank: 6 });
    if (m[RAM.segments]) {
      m[RAM.segments]--;
      m[RAM.timer] = m[RAM.segmentTimer];
      m[RAM.index]--;
      this.move(this.data(m[RAM.index]));
      m[RAM.index]++;
      if (this.skipZero()) this.run();
    } else this.run();
    const after = this.snapshot();
    this.emit('update', after);
    return after;
  }

  // C582: a zero terminator is consumed and execution continues in the SAME tick.
  skipZero() {
    const m = this.memory;
    if (this.data(m[RAM.index]) !== 0) return false;
    m[RAM.index]++;
    return m[RAM.index] !== 0;
  }
  move(value) {
    const m = this.memory;
    m[RAM.x] += signedNibble(value >> 4);
    m[RAM.y] += signedNibble(value);
    m[RAM.animationFlags] = 1;
  }
  randomBranch(threshold) {
    const m = this.memory;
    m[0xef] = threshold;
    m[0xee] = 15;
    if (threshold === 15) return true;
    if (this.random) m[RAM.random] = this.random();
    // A retains the pre-rotation seed; ROR changes RAM, not the accumulator.
    const sample = m[RAM.random];
    let carry = threshold >= 15 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const next = m[RAM.random] & 1;
      m[RAM.random] = (m[RAM.random] >> 1) | (carry << 7);
      carry = next;
    }
    m[0xee] = sample & 15;
    return threshold > m[0xee]; // AEAB explicitly clears carry on equality.
  }

  run() {
    const m = this.memory;
    for (let budget = 0; budget < 4096; budget++) {
      const address = (this.word(RAM.pointer) + m[RAM.index]) & 0xffff;
      const command = this.data(m[RAM.index]);
      m[RAM.index]++;
      let y = m[RAM.index];
      const kind = command >> 4, n = command & 15;
      const take = () => { const value = this.data(y); y = u8(y + 1); return value; };
      const save = () => { m[RAM.index] = y; };
      const terminated = () => { save(); return this.skipZero(); };
      this.emit('command', { address, command });
      if (kind === 0 || kind === 1 || kind === 4 || kind === 5) {
        if (kind === 4 || kind === 5) m[RAM.spriteMode] = 1;
        m[RAM.timer] = n;
        m[RAM.pose] = take();
        m[RAM.animationFlags] = 0x80;
        if (kind === 1 || kind === 5) {
          m[RAM.x] = take(); m[RAM.y] = take(); save(); return;
        }
        if (!y) this.unsupported(command, address, 'C599 falls through into sprite/XY command after index wrap');
        if (terminated()) continue;
        return;
      }
      if (kind === 2) {
        m[RAM.timer] = n;
        // STX does not set flags: C5B5 sees Y restored by IndFuncJump.
        if (!y) {
          const target = take();
          m[RAM.index] = this.randomBranch(n) ? target : y;
          if (!y) this.unsupported(command, address, 'C5C6 falls through after index wrap');
          continue;
        }
        m[RAM.x] = take(); m[RAM.y] = take(); save(); return;
      }
      if (kind === 3) {
        const target = take();
        const branch = this.randomBranch(n);
        m[RAM.index] = branch ? target : y;
        if (!branch && !y) this.unsupported(command, address, 'C5C6 falls through after index wrap');
        continue;
      }
      if (kind === 6 || kind === 7) {
        m[RAM.timer] = kind === 6 ? n : (n & 3) + 1;
        if (kind === 7) {
          m[RAM.segmentTimer] = m[RAM.timer]; m[RAM.segments] = (n >> 2) + 1;
        }
        this.move(take());
        if (terminated()) continue;
        return;
      }
      if (kind === 8) { m[RAM.timer] = take(); save(); return; }
      if (kind === 9) {
        let low = take(); const high = take();
        const count = n || 256;
        for (let i = 0; i < count; i++) {
          const destination = low | (high << 8);
          if (destination >= 2048) this.unsupported(command, address, `write outside fight RAM $${destination.toString(16)}`);
          m[destination] = take(); low = u8(low + 1);
        }
        save(); continue;
      }
      if (kind === 10) {
        m[RAM.timer] = n;
        let reached = true;
        for (let i = 0; i < 2; i++) {
          const deltaByte = u8(m[RAM.x + i] - m[RAM.moveTarget + i]);
          const delta = deltaByte >= 128 ? deltaByte - 256 : deltaByte;
          const step = Math.min(Math.abs(delta), m[RAM.moveSpeed + i]);
          m[RAM.x + i] += delta < 0 ? step : -step;
          reached &&= m[RAM.x + i] === m[RAM.moveTarget + i];
        }
        const target = take();
        if (!reached && !y) this.unsupported(command, address, 'C647 falls through into movement helper after index wrap');
        m[RAM.index] = reached ? target : y; return;
      }
      if (kind >= 11 && kind <= 14) {
        switch (n) {
          case 0: {
            this.setWord(RAM.returnPointer, this.word(RAM.pointer));
            const low = take(), high = take();
            m[RAM.returnIndex] = y; this.setWord(RAM.pointer, low | (high << 8));
            m[RAM.index] = 0; continue;
          }
          case 1:
            this.setWord(RAM.pointer, this.word(RAM.returnPointer));
            m[RAM.index] = m[RAM.returnIndex]; m[RAM.returnPointer + 1] = 0; continue;
          case 4: m[RAM.timer] = m[RAM.variableTimer]; return;
          case 5: m[RAM.punching] = 0; continue;
          case 6: m[RAM.ppuControl] &= 0xdf; m[0x80] = 8; continue;
          case 7: m[RAM.ppuControl] |= 0x20; m[0x80] = 16; continue;
          case 8: {
            const low = take(), high = take(), value = take(), target = take();
            const a = low | (high << 8);
            if (a >= 2048) this.unsupported(command, address, 'compare outside fight RAM');
            if (m[a] !== value && !y) this.unsupported(command, address, 'C7A5 falls through into repeat after index wrap');
            m[RAM.index] = m[a] === value ? target : y; continue;
          }
          case 9: {
            const value = take();
            if (value && !m[RAM.roundStart]) m[RAM.roundStart] = value;
            m[RAM.roundControl] = (m[RAM.roundControl] & 0xfe) | (value ^ 1);
            save(); m[RAM.roundTimerUpper] = 100; return;
          }
          case 12: {
            const value = take(); save();
            m[0xf0 + (value & 3)] = value & 0x80 ? value & 0xfc : value >> 2;
            this.emit('audio', { value }); continue;
          }
          default: this.unsupported(command, address, 'null/undefined function-table entry');
        }
      }
      switch (n) {
        case 0: {
          const status = m[RAM.punchStatus];
          if (!status || status & 0x80) {
            if (!status) m[RAM.punchStatus] = 0x80;
            m[RAM.index]--; return;
          }
          if (status === 3 && !u8(y + 3)) this.unsupported(command, address, 'C76E falls through into pointer jump after index wrap');
          m[RAM.index] = status === 3 ? u8(y + 3) : this.data(u8(y + status - (status < 3 ? 1 : 2)));
          m[RAM.punchStatus] = 0; continue;
        }
        case 1: {
          const low = take(), high = take(), index = take();
          this.setWord(RAM.pointer, low | (high << 8)); m[RAM.index] = index;
          if (!high) {
            // STX does not set flags: C782 sees the high byte loaded at C77C.
            y = index;
            const a = take(), value = take(), target = take();
            if (m[a] !== value && !y) this.unsupported(command, address, 'C7A5 falls through into repeat after index wrap');
            m[RAM.index] = m[a] === value ? target : y;
          }
          continue;
        }
        case 2: {
          const a = take(), value = take(), target = take();
          if (m[a] !== value && !y) this.unsupported(command, address, 'C7A5 falls through into repeat after index wrap');
          m[RAM.index] = m[a] === value ? target : y; continue;
        }
        case 3: {
          m[RAM.repeat]--; const target = take();
          if (!m[RAM.repeat] && !y) { m[RAM.state] = 0x81; return; }
          m[RAM.index] = m[RAM.repeat] ? target : y; continue;
        }
        case 4: m[RAM.state] = 0x81; return;
        case 5: m[RAM.repeat] = take(); save(); return;
        case 6:
          m[RAM.punchSide] = take(); m[RAM.damage] = take();
          if (terminated()) continue; return;
        case 7:
          for (let i = 0; i < 4; i++) m[RAM.defense + i] = take();
          if (terminated()) continue; return;
        case 8: m[0x53] += 2; m[0x52] = 1; return;
        case 9: m[RAM.punching] = 1; continue;
        case 10: {
          const a = take(); m[a] = take();
          if (terminated()) continue; return;
        }
        case 11: m[RAM.comboTimer] = m[RAM.specialTimer]; return;
        case 12:
          if (!m[RAM.comboTimer]) continue;
          m[RAM.index]--; return;
        case 13: m[0x5a] = take(); save(); return;
        case 14: m[RAM.status] = 0x82; return;
        case 15: m[RAM.index]--; m[RAM.status] = 0x83; return;
      }
    }
    throw new Error(`Opponent script exceeded 4096 same-frame commands at $${this.word(RAM.pointer).toString(16)}+$${this.memory[RAM.index].toString(16)}`);
  }
}
