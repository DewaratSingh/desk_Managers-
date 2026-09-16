import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,450;9..144,600;9..144,700;9..144,900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.pds-root{
  --ink:#12181f;
  --ink-2:#1b2430;
  --ink-3:#242f3d;
  --ink-4:#2d3a49;
  --paper:#f4eedb;
  --paper-2:#ece2c4;
  --paper-line:#dcd0ac;
  --rust:#b24a1c;
  --rust-dark:#8a3814;
  --gold:#bd9435;
  --muted-ink:#6d6555;
  --muted-paper:#a9a08a;

  background:var(--paper);
  color:var(--ink);
  font-family:'Inter',sans-serif;
  overflow-x:hidden;
}

.pds-root *{margin:0;padding:0;box-sizing:border-box;}

html{scroll-behavior:smooth;}

@media (prefers-reduced-motion: reduce){
  .pds-root *{animation-duration:0.01ms !important; animation-iteration-count:1 !important; transition-duration:0.01ms !important;}
  html{scroll-behavior:auto !important;}
}

.pds-root h1,.pds-root h2,.pds-root h3{
  font-family:'Fraunces',serif;
  font-weight:600;
  letter-spacing:-0.01em;
}

.pds-root .mono{font-family:'IBM Plex Mono',monospace;}

.pds-root a{color:inherit;}

.pds-root a:focus-visible,
.pds-root button:focus-visible{
  outline:2px solid var(--rust);
  outline-offset:3px;
  border-radius:4px;
}

.pds-root .wrap{width:100%;max-width:1280px;margin:0 auto;padding:0 6%;}

.pds-root ::selection{background:var(--rust);color:var(--paper);}

/* ---------- NAV ---------- */

.navbar-wrapper{
  position:fixed;
  top:0;left:0;width:100%;
  z-index:1000;
  display:flex;justify-content:center;
  padding-top:22px;
}

.navbar{
  width:92%;
  max-width:1200px;
  background:rgba(244,238,219,.88);
  backdrop-filter:blur(10px);
  border:1px solid var(--paper-line);
  border-radius:14px;
  padding:14px 26px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  box-shadow:0 12px 30px rgba(18,24,31,.08);
}

.brand{display:flex;align-items:center;gap:10px;}

.seal{
  width:34px;height:34px;
  border-radius:50%;
  border:1.5px solid var(--ink);
  display:flex;align-items:center;justify-content:center;
  font-family:'Fraunces',serif;
  font-weight:700;
  font-size:13px;
  flex-shrink:0;
}

.brand-name{font-family:'Fraunces',serif;font-weight:600;font-size:19px;}

.menu{display:flex;gap:34px;align-items:center;}

.menu a{
  text-decoration:none;
  font-weight:500;
  font-size:14.5px;
  color:var(--ink);
  position:relative;
}

.menu a::after{
  content:"";
  position:absolute;
  left:0;bottom:-4px;
  width:0%;height:1.5px;
  background:var(--rust);
  transition:width .25s ease;
}

.menu a:hover::after{width:100%;}

.nav-cta{
  background:var(--ink);
  color:var(--paper);
  padding:10px 20px;
  font-size:14px;
  font-weight:600;
  border-radius:8px;
  text-decoration:none;
  white-space:nowrap;
}

/* ---------- BUTTONS ---------- */

.pds-root .btn{
  display:inline-flex;
  align-items:center;
  gap:8px;
  text-decoration:none;
  padding:15px 26px;
  font-weight:600;
  font-size:15px;
  border-radius:8px;
  transition:transform .25s ease, box-shadow .25s ease;
  clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%);
  cursor:pointer;
  font-family:'Inter',sans-serif;
  border:none;
}

.btn-primary{background:var(--rust);color:var(--paper);}

.btn-primary:hover{
  transform:translateY(-3px);
  box-shadow:0 14px 26px rgba(178,74,28,.35);
}

.btn-secondary{
  background:transparent;
  border:1.5px solid var(--ink);
  color:var(--ink);
}

.btn-secondary:hover{
  transform:translateY(-3px);
  background:var(--ink);
  color:var(--paper);
}

.btn-light{background:var(--paper);color:var(--ink);}
.btn-light:hover{transform:translateY(-3px);}

.btn-outline-light{
  border:1.5px solid rgba(244,238,219,.5);
  color:var(--paper);
  background:transparent;
}
.btn-outline-light:hover{
  transform:translateY(-3px);
  background:rgba(244,238,219,.1);
}

/* ---------- HERO ---------- */

.hero{
  min-height:100vh;
  display:flex;
  align-items:center;
  padding:150px 0 80px;
  position:relative;
}

.hero .wrap{
  display:grid;
  grid-template-columns:1.05fr .95fr;
  gap:40px;
  align-items:center;
}

.eyebrow{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:14.5px;
  color:var(--muted-ink);
  margin-bottom:26px;
}

.eyebrow .dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--rust);
  flex-shrink:0;
}

.hero-title{
  font-size:clamp(2.6rem,5vw,4.1rem);
  line-height:1.04;
  font-weight:600;
  color:var(--ink);
  margin-bottom:24px;
}

.hero-title em{font-style:italic;font-weight:450;color:var(--rust);}

.line{display:block;overflow:hidden;}

.hero-subtitle{
  max-width:520px;
  font-size:1.12rem;
  line-height:1.7;
  color:var(--muted-ink);
  margin-bottom:36px;
}

.hero-buttons{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:40px;}

.hero-proof{
  display:flex;
  gap:30px;
  flex-wrap:wrap;
  padding-top:26px;
  border-top:1px solid var(--paper-line);
}

