/** DEF BE1A–BE93: the OAM records include timer/loop markers for portraits. */
export function animateCorner(m){
 for(let x=8;x<256;){const tile=m[0x201+x];if(tile===1){m[0x17]=1;return;}if(tile!==0){x+=4;continue;}m[0x202+x]--;if(m[0x202+x]){x+=4;continue;}const v=m[0x203+x];m[0x202+x]=(v&240)>>>1;m[0x203+x]=((v<<4)|((v&240)>>>4))&255;
  for(x+=4;x<256;){const t=m[0x201+x];if(t<2){m[0x17]=1;return;}const a=m[0x202+x];if(!(a&128)){m[0x201+x]=t^255;x+=4;continue;}const y=m[0x200+x];if(y<240){m[0x200+x]=(y>>>1)|240;m[0x202+x]=(a&227)|((y&224)>>>3);}else{m[0x200+x]=((y&15)<<1)|((a&28)<<3);}x+=4;}
 }
}
export function cornerPoseKey(m){const parts=[];for(let a=0x208;a<0x300;a+=4)if(m[a]<239&&m[a+1]>1)parts.push(...m.slice(a,a+4));return parts.join(',');}
