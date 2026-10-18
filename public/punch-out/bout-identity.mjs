/** Original routing IDs remain distinct from reused combat and art IDs. */
const alternate=[4,5,7,8,9,10,11,12,13];
export function resolveBoutIdentity(careerId,alternateFlag){
 if(!Number.isInteger(careerId)||![0,1].includes(alternateFlag))throw Error('Invalid original bout identity');
 if(alternateFlag===0&&careerId>=0&&careerId<14)return {careerId,combatId:careerId,mode:'career'};
 if(alternateFlag===1&&careerId>=20&&careerId<=28)return {careerId,combatId:alternate[careerId-20],mode:'another-world'};
 throw Error('Invalid original bout identity '+careerId+'/'+alternateFlag);
}
