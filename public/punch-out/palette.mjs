/** Native palette display state. DEF A5C3–A641 / AF0B–AF2D / AF73–AF8C.
 * The 64 authored RGB entries match the offline JSNES NTSC reference table.
 * Packed bytes follow its framebuffer convention (low byte is displayed red).
 * No emulator code or runtime palette inference is used here.
 */
const NTSC = [
  0x525252,0xb40000,0xa00000,0xb1003d,0x740069,0x00005b,0x00005f,0x001840,0x002f10,0x084a08,0x006700,0x124200,0x6d2800,0,0,0,
  0xc4d5e7,0xff4000,0xdc0e22,0xff476b,0xd7009f,0x680ad7,0x0019bc,0x0054b1,0x006a5b,0x008c03,0x00ab00,0x2c8800,0xa47200,0,0,0,
  0xf8f8f8,0xffab3c,0xff7981,0xff5bc5,0xff48f2,0xdf49ff,0x476dff,0x00b4f7,0x00e0ff,0x00e375,0x03f42b,0x78b82e,0xe5e218,0x787878,0,0,
  0xffffff,0xfff2be,0xf8b8b8,0xf8b8d8,0xffb6ff,0xffc3ff,0xc7d1ff,0x9adaff,0x88edf8,0x83ffdd,0xb8f8b8,0xf5f8ac,0xffffb0,0xf8d8f8,0,0,
];

export function paletteColor(value, mask = 0x1e) {
  const packed = NTSC[value & (mask & 1 ? 0x30 : 0x3f)], emphasis = mask >>> 5;
  // Match reference PaletteTable.makeTables before converting its packed RGB.
  const r = Math.floor((packed >>> 16) * (emphasis & 6 ? 0.75 : 1));
  const g = Math.floor(((packed >>> 8) & 255) * (emphasis & 5 ? 0.75 : 1));
  const b = Math.floor((packed & 255) * (emphasis & 3 ? 0.75 : 1));
  return '#' + [b,g,r].map(v => v.toString(16).padStart(2,'0')).join('');
}

export class PaletteState {
  constructor({memory}) {
    this.memory = memory;
    // All fourteen recovered round-start seeds have RAM == uploaded PPU bytes.
    this.bytes = new Uint8Array(memory.slice(0x480,0x4a0));
    this.mask = memory[0x11]; this.uploads = 0;
  }
  beforeFrame() {
    const m = this.memory;
    // AF73 is reached even when the display budget was exhausted at A5EE.
    if (m[0x1b] & 128) {
      m[0x1b] &= 1;
      m[0x11] = m[0x1b] ? m[0x11] | 0x18 : m[0x11] & 0xe7;
    }
    this.mask = m[0x11];
  }
  commit(acknowledged) {
    // A5FC uploads all 32 bytes only when acknowledgeDisplays reaches palette.
    // Two simultaneous OAM/player jobs defer this upload to a later frame.
    if (acknowledged.includes('palette')) {
      this.bytes.set(this.memory.subarray(0x480,0x4a0)); this.uploads++;
      // AF0B writes background first, then sprite; the four universal-color
      // addresses in the second half mirror their background counterparts.
      for (let i=0;i<16;i+=4) this.bytes[i] = this.bytes[i+16];
    }
  }
  colors(kind) {
    if (kind !== 'background' && kind !== 'sprite') throw Error('Unknown palette kind: ' + kind);
    const offset = kind === 'sprite' ? 16 : 0;
    return Array.from(this.bytes.subarray(offset,offset+16), value => paletteColor(value,this.mask));
  }
  snapshot() {
    return {bytes: [...this.bytes], mask: this.mask, uploads: this.uploads,
      background: this.colors('background'), sprite: this.colors('sprite'),
      visible: {background: !!(this.mask & 8), sprite: !!(this.mask & 16)}};
  }
}