.proof-item{display:flex;flex-direction:column;gap:2px;}
.proof-item .num{font-family:'IBM Plex Mono',monospace;font-size:1.3rem;font-weight:500;color:var(--ink);}
.proof-item .lbl{font-size:12.5px;color:var(--muted-ink);}

/* ---------- HERO ILLUSTRATION ---------- */

.hero-art{position:relative;display:flex;align-items:center;justify-content:center;}

.hero-art svg{width:100%;max-width:480px;height:auto;overflow:visible;}

.doc{transform-origin:center;animation:float 6s ease-in-out infinite;}
.doc-a{animation-delay:0s;}
.doc-b{animation-delay:1.1s;}
.doc-c{animation-delay:.5s;}

@keyframes float{
  0%,100%{transform:translateY(0) rotate(var(--r,0deg));}
  50%{transform:translateY(-9px) rotate(var(--r,0deg));}
}

.stamp{transform-origin:center;animation:stampHit 3.4s ease-in-out infinite;}

@keyframes stampHit{
  0%{transform:translate(0,-40px) scale(1.35) rotate(-14deg);opacity:0;}
  14%{transform:translate(0,0) scale(1) rotate(-14deg);opacity:1;}
  30%{transform:translate(0,2px) scale(.97) rotate(-14deg);opacity:1;}
  72%{transform:translate(0,2px) scale(.97) rotate(-14deg);opacity:1;}
  88%{transform:translate(0,-40px) scale(1.35) rotate(-14deg);opacity:0;}
  100%{transform:translate(0,-40px) scale(1.35) rotate(-14deg);opacity:0;}
}

.growth-line{
  stroke-dasharray:420;
  stroke-dashoffset:420;
  animation:draw 3.4s ease-in-out infinite;
}

@keyframes draw{
  0%{stroke-dashoffset:420;}
  55%{stroke-dashoffset:0;}
  100%{stroke-dashoffset:0;}
}

.pulse-dot{animation:pulse 2.4s ease-in-out infinite;transform-origin:center;transform-box:fill-box;}
@keyframes pulse{
  0%,100%{opacity:.35;transform:scale(1);}
  50%{opacity:1;transform:scale(1.4);}
}

/* ---------- MARQUEE ---------- */

.marquee-section{
  border-top:1px solid var(--paper-line);
  border-bottom:1px solid var(--paper-line);
  padding:22px 0;
  overflow:hidden;
}

.marquee-track{
  display:flex;
  gap:60px;
  width:max-content;
  animation:scroll-left 28s linear infinite;
}

@keyframes scroll-left{
  from{transform:translateX(0);}
  to{transform:translateX(-50%);}
}

.marquee-track span{
  font-size:14px;
  color:var(--muted-ink);
  white-space:nowrap;
  display:flex;
  align-items:center;
  gap:10px;
}

.marquee-track span::before{
  content:"";
  width:5px;height:5px;
  border-radius:50%;
  background:var(--rust);
}

/* ---------- FEATURES (pinned horizontal, full-bleed) ---------- */

.features-section{
  position:relative;
  height:100vh;
  overflow:hidden;
  background:var(--ink);
}

/* faint ledger grid over the whole pinned stage */
.features-section::after{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  z-index:3;
  background-image:
    linear-gradient(rgba(244,238,219,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(244,238,219,.035) 1px, transparent 1px);
  background-size:96px 96px;
  mask-image:radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 85%);
  -webkit-mask-image:radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 85%);
}

.features-wrapper{
  display:flex;
  flex-wrap:nowrap;
  width:600vw;
  height:100%;
  position:relative;
  z-index:1;
  will-change:transform;
}

.feature-card{
  flex:0 0 100vw;
  width:100vw;
  height:100vh;
  display:grid;
  grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);
  align-items:center;
  column-gap:clamp(48px,7vw,130px);
  padding:clamp(130px,16vh,190px) clamp(32px,7vw,120px) clamp(90px,12vh,120px);
  color:var(--paper);
}

.feature-card:nth-child(even) .feature-content{order:2;}

.feature-content{max-width:44ch;}

.feature-index{
  display:inline-flex;
  align-items:center;
  gap:10px;
  font-size:12.5px;
  letter-spacing:.04em;
  color:var(--rust);
  margin-bottom:20px;
}

.feature-index::after{
  content:"";
  width:clamp(28px,4vw,64px);
  height:1px;
  background:rgba(178,74,28,.5);
}

.feature-card h2{
  font-size:clamp(2.1rem,3.9vw,3.6rem);
  line-height:1.08;
  letter-spacing:-0.02em;
  margin-bottom:20px;
  text-wrap:balance;
}

.feature-card p.feature-body{
  font-size:clamp(1rem,1.15vw,1.15rem);
  color:#b9b3a4;
  line-height:1.7;
  max-width:46ch;
}

.feature-points{
  list-style:none;
  margin-top:28px;
  padding-top:22px;
  border-top:1px solid rgba(244,238,219,.12);
  display:flex;
  flex-wrap:wrap;
  gap:10px 28px;
}

.feature-points li{
  font-size:13.5px;
  color:#cfc9b8;
  display:flex;
  align-items:center;
  gap:9px;
}

.feature-points li::before{
  content:"";
  width:5px;height:5px;
  border-radius:50%;
  background:var(--gold);
  flex-shrink:0;
}

/* the visual now fills its half of the screen */
.feature-visual{
  position:relative;
  width:100%;
  height:min(66vh,640px);
  border-radius:28px;
  overflow:hidden;
  border:1px solid rgba(244,238,219,.13);
  background:
    radial-gradient(90% 80% at 28% 18%, rgba(244,238,219,.10), rgba(244,238,219,.02) 52%, transparent 72%),
    linear-gradient(160deg, rgba(255,255,255,.05), rgba(255,255,255,.015));
  box-shadow:0 48px 110px rgba(0,0,0,.45), inset 0 1px 0 rgba(244,238,219,.14);
  display:flex;
  align-items:center;
  justify-content:center;
  backdrop-filter:blur(8px);
}

