/* ══════════════════════════════════════════════════════
   ENGINE — Pure math, zero DOM. Takes state → SVG string
   ══════════════════════════════════════════════════════ */
const Engine=(()=>{
    function gcd(a,b){a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));while(b){[a,b]=[b,a%b]}return a||1}
    function hsl2hex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(Math.min(k-3,9-k,1),-1))).toString(16).padStart(2,'0')};return`#${f(0)}${f(8)}${f(4)}`}
    function hex2rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
    function mixH(a,b,t){const[r1,g1,b1]=hex2rgb(a),[r2,g2,b2]=hex2rgb(b);return`rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`}
    function colorize(i,n,mode,c1,c2){
        const t=n<=1?0:i/(n-1);
        const M={mono:()=>c1,dual:()=>mixH(c1,c2,t),rainbow:()=>hsl2hex(t*360,72,48),
            neon:()=>hsl2hex((t*300+280)%360,100,55),gold:()=>hsl2hex(35+t*25,65+t*25,30+t*28),
            ocean:()=>hsl2hex(190+t*50,55+t*35,30+t*30),banknote:()=>hsl2hex(140+t*20,40+t*25,25+t*25),
            steel:()=>hsl2hex(210+t*20,35+t*25,35+t*25),copper:()=>hsl2hex(20+t*15,55+t*30,30+t*25),
            emerald:()=>hsl2hex(150+t*20,50+t*30,25+t*30),royal:()=>hsl2hex(260+t*30,40+t*30,30+t*25),
            crimson:()=>hsl2hex(350+t*20,55+t*30,30+t*20),slate:()=>hsl2hex(200+t*15,15+t*20,40+t*15)};
        return(M[mode]||M.mono)();
    }
// Resolve per-element color: use own if set, else fall back to global style
    function resolveColor(i,n,elem,style){
        const m=elem.colorMode||style.colorMode;
        const c1=elem.color1||style.color1;
        const c2=elem.color2||style.color2;
        return colorize(i,n,m,c1,c2);
    }
    function wave(type,t){
        const M={sine:()=>Math.sin(t),triangle:()=>2*Math.abs(2*((t/(2*Math.PI))%1)-1)-1,
            sawtooth:()=>2*((t/(2*Math.PI))%1)-1,square:()=>Math.sin(t)>=0?1:-1};
        return(M[type]||M.sine)();
    }

// ── Rounded-rect perimeter ──
    function rectPt(t,hw,hh,cr){
        cr=Math.min(cr,hw,hh);
        const tL=2*hw-2*cr,rL=2*hh-2*cr,arc=Math.PI*cr/2;
        const P=2*tL+2*rL+4*arc;let d=((t%1)+1)%1*P;
        if(d<=tL){return{x:-hw+cr+(tL>0?d/tL:0)*tL,y:-hh,nx:0,ny:-1}}d-=tL;
        if(d<=arc&&cr>0){const a=-Math.PI/2+(d/arc)*(Math.PI/2);return{x:hw-cr+cr*Math.cos(a),y:-hh+cr+cr*Math.sin(a),nx:Math.cos(a),ny:Math.sin(a)}}d-=arc;
        if(d<=rL){return{x:hw,y:-hh+cr+(rL>0?d/rL:0)*rL,nx:1,ny:0}}d-=rL;
        if(d<=arc&&cr>0){const a=(d/arc)*(Math.PI/2);return{x:hw-cr+cr*Math.cos(a),y:hh-cr+cr*Math.sin(a),nx:Math.cos(a),ny:Math.sin(a)}}d-=arc;
        if(d<=tL){return{x:hw-cr-(tL>0?d/tL:0)*tL,y:hh,nx:0,ny:1}}d-=tL;
        if(d<=arc&&cr>0){const a=Math.PI/2+(d/arc)*(Math.PI/2);return{x:-hw+cr+cr*Math.cos(a),y:hh-cr+cr*Math.sin(a),nx:Math.cos(a),ny:Math.sin(a)}}d-=arc;
        if(d<=rL){return{x:-hw,y:hh-cr-(rL>0?d/rL:0)*rL,nx:-1,ny:0}}d-=rL;
        {const a=Math.PI+(d/Math.max(arc,0.01))*(Math.PI/2);return{x:-hw+cr+cr*Math.cos(a),y:-hh+cr+cr*Math.sin(a),nx:Math.cos(a),ny:Math.sin(a)}}
    }
    function sideInfo(t,hw,hh,cr){
        cr=Math.min(cr,hw,hh);const tL=2*hw-2*cr,rL=2*hh-2*cr,arc=Math.PI*cr/2;
        const P=2*tL+2*rL+4*arc,segs=[tL,arc,rL,arc,tL,arc,rL,arc];
        let d=((t%1)+1)%1*P,idx=0;
        for(let i=0;i<8;i++){if(d<=segs[i]){idx=i;return{idx,isCorner:idx%2===1,sideT:segs[i]>0?d/segs[i]:0,sideIdx:Math.floor(idx/2)}}d-=segs[i]}
        return{idx:0,isCorner:false,sideT:0,sideIdx:0};
    }

