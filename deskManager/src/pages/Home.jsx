import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.pds-root{
  --ink:#181b3a;
  --ink-2:#20244a;
  --ink-3:#272c58;
  --ink-4:#2f3568;
  --paper:#ffffff;
  --paper-2:#f4f4fd;
  --paper-line:#e4e3f5;
  --rust:#4f46e5;
  --rust-dark:#3c33c4;
  --violet:#8b5cf6;
  --gold:#f59e0b;
  --muted-ink:#5b5f7e;
  --muted-paper:#a7abcf;

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
  font-family:'Space Grotesk',sans-serif;
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

.brand-logo{
  height:24px;
  width:auto;
  color:var(--ink);
  display:block;
}

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
  box-shadow:0 14px 26px rgba(79,70,229,.35);
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
  background:rgba(79,70,229,.5);
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
  color:#b7bbdd;
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
  color:#c7cbe8;
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
  background:rgba(79,70,229,.22);
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
.feature-card:nth-child(5){background:#241f52;}
.feature-card:nth-child(6){background:#1c2050;}

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
  box-shadow:0 0 0 5px rgba(79,70,229,.18);
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
.step p{font-size:13px;color:#b7bbdd;line-height:1.5;}

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
.desk-topbar span{width:9px;height:9px;border-radius:50%;background:#3d4373;}

.desk-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:16px;}

.desk-panel{background:var(--ink-2);border-radius:10px;padding:16px;}

.desk-panel h4{
  font-family:'Inter',sans-serif;
  font-size:11.5px;
  color:#9aa0c9;
  font-weight:600;
  margin-bottom:12px;
}

.desk-row{
  display:flex;
  justify-content:space-between;
  font-size:12.5px;
  color:#d6d8ee;
  padding:7px 0;
  border-bottom:1px solid #2c3363;
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
.stat-tile .l{font-size:11px;color:#9aa0c9;margin-top:2px;}

/* ---------- TESTIMONIAL ---------- */

.testimonial-section{padding:130px 0;background:var(--paper);text-align:center;}

.testimonial-section blockquote{
  font-family:'Space Grotesk',sans-serif;
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
  background:linear-gradient(150deg,var(--ink),#2a1f5c 60%,var(--ink));
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
  background:rgba(79,70,229,.18);
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
  color:#b7bbdd;
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
.stat span{color:#a2a6cf;font-size:13px;}

/* ---------- FOOTER ---------- */

.footer{background:var(--ink);color:var(--paper);padding:90px 6% 50px;}

.footer-top{
  display:flex;
  justify-content:space-between;
  gap:80px;
  flex-wrap:wrap;
  padding-bottom:70px;
  border-bottom:1px solid #2c3363;
}

.footer-brand p{color:#9aa0c9;font-size:14px;margin-top:16px;max-width:280px;line-height:1.6;}

.footer-logo{color:var(--paper);height:22px;}

.footer-links{display:flex;gap:80px;flex-wrap:wrap;}
.footer-links div{display:flex;flex-direction:column;}
.footer-links h4{font-size:13px;color:#9aa0c9;font-weight:600;margin-bottom:18px;}
.footer-links a{color:#d6d8ee;text-decoration:none;margin-bottom:12px;font-size:14.5px;}
.footer-links a:hover{color:var(--paper);}

.footer-bottom{
  display:flex;
  justify-content:space-between;
  padding-top:28px;
  color:#7d81ab;
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

/* Wordmark logo — traced from the uploaded artwork, recolored with
   currentColor so it can sit on both light (navbar) and dark (footer)
   backgrounds just by setting the parent's `color`. */
const Logo = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 209 117"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Desk Manager"
  >
    <path d="M31.632 82.0956H22.512V78.6396L18.048 82.1916C17.024 82.4476 15.792 82.5756 14.352 82.5756C12.24 82.5756 10.336 82.0316 8.64 80.9436C6.976 79.8236 5.664 78.3196 4.704 76.4316C3.776 74.5436 3.312 72.4636 3.312 70.1916C3.312 67.7276 4.064 65.4236 5.568 63.2796C7.072 61.1036 8.944 59.3756 11.184 58.0956C13.456 56.7836 15.648 56.1276 17.76 56.1276C19.52 56.1276 21.12 56.6236 22.56 57.6156V47.7276L18.288 44.7516V43.2636L26.496 40.1916H28.32V78.4956L32.592 80.1756L31.632 82.0956ZM16.8 78.4956C17.76 78.4956 18.672 78.3676 19.536 78.1116C20.432 77.8236 21.424 77.2956 22.512 76.5276V65.5836C22.32 63.9836 21.568 62.6876 20.256 61.6956C18.976 60.6716 17.216 60.1596 14.976 60.1596C11.36 60.1596 9.552 62.7356 9.552 67.8876C9.552 70.8956 10.176 73.4236 11.424 75.4716C12.672 77.4876 14.464 78.4956 16.8 78.4956ZM52.8518 82.1916C51.5718 82.4476 50.0358 82.5756 48.2438 82.5756C46.1318 82.5756 44.2278 82.0316 42.5318 80.9436C40.8678 79.8236 39.5558 78.3196 38.5958 76.4316C37.6678 74.5436 37.2038 72.4636 37.2038 70.1916C37.2038 67.7276 37.9558 65.4236 39.4598 63.2796C40.9638 61.1036 42.8358 59.3756 45.0758 58.0956C47.3478 56.7836 49.5398 56.1276 51.6518 56.1276C54.6918 56.1276 57.0438 57.3276 58.7078 59.7276C60.4038 62.1276 61.2518 65.2956 61.2518 69.2316H43.4918C43.6838 71.9516 44.4198 74.1756 45.6998 75.9036C47.0118 77.6316 48.7878 78.4956 51.0278 78.4956C53.1078 78.4956 56.0678 76.8796 59.9078 73.6476L61.3478 75.4716L52.8518 82.1916ZM48.8678 60.1596C45.4118 60.1596 43.6038 62.5276 43.4438 67.2636H54.6758C54.3878 65.5356 54.0838 64.2236 53.7638 63.3276C53.4758 62.3996 52.9478 61.6476 52.1798 61.0716C51.4438 60.4636 50.3398 60.1596 48.8678 60.1596ZM92.6715 58.0956L80.5275 82.0956H76.8795L69.3915 63.8076L64.9275 61.2156V59.7276L73.1355 55.6956L74.9595 62.9436L80.8155 77.2476L87.5835 63.1836L81.1995 58.5276L82.1595 56.6076H92.6715V58.0956Z" fill="currentColor" />
    <path d="M84.5 81.5956H80.5L87.5 69.0956L89 74.0956L84.5 81.5956Z" fill="currentColor" stroke="currentColor" />
    <path d="M117.472 82.096H108.544L97.9838 65.056L95.7278 63.424L96.4478 61.984H99.1358C101.312 61.984 103.024 61.44 104.272 60.352C105.552 59.232 106.192 57.712 106.192 55.792C106.192 53.264 105.488 51.168 104.08 49.504C102.672 47.808 100.624 46.96 97.9358 46.96C96.1438 46.96 94.4958 47.488 92.9918 48.544V78.448L98.0318 80.176L97.0718 82.096H82.4798V80.608L86.9918 77.056V47.872L81.9998 46.24L82.9598 44.32H88.5278C91.4398 44.32 94.3038 44.224 97.1198 44.032C99.1678 43.904 100.688 43.84 101.68 43.84C103.824 43.84 105.728 44.272 107.392 45.136C109.088 46 110.384 47.168 111.28 48.64C112.208 50.112 112.672 51.728 112.672 53.488C112.672 55.088 112.176 56.624 111.184 58.096C110.192 59.536 108.88 60.8 107.248 61.888C105.648 62.944 103.952 63.744 102.16 64.288L105.28 65.344L112.72 77.344L118.432 80.176L117.472 82.096ZM146.012 82H136.892V77.824L131.468 82.096C130.828 82.352 130.028 82.48 129.068 82.48C126.316 82.48 124.316 81.792 123.068 80.416C121.852 79.04 121.244 77.392 121.244 75.472C121.244 74.32 121.66 73.184 122.492 72.064C123.324 70.944 124.508 69.888 126.044 68.896H136.892V65.824C136.892 63.744 136.332 62.272 135.212 61.408C134.124 60.544 132.62 60.112 130.7 60.112C128.716 60.112 126.284 61.312 123.404 63.712L121.964 61.888L128.876 56.416C130.156 56.16 131.692 56.032 133.484 56.032C136.396 56.032 138.652 56.752 140.252 58.192C141.852 59.6 142.652 61.664 142.652 64.384V78.4L146.972 80.08L146.012 82ZM130.604 78.4C132.556 78.4 134.652 77.504 136.892 75.712V70.864H128.396C127.98 71.376 127.676 71.888 127.484 72.4C127.324 72.912 127.244 73.472 127.244 74.08C127.244 75.264 127.548 76.288 128.156 77.152C128.764 77.984 129.58 78.4 130.604 78.4ZM164.497 82.096C163.761 82.352 162.865 82.48 161.809 82.48C159.153 82.48 157.201 81.792 155.953 80.416C154.737 79.008 154.129 76.848 154.129 73.936V59.92H148.945V57.952L158.065 47.344H159.889V57.952H168.529V59.92H159.889V74.512C159.889 77.104 161.137 78.4 163.633 78.4C164.305 78.4 164.945 78.256 165.553 77.968C166.193 77.68 166.977 77.168 167.905 76.432L169.345 78.256L164.497 82.096ZM201.459 82H192.339V65.824C192.339 64.064 192.067 62.832 191.523 62.128C190.979 61.424 190.003 61.072 188.595 61.072C187.539 61.072 186.483 61.264 185.427 61.648C184.403 62.032 183.187 62.768 181.779 63.856V78.4L186.099 80.08L185.139 82H171.747V80.512L176.019 77.152V47.632L171.747 44.656V43.168L179.955 40.096H181.779V61.6L188.355 56.416C189.027 56.16 189.907 56.032 190.995 56.032C193.171 56.032 194.899 56.704 196.179 58.048C197.459 59.36 198.099 61.152 198.099 63.424V78.4L202.419 80.08L201.459 82Z" fill="currentColor" />
  </svg>
);

const FEATURES = [
  {
    label: 'Stock control',
    title: 'Inventory that updates itself',
    body: 'Every sale, dispatch and goods receipt moves the same stock ledger instantly, so on-screen quantities match what is actually on the shelf.',
    points: ['Live quantity per SKU', 'Batch and serial tracking', 'Low-stock alerts'],
    caption: 'Stock ledger',
    icon: (
      <svg className="feature-icon" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="50" cy="88" rx="34" ry="5" fill="#ffffff" opacity="0.08" />
        <rect x="16" y="52" width="24" height="34" rx="4" fill="#4f46e5" />
        <rect x="16" y="52" width="24" height="8" rx="4" fill="#ffffff" opacity="0.25" />
        <rect x="42" y="34" width="24" height="52" rx="4" fill="#8b5cf6" />
        <rect x="42" y="34" width="24" height="8" rx="4" fill="#ffffff" opacity="0.25" />
        <rect x="68" y="44" width="20" height="42" rx="4" fill="#f59e0b" />
        <rect x="68" y="44" width="20" height="8" rx="4" fill="#ffffff" opacity="0.3" />
        <circle cx="78" cy="20" r="12" fill="#ffffff" />
        <path d="M72 20 L77 25 L85 15" fill="none" stroke="#4f46e5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
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
      <svg className="feature-icon" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="48" cy="90" rx="32" ry="5" fill="#ffffff" opacity="0.08" />
        <path d="M48 50 L48 14 A36 36 0 0 1 79 68 Z" fill="#4f46e5" />
        <path d="M48 50 L79 68 A36 36 0 0 1 22 74 Z" fill="#8b5cf6" />
        <path d="M48 50 L22 74 A36 36 0 0 1 48 14 Z" fill="#f59e0b" />
        <circle cx="48" cy="50" r="15" fill="#ffffff" />
        <path d="M42 50 L47 55 L56 44" fill="none" stroke="#4f46e5" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
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
      <svg className="feature-icon" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="50" cy="90" rx="34" ry="5" fill="#ffffff" opacity="0.08" />
        <rect x="14" y="18" width="46" height="58" rx="6" fill="#8b5cf6" />
        <path d="M24 32 L50 32 M24 42 L46 42 M24 52 L40 52" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        <rect x="40" y="34" width="46" height="58" rx="6" fill="#4f46e5" />
        <path d="M50 48 L76 48 M50 58 L72 58 M50 68 L64 68" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        <circle cx="80" cy="26" r="10" fill="#f59e0b" />
        <path d="M75 26 L79 30 L86 22" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
      <svg className="feature-icon" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="45" cy="90" rx="32" ry="5" fill="#ffffff" opacity="0.08" />
        <circle cx="42" cy="42" r="26" fill="#4f46e5" />
        <circle cx="42" cy="42" r="17" fill="#ffffff" />
        <rect x="60" y="60" width="34" height="12" rx="6" fill="#f59e0b" transform="rotate(45 60 60)" />
        <circle cx="42" cy="42" r="6" fill="#8b5cf6" />
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
      <svg className="feature-icon" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="50" cy="90" rx="34" ry="5" fill="#ffffff" opacity="0.08" />
        <rect x="12" y="12" width="76" height="70" rx="10" fill="#ffffff" opacity="0.95" />
        <rect x="26" y="52" width="10" height="20" rx="3" fill="#8b5cf6" opacity="0.5" />
        <rect x="42" y="40" width="10" height="32" rx="3" fill="#8b5cf6" opacity="0.5" />
        <rect x="58" y="30" width="10" height="42" rx="3" fill="#8b5cf6" opacity="0.5" />
        <path d="M22 62 L40 42 L54 50 L76 22" fill="none" stroke="#4f46e5" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="76" cy="22" r="6" fill="#f59e0b" />
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
      <svg className="feature-icon" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="50" cy="90" rx="34" ry="5" fill="#ffffff" opacity="0.08" />
        <path d="M12 82 C12 58 22 48 36 48 C50 48 60 58 60 82 Z" fill="#8b5cf6" />
        <circle cx="36" cy="30" r="16" fill="#8b5cf6" />
        <path d="M40 82 C40 60 50 50 64 50 C78 50 88 60 88 82 Z" fill="#4f46e5" />
        <circle cx="64" cy="32" r="15" fill="#4f46e5" />
        <circle cx="70" cy="16" r="9" fill="#f59e0b" />
        <path d="M67 16 L69.5 18.5 L74 13" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
            <Logo className="brand-logo" /> 
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
              <ellipse cx="240" cy="410" rx="180" ry="22" fill="#4f46e5" opacity="0.06" />

              <g className="doc doc-c" style={{ '--r': '-3deg' }} transform="translate(150,140) rotate(-3)">
                <rect width="150" height="190" rx="14" fill="#f4f4fd" />
              </g>

              <g className="doc doc-a" style={{ '--r': '-8deg' }} transform="translate(80,225) rotate(-8)">
                <rect width="150" height="190" rx="14" fill="#8b5cf6" />
                <rect x="20" y="26" width="80" height="10" rx="5" fill="#ffffff" opacity="0.9" />
                <rect x="20" y="50" width="100" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
                <rect x="20" y="66" width="90" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
                <rect x="20" y="82" width="70" height="7" rx="3.5" fill="#ffffff" opacity="0.55" />
                <rect x="20" y="140" width="46" height="24" rx="8" fill="#ffffff" opacity="0.2" />
              </g>

              <g className="doc doc-b" style={{ '--r': '6deg' }} transform="translate(225,200) rotate(6)">
                <rect width="150" height="190" rx="14" fill="#4f46e5" />
                <rect x="20" y="26" width="70" height="10" rx="5" fill="#ffffff" />
                <rect x="20" y="50" width="105" height="7" rx="3.5" fill="#ffffff" opacity="0.6" />
                <rect x="20" y="66" width="95" height="7" rx="3.5" fill="#ffffff" opacity="0.6" />
                <rect x="20" y="82" width="112" height="7" rx="3.5" fill="#ffffff" opacity="0.6" />
                <text x="20" y="150" fontFamily="IBM Plex Mono, monospace" fontSize="13" fill="#ffffff" opacity="0.85">INV-2291</text>
              </g>

              <g className="stamp" transform="translate(300,215)">
                <circle r="44" fill="#f59e0b" />
                <path d="M-16 0 L-5 12 L20 -16" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              </g>

              <path className="growth-line" d="M60 400 C 140 380, 160 320, 220 330 S 320 260, 400 200" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
              <circle className="pulse-dot" cx="400" cy="200" r="7" fill="#f59e0b" />
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
 <div className="marquee-section">
        Feature
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
            <div className="brand"><Logo className="brand-logo footer-logo" /></div>
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