.feature-visual::before{
  content:"";
  position:absolute;
  width:60%;
  aspect-ratio:1;
  right:-14%;
  bottom:-20%;
  border-radius:50%;
  background:rgba(178,74,28,.22);
  filter:blur(90px);
}

.feature-icon{
  position:relative;
  width:min(44%,260px);
  height:auto;
  flex-shrink:0;
}

.visual-caption{
  position:absolute;
  left:26px;
  bottom:22px;
  font-size:11.5px;
  letter-spacing:.06em;
  color:rgba(244,238,219,.55);
}

.feature-card:nth-child(1){background:var(--ink);}
.feature-card:nth-child(2){background:var(--ink-2);}
.feature-card:nth-child(3){background:var(--ink-3);}
.feature-card:nth-child(4){background:var(--ink-4);}
.feature-card:nth-child(5){background:#2d231e;}
.feature-card:nth-child(6){background:#1f2b26;}

/* pinned HUD: section name, counter, progress rail */
.features-hud{
  position:absolute;
  z-index:4;
  left:clamp(32px,7vw,120px);
  right:clamp(32px,7vw,120px);
  bottom:clamp(34px,5vh,50px);
  display:flex;
  align-items:center;
  gap:22px;
  pointer-events:none;
}

.hud-label{
  font-size:12px;
  color:rgba(244,238,219,.5);
  letter-spacing:.05em;
  white-space:nowrap;
}

.hud-rail{
  flex:1;
  height:2px;
  background:rgba(244,238,219,.14);
  position:relative;
  overflow:hidden;
}

.hud-rail i{
  position:absolute;
  inset:0 auto 0 0;
  width:16.6%;
  background:var(--rust);
  display:block;
}

.hud-count{
  font-size:12px;
  color:rgba(244,238,219,.75);
  min-width:56px;
  text-align:right;
}

/* ---------- WORKFLOW / LEDGER TRAIL ---------- */

.workflow-section{padding:150px 0 130px;background:var(--paper);}

.workflow-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:40px;
  flex-wrap:wrap;
  margin-bottom:36px;
}

.flow-tabs{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-bottom:54px;
}

.flow-tab{
  padding:10px 20px;
  border-radius:999px;
  border:1px solid var(--paper-line);
  background:transparent;
  color:var(--muted-ink);
  font-family:'Inter',sans-serif;
  font-size:13.5px;
  font-weight:600;
  cursor:pointer;
  transition:background .25s ease, border-color .25s ease, color .25s ease;
}

.flow-tab:hover{border-color:var(--ink);color:var(--ink);}

.flow-tab.active{
  background:var(--ink);
  border-color:var(--ink);
  color:var(--paper);
}

.workflow-header-text{max-width:600px;}

.workflow-header p{
  color:var(--rust);
  font-weight:600;
  font-size:15px;
  margin-bottom:12px;
}

.workflow-header h2{font-size:clamp(2.2rem,4.4vw,3.4rem);line-height:1.1;}

.workflow-count{
  display:flex;
  align-items:baseline;
  gap:10px;
  padding-bottom:6px;
  flex-shrink:0;
}

.workflow-count .v{
  font-family:'IBM Plex Mono',monospace;
  font-size:2.6rem;
  color:var(--ink);
  line-height:1;
}

.workflow-count .l{font-size:13px;color:var(--muted-ink);max-width:120px;line-height:1.4;}

.trail{position:relative;padding-top:10px;}

.trail-line-wrap{position:absolute;top:42px;left:0;right:0;height:2px;}

.trail-line-bg{
  position:absolute;
  inset:0;
  background-image:repeating-linear-gradient(to right, var(--paper-line) 0 8px, transparent 8px 16px);
}

.trail-line-fill{position:absolute;inset:0;width:0%;background:var(--rust);}

.trail-marker{
  position:absolute;
  top:50%;
  left:0%;
  width:14px;height:14px;
  border-radius:50%;
  background:var(--rust);
  transform:translate(-50%,-50%);
  box-shadow:0 0 0 5px rgba(178,74,28,.18);
}

.steps-row{
  display:flex;
  gap:26px;
  overflow-x:auto;
  padding-bottom:20px;
  padding-top:70px;
  scrollbar-width:thin;
}

.step{
  position:relative;
  flex:0 0 auto;
  min-width:180px;
  background:var(--ink);
  color:var(--paper);
  padding:26px 22px 24px 38px;
  clip-path:polygon(22px 0,100% 0,100% 100%,22px 100%,22px 58%,0 48%,22px 38%);
  box-shadow:0 18px 34px rgba(18,24,31,.16);
  transition:transform .3s ease, box-shadow .3s ease;
}

.step:hover{
  transform:translateY(-5px);
  box-shadow:0 26px 44px rgba(18,24,31,.22);
}

.step::after{
  content:"";
  position:absolute;
  left:12px;top:48%;
  width:9px;height:9px;
  border-radius:50%;
  background:var(--paper);
  transform:translateY(-50%);
}

.step .n{
  font-family:'IBM Plex Mono',monospace;
  color:var(--rust);
  font-size:13px;
  display:block;
  margin-bottom:10px;
}

.step h3{font-size:1.1rem;font-weight:600;margin-bottom:6px;}
.step p{font-size:13px;color:#b9b3a4;line-height:1.5;}

/* ---------- SHOWCASE ---------- */

.showcase-section{padding:130px 0;background:var(--paper-2);}

.showcase-section .wrap{
  display:grid;
  grid-template-columns:.85fr 1.15fr;
  gap:70px;
  align-items:center;
}

.showcase-copy p.eyebrow-2{
  color:var(--rust);
  font-weight:600;
  font-size:15px;
  margin-bottom:14px;
}

.showcase-copy h2{font-size:clamp(2rem,3.8vw,3rem);line-height:1.12;margin-bottom:20px;}

.showcase-copy p.desc{
  color:var(--muted-ink);
  font-size:1.05rem;
  line-height:1.75;
  margin-bottom:28px;
  max-width:440px;
}

.showcase-list{list-style:none;display:flex;flex-direction:column;gap:14px;}
.showcase-list li{display:flex;gap:12px;font-size:15px;color:var(--ink);align-items:flex-start;}
.showcase-list li::before{
  content:"";
  width:6px;height:6px;
  border-radius:50%;
  background:var(--rust);
  margin-top:8px;
  flex-shrink:0;
}

.desk-mock{
  background:var(--ink);
  border-radius:16px;
  padding:22px;
  box-shadow:0 30px 70px rgba(18,24,31,.28);
}

.desk-topbar{display:flex;gap:6px;margin-bottom:18px;}
.desk-topbar span{width:9px;height:9px;border-radius:50%;background:#3a4351;}

.desk-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:16px;}

.desk-panel{background:var(--ink-2);border-radius:10px;padding:16px;}

.desk-panel h4{
  font-family:'Inter',sans-serif;
  font-size:11.5px;
  color:#8a93a3;
  font-weight:600;
  margin-bottom:12px;
}

.desk-row{
  display:flex;
  justify-content:space-between;
  font-size:12.5px;
  color:#cfd3da;
  padding:7px 0;
  border-bottom:1px solid #2a3341;
}
.desk-row:last-child{border-bottom:none;}
.desk-row .tag{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--rust);}

.bars{display:flex;align-items:flex-end;gap:8px;height:120px;margin-top:6px;}

.bar{
  flex:1;
  background:linear-gradient(to top, var(--rust), var(--gold));
  border-radius:3px 3px 0 0;
  height:0%;
  transition:height 1.2s cubic-bezier(.16,.9,.3,1);
}

.stat-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;}

