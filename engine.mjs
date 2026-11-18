export const timing = { snap: 260, fight: 2400, recover: 4600, windup: 650 };
export const distance = { warn: 2.15, threat: 1.4, contact: .86, release: 2.4, hysteresis: .13 };
const locked = p => ['snap', 'fight', 'recover'].includes(p.state);
export class CatWorld {
  constructor(width = 1200, height = 700) {
    this.width = width; this.height = height; this.cats = []; this.fights = []; this.serial = 0; this.now = 0;
  }
  add(x, y) {
    const p = { id: ++this.serial, x, y, size: 160, state: 'idle', since: this.now, armed: true, partner: null, facing: -1 };
    this.cats.push(p); this.clamp(p); return p;
  }
  clamp(p) {
    p.x = Math.max(p.size / 2 + 12, Math.min(this.width - p.size / 2 - 12, p.x));
    p.y = Math.max(125, Math.min(this.height - 80, p.y));
  }
  move(id, x, y) {
    const p = this.cats.find(p => p.id === id);
    if (!p || ['snap', 'fight'].includes(p.state)) return false;
    p.x = x; p.y = y; this.clamp(p); return true;
  }
  set(p, state) { if (p.state !== state) { p.state = state; p.since = this.now; } }
  ratio(a, b) { return Math.hypot(a.x-b.x, a.y-b.y) / ((a.size+b.size)/2); }
  resize(w, h) { this.width=w; this.height=h; this.cats.forEach(p => this.clamp(p)); }
  tick(now) {
    this.now = now;
    for (const f of [...this.fights]) {
      const elapsed = now - f.since;
      if (elapsed < timing.snap) {
        const t = 1 - (1 - elapsed / timing.snap) ** 3;
        f.a.x = f.ax + (f.x - 18 - f.ax) * t; f.b.x = f.bx + (f.x + 18 - f.bx) * t;
        f.a.y = f.ay + (f.y-f.ay)*t; f.b.y = f.by + (f.y-f.by)*t;
      } else if (elapsed < timing.snap + timing.fight) {
        this.set(f.a, 'fight'); this.set(f.b, 'fight');
      } else {
        const spread = Math.min(210, (this.width - 190)/2);
        f.a.x=f.x-spread; f.b.x=f.x+spread;
        f.a.y=f.b.y=f.y; this.clamp(f.a); this.clamp(f.b);
        for (const p of [f.a, f.b]) { this.set(p, 'recover'); p.armed=false; p.partner=null; }
        this.fights.splice(this.fights.indexOf(f),1);
      }
    }
    for (const p of this.cats) {
      if (p.state === 'recover' && now-p.since >= timing.recover) this.set(p,'idle');
      if (!p.armed && this.cats.every(q => q===p || this.ratio(p,q)>distance.release)) p.armed=true;
    }
    const edges = [];
    for(let i=0;i<this.cats.length;i++) for(let j=i+1;j<this.cats.length;j++) {
      const a=this.cats[i],b=this.cats[j];
      if(!locked(a)&&!locked(b)) edges.push({a,b,d:this.ratio(a,b)});
    }
    edges.sort((a,b)=>a.d-b.d);
    const used=new Set();
    for(const {a,b,d} of edges) {
      if(used.has(a.id)||used.has(b.id)) continue;
      const wasPaired = a.partner===b.id && b.partner===a.id;
      const limit=distance.warn+(wasPaired?distance.hysteresis:0);
      if(d>limit) continue;
      used.add(a.id); used.add(b.id);
      if (!wasPaired) { a.since=now; b.since=now; }
      a.partner=b.id; b.partner=a.id;
      a.facing=b.x>=a.x?1:-1; b.facing=-a.facing;
      const threat = d < distance.threat + (wasPaired && a.state==='threat' ? distance.hysteresis : 0);
      this.set(a, threat?'threat':'warn'); this.set(b, threat?'threat':'warn');
      if(d<distance.contact && a.armed && b.armed && now-Math.max(a.since,b.since)>=timing.windup) {
        this.set(a,'snap'); this.set(b,'snap');
        this.fights.push({id:`${a.id}-${b.id}-${now}`,a,b,x:(a.x+b.x)/2,y:(a.y+b.y)/2,ax:a.x,ay:a.y,bx:b.x,by:b.y,since:now});
      }
    }
    for(const p of this.cats) if(!locked(p)&&!used.has(p.id)) { p.partner=null; this.set(p,'idle'); }
  }
}
