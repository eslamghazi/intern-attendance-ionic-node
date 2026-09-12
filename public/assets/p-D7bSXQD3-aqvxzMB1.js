import{d as r,m as s,e as i,P as a,i as d}from"./index-De4WCxtt.js";/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const c=()=>{const e=window;e.addEventListener("statusTap",()=>{r(()=>{const n=document.elementFromPoint(e.innerWidth/2,e.innerHeight/2);if(!n)return;const t=s(n);t&&new Promise(o=>i(t,o)).then(()=>{a(async()=>{t.style.setProperty("--overflow","hidden"),await d(t,300),t.style.removeProperty("--overflow")})})})})};export{c as startStatusTap};