// ── Border band ──
    function genBorderBand(b,style){
        if(!b.enabled)return[];
        const hw=style.pageW/2-b.margin,hh=style.pageH/2-b.margin,cr=b.cornerRadius;
        const res=Math.max(500,Math.round((hw+hh)*1.8));
        const depth=typeof b.lobeDepth==='number'&&b.lobeDepth>1?b.lobeDepth/100:b.lobeDepth;
        const paths=[];
        for(let l=0;l<b.lines;l++){
            const lt=b.lines<=1?0.5:l/(b.lines-1);
            const baseOff=(lt-0.5)*b.bandWidth;
            const phase=(lt-0.5)*b.phaseSpread*0.05;
            const pts=[];
            for(let i=0;i<=res;i++){
                const t=i/res;
                const pt=rectPt(t,hw,hh,cr);
                const si=sideInfo(t,hw,hh,cr);
                let env;
                if(si.isCorner){
                    // Smooth corner: blend neighboring side envelopes
                    const cornerBlend=0.5+0.5*Math.cos(si.sideT*Math.PI);
                    env=1-depth*0.4*cornerBlend;
                }else{
                    const lp=b.lobesPerSide*Math.PI*si.sideT;
                    env=1-depth*(0.5-0.5*Math.cos(2*lp));
                }
                let thickMod=1;
                if(b.thicknessVar>0){
                    thickMod=1-(b.thicknessVar/100)*0.4*(0.5-0.5*Math.cos(b.lobesPerSide*2*Math.PI*(si.isCorner?0.5:si.sideT)));
                }
                const off=baseOff*env*thickMod;
                const w=b.waveAmp*wave(b.waveType,b.waveFreq*2*Math.PI*t*4+phase)*env;
                pts.push([pt.x+pt.nx*(off+w),pt.y+pt.ny*(off+w)]);
            }
            paths.push({pts,color:resolveColor(l,b.lines,b,style),sw:style.strokeWidth,opacity:style.opacity/100});
        }
        // Edge lines
        for(let e=0;e<b.edgeLines;e++){
            const gap=e===0?2:5;
            for(const side of[-1,1]){
                const off=side*(b.bandWidth/2+gap);
                const pts=[];
                for(let i=0;i<=500;i++){
                    const t=i/500,pt=rectPt(t,hw,hh,cr);
                    pts.push([pt.x+pt.nx*off,pt.y+pt.ny*off]);
                }
                const ew=e===0?style.strokeWidth*1.4:style.strokeWidth*0.8;
                paths.push({pts,color:b.color1||style.color1,sw:ew,opacity:(style.opacity/100)*(e===0?0.9:0.65)});
            }
        }
        return paths;
    }

