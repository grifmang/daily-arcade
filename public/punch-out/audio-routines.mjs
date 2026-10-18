/** Fixed native sound functions cross-compiled from annotated bank 8 and DEF F400-F53B.
 * Generated offline by tools/capture-audio-source.py; no runtime instruction decoding. */
export function createSoundRoutines(m, read, write) {
 let a=0,x=0,y=0,c=0,z=true,n=false,t=0;
 const nz=v=>{v&=255;z=v===0;n=!!(v&128);return v;};
 function SoundEngine() { // $8000
  a=nz(192);
  write(16407, a);
  PlayDMCSFX();
  return soundAt8008();
 }
 function soundAt8008() { // $8008
  PlaySQ1SFX();
  return soundAt800B();
 }
 function soundAt800B() { // $800B
  PlaySQ2SFX();
  return soundAt800E();
 }
 function soundAt800E() { // $800E
  PlayMusic();
  return soundAt8011();
 }
 function soundAt8011() { // $8011
  a=nz(0);
  write(240, a);
  write(241, a);
  write(242, a);
  write(243, a);
  return;
 }
 function IncToNextLaugh() { // $801C
  y=nz(read(247));
  t=6;c=+(y>=t);nz(y-t);
  if (c) return DMCSFXDone();
  return soundAt8022();
 }
 function soundAt8022() { // $8022
  y=nz(y + 1);
  write(243, y);
  return PlayDMCSFX();
 }
 function PlayDMCSFX() { // $8025
  y=nz(read(243));
  if (n) return DMCSFXDone();
  return soundAt8029();
 }
 function soundAt8029() { // $8029
  if (!z) return DMCSFXInit();
  return soundAt802B();
 }
 function soundAt802B() { // $802B
  a=nz(read(247));
  t=1;c=+(a>=t);nz(a-t);
  if (z) return DMCExit();
  return soundAt8031();
 }
 function soundAt8031() { // $8031
  a=nz(read(247));
  if (z) return DMCDisable();
  return soundAt8035();
 }
 function soundAt8035() { // $8035
  write(1822, nz(read(1822) - 1));
  if (z) return IncToNextLaugh();
  return soundAt803A();
 }
 function soundAt803A() { // $803A
  write(1823, nz(read(1823) - 1));
  if (z) return DMCDisable();
  return soundAt803F();
 }
 function soundAt803F() { // $803F
  return;
 }
 function DMCSFXInit() { // $8040
  write(247, y);
  a=nz(14);
  write(1822, a);
  x=nz(5);
  a=nz(read(247));
  t=7;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8051();
  return soundAt804F();
 }
 function soundAt804F() { // $804F
  x=nz(3);
  return soundAt8051();
 }
 function soundAt8051() { // $8051
  write(1823, x);
  a=nz(y);
  t=a;a=nz(t<<1);c=(t>>7)&1;
  y=nz(a);
  a=nz(read((63334 + y) & 65535));
  write(16402, a);
  a=nz(read((63335 + y) & 65535));
  write(16403, a);
  x=nz(79);
  a=nz(read(247));
  t=1;c=+(a>=t);nz(a-t);
  if (z) return SetDMCRegs();
  return soundAt806B();
 }
 function soundAt806B() { // $806B
  x=nz(15);
  return SetDMCRegs();
 }
 function SetDMCRegs() { // $806D
  write(16400, x);
  a=nz(15);
  write(16405, a);
  a=nz(31);
  write(16405, a);
  return;
 }
 function DMCSFXDone() { // $807B
  a=nz(0);
  write(247, a);
  return DMCDisable();
 }
 function DMCDisable() { // $807F
  a=nz(15);
  write(16405, a);
  return DMCExit();
 }
 function DMCExit() { // $8084
  return;
 }
 function SQ1IntroPunchInit() { // $8085
  a=nz(64);
  InitSQ1SFX();
  return soundAt808A();
 }
 function soundAt808A() { // $808A
  a=nz(26);
  write(1811, a);
  x=nz(159);
  y=nz(131);
  SetSQ1Control();
  return SQ1IntroPunchCont();
 }
 function SQ1IntroPunchCont() { // $8096
  a=nz(read(1810));
  t=64;c=+(a>=t);nz(a-t);
  if (c) return ChkIntroPunchUpdt();
  return soundAt809D();
 }
 function soundAt809D() { // $809D
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  a=nz(a | 144);
  write(16384, a);
  return ChkIntroPunchUpdt();
 }
 function ChkIntroPunchUpdt() { // $80A4
  a=nz(read(1810));
  a=nz(a & 7);
  if (!z) return SQ1IntroPunchEnd();
  return soundAt80AB();
 }
 function soundAt80AB() { // $80AB
  a=nz(read(1811));
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  c=1;
  t=a + read(1811) + c;c=+(t>255);a=nz(t);
  write(1811, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16386, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 7);
  a=nz(a | 8);
  write(16387, a);
  return SQ1IntroPunchEnd();
 }
 function SQ1IntroPunchEnd() { // $80C7
  return FinishSQ1SFXFrame();
 }
 function PlaySQ1SFX() { // $80CA
  y=nz(read(240));
  if (n) return SilenceSQ1SFX();
  return ChkSQ1SFX1();
 }
 function ChkSQ1SFX1() { // $80CE
  a=nz(read(244));
  t=1;c=+(y>=t);nz(y-t);
  if (z) return SQ1IntroPunchInit();
  return soundAt80D4();
 }
 function soundAt80D4() { // $80D4
  t=1;c=+(a>=t);nz(a-t);
  if (z) return SQ1IntroPunchCont();
  return soundAt80D8();
 }
 function soundAt80D8() { // $80D8
  t=2;c=+(y>=t);nz(y-t);
  if (z) return SQ1FallInit();
  return soundAt80DC();
 }
 function soundAt80DC() { // $80DC
  t=2;c=+(a>=t);nz(a-t);
  if (z) return SQ1FallCont();
  return soundAt80E0();
 }
 function soundAt80E0() { // $80E0
  t=3;c=+(y>=t);nz(y-t);
  if (z) return SQ1Punch1Init();
  return soundAt80E4();
 }
 function soundAt80E4() { // $80E4
  t=3;c=+(a>=t);nz(a-t);
  if (z) return SQ1Punch1Cont();
  return soundAt80E8();
 }
 function soundAt80E8() { // $80E8
  return ChkSQ1SFX2();
 }
 function SQ1FallInit() { // $80EB
  a=nz(127);
  InitSQ1SFX();
  return soundAt80F0();
 }
 function soundAt80F0() { // $80F0
  x=nz(156);
  y=nz(127);
  a=nz(98);
  UpdateSQ1();
  return SQ1FallCont();
 }
 function SQ1FallCont() { // $80F9
  a=nz(read(1810));
  t=108;c=+(a>=t);nz(a-t);
  if (z) return SQ1FallEnd();
  return soundAt8100();
 }
 function soundAt8100() { // $8100
  if (!c) return Fall2ndPart();
  return soundAt8102();
 }
 function soundAt8102() { // $8102
  a=nz(a & 7);
  y=nz(a);
  a=nz(read((63350 + y) & 65535));
  write(16385, a);
  if (!z) return SQ1FallEnd();
  return Fall2ndPart();
 }
 function Fall2ndPart() { // $810D
  t=107;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8116();
  return soundAt8111();
 }
 function soundAt8111() { // $8111
  y=nz(165);
  write(16385, y);
  return soundAt8116();
 }
 function soundAt8116() { // $8116
  t=48;c=+(a>=t);nz(a-t);
  if (c) return SQ1FallEnd();
  return soundAt811A();
 }
 function soundAt811A() { // $811A
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  a=nz(a | 144);
  write(16384, a);
  return SQ1FallEnd();
 }
 function SQ1FallEnd() { // $8121
  return FinishSQ1SFXFrame();
 }
 function SQ1Punch1Init() { // $8124
  a=nz(22);
  InitSQ1SFX();
  return soundAt8129();
 }
 function soundAt8129() { // $8129
  x=nz(95);
  y=nz(139);
  a=nz(18);
  UpdateSQ1();
  return SQ1Punch1Cont();
 }
 function SQ1Punch1Cont() { // $8132
  a=nz(read(1810));
  t=16;c=+(a>=t);nz(a-t);
  if (c) return FinishSQ1SFXFrame();
  return soundAt8139();
 }
 function soundAt8139() { // $8139
  a=nz(a | 80);
  write(16384, a);
  return FinishSQ1SFXFrame();
 }
 function FinishSQ1SFXFrame() { // $813E
  write(1810, nz(read(1810) - 1));
  if (!z) return SQ1SFXEnd();
  return SilenceSQ1SFX();
 }
 function SilenceSQ1SFX() { // $8143
  a=nz(read(1828));
  if (z) return ChkSQ2InUse1();
  return soundAt8148();
 }
 function soundAt8148() { // $8148
  a=nz(16);
  write(16396, a);
  a=nz(0);
  write(1828, a);
  return ChkSQ2InUse1();
 }
 function ChkSQ2InUse1() { // $8152
  a=nz(read(1829));
  if (z) return ClearSQ1InUse();
  return soundAt8157();
 }
 function soundAt8157() { // $8157
  a=nz(16);
  write(16388, a);
  a=nz(0);
  write(1829, a);
  return ClearSQ1InUse();
 }
 function ClearSQ1InUse() { // $8161
  a=nz(0);
  write(1830, a);
  a=nz(0);
  write(244, a);
  a=nz(16);
  write(16384, a);
  return SQ1SFXEnd();
 }
 function SQ1SFXEnd() { // $816F
  return;
 }
 function SQ1PunchBlockInit() { // $8170
  a=nz(4);
  InitSQ1SQ2SFX();
  return soundAt8175();
 }
 function soundAt8175() { // $8175
  x=nz(10);
  a=nz(26);
  y=nz(8);
  write(16399, y);
  write(16398, x);
  write(16396, a);
  x=nz(218);
  y=nz(133);
  a=nz(36);
  UpdateSQ1();
  return SQ1PunchBlockCont();
 }
 function SQ1PunchBlockCont() { // $818D
  return FinishSQ1SFXFrame();
 }
 function SQ1OppPunch1Init() { // $8190
  a=nz(32);
  InitSQ1SFX();
  return soundAt8195();
 }
 function soundAt8195() { // $8195
  a=nz(255);
  write(1811, a);
  x=nz(30);
  y=nz(129);
  SetSQ1Control();
  return SQ1OppPunch1Cont();
 }
 function SQ1OppPunch1Cont() { // $81A1
  a=nz(read(1811));
  y=nz(a);
  LogDiv8();
  return soundAt81A8();
 }
 function soundAt81A8() { // $81A8
  write(1811, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16386, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 3);
  a=nz(a | 8);
  write(16387, a);
  a=nz(read(1810));
  t=14;c=+(a>=t);nz(a-t);
  if (c) return soundAt81C4();
  return soundAt81BF();
 }
 function soundAt81BF() { // $81BF
  a=nz(a | 144);
  write(16384, a);
  return soundAt81C4();
 }
 function soundAt81C4() { // $81C4
  return FinishSQ1SFXFrame();
 }
 function ChkSQ1SFX2() { // $81C7
  t=4;c=+(y>=t);nz(y-t);
  if (z) return SQ1PunchBlockInit();
  return soundAt81CB();
 }
 function soundAt81CB() { // $81CB
  t=4;c=+(a>=t);nz(a-t);
  if (z) return SQ1PunchBlockCont();
  return soundAt81CF();
 }
 function soundAt81CF() { // $81CF
  t=5;c=+(y>=t);nz(y-t);
  if (z) return SQ1OppPunch1Init();
  return soundAt81D3();
 }
 function soundAt81D3() { // $81D3
  t=5;c=+(a>=t);nz(a-t);
  if (z) return SQ1OppPunch1Cont();
  return soundAt81D7();
 }
 function soundAt81D7() { // $81D7
  t=6;c=+(y>=t);nz(y-t);
  if (z) return SQ1PunchMiss1Init();
  return soundAt81DB();
 }
 function soundAt81DB() { // $81DB
  t=6;c=+(a>=t);nz(a-t);
  if (z) return SQ1PunchMiss1Cont();
  return soundAt81DF();
 }
 function soundAt81DF() { // $81DF
  t=7;c=+(y>=t);nz(y-t);
  if (z) return SQ1PunchMiss2Init();
  return soundAt81E3();
 }
 function soundAt81E3() { // $81E3
  t=7;c=+(a>=t);nz(a-t);
  if (z) return SQ1PunchMiss2Cont();
  return soundAt81E7();
 }
 function soundAt81E7() { // $81E7
  t=8;c=+(y>=t);nz(y-t);
  if (z) return SQ1Punch2Init();
  return soundAt81EB();
 }
 function soundAt81EB() { // $81EB
  t=8;c=+(a>=t);nz(a-t);
  if (z) return SQ1Punch2Cont();
  return soundAt81EF();
 }
 function soundAt81EF() { // $81EF
  return ChkSQ1SFX3();
 }
 function SQ1PunchMiss1Init() { // $81F2
  a=nz(16);
  InitSQ1SQ2SFX();
  return SQ1PunchMiss1Cont();
 }
 function SQ1PunchMiss1Cont() { // $81F7
  y=nz(read(1810));
  a=nz(read((63357 + y) & 65535));
  return ParseNoiseData();
 }
 function ParseNoiseData() { // $81FD
  x=nz(a);
  a=nz(a & 15);
  write(16398, a);
  a=nz(x);
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  a=nz(a | 16);
  write(16396, a);
  a=nz(8);
  write(16399, a);
  return FinishSQ1SFXFrame();
 }
 function SQ1PunchMiss2Init() { // $8215
  a=nz(10);
  InitSQ1SQ2SFX();
  return SQ1PunchMiss2Cont();
 }
 function SQ1PunchMiss2Cont() { // $821A
  y=nz(read(1810));
  a=nz(read((63373 + y) & 65535));
  if (!z) return ParseNoiseData();
  return SQ1Punch2Init();
 }
 function SQ1Punch2Init() { // $8222
  a=nz(16);
  InitSQ1SFX();
  return soundAt8227();
 }
 function soundAt8227() { // $8227
  x=nz(67);
  y=nz(132);
  a=nz(76);
  UpdateSQ1();
  return SQ1Punch2Cont();
 }
 function SQ1Punch2Cont() { // $8230
  return FinishSQ1SFXFrame();
 }
 function SQ1Talk1Init() { // $8233
  a=nz(4);
  InitSQ1SFX();
  return soundAt8238();
 }
 function soundAt8238() { // $8238
  a=nz(127);
  write(16385, a);
  write(1811, nz(read(1811) + 1));
  a=nz(read(1811));
  a=nz(a & 15);
  y=nz(a);
  a=nz(read((63388 + y) & 65535));
  UpdateSQ1Note();
  return SQ1Talk1Cont();
 }
 function SQ1Talk1Cont() { // $824C
  y=nz(read(1810));
  a=nz(read((63383 + y) & 65535));
  write(16384, a);
  return FinishSQ1SFXFrame();
 }
 function SQ2Talk23Init() { // $8258
  a=nz(4);
  InitSQ1SFX();
  return soundAt825D();
 }
 function soundAt825D() { // $825D
  a=nz(188);
  write(16385, a);
  write(1811, nz(read(1811) + 1));
  a=nz(read(1811));
  a=nz(a & 15);
  y=nz(a);
  a=nz(read(244));
  t=11;c=+(a>=t);nz(a-t);
  if (z) return GetTalk3Note();
  return GetTalk2Note();
 }
 function GetTalk2Note() { // $8271
  a=nz(read((63404 + y) & 65535));
  if (!z) return SetTalk23Note();
  return GetTalk3Note();
 }
 function GetTalk3Note() { // $8276
  a=nz(read((63420 + y) & 65535));
  return SetTalk23Note();
 }
 function SetTalk23Note() { // $8279
  UpdateSQ1Note();
  return SQ1Talk23Cont();
 }
 function SQ1Talk23Cont() { // $827C
  return SQ1Talk1Cont();
 }
 function ChkSQ1SFX3() { // $827F
  t=9;c=+(y>=t);nz(y-t);
  if (z) return SQ1Talk1Init();
  return soundAt8283();
 }
 function soundAt8283() { // $8283
  t=9;c=+(a>=t);nz(a-t);
  if (z) return SQ1Talk1Cont();
  return soundAt8287();
 }
 function soundAt8287() { // $8287
  t=10;c=+(y>=t);nz(y-t);
  if (z) return SQ2Talk23Init();
  return soundAt828B();
 }
 function soundAt828B() { // $828B
  t=10;c=+(a>=t);nz(a-t);
  if (z) return SQ1Talk23Cont();
  return soundAt828F();
 }
 function soundAt828F() { // $828F
  t=11;c=+(y>=t);nz(y-t);
  if (z) return SQ2Talk23Init();
  return soundAt8293();
 }
 function soundAt8293() { // $8293
  t=11;c=+(a>=t);nz(a-t);
  if (z) return SQ1Talk23Cont();
  return soundAt8297();
 }
 function soundAt8297() { // $8297
  t=12;c=+(y>=t);nz(y-t);
  if (z) return SQ1Bell1Init();
  return soundAt829B();
 }
 function soundAt829B() { // $829B
  t=12;c=+(a>=t);nz(a-t);
  if (z) return SQ1Bell1Cont();
  return soundAt829F();
 }
 function soundAt829F() { // $829F
  return ChkSQ1SFX4();
 }
 function SQ1Bell1Init() { // $82A2
  a=nz(64);
  return soundAt82A4();
 }
 function soundAt82A4() { // $82A4
  soundAtF494();
  return soundAt82A7();
 }
 function soundAt82A7() { // $82A7
  x=nz(136);
  write(16384, x);
  write(16388, x);
  a=nz(88);
  UpdateSQ1Note();
  return soundAt82B4();
 }
 function soundAt82B4() { // $82B4
  a=nz(34);
  write(16390, a);
  a=nz(8);
  write(16391, a);
  return SQ1Bell1Cont();
 }
 function SQ1Bell1Cont() { // $82BE
  a=nz(read(1810));
  t=40;c=+(a>=t);nz(a-t);
  if (!z) return soundAt82CD();
  return soundAt82C5();
 }
 function soundAt82C5() { // $82C5
  x=nz(143);
  write(16384, x);
  write(16388, x);
  return soundAt82CD();
 }
 function soundAt82CD() { // $82CD
  return FinishSQ1SFXFrame();
 }
 function soundAt82D0() { // $82D0
  a=nz(15);
  soundAtF494();
  return soundAt82D5();
 }
 function soundAt82D5() { // $82D5
  a=nz(0);
  write(1811, a);
  return soundAt82DA();
 }
 function soundAt82DA() { // $82DA
  a=nz(read(1810));
  t=a;a=nz(t>>1);c=t&1;
  c=0;
  t=a + read(1811) + c;c=+(t>255);a=nz(t);
  y=nz(a);
  a=nz(read((63436 + y) & 65535));
  soundAtF4CD();
  return soundAt82E9();
 }
 function soundAt82E9() { // $82E9
  a=nz(read((63467 + y) & 65535));
  soundAtF4DD();
  return soundAt82EF();
 }
 function soundAt82EF() { // $82EF
  return FinishSQ1SFXFrame();
 }
 function soundAt82F2() { // $82F2
  a=nz(18);
  soundAtF494();
  return soundAt82F7();
 }
 function soundAt82F7() { // $82F7
  a=nz(8);
  write(1811, a);
  if (!z) return soundAt82DA();
  return soundAt82FE();
 }
 function soundAt82FE() { // $82FE
  a=nz(30);
  soundAtF494();
  return soundAt8303();
 }
 function soundAt8303() { // $8303
  a=nz(8);
  write(1811, a);
  if (!z) return soundAt82DA();
  return soundAt830A();
 }
 function soundAt830A() { // $830A
  a=nz(12);
  soundAtF494();
  return soundAt830F();
 }
 function soundAt830F() { // $830F
  a=nz(24);
  write(1811, a);
  if (!z) return soundAt82DA();
  return ChkSQ1SFX4();
 }
 function ChkSQ1SFX4() { // $8316
  t=13;c=+(y>=t);nz(y-t);
  if (z) return soundAt82D0();
  return soundAt831A();
 }
 function soundAt831A() { // $831A
  t=13;c=+(a>=t);nz(a-t);
  if (z) return soundAt82DA();
  return soundAt831E();
 }
 function soundAt831E() { // $831E
  t=14;c=+(y>=t);nz(y-t);
  if (z) return soundAt82F2();
  return soundAt8322();
 }
 function soundAt8322() { // $8322
  t=14;c=+(a>=t);nz(a-t);
  if (z) return soundAt82DA();
  return soundAt8326();
 }
 function soundAt8326() { // $8326
  t=15;c=+(y>=t);nz(y-t);
  if (z) return soundAt82FE();
  return soundAt832A();
 }
 function soundAt832A() { // $832A
  t=15;c=+(a>=t);nz(a-t);
  if (z) return soundAt82DA();
  return soundAt832E();
 }
 function soundAt832E() { // $832E
  t=16;c=+(y>=t);nz(y-t);
  if (z) return soundAt830A();
  return soundAt8332();
 }
 function soundAt8332() { // $8332
  t=16;c=+(a>=t);nz(a-t);
  if (z) return soundAt82DA();
  return soundAt8336();
 }
 function soundAt8336() { // $8336
  t=17;c=+(y>=t);nz(y-t);
  if (z) return soundAt8359();
  return soundAt833A();
 }
 function soundAt833A() { // $833A
  t=17;c=+(a>=t);nz(a-t);
  if (z) return soundAt835E();
  return soundAt833E();
 }
 function soundAt833E() { // $833E
  t=18;c=+(y>=t);nz(y-t);
  if (z) return soundAt8367();
  return soundAt8342();
 }
 function soundAt8342() { // $8342
  t=18;c=+(a>=t);nz(a-t);
  if (z) return soundAt8375();
  return soundAt8346();
 }
 function soundAt8346() { // $8346
  t=19;c=+(y>=t);nz(y-t);
  if (z) return soundAt8378();
  return soundAt834A();
 }
 function soundAt834A() { // $834A
  t=19;c=+(a>=t);nz(a-t);
  if (z) return soundAt8386();
  return soundAt834E();
 }
 function soundAt834E() { // $834E
  t=20;c=+(y>=t);nz(y-t);
  if (z) return soundAt8395();
  return soundAt8352();
 }
 function soundAt8352() { // $8352
  t=20;c=+(a>=t);nz(a-t);
  if (z) return soundAt83A3();
  return soundAt8356();
 }
 function soundAt8356() { // $8356
  return ChkSQ1SFX5();
 }
 function soundAt8359() { // $8359
  a=nz(5);
  InitSQ1SQ2SFX();
  return soundAt835E();
 }
 function soundAt835E() { // $835E
  y=nz(read(1810));
  a=nz(read((63497 + y) & 65535));
  return ParseNoiseData();
 }
 function soundAt8367() { // $8367
  a=nz(32);
  InitSQ1SFX();
  return soundAt836C();
 }
 function soundAt836C() { // $836C
  x=nz(152);
  y=nz(127);
  a=nz(100);
  UpdateSQ1();
  return soundAt8375();
 }
 function soundAt8375() { // $8375
  return FinishSQ1SFXFrame();
 }
 function soundAt8378() { // $8378
  a=nz(18);
  InitSQ1SFX();
  return soundAt837D();
 }
 function soundAt837D() { // $837D
  x=nz(95);
  y=nz(139);
  a=nz(14);
  UpdateSQ1();
  return soundAt8386();
 }
 function soundAt8386() { // $8386
  a=nz(read(1810));
  t=12;c=+(a>=t);nz(a-t);
  if (c) return soundAt8392();
  return soundAt838D();
 }
 function soundAt838D() { // $838D
  a=nz(a | 80);
  write(16384, a);
  return soundAt8392();
 }
 function soundAt8392() { // $8392
  return FinishSQ1SFXFrame();
 }
 function soundAt8395() { // $8395
  a=nz(6);
  InitSQ1SFX();
  return soundAt839A();
 }
 function soundAt839A() { // $839A
  x=nz(149);
  y=nz(127);
  a=nz(74);
  UpdateSQ1();
  return soundAt83A3();
 }
 function soundAt83A3() { // $83A3
  a=nz(read(1810));
  t=3;c=+(a>=t);nz(a-t);
  if (!z) return soundAt83AF();
  return soundAt83AA();
 }
 function soundAt83AA() { // $83AA
  a=nz(66);
  UpdateSQ1Note();
  return soundAt83AF();
 }
 function soundAt83AF() { // $83AF
  return FinishSQ1SFXFrame();
 }
 function SQ1Bell3Init() { // $83B2
  a=nz(4);
  write(1811, a);
  return soundAt83B7();
 }
 function soundAt83B7() { // $83B7
  a=nz(24);
  y=nz(21);
  return soundAt82A4();
 }
 function SQ1Bell3Cont() { // $83BE
  a=nz(read(1810));
  t=1;c=+(a>=t);nz(a-t);
  if (!z) return soundAt83CA();
  return soundAt83C5();
 }
 function soundAt83C5() { // $83C5
  write(1811, nz(read(1811) - 1));
  if (!z) return soundAt83B7();
  return soundAt83CA();
 }
 function soundAt83CA() { // $83CA
  return SQ1Bell1Cont();
 }
 function SQ1StarPunchInit() { // $83CD
  a=nz(36);
  InitSQ1SFX();
  return soundAt83D2();
 }
 function soundAt83D2() { // $83D2
  write(1810, nz(read(1810) - 1));
  a=nz(143);
  write(1811, a);
  x=nz(156);
  y=nz(130);
  SetSQ1Control();
  return SQ1StarPunchCont();
 }
 function SQ1StarPunchCont() { // $83E1
  a=nz(read(1810));
  t=18;c=+(a>=t);nz(a-t);
  if (z) return soundAt83D2();
  return soundAt83E8();
 }
 function soundAt83E8() { // $83E8
  a=nz(read(1811));
  y=nz(a);
  LogDiv16();
  return soundAt83EF();
 }
 function soundAt83EF() { // $83EF
  write(1811, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16386, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 3);
  a=nz(a | 8);
  write(16387, a);
  return FinishSQ1SFXFrame();
 }
 function ChkSQ1SFX5() { // $8402
  t=21;c=+(y>=t);nz(y-t);
  if (z) return SQ1Bell3Init();
  return soundAt8406();
 }
 function soundAt8406() { // $8406
  t=21;c=+(a>=t);nz(a-t);
  if (z) return SQ1Bell3Cont();
  return soundAt840A();
 }
 function soundAt840A() { // $840A
  t=22;c=+(y>=t);nz(y-t);
  if (z) return SQ1StarPunchInit();
  return soundAt840E();
 }
 function soundAt840E() { // $840E
  t=22;c=+(a>=t);nz(a-t);
  if (z) return SQ1StarPunchCont();
  return soundAt8412();
 }
 function soundAt8412() { // $8412
  t=23;c=+(y>=t);nz(y-t);
  if (z) return SQ1HippoTalkInit();
  return soundAt8416();
 }
 function soundAt8416() { // $8416
  t=23;c=+(a>=t);nz(a-t);
  if (z) return SQ1HippoTalkCont();
  return soundAt841A();
 }
 function soundAt841A() { // $841A
  t=24;c=+(y>=t);nz(y-t);
  if (z) return SQ1HolePunchInit();
  return soundAt841E();
 }
 function soundAt841E() { // $841E
  t=24;c=+(a>=t);nz(a-t);
  if (z) return SQ1HolePunchCont();
  return soundAt8422();
 }
 function soundAt8422() { // $8422
  return;
 }
 function SQ1HippoTalkInit() { // $8423
  a=nz(16);
  InitSQ1SFX();
  return soundAt8428();
 }
 function soundAt8428() { // $8428
  x=nz(130);
  y=nz(162);
  a=nz(86);
  UpdateSQ1();
  return SQ1HippoTalkCont();
 }
 function SQ1HippoTalkCont() { // $8431
  a=nz(read(1810));
  t=14;c=+(a>=t);nz(a-t);
  if (!z) return soundAt843D();
  return soundAt8438();
 }
 function soundAt8438() { // $8438
  a=nz(62);
  UpdateSQ1Note();
  return soundAt843D();
 }
 function soundAt843D() { // $843D
  return FinishSQ1SFXFrame();
 }
 function SQ1HolePunchInit() { // $8440
  a=nz(32);
  InitSQ1SQ2SFX();
  return soundAt8445();
 }
 function soundAt8445() { // $8445
  a=nz(9);
  write(16396, a);
  a=nz(15);
  write(16398, a);
  a=nz(8);
  write(16399, a);
  a=nz(15);
  write(16392, a);
  a=nz(0);
  write(16394, a);
  a=nz(9);
  write(16395, a);
  return SQ1HolePunchCont();
 }
 function SQ1HolePunchCont() { // $8463
  return FinishSQ1SFXFrame();
 }
 function soundAt8466() { // $8466
  a=nz(read(1813));
  a=nz(a & 7);
  if (!z) return soundAt8489();
  return soundAt846D();
 }
 function soundAt846D() { // $846D
  a=nz(read(1814));
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  c=1;
  t=a + read(1814) + c;c=+(t>255);a=nz(t);
  write(1814, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16390, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 7);
  a=nz(a | 8);
  write(16391, a);
  return soundAt8489();
 }
 function soundAt8489() { // $8489
  return;
 }
 function soundAt848A() { // $848A
  write(245, y);
  a=nz(64);
  write(1813, a);
  a=nz(26);
  write(1814, a);
  x=nz(159);
  y=nz(131);
  SetSQ2Control();
  return soundAt849D();
 }
 function soundAt849D() { // $849D
  a=nz(read(1813));
  t=64;c=+(a>=t);nz(a-t);
  if (c) return soundAt84AB();
  return soundAt84A4();
 }
 function soundAt84A4() { // $84A4
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  a=nz(a | 144);
  write(16388, a);
  return soundAt84AB();
 }
 function soundAt84AB() { // $84AB
  soundAt8466();
  return soundAt84AE();
 }
 function soundAt84AE() { // $84AE
  return soundAt8514();
 }
 function PlaySQ2SFX() { // $84B1
  a=nz(read(1829));
  if (z) return soundAt84BB();
  return soundAt84B6();
 }
 function soundAt84B6() { // $84B6
  a=nz(0);
  write(245, a);
  return;
 }
 function soundAt84BB() { // $84BB
  y=nz(read(241));
  if (n) return soundAt8519();
  return soundAt84BF();
 }
 function soundAt84BF() { // $84BF
  a=nz(read(245));
  t=1;c=+(y>=t);nz(y-t);
  if (z) return soundAt848A();
  return soundAt84C5();
 }
 function soundAt84C5() { // $84C5
  t=1;c=+(a>=t);nz(a-t);
  if (z) return soundAt849D();
  return soundAt84C9();
 }
 function soundAt84C9() { // $84C9
  t=2;c=+(y>=t);nz(y-t);
  if (z) return soundAt84DC();
  return soundAt84CD();
 }
 function soundAt84CD() { // $84CD
  t=2;c=+(a>=t);nz(a-t);
  if (z) return soundAt84EC();
  return soundAt84D1();
 }
 function soundAt84D1() { // $84D1
  t=3;c=+(y>=t);nz(y-t);
  if (z) return soundAt8523();
  return soundAt84D5();
 }
 function soundAt84D5() { // $84D5
  t=3;c=+(a>=t);nz(a-t);
  if (z) return soundAt852F();
  return soundAt84D9();
 }
 function soundAt84D9() { // $84D9
  return soundAt85B0();
 }
 function soundAt84DC() { // $84DC
  write(245, y);
  a=nz(127);
  write(1813, a);
  x=nz(156);
  y=nz(127);
  a=nz(98);
  UpdateSQ2();
  return soundAt84EC();
 }
 function soundAt84EC() { // $84EC
  a=nz(read(1813));
  t=108;c=+(a>=t);nz(a-t);
  if (z) return soundAt8514();
  return soundAt84F3();
 }
 function soundAt84F3() { // $84F3
  if (!c) return soundAt8500();
  return soundAt84F5();
 }
 function soundAt84F5() { // $84F5
  a=nz(a & 7);
  y=nz(a);
  a=nz(read((63503 + y) & 65535));
  write(16389, a);
  if (!z) return soundAt8514();
  return soundAt8500();
 }
 function soundAt8500() { // $8500
  t=107;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8509();
  return soundAt8504();
 }
 function soundAt8504() { // $8504
  y=nz(165);
  write(16389, y);
  return soundAt8509();
 }
 function soundAt8509() { // $8509
  t=48;c=+(a>=t);nz(a-t);
  if (c) return soundAt8514();
  return soundAt850D();
 }
 function soundAt850D() { // $850D
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  a=nz(a | 144);
  write(16388, a);
  return soundAt8514();
 }
 function soundAt8514() { // $8514
  write(1813, nz(read(1813) - 1));
  if (!z) return soundAt8522();
  return soundAt8519();
 }
 function soundAt8519() { // $8519
  a=nz(0);
  write(245, a);
  a=nz(16);
  write(16388, a);
  return soundAt8522();
 }
 function soundAt8522() { // $8522
  return;
 }
 function soundAt8523() { // $8523
  write(245, y);
  a=nz(16);
  write(1813, a);
  a=nz(4);
  write(1814, a);
  return soundAt852F();
 }
 function soundAt852F() { // $852F
  y=nz(read(1814));
  a=nz(read(1813));
  t=read((63510 + y) & 65535);c=+(a>=t);nz(a-t);
  if (!z) return soundAt8550();
  return soundAt853A();
 }
 function soundAt853A() { // $853A
  x=nz(132);
  SQ2CntrlAndSwpDis();
  return soundAt853F();
 }
 function soundAt853F() { // $853F
  y=nz(read(1814));
  a=nz(read((63514 + y) & 65535));
  write(16390, a);
  a=nz(8);
  write(16391, a);
  write(1814, nz(read(1814) - 1));
  return soundAt8550();
 }
 function soundAt8550() { // $8550
  return soundAt8514();
 }
 function soundAt8553() { // $8553
  write(245, y);
  a=nz(32);
  write(1813, a);
  x=nz(26);
  y=nz(205);
  a=nz(66);
  if (!z) return soundAt856F();
  return soundAt8562();
 }
 function soundAt8562() { // $8562
  a=nz(read(1813));
  t=24;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8572();
  return soundAt8569();
 }
 function soundAt8569() { // $8569
  x=nz(148);
  y=nz(197);
  a=nz(80);
  return soundAt856F();
 }
 function soundAt856F() { // $856F
  UpdateSQ2();
  return soundAt8572();
 }
 function soundAt8572() { // $8572
  return soundAt8514();
 }
 function soundAt8575() { // $8575
  write(245, y);
  a=nz(16);
  write(1813, a);
  a=nz(56);
  if (!z) return soundAt8589();
  return soundAt8580();
 }
 function soundAt8580() { // $8580
  a=nz(read(1813));
  t=12;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8591();
  return soundAt8587();
 }
 function soundAt8587() { // $8587
  a=nz(68);
  return soundAt8589();
 }
 function soundAt8589() { // $8589
  x=nz(205);
  write(16389, x);
  UpdateSQ2Note();
  return soundAt8591();
 }
 function soundAt8591() { // $8591
  y=nz(read(1813));
  a=nz(read((63576 + y) & 65535));
  write(16388, a);
  return soundAt8514();
 }
 function soundAt859D() { // $859D
  write(245, y);
  a=nz(16);
  write(1813, a);
  x=nz(67);
  y=nz(132);
  a=nz(76);
  UpdateSQ2();
  return soundAt85AD();
 }
 function soundAt85AD() { // $85AD
  return soundAt8514();
 }
 function soundAt85B0() { // $85B0
  t=4;c=+(y>=t);nz(y-t);
  if (z) return soundAt8553();
  return soundAt85B4();
 }
 function soundAt85B4() { // $85B4
  t=4;c=+(a>=t);nz(a-t);
  if (z) return soundAt8562();
  return soundAt85B8();
 }
 function soundAt85B8() { // $85B8
  t=5;c=+(y>=t);nz(y-t);
  if (z) return soundAt8575();
  return soundAt85BC();
 }
 function soundAt85BC() { // $85BC
  t=5;c=+(a>=t);nz(a-t);
  if (z) return soundAt8580();
  return soundAt85C0();
 }
 function soundAt85C0() { // $85C0
  t=6;c=+(y>=t);nz(y-t);
  if (z) return soundAt859D();
  return soundAt85C4();
 }
 function soundAt85C4() { // $85C4
  t=6;c=+(a>=t);nz(a-t);
  if (z) return soundAt85AD();
  return soundAt85C8();
 }
 function soundAt85C8() { // $85C8
  t=7;c=+(y>=t);nz(y-t);
  if (z) return soundAt85DB();
  return soundAt85CC();
 }
 function soundAt85CC() { // $85CC
  t=7;c=+(a>=t);nz(a-t);
  if (z) return soundAt85EB();
  return soundAt85D0();
 }
 function soundAt85D0() { // $85D0
  t=8;c=+(y>=t);nz(y-t);
  if (z) return soundAt85FA();
  return soundAt85D4();
 }
 function soundAt85D4() { // $85D4
  t=8;c=+(a>=t);nz(a-t);
  if (z) return soundAt860A();
  return soundAt85D8();
 }
 function soundAt85D8() { // $85D8
  return soundAt8666();
 }
 function soundAt85DB() { // $85DB
  write(245, y);
  a=nz(22);
  write(1813, a);
  x=nz(95);
  y=nz(139);
  a=nz(14);
  UpdateSQ2();
  return soundAt85EB();
 }
 function soundAt85EB() { // $85EB
  a=nz(read(1813));
  t=16;c=+(a>=t);nz(a-t);
  if (c) return soundAt85F7();
  return soundAt85F2();
 }
 function soundAt85F2() { // $85F2
  a=nz(a | 80);
  write(16388, a);
  return soundAt85F7();
 }
 function soundAt85F7() { // $85F7
  return soundAt8514();
 }
 function soundAt85FA() { // $85FA
  write(245, y);
  a=nz(16);
  write(1813, a);
  x=nz(133);
  y=nz(133);
  a=nz(28);
  UpdateSQ2();
  return soundAt860A();
 }
 function soundAt860A() { // $860A
  return soundAt8514();
 }
 function soundAt860D() { // $860D
  write(245, y);
  a=nz(32);
  write(1813, a);
  a=nz(143);
  write(1814, a);
  x=nz(93);
  y=nz(129);
  SetSQ2Control();
  return soundAt8620();
 }
 function soundAt8620() { // $8620
  a=nz(read(1814));
  y=nz(a);
  LogDiv16();
  return soundAt8627();
 }
 function soundAt8627() { // $8627
  write(1814, a);
  return soundAt862A();
 }
 function soundAt862A() { // $862A
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16390, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 3);
  a=nz(a | 8);
  write(16391, a);
  a=nz(read(1813));
  t=13;c=+(a>=t);nz(a-t);
  if (c) return soundAt8643();
  return soundAt863E();
 }
 function soundAt863E() { // $863E
  a=nz(a | 144);
  write(16388, a);
  return soundAt8643();
 }
 function soundAt8643() { // $8643
  return soundAt8514();
 }
 function soundAt8646() { // $8646
  write(245, y);
  a=nz(16);
  write(1813, a);
  a=nz(255);
  write(1814, a);
  x=nz(93);
  y=nz(129);
  SetSQ2Control();
  return soundAt8659();
 }
 function soundAt8659() { // $8659
  a=nz(read(1814));
  y=nz(a);
  LogDiv8();
  return soundAt8660();
 }
 function soundAt8660() { // $8660
  write(1814, a);
  return soundAt862A();
 }
 function soundAt8666() { // $8666
  t=9;c=+(y>=t);nz(y-t);
  if (z) return soundAt860D();
  return soundAt866A();
 }
 function soundAt866A() { // $866A
  t=9;c=+(a>=t);nz(a-t);
  if (z) return soundAt8620();
  return soundAt866E();
 }
 function soundAt866E() { // $866E
  t=10;c=+(y>=t);nz(y-t);
  if (z) return soundAt8646();
  return soundAt8672();
 }
 function soundAt8672() { // $8672
  t=10;c=+(a>=t);nz(a-t);
  if (z) return soundAt8659();
  return soundAt8676();
 }
 function soundAt8676() { // $8676
  t=11;c=+(y>=t);nz(y-t);
  if (z) return soundAt8681();
  return soundAt867A();
 }
 function soundAt867A() { // $867A
  t=11;c=+(a>=t);nz(a-t);
  if (z) return soundAt8691();
  return soundAt867E();
 }
 function soundAt867E() { // $867E
  return soundAt86D9();
 }
 function soundAt8681() { // $8681
  write(245, y);
  a=nz(24);
  write(1813, a);
  x=nz(200);
  y=nz(204);
  a=nz(52);
  UpdateSQ2();
  return soundAt8691();
 }
 function soundAt8691() { // $8691
  return soundAt8514();
 }
 function soundAt8694() { // $8694
  write(245, y);
  a=nz(12);
  write(1813, a);
  x=nz(3);
  y=nz(197);
  SetSQ2Control();
  return soundAt86A2();
 }
 function soundAt86A2() { // $86A2
  a=nz(56);
  if (!z) return soundAt86B6();
  return soundAt86A6();
 }
 function soundAt86A6() { // $86A6
  a=nz(read(1813));
  t=8;c=+(a>=t);nz(a-t);
  if (!z) return soundAt86B9();
  return soundAt86AD();
 }
 function soundAt86AD() { // $86AD
  x=nz(2);
  y=nz(204);
  SetSQ2Control();
  return soundAt86B4();
 }
 function soundAt86B4() { // $86B4
  a=nz(72);
  return soundAt86B6();
 }
 function soundAt86B6() { // $86B6
  return soundAt856F();
 }
 function soundAt86B9() { // $86B9
  return soundAt8514();
 }
 function soundAt86BC() { // $86BC
  write(245, y);
  a=nz(16);
  write(1813, a);
  x=nz(136);
  y=nz(211);
  a=nz(28);
  UpdateSQ2();
  return soundAt86CC();
 }
 function soundAt86CC() { // $86CC
  a=nz(58);
  UpdateTriNote();
  return soundAt86D1();
 }
 function soundAt86D1() { // $86D1
  a=nz(28);
  write(16392, a);
  return soundAt86D6();
 }
 function soundAt86D6() { // $86D6
  return soundAt8514();
 }
 function soundAt86D9() { // $86D9
  t=12;c=+(y>=t);nz(y-t);
  if (z) return soundAt8694();
  return soundAt86DD();
 }
 function soundAt86DD() { // $86DD
  t=12;c=+(a>=t);nz(a-t);
  if (z) return soundAt86A6();
  return soundAt86E1();
 }
 function soundAt86E1() { // $86E1
  t=13;c=+(y>=t);nz(y-t);
  if (z) return soundAt86BC();
  return soundAt86E5();
 }
 function soundAt86E5() { // $86E5
  t=13;c=+(a>=t);nz(a-t);
  if (z) return soundAt86D6();
  return soundAt86E9();
 }
 function soundAt86E9() { // $86E9
  t=14;c=+(y>=t);nz(y-t);
  if (z) return soundAt86FC();
  return soundAt86ED();
 }
 function soundAt86ED() { // $86ED
  t=14;c=+(a>=t);nz(a-t);
  if (z) return soundAt870F();
  return soundAt86F1();
 }
 function soundAt86F1() { // $86F1
  t=15;c=+(y>=t);nz(y-t);
  if (z) return soundAt872B();
  return soundAt86F5();
 }
 function soundAt86F5() { // $86F5
  t=15;c=+(a>=t);nz(a-t);
  if (z) return soundAt873F();
  return soundAt86F9();
 }
 function soundAt86F9() { // $86F9
  return soundAt87D9();
 }
 function soundAt86FC() { // $86FC
  write(245, y);
  a=nz(10);
  write(1813, a);
  a=nz(26);
  write(1814, a);
  x=nz(159);
  y=nz(131);
  SetSQ2Control();
  return soundAt870F();
 }
 function soundAt870F() { // $870F
  a=nz(read(1813));
  t=6;c=+(a>=t);nz(a-t);
  if (!c) return soundAt871B();
  return soundAt8716();
 }
 function soundAt8716() { // $8716
  soundAt8466();
  return soundAt8719();
 }
 function soundAt8719() { // $8719
  if (!z) return soundAt8728();
  return soundAt871B();
 }
 function soundAt871B() { // $871B
  t=5;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8728();
  return soundAt871F();
 }
 function soundAt871F() { // $871F
  x=nz(129);
  y=nz(139);
  a=nz(52);
  UpdateSQ2();
  return soundAt8728();
 }
 function soundAt8728() { // $8728
  return soundAt8514();
 }
 function soundAt872B() { // $872B
  write(245, y);
  a=nz(24);
  write(1813, a);
  a=nz(20);
  write(1814, a);
  x=nz(158);
  y=nz(179);
  a=nz(64);
  if (!z) return soundAt874D();
  return soundAt873F();
 }
 function soundAt873F() { // $873F
  a=nz(read(1813));
  t=read(1814);c=+(a>=t);nz(a-t);
  if (!z) return soundAt8750();
  return soundAt8747();
 }
 function soundAt8747() { // $8747
  x=nz(134);
  y=nz(197);
  a=nz(94);
  return soundAt874D();
 }
 function soundAt874D() { // $874D
  UpdateSQ2();
  return soundAt8750();
 }
 function soundAt8750() { // $8750
  return soundAt8514();
 }
 function soundAt8753() { // $8753
  write(245, y);
  a=nz(96);
  write(1813, a);
  a=nz(12);
  write(1814, a);
  a=nz(15);
  write(1815, a);
  a=nz(0);
  write(1832, a);
  a=nz(4);
  write(1833, a);
  return soundAt876E();
 }
 function soundAt876E() { // $876E
  y=nz(read(1815));
  a=nz(read(1832));
  if (z) return soundAt877B();
  return soundAt8776();
 }
 function soundAt8776() { // $8776
  a=nz(read((63557 + y) & 65535));
  if (!z) return soundAt877E();
  return soundAt877B();
 }
 function soundAt877B() { // $877B
  a=nz(read((63541 + y) & 65535));
  return soundAt877E();
 }
 function soundAt877E() { // $877E
  write(16388, a);
  a=nz(read(1813));
  y=nz(read(1814));
  t=read((63522 + y) & 65535);c=+(a>=t);nz(a-t);
  if (!z) return soundAt87CB();
  return soundAt878C();
 }
 function soundAt878C() { // $878C
  y=nz(y + 1);
  a=nz(y);
  t=a;a=nz(t>>1);c=t&1;
  y=nz(a);
  a=nz(read((63534 + y) & 65535));
  write(1815, a);
  a=nz(read(1814));
  t=a;a=nz(t>>1);c=t&1;
  if (c) return soundAt87A2();
  return soundAt879C();
 }
 function soundAt879C() { // $879C
  a=nz(202);
  x=nz(0);
  if (z) return soundAt87A6();
  return soundAt87A2();
 }
 function soundAt87A2() { // $87A2
  a=nz(187);
  x=nz(1);
  return soundAt87A6();
 }
 function soundAt87A6() { // $87A6
  write(1832, x);
  write(16389, a);
  a=nz(read(1814));
  if (z) return soundAt87B4();
  return soundAt87B1();
 }
 function soundAt87B1() { // $87B1
  write(1814, nz(read(1814) - 1));
  return soundAt87B4();
 }
 function soundAt87B4() { // $87B4
  y=nz(read(1833));
  a=nz(read((63518 + y) & 65535));
  write(16390, a);
  a=nz(read((63572 + y) & 65535));
  write(16391, a);
  y=nz(y - 1);
  if (!z) return soundAt87C8();
  return soundAt87C6();
 }
 function soundAt87C6() { // $87C6
  y=nz(4);
  return soundAt87C8();
 }
 function soundAt87C8() { // $87C8
  write(1833, y);
  return soundAt87CB();
 }
 function soundAt87CB() { // $87CB
  a=nz(read(1815));
  if (z) return soundAt87D3();
  return soundAt87D0();
 }
 function soundAt87D0() { // $87D0
  write(1815, nz(read(1815) - 1));
  return soundAt87D3();
 }
 function soundAt87D3() { // $87D3
  return soundAt8514();
 }
 function soundAt87D6() { // $87D6
  return soundAt8753();
 }
 function soundAt87D9() { // $87D9
  t=16;c=+(y>=t);nz(y-t);
  if (z) return soundAt87D6();
  return soundAt87DD();
 }
 function soundAt87DD() { // $87DD
  t=16;c=+(a>=t);nz(a-t);
  if (z) return soundAt876E();
  return soundAt87E1();
 }
 function soundAt87E1() { // $87E1
  t=17;c=+(y>=t);nz(y-t);
  if (z) return soundAt87F4();
  return soundAt87E5();
 }
 function soundAt87E5() { // $87E5
  t=17;c=+(a>=t);nz(a-t);
  if (z) return soundAt8807();
  return soundAt87E9();
 }
 function soundAt87E9() { // $87E9
  t=18;c=+(y>=t);nz(y-t);
  if (z) return soundAt8823();
  return soundAt87ED();
 }
 function soundAt87ED() { // $87ED
  t=18;c=+(a>=t);nz(a-t);
  if (z) return soundAt8836();
  return soundAt87F1();
 }
 function soundAt87F1() { // $87F1
  return soundAt88B6();
 }
 function soundAt87F4() { // $87F4
  write(245, y);
  a=nz(8);
  write(1813, a);
  a=nz(31);
  write(1814, a);
  x=nz(154);
  y=nz(131);
  SetSQ2Control();
  return soundAt8807();
 }
 function soundAt8807() { // $8807
  a=nz(read(1813));
  t=4;c=+(a>=t);nz(a-t);
  if (!c) return soundAt8813();
  return soundAt880E();
 }
 function soundAt880E() { // $880E
  soundAt8466();
  return soundAt8811();
 }
 function soundAt8811() { // $8811
  if (!z) return soundAt8820();
  return soundAt8813();
 }
 function soundAt8813() { // $8813
  t=3;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8820();
  return soundAt8817();
 }
 function soundAt8817() { // $8817
  x=nz(129);
  y=nz(139);
  a=nz(80);
  UpdateSQ2();
  return soundAt8820();
 }
 function soundAt8820() { // $8820
  return soundAt8514();
 }
 function soundAt8823() { // $8823
  write(245, y);
  a=nz(64);
  write(1813, a);
  a=nz(255);
  write(1814, a);
  x=nz(30);
  y=nz(130);
  SetSQ2Control();
  return soundAt8836();
 }
 function soundAt8836() { // $8836
  a=nz(read(1814));
  y=nz(a);
  LogDiv16();
  return soundAt883D();
 }
 function soundAt883D() { // $883D
  write(1814, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16390, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 3);
  a=nz(a | 8);
  write(16391, a);
  a=nz(read(1813));
  t=12;c=+(a>=t);nz(a-t);
  if (c) return soundAt8859();
  return soundAt8854();
 }
 function soundAt8854() { // $8854
  a=nz(a | 144);
  write(16388, a);
  return soundAt8859();
 }
 function soundAt8859() { // $8859
  return soundAt8514();
 }
 function soundAt885C() { // $885C
  write(245, y);
  a=nz(16);
  write(1813, a);
  x=nz(130);
  y=nz(162);
  a=nz(86);
  UpdateSQ2();
  return soundAt886C();
 }
 function soundAt886C() { // $886C
  a=nz(read(1813));
  t=14;c=+(a>=t);nz(a-t);
  if (!z) return soundAt8878();
  return soundAt8873();
 }
 function soundAt8873() { // $8873
  a=nz(62);
  UpdateSQ2Note();
  return soundAt8878();
 }
 function soundAt8878() { // $8878
  return soundAt8514();
 }
 function soundAt887B() { // $887B
  write(245, y);
  a=nz(32);
  write(1813, a);
  a=nz(127);
  if (!z) return soundAt888B();
  return soundAt8886();
 }
 function soundAt8886() { // $8886
  a=nz(95);
  write(1813, nz(read(1813) - 1));
  return soundAt888B();
 }
 function soundAt888B() { // $888B
  write(1814, a);
  x=nz(158);
  y=nz(130);
  SetSQ2Control();
  return soundAt8895();
 }
 function soundAt8895() { // $8895
  a=nz(read(1813));
  t=16;c=+(a>=t);nz(a-t);
  if (z) return soundAt8886();
  return soundAt889C();
 }
 function soundAt889C() { // $889C
  a=nz(read(1814));
  y=nz(a);
  LogDiv32();
  return soundAt88A3();
 }
 function soundAt88A3() { // $88A3
  write(1814, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  write(16390, a);
  t=a;a=nz((t<<1)|c);c=(t>>7)&1;
  a=nz(a & 3);
  a=nz(a | 8);
  write(16391, a);
  return soundAt8514();
 }
 function soundAt88B6() { // $88B6
  t=19;c=+(y>=t);nz(y-t);
  if (z) return soundAt885C();
  return soundAt88BA();
 }
 function soundAt88BA() { // $88BA
  t=19;c=+(a>=t);nz(a-t);
  if (z) return soundAt886C();
  return soundAt88BE();
 }
 function soundAt88BE() { // $88BE
  t=20;c=+(y>=t);nz(y-t);
  if (z) return soundAt887B();
  return soundAt88C2();
 }
 function soundAt88C2() { // $88C2
  t=20;c=+(a>=t);nz(a-t);
  if (z) return soundAt8895();
  return soundAt88C6();
 }
 function soundAt88C6() { // $88C6
  t=21;c=+(y>=t);nz(y-t);
  if (z) return soundAt88CF();
  return soundAt88CA();
 }
 function soundAt88CA() { // $88CA
  t=21;c=+(a>=t);nz(a-t);
  if (z) return soundAt88DF();
  return soundAt88CE();
 }
 function soundAt88CE() { // $88CE
  return;
 }
 function soundAt88CF() { // $88CF
  write(245, y);
  a=nz(16);
  write(1813, a);
  x=nz(200);
  y=nz(172);
  a=nz(66);
  UpdateSQ2();
  return soundAt88DF();
 }
 function soundAt88DF() { // $88DF
  return soundAt8514();
 }
 function PlayMusic() { // $88E2
  a=nz(read(242));
  if (n) return StopMusic();
  return soundAt88E6();
 }
 function soundAt88E6() { // $88E6
  t=27;c=+(a>=t);nz(a-t);
  if (z) return StopMusic();
  return soundAt88EA();
 }
 function soundAt88EA() { // $88EA
  t=28;c=+(a>=t);nz(a-t);
  if (z) return StopMusic();
  return soundAt88EE();
 }
 function soundAt88EE() { // $88EE
  a=nz(read(242));
  if (!z) return DoInitMusic();
  return soundAt88F2();
 }
 function soundAt88F2() { // $88F2
  a=nz(read(246));
  if (z) return ExitNoMusic();
  return soundAt88F6();
 }
 function soundAt88F6() { // $88F6
  return UpdateSQ2Music();
 }
 function DoInitMusic() { // $88F9
  return InitMusic();
 }
 function ChkRepeatMusic() { // $88FC
  a=nz(read(246));
  t=26;c=+(a>=t);nz(a-t);
  if (c) return UpdateMusicIndex();
  return StopMusic();
 }
 function StopMusic() { // $8902
  a=nz(0);
  write(246, a);
  return SilenceChannels();
 }
 function SilenceChannels() { // $8906
  a=nz(read(1828));
  if (z) return ChkSQ1Use();
  return soundAt890B();
 }
 function soundAt890B() { // $890B
  a=nz(read(245));
  if (z) return SilenceSQ2();
  return soundAt890F();
 }
 function soundAt890F() { // $890F
  a=nz(16);
  return soundAt8911();
 }
 function soundAt8911() { // $8911
  write(16384, a);
  a=nz(0);
  write(16392, a);
  if (z) return ResetSQ1SQ2Env();
  return SilenceSQ2();
 }
 function SilenceSQ2() { // $891B
  a=nz(16);
  write(16388, a);
  if (!z) return soundAt8911();
  return ChkSQ1Use();
 }
 function ChkSQ1Use() { // $8922
  a=nz(read(1830));
  if (z) return ChkSQ2Use();
  return soundAt8927();
 }
 function soundAt8927() { // $8927
  a=nz(read(245));
  if (z) return _SilenceSQ2();
  return soundAt892B();
 }
 function soundAt892B() { // $892B
  if (!z) return ChkTriNoiseSilence();
  return _SilenceSQ2();
 }
 function _SilenceSQ2() { // $892D
  a=nz(16);
  write(16388, a);
  if (!z) return SilenceTriNoise();
  return ChkSQ2Use();
 }
 function ChkSQ2Use() { // $8934
  a=nz(read(1829));
  if (z) return ChkMusicEnd();
  return ChkTriNoiseSilence();
 }
 function ChkTriNoiseSilence() { // $8939
  a=nz(16);
  if (!z) return SilenceTriNoise();
  return ChkMusicEnd();
 }
 function ChkMusicEnd() { // $893D
  a=nz(read(245));
  if (z) return SilenceAllChannels();
  return soundAt8941();
 }
 function soundAt8941() { // $8941
  a=nz(16);
  if (!z) return SilenceSQ1TriNoise();
  return SilenceAllChannels();
 }
 function SilenceAllChannels() { // $8945
  a=nz(16);
  write(16388, a);
  return SilenceSQ1TriNoise();
 }
 function SilenceSQ1TriNoise() { // $894A
  write(16384, a);
  return SilenceTriNoise();
 }
 function SilenceTriNoise() { // $894D
  write(16396, a);
  a=nz(0);
  write(16392, a);
  return ResetSQ1SQ2Env();
 }
 function ResetSQ1SQ2Env() { // $8955
  a=nz(0);
  write(1800, a);
  write(1801, a);
  write(1824, a);
  return ExitNoMusic();
 }
 function ExitNoMusic() { // $8960
  return;
 }
 function JmpChkRepeatMusic() { // $8961
  return ChkRepeatMusic();
 }
 function InitMusic() { // $8964
  x=nz(a);
  SilenceChannels();
  return soundAt8968();
 }
 function soundAt8968() { // $8968
  a=nz(x);
  return UpdateMusicIndex();
 }
 function UpdateMusicIndex() { // $8969
  write(246, a);
  write(1802, a);
  y=nz(0);
  write(1803, y);
  return soundAt8973();
 }
 function soundAt8973() { // $8973
  y=nz(read(1802));
  a=nz(read((36863 + y) & 65535));
  c=0;
  t=a + read(1803) + c;c=+(t>255);a=nz(t);
  write(1803, nz(read(1803) + 1));
  y=nz(a);
  a=nz(read((36864 + y) & 65535));
  y=nz(a);
  if (z) return JmpChkRepeatMusic();
  return soundAt8987();
 }
 function soundAt8987() { // $8987
  a=nz(read(246));
  t=16;c=+(a>=t);nz(a-t);
  if (c) return InitUpperMusic();
  return InitLowerMusic();
 }
 function InitLowerMusic() { // $898D
  a=nz(read((36969 + y) & 65535));
  write(1805, a);
  a=nz(read((36970 + y) & 65535));
  write(248, a);
  a=nz(read((36971 + y) & 65535));
  write(249, a);
  a=nz(read((36972 + y) & 65535));
  write(1826, a);
  a=nz(read((36973 + y) & 65535));
  write(253, a);
  a=nz(read((36974 + y) & 65535));
  write(1827, a);
  write(1804, a);
  a=nz(read((36975 + y) & 65535));
  write(1820, a);
  a=nz(read((36976 + y) & 65535));
  write(1821, a);
  return PrepMusicStart();
 }
 function soundAt89C0() { // $89C0
  return soundAt8973();
 }
 function InitUpperMusic() { // $89C3
  a=nz(read((37086 + y) & 65535));
  write(1805, a);
  a=nz(read((37087 + y) & 65535));
  write(248, a);
  a=nz(read((37088 + y) & 65535));
  write(249, a);
  a=nz(read((37089 + y) & 65535));
  write(1826, a);
  a=nz(read((37090 + y) & 65535));
  write(253, a);
  a=nz(read((37091 + y) & 65535));
  write(1827, a);
  write(1804, a);
  a=nz(read((37092 + y) & 65535));
  write(1820, a);
  a=nz(read((37093 + y) & 65535));
  write(1821, a);
  return PrepMusicStart();
 }
 function PrepMusicStart() { // $89F3
  a=nz(0);
  write(252, a);
  a=nz(1);
  write(1792, a);
  write(1793, a);
  write(1794, a);
  write(1795, a);
  a=nz(127);
  write(1806, a);
  return UpdateSQ2Music();
 }
 function UpdateSQ2Music() { // $8A0A
  a=nz(read(245));
  if (!z) return soundAt8A13();
  return soundAt8A0E();
 }
 function soundAt8A0E() { // $8A0E
  a=nz(read(1829));
  if (z) return DecSQ2NoteTime();
  return soundAt8A13();
 }
 function soundAt8A13() { // $8A13
  a=nz(read(1820));
  t=64;c=+(a>=t);nz(a-t);
  if (c) return soundAt8A26();
  return soundAt8A1A();
 }
 function soundAt8A1A() { // $8A1A
  a=nz(63);
  write(1800, a);
  a=nz(1);
  write(1818, a);
  if (!z) return DecSQ2NoteTime();
  return soundAt8A26();
 }
 function soundAt8A26() { // $8A26
  a=nz(0);
  write(1800, a);
  return DecSQ2NoteTime();
 }
 function DecSQ2NoteTime() { // $8A2B
  write(1792, nz(read(1792) - 1));
  if (z) return GetNewSQ2Note();
  return soundAt8A30();
 }
 function soundAt8A30() { // $8A30
  if (!z) return SQ2NoteContinue();
  return soundAt8A32();
 }
 function soundAt8A32() { // $8A32
  GetNoteLength();
  return soundAt8A35();
 }
 function soundAt8A35() { // $8A35
  write(1796, a);
  return GetNewSQ2Note();
 }
 function GetNewSQ2Note() { // $8A38
  y=nz(read(252));
  write(252, nz(read(252) + 1));
  a=nz(read((m[248] | (m[249] << 8)) + y & 65535));
  if (z) return soundAt89C0();
  return soundAt8A40();
 }
 function soundAt8A40() { // $8A40
  if (n) return soundAt8A32();
  return soundAt8A42();
 }
 function soundAt8A42() { // $8A42
  write(1816, a);
  y=nz(read(245));
  if (!z) return ResetSQ2NoteLength();
  return soundAt8A49();
 }
 function soundAt8A49() { // $8A49
  y=nz(read(1829));
  if (!z) return ResetSQ2NoteLength();
  return soundAt8A4E();
 }
 function soundAt8A4E() { // $8A4E
  UpdateSQ2Note();
  return soundAt8A51();
 }
 function soundAt8A51() { // $8A51
  if (z) return ResetSQ2NoteLength();
  return soundAt8A53();
 }
 function soundAt8A53() { // $8A53
  a=nz(read(1820));
  t=128;c=+(a>=t);nz(a-t);
  if (!c) return soundAt8A5E();
  return soundAt8A5A();
 }
 function soundAt8A5A() { // $8A5A
  a=nz(127);
  if (!z) return soundAt8A60();
  return soundAt8A5E();
 }
 function soundAt8A5E() { // $8A5E
  a=nz(63);
  return soundAt8A60();
 }
 function soundAt8A60() { // $8A60
  write(1800, a);
  return ResetSQ2NoteLength();
 }
 function ResetSQ2NoteLength() { // $8A63
  a=nz(read(1796));
  write(1792, a);
  return SQ2NoteContinue();
 }
 function SQ2NoteContinue() { // $8A69
  a=nz(read(245));
  if (!z) return UpdateSQ1Music();
  return soundAt8A6D();
 }
 function soundAt8A6D() { // $8A6D
  a=nz(read(1829));
  if (!z) return UpdateSQ1Music();
  return soundAt8A72();
 }
 function soundAt8A72() { // $8A72
  a=nz(read(1820));
  t=64;c=+(a>=t);nz(a-t);
  if (c) return soundAt8A98();
  return soundAt8A79();
 }
 function soundAt8A79() { // $8A79
  a=nz(read(1816));
  t=2;c=+(a>=t);nz(a-t);
  if (z) return soundAt8A94();
  return soundAt8A80();
 }
 function soundAt8A80() { // $8A80
  x=nz(read(1818));
  if (z) return soundAt8A8D();
  return soundAt8A85();
 }
 function soundAt8A85() { // $8A85
  UpdateSQ2Note();
  return soundAt8A88();
 }
 function soundAt8A88() { // $8A88
  x=nz(0);
  write(1818, x);
  return soundAt8A8D();
 }
 function soundAt8A8D() { // $8A8D
  a=nz(read(1792));
  t=2;c=+(a>=t);nz(a-t);
  if (c) return soundAt8A98();
  return soundAt8A94();
 }
 function soundAt8A94() { // $8A94
  x=nz(16);
  if (!z) return soundAt8AAE();
  return soundAt8A98();
 }
 function soundAt8A98() { // $8A98
  soundAtF472();
  return soundAt8A9B();
 }
 function soundAt8A9B() { // $8A9B
  a=nz(read(1800));
  if (z) return soundAt8AA5();
  return soundAt8AA0();
 }
 function soundAt8AA0() { // $8AA0
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  write(1800, nz(read(1800) - 1));
  return soundAt8AA5();
 }
 function soundAt8AA5() { // $8AA5
  c=0;
  t=a + read(1820) + c;c=+(t>255);a=nz(t);
  y=nz(a);
  a=nz(read((63092 + y) & 65535));
  x=nz(a);
  return soundAt8AAE();
 }
 function soundAt8AAE() { // $8AAE
  SQ2CntrlAndSwpDis();
  return UpdateSQ1Music();
 }
 function UpdateSQ1Music() { // $8AB1
  a=nz(read(253));
  if (!z) return soundAt8AB8();
  return soundAt8AB5();
 }
 function soundAt8AB5() { // $8AB5
  return UpdateTRIMusic();
 }
 function soundAt8AB8() { // $8AB8
  a=nz(read(244));
  if (z) return SQ1NoteCont();
  return soundAt8ABC();
 }
 function soundAt8ABC() { // $8ABC
  a=nz(read(1821));
  t=64;c=+(a>=t);nz(a-t);
  if (c) return soundAt8ACF();
  return soundAt8AC3();
 }
 function soundAt8AC3() { // $8AC3
  a=nz(63);
  write(1801, a);
  a=nz(1);
  write(1819, a);
  if (!z) return SQ1NoteCont();
  return soundAt8ACF();
 }
 function soundAt8ACF() { // $8ACF
  a=nz(0);
  write(1801, a);
  return SQ1NoteCont();
 }
 function SQ1NoteCont() { // $8AD4
  write(1793, nz(read(1793) - 1));
  if (z) return GetNextSQ1Note();
  return soundAt8AD9();
 }
 function soundAt8AD9() { // $8AD9
  if (!z) return soundAt8B18();
  return soundAt8ADB();
 }
 function soundAt8ADB() { // $8ADB
  GetNoteLength();
  return soundAt8ADE();
 }
 function soundAt8ADE() { // $8ADE
  write(1797, a);
  return GetNextSQ1Note();
 }
 function GetNextSQ1Note() { // $8AE1
  y=nz(read(253));
  write(253, nz(read(253) + 1));
  a=nz(read((m[248] | (m[249] << 8)) + y & 65535));
  if (n) return soundAt8ADB();
  return soundAt8AE9();
 }
 function soundAt8AE9() { // $8AE9
  if (!z) return soundAt8AF6();
  return soundAt8AEB();
 }
 function soundAt8AEB() { // $8AEB
  y=nz(read(253));
  write(253, nz(read(253) + 1));
  a=nz(read((m[248] | (m[249] << 8)) + y & 65535));
  write(1806, a);
  if (!z) return GetNextSQ1Note();
  return soundAt8AF6();
 }
 function soundAt8AF6() { // $8AF6
  write(1817, a);
  y=nz(read(244));
  if (!z) return soundAt8B12();
  return soundAt8AFD();
 }
 function soundAt8AFD() { // $8AFD
  UpdateSQ1Note();
  return soundAt8B00();
 }
 function soundAt8B00() { // $8B00
  if (z) return soundAt8B12();
  return soundAt8B02();
 }
 function soundAt8B02() { // $8B02
  a=nz(read(1821));
  t=128;c=+(a>=t);nz(a-t);
  if (!c) return soundAt8B0D();
  return soundAt8B09();
 }
 function soundAt8B09() { // $8B09
  a=nz(127);
  if (!z) return soundAt8B0F();
  return soundAt8B0D();
 }
 function soundAt8B0D() { // $8B0D
  a=nz(63);
  return soundAt8B0F();
 }
 function soundAt8B0F() { // $8B0F
  write(1801, a);
  return soundAt8B12();
 }
 function soundAt8B12() { // $8B12
  a=nz(read(1797));
  write(1793, a);
  return soundAt8B18();
 }
 function soundAt8B18() { // $8B18
  a=nz(read(244));
  if (!z) return UpdateTRIMusic();
  return soundAt8B1C();
 }
 function soundAt8B1C() { // $8B1C
  a=nz(read(1821));
  t=64;c=+(a>=t);nz(a-t);
  if (c) return soundAt8B42();
  return soundAt8B23();
 }
 function soundAt8B23() { // $8B23
  a=nz(read(1817));
  t=2;c=+(a>=t);nz(a-t);
  if (z) return soundAt8B3E();
  return soundAt8B2A();
 }
 function soundAt8B2A() { // $8B2A
  x=nz(read(1819));
  if (z) return soundAt8B37();
  return soundAt8B2F();
 }
 function soundAt8B2F() { // $8B2F
  UpdateSQ1Note();
  return soundAt8B32();
 }
 function soundAt8B32() { // $8B32
  x=nz(0);
  write(1819, x);
  return soundAt8B37();
 }
 function soundAt8B37() { // $8B37
  a=nz(read(1793));
  t=2;c=+(a>=t);nz(a-t);
  if (c) return soundAt8B42();
  return soundAt8B3E();
 }
 function soundAt8B3E() { // $8B3E
  x=nz(16);
  if (!z) return soundAt8B58();
  return soundAt8B42();
 }
 function soundAt8B42() { // $8B42
  soundAtF463();
  return soundAt8B45();
 }
 function soundAt8B45() { // $8B45
  a=nz(read(1801));
  if (z) return soundAt8B4F();
  return soundAt8B4A();
 }
 function soundAt8B4A() { // $8B4A
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  write(1801, nz(read(1801) - 1));
  return soundAt8B4F();
 }
 function soundAt8B4F() { // $8B4F
  c=0;
  t=a + read(1821) + c;c=+(t>255);a=nz(t);
  y=nz(a);
  a=nz(read((63092 + y) & 65535));
  x=nz(a);
  return soundAt8B58();
 }
 function soundAt8B58() { // $8B58
  y=nz(read(1806));
  SetSQ1Control();
  return soundAt8B5E();
 }
 function soundAt8B5E() { // $8B5E
  if (!z) return UpdateTRIMusic();
  return DoNoiseMusic();
 }
 function DoNoiseMusic() { // $8B60
  return UpdateNoiseMusic();
 }
 function UpdateTRIMusic() { // $8B63
  y=nz(read(1826));
  if (z) return DoNoiseMusic();
  return soundAt8B68();
 }
 function soundAt8B68() { // $8B68
  write(1834, nz(read(1834) - 1));
  write(1794, nz(read(1794) - 1));
  if (z) return GetNextTriNote();
  return soundAt8B70();
 }
 function soundAt8B70() { // $8B70
  if (!z) return ContinueTriNote();
  return UpdateTriLength();
 }
 function UpdateTriLength() { // $8B72
  GetNoteLength();
  return soundAt8B75();
 }
 function soundAt8B75() { // $8B75
  write(1798, a);
  return GetNextTriNote();
 }
 function GetNextTriNote() { // $8B78
  y=nz(read(1826));
  write(1826, nz(read(1826) + 1));
  a=nz(read((m[248] | (m[249] << 8)) + y & 65535));
  if (n) return UpdateTriLength();
  return soundAt8B82();
 }
 function soundAt8B82() { // $8B82
  y=nz(read(245));
  t=13;c=+(y>=t);nz(y-t);
  if (z) return ResetTriNoteLen();
  return soundAt8B88();
 }
 function soundAt8B88() { // $8B88
  y=nz(read(244));
  t=24;c=+(y>=t);nz(y-t);
  if (z) return ResetTriNoteLen();
  return soundAt8B8E();
 }
 function soundAt8B8E() { // $8B8E
  t=2;c=+(a>=t);nz(a-t);
  if (!z) return PlayTriNote();
  return soundAt8B92();
 }
 function soundAt8B92() { // $8B92
  y=nz(0);
  write(16392, y);
  if (z) return ResetTriNoteLen();
  return PlayTriNote();
 }
 function PlayTriNote() { // $8B99
  y=nz(129);
  write(16392, y);
  UpdateTriNote();
  return ResetTriNoteLen();
 }
 function ResetTriNoteLen() { // $8BA1
  a=nz(read(1798));
  write(1794, a);
  y=nz(read(246));
  t=21;c=+(y>=t);nz(y-t);
  if (z) return soundAt8BB1();
  return soundAt8BAD();
 }
 function soundAt8BAD() { // $8BAD
  t=4;c=+(y>=t);nz(y-t);
  if (c) return ContinueTriNote();
  return soundAt8BB1();
 }
 function soundAt8BB1() { // $8BB1
  t=11;c=+(a>=t);nz(a-t);
  if (c) return soundAt8BCD();
  return soundAt8BB5();
 }
 function soundAt8BB5() { // $8BB5
  x=nz(a);
  c=1;
  t=a - 2 - (1-c);c=+(t>=0);a=nz(t);
  write(1835, a);
  a=nz(x);
  t=a;a=nz(t>>1);c=t&1;
  write(1834, a);
  t=4;c=+(a>=t);nz(a-t);
  if (c) return soundAt8BC9();
  return soundAt8BC5();
 }
 function soundAt8BC5() { // $8BC5
  a=nz(0);
  if (z) return StoreBlipType();
  return soundAt8BC9();
 }
 function soundAt8BC9() { // $8BC9
  a=nz(1);
  if (!z) return StoreBlipType();
  return soundAt8BCD();
 }
 function soundAt8BCD() { // $8BCD
  a=nz(2);
  return StoreBlipType();
 }
 function StoreBlipType() { // $8BCF
  write(1836, a);
  return ContinueTriNote();
 }
 function ContinueTriNote() { // $8BD2
  a=nz(read(245));
  t=13;c=+(a>=t);nz(a-t);
  if (z) return UpdateNoiseMusic();
  return soundAt8BD8();
 }
 function soundAt8BD8() { // $8BD8
  a=nz(read(244));
  t=24;c=+(a>=t);nz(a-t);
  if (z) return UpdateNoiseMusic();
  return soundAt8BDE();
 }
 function soundAt8BDE() { // $8BDE
  a=nz(read(246));
  t=21;c=+(a>=t);nz(a-t);
  if (z) return ChkBlipType();
  return soundAt8BE4();
 }
 function soundAt8BE4() { // $8BE4
  t=4;c=+(a>=t);nz(a-t);
  if (c) return ChkTriNoteEnd();
  return ChkBlipType();
 }
 function ChkBlipType() { // $8BE8
  a=nz(read(1836));
  t=1;c=+(a>=t);nz(a-t);
  if (z) return ChkMidBlip();
  return soundAt8BEF();
 }
 function soundAt8BEF() { // $8BEF
  t=2;c=+(a>=t);nz(a-t);
  if (z) return ChkBackBlip();
  return ChkFrontBlip();
 }
 function ChkFrontBlip() { // $8BF3
  a=nz(read(1794));
  t=read(1835);c=+(a>=t);nz(a-t);
  if (!z) return UpdateNoiseMusic();
  return soundAt8BFB();
 }
 function soundAt8BFB() { // $8BFB
  if (z) return TriNoteSilence();
  return ChkMidBlip();
 }
 function ChkMidBlip() { // $8BFD
  a=nz(read(1834));
  t=2;c=+(a>=t);nz(a-t);
  if (!z) return UpdateNoiseMusic();
  return soundAt8C04();
 }
 function soundAt8C04() { // $8C04
  if (z) return TriNoteSilence();
  return ChkBackBlip();
 }
 function ChkBackBlip() { // $8C06
  a=nz(read(1794));
  t=7;c=+(a>=t);nz(a-t);
  if (!z) return UpdateNoiseMusic();
  return soundAt8C0D();
 }
 function soundAt8C0D() { // $8C0D
  if (z) return TriNoteSilence();
  return ChkTriNoteEnd();
 }
 function ChkTriNoteEnd() { // $8C0F
  a=nz(read(1794));
  t=2;c=+(a>=t);nz(a-t);
  if (!z) return UpdateNoiseMusic();
  return TriNoteSilence();
 }
 function TriNoteSilence() { // $8C16
  a=nz(0);
  write(16392, a);
  return UpdateNoiseMusic();
 }
 function UpdateNoiseMusic() { // $8C1B
  a=nz(read(1827));
  if (z) return MusicUpdateEnd();
  return soundAt8C20();
 }
 function soundAt8C20() { // $8C20
  a=nz(read(1828));
  if (z) return DecNoiseNoteTime();
  return soundAt8C25();
 }
 function soundAt8C25() { // $8C25
  a=nz(0);
  write(1824, a);
  return DecNoiseNoteTime();
 }
 function DecNoiseNoteTime() { // $8C2A
  write(1795, nz(read(1795) - 1));
  if (z) return GetNextNoiseNote();
  return soundAt8C2F();
 }
 function soundAt8C2F() { // $8C2F
  if (!z) return ChkNoiseVolAdj();
  return UpdateNoiseLength();
 }
 function UpdateNoiseLength() { // $8C31
  GetNoteLength();
  return soundAt8C34();
 }
 function soundAt8C34() { // $8C34
  write(1799, a);
  return GetNextNoiseNote();
 }
 function GetNextNoiseNote() { // $8C37
  y=nz(read(1827));
  write(1827, nz(read(1827) + 1));
  a=nz(read((m[248] | (m[249] << 8)) + y & 65535));
  if (n) return UpdateNoiseLength();
  return soundAt8C41();
 }
 function soundAt8C41() { // $8C41
  if (!z) return SaveNoiseDecay();
  return soundAt8C43();
 }
 function soundAt8C43() { // $8C43
  a=nz(read(1804));
  write(1827, a);
  if (!z) return GetNextNoiseNote();
  return SaveNoiseDecay();
 }
 function SaveNoiseDecay() { // $8C4B
  y=nz(a);
  write(1825, a);
  a=nz(read(1828));
  if (!z) return ResetNoiseNoteLen();
  return soundAt8C54();
 }
 function soundAt8C54() { // $8C54
  a=nz(read((63290 + y) & 65535));
  write(16396, a);
  a=nz(read((63291 + y) & 65535));
  write(16398, a);
  a=nz(read((63292 + y) & 65535));
  write(16399, a);
  a=nz(39);
  write(1824, a);
  return ResetNoiseNoteLen();
 }
 function ResetNoiseNoteLen() { // $8C6B
  a=nz(read(1799));
  write(1795, a);
  return ChkNoiseVolAdj();
 }
 function ChkNoiseVolAdj() { // $8C71
  a=nz(read(1825));
  t=38;c=+(a>=t);nz(a-t);
  if (!c) return MusicUpdateEnd();
  return soundAt8C78();
 }
 function soundAt8C78() { // $8C78
  a=nz(read(1828));
  if (!z) return MusicUpdateEnd();
  return soundAt8C7D();
 }
 function soundAt8C7D() { // $8C7D
  y=nz(read(1824));
  if (z) return SetNoiseVolume();
  return soundAt8C82();
 }
 function soundAt8C82() { // $8C82
  write(1824, nz(read(1824) - 1));
  return SetNoiseVolume();
 }
 function SetNoiseVolume() { // $8C85
  a=nz(read((63252 + y) & 65535));
  write(16396, a);
  return MusicUpdateEnd();
 }
 function MusicUpdateEnd() { // $8C8B
  return;
 }
 function GetNoteLength() { // $F400
  a=nz(a & 31);
  c=0;
  t=a + read(1805) + c;c=+(t>255);a=nz(t);
  y=nz(a);
  a=nz(read((62908 + y) & 65535));
  return;
 }
 function SetSQ1Control() { // $F40B
  write(16384, x);
  write(16385, y);
  return;
 }
 function SQ2CntrlAndSwpDis() { // $F412
  y=nz(127);
  return SetSQ2Control();
 }
 function SetSQ2Control() { // $F414
  write(16388, x);
  write(16389, y);
  return;
 }
 function UpdateSQ2() { // $F41B
  SetSQ2Control();
  return UpdateSQ2Note();
 }
 function UpdateSQ2Note() { // $F41E
  x=nz(4);
  if (!z) return GetChannelNote();
  return UpdateTriNote();
 }
 function UpdateTriNote() { // $F422
  x=nz(8);
  if (!z) return GetChannelNote();
  return UpdateSQ1();
 }
 function UpdateSQ1() { // $F426
  SetSQ1Control();
  return UpdateSQ1Note();
 }
 function UpdateSQ1Note() { // $F429
  x=nz(0);
  return GetChannelNote();
 }
 function GetChannelNote() { // $F42B
  y=nz(a);
  a=nz(read((62781 + y) & 65535));
  if (z) return GetNoteDone();
  return soundAtF431();
 }
 function soundAtF431() { // $F431
  write((16386 + x) & 65535, a);
  t=0;c=+(x>=t);nz(x-t);
  if (!z) return soundAtF43D();
  return soundAtF438();
 }
 function soundAtF438() { // $F438
  write(1807, a);
  if (!z) return GetNoteUpperBits();
  return soundAtF43D();
 }
 function soundAtF43D() { // $F43D
  t=4;c=+(x>=t);nz(x-t);
  if (!z) return GetNoteUpperBits();
  return soundAtF441();
 }
 function soundAtF441() { // $F441
  write(1808, a);
  return GetNoteUpperBits();
 }
 function GetNoteUpperBits() { // $F444
  a=nz(read((62780 + y) & 65535));
  a=nz(a | 8);
  write((16387 + x) & 65535, a);
  return GetNoteDone();
 }
 function GetNoteDone() { // $F44C
  return;
 }
 function LogDiv64() { // $F44D
  t=a;a=nz(t>>1);c=t&1;
  return LogDiv32();
 }
 function LogDiv32() { // $F44E
  t=a;a=nz(t>>1);c=t&1;
  return LogDiv16();
 }
 function LogDiv16() { // $F44F
  t=a;a=nz(t>>1);c=t&1;
  return LogDiv8();
 }
 function LogDiv8() { // $F450
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  write(224, a);
  if (!z) return soundAtF459();
  return soundAtF457();
 }
 function soundAtF457() { // $F457
  write(224, nz(read(224) + 1));
  return soundAtF459();
 }
 function soundAtF459() { // $F459
  a=nz(y);
  c=1;
  t=a - read(224) - (1-c);c=+(t>=0);a=nz(t);
  return;
 }
 function soundAtF45E() { // $F45E
  a=nz(read(1810));
  if (!z) return soundAtF466();
  return soundAtF463();
 }
 function soundAtF463() { // $F463
  a=nz(read(1793));
  return soundAtF466();
 }
 function soundAtF466() { // $F466
  x=nz(0);
  y=nz(read(1807));
  if (!z) return soundAtF47A();
  return soundAtF46D();
 }
 function soundAtF46D() { // $F46D
  a=nz(read(1813));
  if (!z) return soundAtF475();
  return soundAtF472();
 }
 function soundAtF472() { // $F472
  a=nz(read(1792));
  return soundAtF475();
 }
 function soundAtF475() { // $F475
  x=nz(4);
  y=nz(read(1808));
  return soundAtF47A();
 }
 function soundAtF47A() { // $F47A
  write(1809, y);
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  t=a;a=nz(t>>1);c=t&1;
  if (c) return soundAtF48A();
  return soundAtF482();
 }
 function soundAtF482() { // $F482
  a=nz(255);
  c=0;
  t=a + read(1809) + c;c=+(t>255);a=nz(t);
  if (!z) return soundAtF490();
  return soundAtF48A();
 }
 function soundAtF48A() { // $F48A
  a=nz(1);
  c=0;
  t=a + read(1809) + c;c=+(t>255);a=nz(t);
  return soundAtF490();
 }
 function soundAtF490() { // $F490
  write((16386 + x) & 65535, a);
  return;
 }
 function soundAtF494() { // $F494
  write(244, y);
  write(1810, a);
  a=nz(0);
  write(1830, a);
  a=nz(127);
  write(16385, a);
  write(16389, a);
  a=nz(read(1828));
  if (z) return soundAtF4B5();
  return soundAtF4AB();
 }
 function soundAtF4AB() { // $F4AB
  a=nz(16);
  write(16396, a);
  a=nz(0);
  write(1828, a);
  return soundAtF4B5();
 }
 function soundAtF4B5() { // $F4B5
  a=nz(1);
  write(1829, a);
  a=nz(read(244));
  t=12;c=+(a>=t);nz(a-t);
  if (z) return soundAtF4CC();
  return soundAtF4C0();
 }
 function soundAtF4C0() { // $F4C0
  t=21;c=+(a>=t);nz(a-t);
  if (z) return soundAtF4CC();
  return soundAtF4C4();
 }
 function soundAtF4C4() { // $F4C4
  a=nz(10);
  write(16387, a);
  write(16391, a);
  return soundAtF4CC();
 }
 function soundAtF4CC() { // $F4CC
  return;
 }
 function soundAtF4CD() { // $F4CD
  write(16384, a);
  c=1;
  t=a - 3 - (1-c);c=+(t>=0);a=nz(t);
  t=144;c=+(a>=t);nz(a-t);
  if (c) return soundAtF4D9();
  return soundAtF4D7();
 }
 function soundAtF4D7() { // $F4D7
  a=nz(144);
  return soundAtF4D9();
 }
 function soundAtF4D9() { // $F4D9
  write(16388, a);
  return;
 }
 function soundAtF4DD() { // $F4DD
  write(16386, a);
  t=10;c=+(a>=t);nz(a-t);
  if (c) return soundAtF4E8();
  return soundAtF4E4();
 }
 function soundAtF4E4() { // $F4E4
  a=nz(0);
  if (z) return soundAtF4EB();
  return soundAtF4E8();
 }
 function soundAtF4E8() { // $F4E8
  c=1;
  t=a - 10 - (1-c);c=+(t>=0);a=nz(t);
  return soundAtF4EB();
 }
 function soundAtF4EB() { // $F4EB
  write(16390, a);
  return;
 }
 function InitSQ1SFX() { // $F4EF
  write(244, y);
  write(1810, a);
  a=nz(1);
  write(1830, a);
  a=nz(read(1828));
  if (z) return soundAtF508();
  return soundAtF4FE();
 }
 function soundAtF4FE() { // $F4FE
  a=nz(16);
  write(16396, a);
  a=nz(0);
  write(1828, a);
  return soundAtF508();
 }
 function soundAtF508() { // $F508
  a=nz(read(1829));
  if (z) return soundAtF517();
  return soundAtF50D();
 }
 function soundAtF50D() { // $F50D
  a=nz(16);
  write(16388, a);
  a=nz(0);
  write(1829, a);
  return soundAtF517();
 }
 function soundAtF517() { // $F517
  return;
 }
 function InitSQ1SQ2SFX() { // $F518
  write(244, y);
  write(1810, a);
  a=nz(0);
  write(1830, a);
  a=nz(read(1829));
  if (z) return SetNoiseInUse();
  return soundAtF527();
 }
 function soundAtF527() { // $F527
  a=nz(16);
  write(16388, a);
  a=nz(0);
  write(1829, a);
  return SetNoiseInUse();
 }
 function SetNoiseInUse() { // $F531
  a=nz(16);
  write(16384, a);
  a=nz(1);
  write(1828, a);
  return;
 }
 return SoundEngine;
}
