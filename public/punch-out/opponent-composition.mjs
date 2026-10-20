// Resolve opaque source cells in OAM order before drawing transparent glyphs.
// The bounded cache retains shapes only; drawDetail owns palette raster caches.
const composites=[];
const screenWidth=256,screenHeight=240;
export function composeOpponentParts(parts,art){
 const fine=part=>part.matrix.cellWidth===1&&part.matrix.cellHeight===1;
 const regular=parts.filter(fine),coarse=parts.filter(part=>!fine(part));
 // Committed stars precede every regular tile and keep their authored spacing.
 // Unknown declarations retain the original renderer rather than being resampled.
 if(parts.some(part=>{
  const m=part.matrix;
  return m.char||m.details?.length||m.lettering||!Number.isInteger(part.x)||!Number.isInteger(part.y)||!Number.isInteger(m.x??0)||!Number.isInteger(m.y??0);
 })||coarse.some(part=>part.matrix.cellWidth!==undefined||part.matrix.cellHeight!==undefined)||parts.slice(coarse.length).some(part=>!fine(part)))return parts;
 const found=composites.findIndex(entry=>entry.cellWidth===art.cellWidth&&entry.cellHeight===art.cellHeight&&entry.parts.length===parts.length&&entry.parts.every((part,i)=>part.matrix===parts[i].matrix&&part.x===parts[i].x&&part.y===parts[i].y&&part.foreground===parts[i].foreground));
 if(found>=0){const [entry]=composites.splice(found,1);composites.push(entry);return entry.result;}
 const left=Math.max(0,Math.min(screenWidth,...regular.map(part=>part.x+(part.matrix.x||0))));
 const top=Math.max(0,Math.min(screenHeight,...regular.map(part=>part.y+(part.matrix.y||0))));
 const right=Math.min(screenWidth,Math.max(left,...regular.map(part=>part.x+(part.matrix.x||0)+part.matrix.width)));
 const bottom=Math.min(screenHeight,Math.max(top,...regular.map(part=>part.y+(part.matrix.y||0)+part.matrix.height)));
 const width=right-left,height=bottom-top;
 const rows=Array.from({length:height},()=>Array(width).fill(' '));
 const inks=Array.from({length:height},()=>Array(width).fill('.'));
 const owners=Array.from({length:height},()=>Array(width).fill(false));
 for(const part of regular){
  const m=part.matrix,x=part.x+(m.x||0),y=part.y+(m.y||0);
  for(let r=Math.max(0,top-y);r<Math.min(m.height,bottom-y);r++)for(let c=Math.max(0,left-x);c<Math.min(m.width,right-x);c++){
   if(m.inks[r][c]==='.')continue;
   const dy=y+r-top,dx=x+c-left;
   rows[dy][dx]=m.rows[r][c];inks[dy][dx]=m.inks[r][c];owners[dy][dx]=!!part.foreground;
  }
 }
 const result=coarse.map(part=>{
  const m=part.matrix,x=part.x+(m.x||0),y=part.y+(m.y||0),clipRects=[];
  const x0=Math.max(0,x),x1=Math.min(screenWidth,x+m.width*art.cellWidth);
  const y0=Math.max(0,y),y1=Math.min(screenHeight,y+m.height*art.cellHeight);
  // Clip the original coarse glyphs around occupied regular source cells,
  // including spaces and tiles whose background-priority flag differs.
  for(let sy=y0;sy<y1;sy++){
   let start=x0;
   for(let sx=x0;sx<=x1;sx++){
    const covered=sx===x1||(sy>=top&&sy<bottom&&sx>=left&&sx<right&&inks[sy-top][sx-left]!=='.');
    if(covered){if(start<sx)clipRects.push({x:start,y:sy,width:sx-start,height:1});start=sx+1;}
   }
  }
  return {...part,clipRects};
 });
 for(const foreground of [false,true]){
  const groupInks=inks.map((row,r)=>row.map((ink,c)=>owners[r][c]===foreground?ink:'.').join(''));
  if(groupInks.some(row=>/[^.]/.test(row)))result.push({x:left,y:top,foreground,matrix:{width,height,cellWidth:1,cellHeight:1,rows:rows.map(row=>row.join('')),inks:groupInks}});
 }
 composites.push({parts:parts.map(part=>({...part})),cellWidth:art.cellWidth,cellHeight:art.cellHeight,result});
 if(composites.length>8)composites.shift();
 return result;
}