// ── Fine rect lines ──
    function genFineLine(offset,W,H,cr,style){
        const hw=W/2-offset,hh=H/2-offset;
        const pts=[];for(let i=0;i<=500;i++){const t=i/500,pt=rectPt(t,hw,hh,Math.max(0,cr));pts.push([pt.x+W/2,pt.y+H/2])}
        return{pts,color:style.color1,sw:style.strokeWidth*1.3,opacity:(style.opacity/100)*0.75};
    }

// ── Spirograph ──
    function spiro(R,r,d,res,phase,type){
        const pts=[],rev=type==='rose'?20:Math.min(50,Math.max(10,Math.round(r*20/gcd(Math.round(R),Math.round(r))))),maxT=Math.PI*2*rev;
        for(let i=0;i<=res;i++){const t=i/res*maxT+phase;let x,y;
            if(type==='epi'){x=(R+r)*Math.cos(t)-d*Math.cos((R+r)/r*t);y=(R+r)*Math.sin(t)-d*Math.sin((R+r)/r*t)}
            else if(type==='rose'){const k=R/Math.max(1,r);x=d*Math.cos(k*t)*Math.cos(t);y=d*Math.cos(k*t)*Math.sin(t)}
            else{x=(R-r)*Math.cos(t)+d*Math.cos((R-r)/r*t);y=(R-r)*Math.sin(t)-d*Math.sin((R-r)/r*t)}
            pts.push([x,y]);}return pts;
    }

// ── Corners ──
    function genCorners(p,W,H,bMargin,style){
        if(!p.enabled)return[];
        const cx=[bMargin+p.size*0.6,W-bMargin-p.size*0.6],cy=[bMargin+p.size*0.6,H-bMargin-p.size*0.6];
        const corners=[];cx.forEach(x=>cy.forEach(y=>corners.push({x,y})));
        const all=[];
        corners.forEach(c=>{
            for(let i=0;i<p.copies;i++){
                const ct=p.copies<=1?0.5:i/(p.copies-1);
                const d=p.dMin+ct*p.dSpread,sc=p.size/100;
                let pts;
                if(p.type==='spiro')pts=spiro(p.R*sc,Math.max(1,p.r*sc),d*sc,800,(ct-0.5)*p.phaseSpread,'hypo');
                else if(p.type==='rosette'){
                    pts=[];const res=500,pet=p.petals||8;
                    for(let j=0;j<=res;j++){const t=j/res*Math.PI*2;const rr=p.size*0.5*(0.5+0.5*Math.cos(pet*t+(ct-0.5)*3));
                        pts.push([(rr+d*0.1*Math.sin(p.r*t+ct*5))*Math.cos(t),(rr+d*0.1*Math.sin(p.r*t+ct*5))*Math.sin(t)])}
                }else if(p.type==='burst'){
                    pts=[];const res=400,sp=p.petals||12;
                    for(let j=0;j<=res;j++){const t=j/res*Math.PI*2;const rr=p.size*0.3*(1+0.5*Math.cos(sp*t))+d*0.15*Math.sin(p.r*t+ct*4);pts.push([rr*Math.cos(t),rr*Math.sin(t)])}
                }else if(p.type==='diamond'){
                    pts=[];for(let j=0;j<=300;j++){const t=j/300*Math.PI*2;const rr=p.size*0.4*(Math.abs(Math.cos(t))+Math.abs(Math.sin(t)))*0.7+d*0.08*Math.sin(p.r*t+ct*4);pts.push([rr*Math.cos(t),rr*Math.sin(t)])}
                }else{
                    pts=[];for(let j=0;j<=300;j++){const t=j/300*Math.PI*2;const rr=p.size*0.4*(1+0.3*Math.cos(2*t)-0.15*Math.cos(4*t))+d*0.08*Math.sin(p.r*t+ct*3);pts.push([rr*Math.cos(t),rr*Math.sin(t)])}
                }
                all.push({pts:pts.map(pt=>[pt[0]+c.x,pt[1]+c.y]),color:resolveColor(i,p.copies,p,style),sw:style.strokeWidth,opacity:(style.opacity/100)*0.7});
            }
        });
        return all;
    }

