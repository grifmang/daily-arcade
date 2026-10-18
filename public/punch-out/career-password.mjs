// Native port of original bank 7 $8EBA–8FC5; routing: DEF $A443–A47A.
// No cartridge data, CPU execution, or browser storage is needed at runtime.
const OFFSETS = [6,3,5,7,9,0,1,4,2,8];
const ROTATIONS = [1,2,0,255,2,0,1,255,0,1,2,255,255,255,255,255];
const FIGHTERS = [3,7,12]; // DEF $A185, indexed by decoded $0136 + 1.
const RANKS = [0x23,0x15,0x10]; // DEF $A18D + fighter.

function normalize(text) {
 if(typeof text !== 'string' || !/^[\d\s-]+$/.test(text))return null;
 const password=text.replace(/[\s-]/g,'');
 return /^\d{10}$/.test(password)?password:null;
}

/** Source-defined non-career passwords, bank 7 $8DA2–8DDD. The two chord
 * entries require (A history OR B history) AND Select history at submission
 * ($8DDE), despite the original disassembly's A+B+Select shorthand. */
export function specialPassword(text) {
 const password=normalize(text);
 const kind={'0755416113':'busy','8004222602':'busy','2068822040':'busy','1357924680':'another-world','1061130120':'credits','0073735963':'tyson'}[password];
 if(!kind)return null;
 return {kind,password,requiresChord:kind==='another-world'||kind==='credits'};
}

/** Returns a playable original career, or null. records holds decimal digits
 * [wins tens, wins units, losses tens, losses units, KO tens, KO units].
 * Fresh title entry clears $0180–07FF (DEF $A829–A847), including lossStreak.
 * rematch:0 describes a fresh career; original menu reentry leaves existing
 * zero-page $0A untouched, so callers reproducing that path must preserve it.
 * Rank is the live $09 value, circuitIndex is decoded $0136 (0..2).
 */
export function decodeCareerPassword(text) {
 const password=normalize(text);
 if(!password)return null;
 if(password==='0073735963')return {kind:'tyson',password,fighter:13,records:[0,0,0,2,0,0],rank:0,circuitIndex:null,lossStreak:0,rematch:0};
 const digits=Array.from(password,(value,i)=>(Number(value)-OFFSETS[i]+10)%10);
 const rotations=digits[9]&3;
 for(let r=0;r<rotations;r++){
  for(let i=0;i<10;i++){
   const carry=digits[i]&1;
   digits[i]>>>=1;
   if(i<9)digits[i+1]|=carry<<3;
  }
  digits[0]|=(digits[9]&2)<<1;
 }
 const packed=Array.from({length:5},(_,i)=>((digits[i*2]<<3)|digits[i*2+1])&255);
 const records=[(packed[0]&12)|(packed[1]&3),(packed[3]&12)|(packed[2]&3),0,0,(packed[2]&12)|(packed[3]&3),(packed[1]&12)|(packed[0]&3)];
 const checksum=((packed[2]&48)>>>4)|((packed[1]&48)>>>2)|(packed[0]&48)|((packed[3]&48)<<2);
 const rankBits=(packed[4]&12)|(packed[4]>>>4);
 records[3]=rankBits&3;
 const circuitIndex=rankBits>>>2;
 if(((records.reduce((sum,digit)=>sum+digit,0)^255)&255)!==checksum)return null;
 if(ROTATIONS[rankBits]!==rotations || circuitIndex>2 || records.some(digit=>digit>9))return null;
 if(records[0]===0 && records[1]<3)return null;
 // Preserve $8FB1's comparison quirk: when wins tens is zero, A still holds
 // wins units. Some impossible KO totals therefore pass the original game.
 const comparison=records[0]||records[1];
 if(comparison<records[4] || comparison===records[4]&&records[1]<records[5])return null;
 return {kind:'career',password,fighter:FIGHTERS[circuitIndex],records,rank:RANKS[circuitIndex],circuitIndex,lossStreak:0,rematch:0};
}
