/**
 * Launch / Splash Animation Screen
 * Renders the Flynkit cart animation full-screen via WebView.
 * Navigates to /welcome automatically when the animation finishes.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Full-screen HTML animation — replay button removed, postMessage on complete
const HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow:hidden; background:#FFF4EC; }
  #flynkit-root {
    width:100vw; height:100vh;
    background: linear-gradient(180deg,#FFF4EC 0%,#FDE6D8 50%,#FFD8C7 100%);
    position:relative; overflow:hidden;
    font-family:'Inter',sans-serif;
  }
  #anim-canvas {
    position:absolute; inset:0;
    width:100%; height:100%;
  }
  #logo-overlay {
    position:absolute; bottom:0; left:0; right:0;
    display:flex; flex-direction:column;
    align-items:center; justify-content:flex-end;
    padding-bottom:64px;
    opacity:0; transform:translateY(18px);
    transition:none;
  }
  #logo-text {
    font-size:42px; font-weight:900; letter-spacing:-1px;
    color:#1a1a1a; margin-bottom:16px;
  }
  #tagline {
    font-size:26px; font-weight:700; line-height:1.3;
    color:#1a1a1a; text-align:center; letter-spacing:-0.3px;
  }
  #tagline .highlight { color:#FF7F66; display:block; }
</style>
</head>
<body>
<div id="flynkit-root">
  <canvas id="anim-canvas"></canvas>
  <div id="logo-overlay">
    <div id="logo-text">FLYNKIT</div>
    <div id="tagline">FROM STORE<br>TO DOOR IN<span class="highlight">MINUTES.</span></div>
  </div>
</div>
<script>
(function(){
  const canvas = document.getElementById('anim-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('logo-overlay');

  function resize(){
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W*2; canvas.height = H*2;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.scale(2,2);
  }
  resize();
  const W = ()=>window.innerWidth;
  const H = ()=>window.innerHeight;

  const DURATION = 3800;
  let startTime=null, rafId=null, animDone=false;

  function easeOutBack(t){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}
  function easeOutBounce(t){
    const n1=7.5625,d1=2.75;
    if(t<1/d1)return n1*t*t;
    if(t<2/d1)return n1*(t-=1.5/d1)*t+0.75;
    if(t<2.5/d1)return n1*(t-=2.25/d1)*t+0.9375;
    return n1*(t-=2.625/d1)*t+0.984375;
  }
  function easeInOut(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function easeOut(t){return 1-(1-t)*(1-t);}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function tRange(t,t0,t1){return clamp((t-t0)/(t1-t0),0,1);}

  const groceryTargets=[
    {dx:-22,dy:5},{dx:10,dy:2},{dx:-6,dy:8},
    {dx:-32,dy:3},{dx:22,dy:4},{dx:30,dy:8},
    {dx:-14,dy:0},{dx:2,dy:-2},{dx:18,dy:6},
  ];
  const sparklePositions=[
    {x:-62,y:-80},{x:58,y:-95},{x:72,y:-30},{x:-78,y:-38},
    {x:0,y:-110},{x:-50,y:-120},{x:55,y:-120},
  ];

  function drawBg(){
    const w=W(),h=H();
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#FFF4EC');g.addColorStop(0.5,'#FDE6D8');g.addColorStop(1,'#FFD8C7');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }
  function drawShadow(cx,cy,scaleX,alpha){
    ctx.save();ctx.globalAlpha=alpha*0.22;
    ctx.beginPath();
    const rx=55*scaleX,ry=10;
    ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
    const sg=ctx.createRadialGradient(cx,cy,0,cx,cy,rx);
    sg.addColorStop(0,'rgba(140,60,30,0.7)');sg.addColorStop(1,'rgba(140,60,30,0)');
    ctx.fillStyle=sg;ctx.fill();ctx.restore();
  }
  function drawCart(cx,cy,scale,alpha,glow){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(scale,scale);
    if(glow>0){
      ctx.save();ctx.globalAlpha=alpha*glow*0.35;
      const gg=ctx.createRadialGradient(0,-10,5,0,-10,60);
      gg.addColorStop(0,'rgba(255,200,160,0.8)');gg.addColorStop(1,'rgba(255,200,160,0)');
      ctx.fillStyle=gg;ctx.beginPath();ctx.arc(0,-10,60,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.beginPath();ctx.moveTo(-40,-10);ctx.lineTo(-32,18);ctx.lineTo(38,18);ctx.lineTo(43,-10);ctx.closePath();
    ctx.fillStyle='rgba(255,235,215,0.92)';ctx.fill();
    ctx.strokeStyle='#d08050';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-44,-10);ctx.lineTo(47,-10);ctx.strokeStyle='#d08050';ctx.lineWidth=2.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-52,-20);ctx.bezierCurveTo(-52,-10,-44,-10,-44,-10);ctx.strokeStyle='#d08050';ctx.lineWidth=2.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-58,-26);ctx.lineTo(-46,-26);ctx.strokeStyle='#d08050';ctx.lineWidth=3;ctx.stroke();
    ctx.beginPath();ctx.arc(-20,26,6,0,Math.PI*2);ctx.fillStyle='#d08050';ctx.fill();
    ctx.beginPath();ctx.arc(-20,26,3,0,Math.PI*2);ctx.fillStyle='#FFF0E0';ctx.fill();
    ctx.beginPath();ctx.arc(22,26,6,0,Math.PI*2);ctx.fillStyle='#d08050';ctx.fill();
    ctx.beginPath();ctx.arc(22,26,3,0,Math.PI*2);ctx.fillStyle='#FFF0E0';ctx.fill();
    ctx.restore();
  }
  function drawTomato(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.ellipse(0,2,14,13,0,0,Math.PI*2);ctx.fillStyle='#E03030';ctx.fill();
    ctx.strokeStyle='#b01010';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-11);ctx.bezierCurveTo(-5,-16,-2,-18,0,-15);ctx.bezierCurveTo(2,-18,5,-16,0,-11);
    ctx.fillStyle='#3DB34A';ctx.fill();ctx.restore();
  }
  function drawApple(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.ellipse(-2,2,13,14,0,0,Math.PI*2);ctx.fillStyle='#E84040';ctx.fill();
    ctx.strokeStyle='#b02020';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-12);ctx.bezierCurveTo(3,-18,7,-14,4,-10);ctx.strokeStyle='#5a3010';ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  }
  function drawBanana(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.moveTo(-22,4);ctx.bezierCurveTo(-18,-12,18,-12,22,4);ctx.bezierCurveTo(18,12,-18,12,-22,4);ctx.closePath();
    ctx.fillStyle='#F5C842';ctx.fill();ctx.strokeStyle='#c9980e';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  }
  function drawCarrot(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.moveTo(0,-17);ctx.bezierCurveTo(8,-17,8,17,0,17);ctx.bezierCurveTo(-8,17,-8,-17,0,-17);
    ctx.fillStyle='#F77C2A';ctx.fill();ctx.strokeStyle='#c45010';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-5,-17);ctx.bezierCurveTo(-8,-26,-2,-24,0,-17);ctx.moveTo(0,-17);ctx.bezierCurveTo(2,-24,8,-26,5,-17);
    ctx.strokeStyle='#3DB34A';ctx.lineWidth=1.8;ctx.stroke();ctx.restore();
  }
  function drawBroccoli(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.arc(0,-8,12,0,Math.PI*2);ctx.fillStyle='#3DB34A';ctx.fill();
    ctx.beginPath();ctx.arc(-9,-5,8,0,Math.PI*2);ctx.fillStyle='#4CC45A';ctx.fill();
    ctx.beginPath();ctx.arc(9,-5,8,0,Math.PI*2);ctx.fillStyle='#4CC45A';ctx.fill();
    ctx.beginPath();ctx.rect(-4,4,8,13);ctx.fillStyle='#6a9e30';ctx.fill();ctx.restore();
  }
  function drawLettuce(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    for(let i=0;i<5;i++){
      ctx.beginPath();const a=i*72*(Math.PI/180);
      ctx.ellipse(Math.cos(a)*6,Math.sin(a)*6,13,9,a,0,Math.PI*2);
      ctx.fillStyle=i%2===0?'#5CC85A':'#7AD868';ctx.fill();
    }
    ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fillStyle='#8ee870';ctx.fill();ctx.restore();
  }
  function drawMilk(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.moveTo(-9,-20);ctx.lineTo(-10,20);ctx.lineTo(10,20);ctx.lineTo(9,-20);ctx.closePath();
    ctx.fillStyle='#F4F4F4';ctx.fill();ctx.strokeStyle='#c0c0c0';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.rect(-7,-10,14,12);ctx.fillStyle='#4ab8f0';ctx.fill();
    ctx.restore();
  }
  function drawJuice(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.moveTo(-8,-22);ctx.lineTo(-9,22);ctx.lineTo(9,22);ctx.lineTo(8,-22);ctx.closePath();
    ctx.fillStyle='#F5A623';ctx.fill();ctx.strokeStyle='#c07810';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  }
  function drawBread(cx,cy,s,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.beginPath();ctx.ellipse(0,4,18,12,0,0,Math.PI*2);ctx.fillStyle='#D4A35A';ctx.fill();
    ctx.strokeStyle='#a07030';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,-2,14,8,0,0,Math.PI);ctx.fillStyle='#E8BC72';ctx.fill();
    ctx.restore();
  }
  const drawFns=[drawTomato,drawApple,drawBanana,drawCarrot,drawBroccoli,drawLettuce,drawMilk,drawJuice,drawBread];

  function drawSparkle(cx,cy,r,alpha){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      ctx.strokeStyle='#FF7F66';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.stroke();
    }
    ctx.beginPath();ctx.arc(0,0,r*0.18,0,Math.PI*2);ctx.fillStyle='#FF9980';ctx.fill();
    ctx.restore();
  }

  function render(timestamp){
    if(!startTime) startTime=timestamp;
    const elapsed=timestamp-startTime;
    const t=Math.min(elapsed/DURATION,1);
    const cw=W(),ch=H();
    const cartCX=cw/2, cartBaseY=ch/2-10;

    ctx.clearRect(0,0,cw,ch);
    drawBg();

    const scene1end=0.2,scene2end=0.5,scene3end=0.75,scene4end=0.95;
    const cartT=tRange(t,0,scene1end);
    const cartScale=cartT<1?easeOutBack(cartT):1;
    const cartAlpha=1-tRange(t,scene3end,scene4end)*0.7;
    const scene3T=tRange(t,scene2end,scene3end);
    const riseY=scene3T>0?lerp(0,-28,easeInOut(scene3T)):0;
    const glowAlpha=scene3T;
    const floatY=Math.sin(elapsed*0.002)*3.5*(t>scene1end?1:0);
    const cx=cartCX,cy=cartBaseY+floatY+riseY;

    drawShadow(cx,cartBaseY+32,cartScale,cartAlpha);
    drawCart(cx,cy,cartScale*1.0,cartAlpha,glowAlpha);

    for(let i=0;i<9;i++){
      const itemStart=scene1end+(i/9)*(scene2end-scene1end);
      const itemEnd=itemStart+(scene2end-scene1end)/9+0.03;
      const iT=tRange(t,itemStart,itemEnd);
      if(iT<=0) continue;
      const target=groceryTargets[i];
      const tgt={x:cx+target.dx*cartScale,y:cy+target.dy*cartScale};
      const startX=cx+(i%2===0?-1:1)*35;
      const startY=cy-90;
      const dropT=Math.min(iT,1);
      const ix=lerp(startX,tgt.x,easeOut(dropT));
      const iy=lerp(startY,tgt.y,easeOutBounce(dropT));
      const is=cartScale*(0.7+0.3*easeOutBack(Math.min(dropT*1.2,1)));
      drawFns[i](ix,iy,is,Math.min(iT*3,1)*cartAlpha);
    }

    if(scene3T>0){
      for(let i=0;i<sparklePositions.length;i++){
        const sp=sparklePositions[i];
        const delay=i*0.08;
        const sT=clamp((scene3T-delay)*3.5,0,1);
        if(sT<=0) continue;
        const sAlpha=sT<0.5?sT*2:(1-sT)*2;
        const pulse=1+Math.sin(elapsed*0.005+i)*0.25;
        drawSparkle(cx+sp.x,cy+sp.y+riseY,7*pulse,sAlpha*cartAlpha);
      }
    }

    if(t>=scene4end&&!animDone){
      animDone=true;
      overlay.style.transition='opacity 0.5s ease,transform 0.5s ease';
      overlay.style.opacity='1';
      overlay.style.transform='translateY(0)';
      // Notify React Native to navigate after overlay fully fades in
      setTimeout(function(){
        try{ window.ReactNativeWebView.postMessage('ANIM_DONE'); }catch(e){}
      }, 900);
    }

    if(t<1) rafId=requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>
</body>
</html>
`;

export default function SplashScreen() {
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === 'ANIM_DONE') {
      router.replace('/welcome');
    }
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <WebView
        source={{ html: HTML }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={onMessage}
        javaScriptEnabled
        // Prevent any external navigation
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || !req.url.startsWith('http')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF4EC',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