.stat-tile{background:var(--ink-2);border-radius:10px;padding:14px;}
.stat-tile .v{font-family:'IBM Plex Mono',monospace;font-size:1.2rem;color:var(--paper);}
.stat-tile .l{font-size:11px;color:#8a93a3;margin-top:2px;}

/* ---------- TESTIMONIAL ---------- */

.testimonial-section{padding:130px 0;background:var(--paper);text-align:center;}

.testimonial-section blockquote{
  font-family:'Fraunces',serif;
  font-weight:450;
  font-style:italic;
  font-size:clamp(1.6rem,3.4vw,2.6rem);
  line-height:1.4;
  max-width:820px;
  margin:0 auto 30px;
  color:var(--ink);
}

.testimonial-who{font-size:14.5px;color:var(--muted-ink);}
.testimonial-who strong{color:var(--ink);font-weight:600;}

/* ---------- CTA ---------- */

.try-now-section{padding:0 6% 130px;}

.try-now-card{
  max-width:1200px;
  margin:0 auto;
  background:linear-gradient(150deg,var(--ink),#1e2a1f 60%,var(--ink));
  color:var(--paper);
  border-radius:24px;
  padding:100px 70px;
  text-align:center;
  position:relative;
  overflow:hidden;
}

.try-now-card::before{
  content:"";
  position:absolute;
  width:460px;height:460px;
  border-radius:50%;
  background:rgba(178,74,28,.18);
  filter:blur(110px);
  top:-140px;right:-120px;
}

.try-tag{color:var(--rust);font-weight:600;font-size:15px;margin-bottom:18px;}

.try-now-card h2{
  font-size:clamp(2.3rem,4.8vw,4rem);
  line-height:1.08;
  margin-bottom:24px;
  position:relative;
}

.try-description{
  max-width:620px;
  margin:0 auto;
  color:#b9b3a4;
  font-size:1.08rem;
  line-height:1.75;
  position:relative;
}

.try-buttons{
  margin-top:38px;
  display:flex;
  justify-content:center;
  gap:16px;
  flex-wrap:wrap;
  position:relative;
}

.stats{
  margin-top:64px;
  display:flex;
  justify-content:center;
  gap:60px;
  flex-wrap:wrap;
  position:relative;
}

.stat h3{
  font-family:'IBM Plex Mono',monospace;
  font-size:2rem;
  color:var(--paper);
  font-weight:500;
}
.stat span{color:#8f9aa8;font-size:13px;}

/* ---------- FOOTER ---------- */

.footer{background:var(--ink);color:var(--paper);padding:90px 6% 50px;}

.footer-top{
  display:flex;
  justify-content:space-between;
  gap:80px;
  flex-wrap:wrap;
  padding-bottom:70px;
  border-bottom:1px solid #2a3341;
}

.footer-brand .brand-name{color:var(--paper);}
.footer-brand .seal{border-color:var(--paper);color:var(--paper);}
.footer-brand p{color:#8a93a3;font-size:14px;margin-top:16px;max-width:280px;line-height:1.6;}

.footer-links{display:flex;gap:80px;flex-wrap:wrap;}
.footer-links div{display:flex;flex-direction:column;}
.footer-links h4{font-size:13px;color:#8a93a3;font-weight:600;margin-bottom:18px;}
.footer-links a{color:#cfd3da;text-decoration:none;margin-bottom:12px;font-size:14.5px;}
.footer-links a:hover{color:var(--paper);}

.footer-bottom{
  display:flex;
  justify-content:space-between;
  padding-top:28px;
  color:#6a7382;
  font-size:13px;
  flex-wrap:wrap;
  gap:10px;
}

/* ---------- RESPONSIVE ---------- */

@media(max-width:1100px){
  .feature-card{column-gap:48px;}
  .feature-visual{height:min(58vh,520px);}
}

@media(max-width:900px){
  .hero .wrap{grid-template-columns:1fr;}
  .hero-art{order:-1;max-width:340px;margin:0 auto 20px;}
  .showcase-section .wrap{grid-template-columns:1fr;}
  .desk-grid{grid-template-columns:1fr;}
}

@media(max-width:768px){
  .navbar{width:95%;padding:12px 18px;}
  .menu{display:none;}
  .hero{padding-top:120px;}

  /* features stack vertically instead of pinning */
  .features-section{height:auto;overflow:visible;}
  .features-section::after{display:none;}
  .features-wrapper{flex-direction:column;width:100%;}
  .feature-card{
    flex:0 0 auto;
    width:100%;
    height:auto;
    min-height:auto;
    grid-template-columns:1fr;
    row-gap:30px;
    padding:70px 6%;
  }
  .feature-card:nth-child(even) .feature-content{order:0;}
  .feature-visual{height:260px;}
  .feature-icon{width:120px;}
  .features-hud{display:none;}
}
`;

const FEATURES = [
  {
    label: 'Stock control',
    title: 'Inventory that updates itself',
    body: 'Every sale, dispatch and goods receipt moves the same stock ledger instantly, so on-screen quantities match what is actually on the shelf.',
    points: ['Live quantity per SKU', 'Batch and serial tracking', 'Low-stock alerts'],
    caption: 'Stock ledger',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="15" y="55" width="14" height="30" rx="2" fill="#b24a1c" />
        <rect x="35" y="35" width="14" height="50" rx="2" fill="#bd9435" />
        <rect x="55" y="45" width="14" height="40" rx="2" fill="#b24a1c" />
        <rect x="75" y="20" width="14" height="65" rx="2" fill="#f4eedb" />
        <line x1="10" y1="90" x2="94" y2="90" stroke="#f4eedb" strokeOpacity=".35" strokeWidth="2" />
      </svg>
    )
  },
  {
    label: 'Cost centers',
    title: 'Know what every product actually earns',
    body: 'Assign a cost center to each product and read departmental margin, store-wise performance and true product profitability without exporting anything.',
    points: ['Margin by department', 'Store-wise performance', 'Per-product profit'],
    caption: 'Margin view',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="50" cy="50" r="38" stroke="#bd9435" strokeWidth="3" fill="none" />
        <circle cx="50" cy="50" r="24" stroke="#b24a1c" strokeWidth="3" fill="none" />
        <circle cx="50" cy="50" r="10" fill="#f4eedb" />
        <path d="M50 12 A38 38 0 0 1 88 50" stroke="#f4eedb" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    )
  },
  {
    label: 'Document flow',
    title: 'One connected chain, RFQ to invoice',
    body: 'Quotations, purchase orders, delivery notes, goods receipts and invoices each carry the one before them, so nothing has to be keyed in twice.',
    points: ['Auto-linked documents', 'Full audit trail', 'No re-entry'],
    caption: 'Paper trail',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="14" y="14" width="46" height="58" rx="4" fill="#f4eedb" />
        <rect x="36" y="26" width="46" height="58" rx="4" fill="#bd9435" />
        <path d="M22 80 L72 80" stroke="#b24a1c" strokeWidth="4" strokeLinecap="round" />
        <polyline points="62,72 72,80 62,88" stroke="#b24a1c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    )
  },
  {
    label: 'Search',
    title: 'Find any record from one search bar',
    body: 'Look up a product, a customer, a quote, an order, an invoice or a batch number from the same field, wherever you happen to be on the desk.',
    points: ['Search across all records', 'Keyboard shortcut', 'Recent results kept'],
    caption: 'Global search',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="42" cy="42" r="28" stroke="#f4eedb" strokeWidth="5" fill="none" />
        <line x1="62" y1="62" x2="86" y2="86" stroke="#b24a1c" strokeWidth="8" strokeLinecap="round" />
        <line x1="30" y1="36" x2="54" y2="36" stroke="#bd9435" strokeWidth="3" strokeLinecap="round" />
        <line x1="30" y1="48" x2="46" y2="48" stroke="#bd9435" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    label: 'Price history',
    title: 'Quote with the last three years in view',
    body: 'Historical purchase costs, past quotes to the same customer and selling-price trends sit beside the line you are pricing, so the number is defensible.',
    points: ['Past purchase cost', 'Previous customer quotes', 'Selling-price trend'],
    caption: 'Price trend',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="16" y="16" width="68" height="68" rx="8" fill="#f4eedb" />
        <polyline points="28,68 46,46 60,54 74,28" fill="none" stroke="#b24a1c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="74" cy="28" r="5" fill="#bd9435" />
      </svg>
    )
  },
  {
    label: 'Team',
    title: 'Sales, warehouse and accounts at once',
    body: 'Reps, warehouse staff and accountants work on orders, stock and approvals at the same time, with no record locks and no waiting for a file to close.',
    points: ['No record locks', 'Role-based access', 'Live updates'],
    caption: 'Shared desk',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="32" cy="35" r="12" fill="#bd9435" />
        <path d="M12 75 C12 57 22 50 32 50 C42 50 52 57 52 75" fill="#b24a1c" />
        <circle cx="68" cy="35" r="12" fill="#f4eedb" />
        <path d="M48 75 C48 57 58 50 68 50 C78 50 88 57 88 75" fill="#bd9435" opacity="0.8" />
      </svg>
    )
  }
];

const FLOWS = {
  sell: {
    tabLabel: 'Sales',
    eyebrow: 'The paper trail, in order',
    heading: 'From RFQ to payment, without losing a document',
    countLabel: 'documents, one connected chain',
    steps: [
      { n: '01', title: 'RFQ', body: 'Customer sends a request for quotation.' },
      { n: '02', title: 'Quotation', body: 'You price it and send a quote back.' },
      { n: '03', title: 'Purchase order', body: 'They confirm — the order is placed.' },
      { n: '04', title: 'Delivery note', body: 'Goods leave with a signed delivery note.' },
      { n: '05', title: 'Goods receipt', body: 'Buyer confirms what arrived and when.' },
      { n: '06', title: 'Invoice', body: 'Billing goes out against the delivery.' },
      { n: '07', title: 'Payment', body: 'Collection is tracked until it\u2019s settled.' }
    ]
  },
  contract: {
    tabLabel: 'Contract',
    eyebrow: 'Standing agreements, tracked the same way',
    heading: 'From signed contract to settled payment',
    countLabel: 'documents per release',
    steps: [
      { n: '01', title: 'Contract', body: 'Terms and pricing are agreed and logged against the customer.' },
      { n: '02', title: 'Release order', body: 'Buyer raises a release against the standing contract.' },
      { n: '03', title: 'Delivery note', body: 'Goods leave against that release order.' },
      { n: '04', title: 'Invoice', body: 'Billing goes out against the delivery.' },
      { n: '05', title: 'Goods receipt', body: 'Buyer confirms what arrived and when.' },
      { n: '06', title: 'Payment', body: 'Collection is tracked until it\u2019s settled.' }
    ]
  },
  buy: {
    tabLabel: 'Purchase',
    eyebrow: 'What you buy, tracked the same way',
    heading: 'From supplier quotation to goods received',
    countLabel: 'documents per purchase',
    steps: [
      { n: '01', title: 'Quotation received', body: 'A supplier sends their quotation in.' },
      { n: '02', title: 'Purchase order', body: 'You create a PO against the accepted quote.' },
      { n: '03', title: 'Delivery note', body: 'The supplier ships against the PO with a delivery note.' },
      { n: '04', title: 'Invoice', body: 'The supplier\u2019s invoice is added against the PO.' },
      { n: '05', title: 'Goods receipt', body: 'You record what arrived and when.' }
    ]
  }
};

export default function HomeView() {
  const root = useRef(null);
  const stepsRowRef = useRef(null);
  const isFirstRender = useRef(true);
  const [activeFlow, setActiveFlow] = useState('sell');
  const flow = FLOWS[activeFlow];

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isDesktop = window.innerWidth > 768;

      /* Hero entrance — one orchestrated sequence */
      const tl = gsap.timeline();
      tl.from('.eyebrow', { opacity: 0, y: 20, duration: 0.7 })
        .from('.line', { y: 110, opacity: 0, stagger: 0.12, duration: 1, ease: 'power4.out' }, '-=.35')
        .from('.hero-subtitle', { opacity: 0, y: 30, duration: 0.7 }, '-=.6')
        .from('.hero-buttons', { opacity: 0, y: 30, duration: 0.7 }, '-=.5')
        .from('.hero-proof', { opacity: 0, y: 20, duration: 0.7 }, '-=.4')
        .from('.hero-art svg', { opacity: 0, scale: 0.9, duration: 1, ease: 'power3.out' }, '-=1.1');

      /* Pinned horizontal feature scroll */
      if (!reduceMotion && isDesktop) {
        const cards = gsap.utils.toArray('.feature-card');
        const total = cards.length;
        const railFill = document.getElementById('hudFill');
        const counter = document.getElementById('hudCount');

        const horizontal = gsap.to('.features-wrapper', {
          xPercent: -100 * ((total - 1) / total),
          ease: 'none',
          scrollTrigger: {
            trigger: '.features-section',
            start: 'top top',
            end: () => '+=' + window.innerWidth * (total - 1),
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const step = 1 / total;
              const pos = self.progress * ((total - 1) / total);
              if (railFill) railFill.style.transform = `translateX(${(pos / step) * 100}%)`;
              const idx = Math.min(total, Math.round(self.progress * (total - 1)) + 1);
              if (counter) counter.textContent = String(idx).padStart(2, '0') + ' / ' + total;
            }
          }
        });

        cards.forEach((card) => {
          gsap.from(card.querySelectorAll('.feature-index, h2, .feature-body, .feature-points li, .feature-visual'), {
            y: 56,
            opacity: 0,
            duration: 0.9,
            stagger: 0.07,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              containerAnimation: horizontal,
              start: 'left 72%'
            }
          });
        });
      }

      /* Ledger trail — draws as the section enters view */
      ScrollTrigger.create({
        trigger: '.trail',
        start: 'top 75%',
        end: 'bottom 55%',
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress * 100;
          const fill = document.getElementById('trailFill');
          const marker = document.getElementById('trailMarker');
          if (fill) fill.style.width = p + '%';
          if (marker) marker.style.left = p + '%';
        }
      });

      gsap.from('.step', {
        opacity: 0,
        y: 26,
        stagger: 0.06,
        duration: 0.7,
        scrollTrigger: { trigger: '.steps-row', start: 'top 85%' }
      });

      /* Desk mockup — bars grow, panel slides in */
      ScrollTrigger.create({
        trigger: '#deskMock',
        start: 'top 75%',
        once: true,
        onEnter: () => {
          document.querySelectorAll('#deskBars .bar').forEach((bar) => {
            bar.style.height = bar.dataset.h + '%';
          });
        }
      });

      gsap.from('#deskMock', {
        y: 60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '#deskMock', start: 'top 80%' }
      });

      gsap.from('.showcase-copy > *', {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        scrollTrigger: { trigger: '.showcase-copy', start: 'top 80%' }
      });

      gsap.from('.testimonial-section blockquote, .testimonial-who', {
        y: 30,
        opacity: 0,
        stagger: 0.15,
        duration: 0.9,
        scrollTrigger: { trigger: '.testimonial-section', start: 'top 75%' }
      });

      gsap.from('.try-now-card', {
        y: 80,
        opacity: 0,
        duration: 1.1,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.try-now-card', start: 'top 82%' }
      });
    }, root);

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      ctx.revert();
    };
  }, []);

  /* Re-animate the step row whenever the flow tab changes (skip on first mount —
     the scroll-triggered reveal above already handles that pass) */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!stepsRowRef.current) return;
    const els = stepsRowRef.current.querySelectorAll('.step');
    gsap.fromTo(
      els,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power2.out' }
    );
  }, [activeFlow]);

  return (
    <div className="pds-root" ref={root}>
      <style>{styles}</style>

      <div className="navbar-wrapper">
        <nav className="navbar">
          <div className="brand">
            <div className="seal">PDS</div>
            <div className="brand-name">Desk Manager</div>
          </div>
          <div className="menu">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#showcase">Desk</a>
            <a href="#pricing">Pricing</a>
          </div>
          <a href="#pricing" className="nav-cta">Start free trial</a>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap">

          <div className="hero-copy">
            <div className="eyebrow"><span className="dot"></span> Built for distributors, traders and manufacturers</div>

            <h1 className="hero-title">
              <span className="line">Every quotation, order</span>
              <span className="line">and invoice on <em>one desk.</em></span>
            </h1>

            <p className="hero-subtitle">
              PDS Desk Manager takes a request for quotation all the way to a collected payment — tracking stock, customers and every document in between, so nothing sits buried in someone&apos;s inbox.
            </p>

            <div className="hero-buttons">
              <a href="#pricing" className="btn btn-primary">Start 15-day free trial</a>
              <a href="#workflow" className="btn btn-secondary">See how it works</a>
            </div>

            <div className="hero-proof">
              <div className="proof-item"><span className="num mono">7</span><span className="lbl">documents tracked, RFQ to payment</span></div>
              <div className="proof-item"><span className="num mono">24/7</span><span className="lbl">support desk</span></div>
              <div className="proof-item"><span className="num mono">0</span><span className="lbl">spreadsheets required</span></div>
            </div>
          </div>

          <div className="hero-art">
            <svg viewBox="0 0 480 460" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="240" cy="400" rx="200" ry="26" fill="#e3d6ab" opacity="0.5" />

              <g className="doc doc-a" style={{ '--r': '-8deg' }} transform="translate(90,230) rotate(-8)">
                <rect width="150" height="190" rx="6" fill="#efe6cd" stroke="#d8cfb5" strokeWidth="1.5" />
                <line x1="20" y1="34" x2="120" y2="34" stroke="#c9bd97" strokeWidth="4" />
                <line x1="20" y1="54" x2="100" y2="54" stroke="#d8cfb5" strokeWidth="3" />
                <line x1="20" y1="70" x2="110" y2="70" stroke="#d8cfb5" strokeWidth="3" />
                <line x1="20" y1="86" x2="90" y2="86" stroke="#d8cfb5" strokeWidth="3" />
              </g>

              <g className="doc doc-b" style={{ '--r': '6deg' }} transform="translate(230,205) rotate(6)">
                <rect width="150" height="190" rx="6" fill="#f7f1de" stroke="#d8cfb5" strokeWidth="1.5" />
                <line x1="20" y1="34" x2="120" y2="34" stroke="#b24a1c" strokeWidth="4" />
                <line x1="20" y1="56" x2="105" y2="56" stroke="#d8cfb5" strokeWidth="3" />
                <line x1="20" y1="72" x2="95" y2="72" stroke="#d8cfb5" strokeWidth="3" />
                <line x1="20" y1="88" x2="112" y2="88" stroke="#d8cfb5" strokeWidth="3" />
                <line x1="20" y1="104" x2="80" y2="104" stroke="#d8cfb5" strokeWidth="3" />
                <text x="20" y="150" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill="#8a3814">INV-2291</text>
              </g>

              <g className="doc doc-c" style={{ '--r': '-3deg' }} transform="translate(165,150) rotate(-3)">
                <rect width="150" height="190" rx="6" fill="#efe6cd" stroke="#d8cfb5" strokeWidth="1.5" />
                <line x1="20" y1="34" x2="120" y2="34" stroke="#c9bd97" strokeWidth="4" />
                <line x1="20" y1="54" x2="100" y2="54" stroke="#d8cfb5" strokeWidth="3" />
                <line x1="20" y1="70" x2="110" y2="70" stroke="#d8cfb5" strokeWidth="3" />
              </g>

              <g className="stamp" transform="translate(280,220)">
                <circle r="46" fill="none" stroke="#b24a1c" strokeWidth="4" />
                <circle r="36" fill="none" stroke="#b24a1c" strokeWidth="1.5" />
                <text x="0" y="-6" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill="#b24a1c" fontWeight="600">APPROVED</text>
                <text x="0" y="12" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#b24a1c">PDS · DESK</text>
              </g>

              <path className="growth-line" d="M60 400 C 140 380, 160 320, 220 330 S 320 260, 400 200" fill="none" stroke="#b24a1c" strokeWidth="3" strokeLinecap="round" />
              <circle className="pulse-dot" cx="400" cy="200" r="6" fill="#b24a1c" />
            </svg>
          </div>

        </div>
      </section>

      <div className="marquee-section">
        <div className="marquee-track">
          <span>Quotations</span><span>Purchase orders</span><span>Delivery notes</span><span>Goods receipt</span><span>Invoices</span><span>Payment collection</span><span>Stock ledgers</span>
          <span>Quotations</span><span>Purchase orders</span><span>Delivery notes</span><span>Goods receipt</span><span>Invoices</span><span>Payment collection</span><span>Stock ledgers</span>
        </div>
      </div>

      <section className="features-section" id="features">
        <div className="features-wrapper">
          {FEATURES.map((f) => (
            <article className="feature-card" key={f.title}>
              <div className="feature-content">
                <span className="feature-index mono">{f.label}</span>
                <h2>{f.title}</h2>
                <p className="feature-body">{f.body}</p>
                <ul className="feature-points">
                  {f.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>

              <figure className="feature-visual">
                {f.icon}
                <figcaption className="visual-caption mono">{f.caption}</figcaption>
              </figure>
            </article>
          ))}
        </div>

        <div className="features-hud">
          <span className="hud-label mono">What the desk does</span>
          <span className="hud-rail"><i id="hudFill"></i></span>
          <span className="hud-count mono" id="hudCount">01 / 6</span>
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="wrap">

          <div className="workflow-header">
            <div className="workflow-header-text">
              <p>{flow.eyebrow}</p>
              <h2>{flow.heading}</h2>
            </div>
            <div className="workflow-count">
              <span className="v mono">{String(flow.steps.length).padStart(2, '0')}</span>
              <span className="l">{flow.countLabel}</span>
            </div>
          </div>

          <div className="flow-tabs" role="tablist" aria-label="Document flow">
            {Object.entries(FLOWS).map(([key, f]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeFlow === key}
                className={'flow-tab' + (activeFlow === key ? ' active' : '')}
                onClick={() => setActiveFlow(key)}
              >
                {f.tabLabel}
              </button>
            ))}
          </div>

          <div className="trail">
            <div className="trail-line-wrap">
              <div className="trail-line-bg"></div>
              <div className="trail-line-fill" id="trailFill"></div>
              <div className="trail-marker" id="trailMarker"></div>
            </div>

            <div className="steps-row" ref={stepsRowRef}>
              {flow.steps.map((s) => (
                <div className="step" key={activeFlow + s.n}>
                  <span className="n mono">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <section className="showcase-section" id="showcase">
        <div className="wrap">

          <div className="showcase-copy">
            <p className="eyebrow-2">The desk itself</p>
            <h2>A single screen for what used to take five tabs</h2>
            <p className="desc">Stock levels, this week&apos;s quotations and who still owes you money — laid out the way a desk manager actually thinks, not the way a database happens to store it.</p>
            <ul className="showcase-list">
              <li>Live stock counts against every open order</li>
              <li>Outstanding payments sorted by how overdue they are</li>
              <li>One search across customers, orders and invoices</li>
            </ul>
          </div>

          <div className="desk-mock" id="deskMock">
            <div className="desk-topbar"><span></span><span></span><span></span></div>
            <div className="desk-grid">
              <div className="desk-panel">
                <h4>Open orders</h4>
                <div className="desk-row"><span>Anand Traders</span><span className="tag">PO-1187</span></div>
                <div className="desk-row"><span>Kumar Distributors</span><span className="tag">PO-1188</span></div>
                <div className="desk-row"><span>Shree Enterprises</span><span className="tag">PO-1190</span></div>
                <div className="desk-row"><span>Vikas &amp; Co.</span><span className="tag">PO-1192</span></div>

                <div className="stat-tiles">
                  <div className="stat-tile"><div className="v mono">128</div><div className="l">In stock (SKUs)</div></div>
                  <div className="stat-tile"><div className="v mono">₹4.2L</div><div className="l">Pending payment</div></div>
                  <div className="stat-tile"><div className="v mono">9</div><div className="l">Due this week</div></div>
                </div>
              </div>

              <div className="desk-panel">
                <h4>Dispatches this week</h4>
                <div className="bars" id="deskBars">
                  <div className="bar" data-h="40"></div>
                  <div className="bar" data-h="65"></div>
                  <div className="bar" data-h="35"></div>
                  <div className="bar" data-h="80"></div>
                  <div className="bar" data-h="55"></div>
                  <div className="bar" data-h="95"></div>
                  <div className="bar" data-h="70"></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="testimonial-section">
        <div className="wrap">
          <blockquote>&ldquo;We stopped chasing invoices across three notebooks and one shared spreadsheet — now our desk knows what everyone else&apos;s desk is waiting on.&rdquo;</blockquote>
          <p className="testimonial-who"><strong>Operations lead</strong> — mid-size industrial distributor</p>
        </div>
      </section>

      <section className="try-now-section" id="pricing">
        <div className="try-now-card">
          <p className="try-tag">Start today</p>
          <h2>Put your paper trail on one desk</h2>
          <p className="try-description">
            Quotations, purchase orders, delivery notes, goods receipt, invoices and payment collection — running from a single, growing ledger.
          </p>

          <div className="try-buttons">
            <a href="#" className="btn btn-light">Start 15-day free trial</a>
            <a href="#" className="btn btn-outline-light">Schedule a demo</a>
          </div>

          <div className="stats">
            <div className="stat"><h3>15 days</h3><span>free trial</span></div>
            <div className="stat"><h3>24/7</h3><span>support desk</span></div>
            <div className="stat"><h3>100%</h3><span>your data, encrypted</span></div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand"><div className="seal">PDS</div><div className="brand-name">Desk Manager</div></div>
            <p>Business management for trading and distribution teams — from the first quotation to the last rupee collected.</p>
          </div>

          <div className="footer-links">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#workflow">Workflow</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Contact</a>
              <a href="#">Support</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="#">Documentation</a>
              <a href="#">Help centre</a>
              <a href="#">Privacy policy</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} PDS Desk Manager. All rights reserved.</span>
          <span>Built for teams who&apos;d rather sell than search for paperwork.</span>
        </div>
      </footer>
    </div>
  );
}