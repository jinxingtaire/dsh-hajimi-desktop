function validZones(zones){return Array.isArray(zones)&&zones.length<=12&&zones.every(z=>z&&[z.x,z.y,z.w,z.h].every(Number.isFinite)&&z.w>0&&z.w<=1000&&z.h>0&&z.h<=1000&&(!z.mask||Array.isArray(z.mask)&&z.mask.length===32&&z.mask.every(row=>typeof row==='string'&&/^[01]{32}$/.test(row))));}
function pointHitsZones(x,y,zones){
  return zones.some(z=>{if(x<z.x||y<z.y||x>=z.x+z.w||y>=z.y+z.h)return false;if(!z.mask)return true;const mx=Math.floor((x-z.x)/z.w*32),my=Math.floor((y-z.y)/z.h*32);return z.mask[my]?.[mx]==='1';});
}
function cleanState(value){
  const v=value&&typeof value==='object'?value:{};
  return {sound:v.sound!==false,width:Number.isFinite(v.width)&&v.width>0?v.width:0,height:Number.isFinite(v.height)&&v.height>0?v.height:0,cats:(Array.isArray(v.cats)?v.cats:[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,6).map(p=>({x:Math.max(0,Math.min(30000,p.x)),y:Math.max(0,Math.min(30000,p.y)),skin:p.skin==='gray'?'gray':'orange'}))};
}
module.exports={validZones,pointHitsZones,cleanState};