// ── Cartouche ornament (envelope-distorted fan) ──
    function genCartouche(p,cx,cy,flipY,style){
        const all=[];
        const fY=flipY?-1:1;
        for(let l=0;l<p.lines;l++){
            const lt=p.lines<=1?0.5:l/(p.lines-1);
            const phase=lt*p.phaseSpread;
            const pts=[];const res=600;

            if(p.type==='fan'){
                // Fan: lines radiate from bottom center, constrained by envelope
                const fanSpread=p.fanSpread*(Math.PI/180);
                const startA=Math.PI/2-fanSpread/2;
                const endA=Math.PI/2+fanSpread/2;
                const a=startA+(endA-startA)*lt;
                for(let i=0;i<=res;i++){
                    const t=i/res;
                    const r=t*p.height;
                    // Envelope width narrows/widens
                    const envW=p.width*0.5*(Math.sin(t*Math.PI));
                    const envH=p.height;
                    const baseX=r*Math.cos(a);
                    const baseY=-r*Math.sin(a)*fY;
                    // Wave modulation
                    const wv=p.waveAmp*Math.sin(p.waveFreq*t*Math.PI*2+phase);
                    const lobe=1+0.3*Math.sin(p.lobes*t*Math.PI);
                    pts.push([cx+baseX*lobe+wv*0.3,cy+baseY*lobe]);
                }
            }else if(p.type==='envelope'){
                // Nested wavy ellipses scaling from small to full
                const sc=0.08+0.92*lt;
                for(let i=0;i<=res;i++){
                    const t=i/res;const a=t*Math.PI*2;
                    const lobeEnv=1-p.lobeDepth*(0.5-0.5*Math.cos(p.lobes*a));
                    const rx=p.width*0.5*sc*lobeEnv;
                    const ry=p.height*0.5*sc*lobeEnv*fY;
                    const wv=p.waveAmp*wave(p.waveType||'sine',p.waveFreq*a+phase);
                    pts.push([cx+rx*Math.cos(a)+wv*0.05*rx,cy+ry*Math.sin(a)+wv*0.05*ry]);
                }
            }else{
                // Spiro cartouche
                const sc=p.height/200*((0.1+0.9*lt));
                const spts=spiro(p.R||80,Math.max(1,p.r||30),(p.dMin||5)+lt*(p.dSpread||40),800,(lt-0.5)*p.phaseSpread,'hypo');
                spts.forEach(sp=>pts.push([cx+sp[0]*sc*(p.width/p.height),cy+sp[1]*sc*fY]));
            }
            all.push({pts,color:resolveColor(l,p.lines,p,style),sw:style.strokeWidth,opacity:(style.opacity/100)*p.opacityMult});
        }
        return all;
    }

// ── TB Ornaments (top/bottom) ──
    function genTB(p,W,H,style){
        if(p.mode==='off')return[];
        const all=[];
        if(p.mode==='top'||p.mode==='both') all.push(...genCartouche(p,W/2,p.yOffset,false,style));
        if(p.mode==='bottom'||p.mode==='both') all.push(...genCartouche(p,W/2,H-p.yOffset,true,style));
        return all;
    }

// ── Side ornaments (left/right mid-points) ──
    function genSideOrn(p,W,H,style){
        if(!p.enabled)return[];
        const all=[];
        const positions=[{x:p.xOffset,y:H/2,rot:-Math.PI/2},{x:W-p.xOffset,y:H/2,rot:Math.PI/2}];
        positions.forEach(pos=>{
            for(let l=0;l<p.lines;l++){
                const lt=p.lines<=1?0.5:l/(p.lines-1);
                const sc=0.1+0.9*lt;
                const phase=lt*p.phaseSpread;
                const pts=[];const res=400;
                for(let i=0;i<=res;i++){
                    const t=i/res;const a=t*Math.PI*2;
                    const lobeMod=1-p.lobeDepth*(0.5-0.5*Math.cos(p.lobes*a));
                    const rx=p.width*0.5*sc*lobeMod;
                    const ry=p.height*0.5*sc*lobeMod;
                    const wv=p.waveAmp*Math.sin(p.waveFreq*a+phase);
                    const lx=rx*Math.cos(a);
                    const ly=ry*Math.sin(a)+wv*0.05*ry;
                    // Rotate
                    const ca=Math.cos(pos.rot),sa=Math.sin(pos.rot);
                    pts.push([pos.x+lx*ca-ly*sa, pos.y+lx*sa+ly*ca]);
                }
                all.push({pts,color:resolveColor(l,p.lines,p,style),sw:style.strokeWidth,opacity:(style.opacity/100)*p.opacityMult});
            }
        });
        return all;
    }

// ── Center medallion ──
    function genMedallion(p,W,H,style){
        if(!p.enabled)return[];
        const cx=W/2,cy=H/2,all=[];
        for(let i=0;i<p.copies;i++){
            const ct=p.copies<=1?0.5:i/(p.copies-1);
            const d=p.dMin+ct*p.dSpread,sc=p.size/150;
            let pts;
            if(p.type==='spiro') pts=spiro(p.R*sc,Math.max(1,p.r*sc),d*sc,1200,(ct-0.5)*p.phaseSpread,p.spiroType||'hypo');
            else{pts=[];const res=600,pet=p.petals||8;
                for(let j=0;j<=res;j++){const t=j/res*Math.PI*2;const rr=p.size*0.5*(0.4+0.6*Math.cos(pet*t+(ct-0.5)*4));pts.push([rr*Math.cos(t),rr*Math.sin(t)])}}
            all.push({pts:pts.map(pt=>[pt[0]+cx,pt[1]+cy]),color:resolveColor(i,p.copies,p,style),sw:style.strokeWidth,opacity:p.opacity/100});
        }
        return all;
    }

// ── Background ──
    function genBG(p,W,H,style){
        if(!p.enabled)return[];const all=[],res=250;
        if(p.pattern==='concentric'){
            const cx=W/2,cy=H/2,maxR=Math.sqrt(cx*cx+cy*cy),rings=Math.ceil(maxR/p.spacing);
            for(let r=1;r<=rings;r++){const rad=r*p.spacing,pts=[],steps=Math.max(80,Math.round(rad*0.6));
                for(let i=0;i<=steps;i++){const t=i/steps,a=t*Math.PI*2,w=p.amplitude*Math.sin(p.frequency*a);pts.push([cx+(rad+w)*Math.cos(a),cy+(rad+w)*Math.sin(a)])}
                all.push({pts,color:resolveColor(r,rings,p,style),sw:style.strokeWidth*0.5,opacity:p.opacity/100})}
            return all;
        }
        if(p.pattern==='radial'){
            const cx=W/2,cy=H/2,maxR=Math.sqrt(cx*cx+cy*cy),nRays=Math.ceil(360/p.spacing);
            for(let r=0;r<nRays;r++){const a=r/nRays*Math.PI*2,pts=[];
                for(let i=0;i<=100;i++){const t=i/100,rad=t*maxR,w=p.amplitude*Math.sin(p.frequency*t*Math.PI*2);pts.push([cx+rad*Math.cos(a+w*0.01),cy+rad*Math.sin(a+w*0.01)])}
                all.push({pts,color:resolveColor(r,nRays,p,style),sw:style.strokeWidth*0.4,opacity:p.opacity/100})}
            return all;
        }
        const rows=Math.ceil(H/p.spacing);
        for(let l=0;l<rows;l++){
            const y=l*p.spacing,pts=[];
            for(let i=0;i<=res;i++){const t=i/res,x=t*W;let dy=0;
                if(p.pattern==='wave')dy=p.amplitude*wave(p.waveType||'sine',p.frequency*t*Math.PI*2);
                else if(p.pattern==='wave2')dy=p.amplitude*Math.sin(p.frequency*t*Math.PI*2)+p.amplitude*0.5*Math.sin(p.frequency*2.3*t*Math.PI*2+0.7);
                else if(p.pattern==='diag')dy=p.amplitude*Math.sin(p.frequency*t*Math.PI*2+l*0.3);
                pts.push([x,y+dy])}
            all.push({pts,color:resolveColor(l,rows,p,style),sw:style.strokeWidth*0.6,opacity:p.opacity/100});
            if(p.pattern==='cross'&&l<Math.ceil(W/p.spacing)){
                const pts2=[];for(let i=0;i<=res;i++){const t=i/res;pts2.push([l*p.spacing+p.amplitude*wave(p.waveType||'sine',p.frequency*t*Math.PI*2),t*H])}
                all.push({pts:pts2,color:resolveColor(l,rows,p,style),sw:style.strokeWidth*0.6,opacity:p.opacity/100})}
        }
        return all;
    }

// ── Moiré ──
    function genMoire(p,W,H,style){
        if(!p.enabled)return[];const all=[],diag=Math.sqrt(W*W+H*H),cx=W/2,cy=H/2;
        for(let set=0;set<2;set++){
            const angle=set*p.angleSeparation*Math.PI/180,count=Math.ceil(diag/p.spacing);
            for(let l=-count;l<=count;l++){
                const off=l*p.spacing,ca=Math.cos(angle),sa=Math.sin(angle),pts=[];
                for(let i=0;i<=80;i++){const t=(i/80-0.5)*diag;const x=cx+t*ca-off*sa,y=cy+t*sa+off*ca;
                    if(x>=-5&&x<=W+5&&y>=-5&&y<=H+5)pts.push([x,y])}
                if(pts.length>1)all.push({pts,color:style.color1,sw:style.strokeWidth*0.3,opacity:p.opacity/100});
            }
        }
        return all;
    }

// ── SVG serialization ──
    function pts2d(pts){if(pts.length<2)return'';let s='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);for(let i=1;i<pts.length;i++)s+='L'+pts[i][0].toFixed(1)+','+pts[i][1].toFixed(1);return s}

// ── Master render ──
    function render(state){
        const W=state.page.width,H=state.page.height;
        const stl={pageW:W,pageH:H,colorMode:state.style.colorMode,color1:state.style.color1,
            color2:state.style.color2,strokeWidth:state.style.strokeWidth,opacity:state.style.opacity};
        let all=[];
        all.push(...genBG(state.background,W,H,stl));
        all.push(...genMoire(state.moire,W,H,stl));
        all.push(...genMedallion(state.medallion,W,H,stl));
        if(state.fineLines.outer)all.push(genFineLine(state.fineLines.outerOffset,W,H,6,stl));
        if(state.fineLines.inner)all.push(genFineLine(state.fineLines.innerOffset,W,H,4,stl));
        const cx=W/2,cy=H/2;
        state.borderBands.forEach(b=>{
            genBorderBand(b,stl).forEach(p=>{p.pts=p.pts.map(pt=>[pt[0]+cx,pt[1]+cy]);all.push(p)})});
        all.push(...genCorners(state.corners,W,H,state.borderBands[0]?.margin||20,stl));
        all.push(...genTB(state.tbOrnament,W,H,stl));
        all.push(...genSideOrn(state.sideOrnament,W,H,stl));
        let pathSvg='',ptC=0,pC=0;
        all.forEach(p=>{if(!p||!p.pts||p.pts.length<2)return;ptC+=p.pts.length;pC++;
            pathSvg+=`<path d="${pts2d(p.pts)}" fill="none" stroke="${p.color}" stroke-width="${p.sw}" opacity="${p.opacity}" stroke-linecap="round" stroke-linejoin="round"/>\n`});
        const bgR=state.page.showBg?`<rect width="${W}" height="${H}" fill="${state.page.bgColor}"/>`:'';
        return{svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${bgR}\n${pathSvg}</svg>`,pathCount:pC,pointCount:ptC};
    }
    return{render,colorize,hsl2hex,spiro,wave};
})();


export default Engine;