/**
 * Support Widget for Netrun CAD
 *
 * Self-contained help panel with tutorials, keyboard shortcuts reference,
 * and Charlotte AI chat link. Based on the @netrun/support-widget pattern.
 */

'use client';

import { useEffect } from 'react';

export function SupportWidget() {
  useEffect(() => {
    // Only inject once
    if (document.getElementById('ncms-support-root')) return;

    const script = document.createElement('script');
    script.id = 'netrun-cad-support';
    script.textContent = getSupportSnippet();
    document.body.appendChild(script);

    return () => {
      const root = document.getElementById('ncms-support-root');
      if (root) root.remove();
      const style = document.querySelector('style[data-support-panel]');
      if (style) style.remove();
      script.remove();
    };
  }, []);

  return null;
}

function getSupportSnippet(): string {
  return `(function(){
"use strict";
if(document.getElementById("ncms-support-root"))return;

var CFG={
  slug:"netrun-cad",
  primary:"#00d4aa",
  accent:"#ff9800",
  title:"Survai Construction Help",
  greeting:"How can we help with your design?",
  tabs:["home","tutorials","shortcuts"]
};

var TUTORIALS=[
  {title:"Draw Your First Line",steps:[
    "Press L or click the Line tool in the side panel",
    "Click on the canvas to set the first point",
    "Move your mouse to set direction, then click for the second point",
    "The length displays automatically at the line midpoint"
  ]},
  {title:"Use Precise Dimensions",steps:[
    "Select the Line tool and click your first point",
    "Move the mouse to indicate direction",
    "Type the exact length (e.g. 12 for 12 feet) and press Enter",
    "For feet-inches: type 12'6 or 12,6 for 12 feet 6 inches",
    "For rectangles: type 10x8 for a 10ft by 8ft rectangle"
  ]},
  {title:"Add Dimensions to Your Drawing",steps:[
    "Press D or type DIM in the command line",
    "Click the first measurement point on your drawing",
    "Click the second measurement point",
    "Move mouse to set offset distance, then click to place",
    "The dimension shows the distance with extension lines"
  ]},
  {title:"Import a Site Plan",steps:[
    "Open the hamburger menu (top-left)",
    "Select Import DXF for AutoCAD files, or Import GIS for property data",
    "Toggle the satellite basemap with the globe icon in the top bar",
    "Use the Basemap panel to search for an address",
    "GIS property lines import automatically from the county assessor"
  ]},
  {title:"Export to PDF",steps:[
    "Open the hamburger menu (top-left)",
    "Click Export PDF",
    "Choose page size (Letter, Tabloid, ARCH D, Custom)",
    "Set the scale (1/4 inch = 1 foot is standard for landscape plans)",
    "Click Export to download the PDF"
  ]}
];

var SHORTCUTS=[
  {key:"L",desc:"Line tool"},
  {key:"R",desc:"Rectangle tool"},
  {key:"C",desc:"Circle tool"},
  {key:"D",desc:"Dimension tool"},
  {key:"V",desc:"Select / Pan"},
  {key:"1-4",desc:"Switch modes (CAD, Draw, Color, Text)"},
  {key:"G",desc:"Toggle grid"},
  {key:"S",desc:"Toggle snap"},
  {key:"F8",desc:"Toggle Ortho mode (constrain to 90 deg)"},
  {key:"Enter",desc:"Focus command line / repeat last"},
  {key:"Esc",desc:"Cancel current operation"},
  {key:"Ctrl+Z",desc:"Undo"},
  {key:"Ctrl+Shift+Z",desc:"Redo"},
  {key:"?",desc:"Toggle help panel"},
  {key:"Delete",desc:"Delete last element"},
  {key:"Ctrl+0",desc:"Reset view"},
  {key:"Scroll",desc:"Zoom in/out"},
  {key:"Right-click",desc:"Context menu (long-press on iPad)"}
];

var DOC_LINKS=[
  {label:"Command Reference",href:"#",action:"help"},
  {label:"Charlotte AI Assistant",href:"https://charlotte.netrunsystems.com"},
  {label:"Report a Bug",href:"mailto:support@netrunsystems.com?subject=CAD%20Bug%20Report"},
  {label:"Netrun Systems",href:"https://www.netrunsystems.com"}
];

var style=document.createElement("style");
style.setAttribute("data-support-panel","1");
style.textContent=\`
#ncms-support-root{
  --sp-primary:\${CFG.primary};
  --sp-accent:\${CFG.accent};
  font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:14px;line-height:1.5;color:#e5e5e5;z-index:999999;
}
#ncms-sp-btn{
  position:fixed;right:20px;bottom:20px;width:44px;height:44px;
  border-radius:50%;background:var(--sp-primary);color:#0a0a0a;
  border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);
  display:flex;align-items:center;justify-content:center;
  transition:transform .2s;z-index:999999;font-size:18px;font-weight:700;
}
#ncms-sp-btn:hover{transform:scale(1.1)}
#ncms-sp-panel{
  position:fixed;right:20px;bottom:76px;width:340px;
  max-height:min(500px,calc(100vh - 100px));
  background:#141414;border:1px solid #2a2a2a;border-radius:10px;
  box-shadow:0 8px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;
  overflow:hidden;transform:translateY(12px);opacity:0;pointer-events:none;
  transition:transform .25s ease,opacity .25s ease;z-index:999998;
}
#ncms-sp-panel.open{transform:translateY(0);opacity:1;pointer-events:auto}
.sp-hdr{display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;background:#1c1c1c;border-bottom:1px solid #2a2a2a;flex-shrink:0}
.sp-hdr h3{margin:0;font-size:14px;font-weight:600;color:#e5e5e5}
.sp-x{background:none;border:none;color:#a3a3a3;cursor:pointer;font-size:18px;padding:4px 8px;border-radius:4px}
.sp-x:hover{background:#2a2a2a;color:#e5e5e5}
.sp-tabs{display:flex;border-bottom:1px solid #2a2a2a;flex-shrink:0}
.sp-tab{flex:1;padding:7px;font-size:11px;text-align:center;background:none;border:none;
  cursor:pointer;color:#737373;border-bottom:2px solid transparent;transition:color .15s}
.sp-tab:hover{color:#a3a3a3}
.sp-tab.active{color:\${CFG.primary};border-bottom-color:\${CFG.primary};font-weight:600}
.sp-body{flex:1;overflow-y:auto;padding:14px}
.sp-body::-webkit-scrollbar{width:4px}
.sp-body::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
.sp-greeting{font-size:14px;font-weight:600;color:#e5e5e5;margin:0 0 4px}
.sp-sub{color:#737373;margin:0 0 14px;font-size:12px}
.sp-links{display:flex;flex-direction:column;gap:5px}
.sp-lnk{display:block;padding:9px 12px;border:1px solid #2a2a2a;border-radius:6px;
  color:#a3a3a3;font-size:12px;transition:border-color .15s,color .15s;text-decoration:none}
.sp-lnk:hover{border-color:\${CFG.primary};color:#e5e5e5}
.sp-tut{border:1px solid #2a2a2a;border-radius:6px;margin-bottom:6px;overflow:hidden}
.sp-tut-title{padding:9px 12px;font-size:12px;font-weight:600;color:#e5e5e5;
  cursor:pointer;background:#1c1c1c;transition:background .15s}
.sp-tut-title:hover{background:#222}
.sp-tut-steps{padding:6px 12px;display:none}
.sp-tut-steps.open{display:block}
.sp-tut-step{font-size:11px;color:#a3a3a3;padding:3px 0 3px 16px;position:relative}
.sp-tut-step::before{content:counter(step);counter-increment:step;
  position:absolute;left:0;color:\${CFG.primary};font-weight:600;font-size:10px}
.sp-tut-steps{counter-reset:step}
.sp-shortcut{display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1c1c1c}
.sp-shortcut:last-child{border-bottom:none}
.sp-key{font-family:'Consolas','Courier New',monospace;font-size:11px;color:\${CFG.primary};
  background:#1c1c1c;padding:2px 6px;border-radius:3px;border:1px solid #2a2a2a;min-width:50px;text-align:center}
.sp-kdesc{font-size:11px;color:#a3a3a3}
\`;
document.head.appendChild(style);

var root=document.createElement("div");root.id="ncms-support-root";
var isOpen=false;

var btn=document.createElement("button");btn.id="ncms-sp-btn";
btn.setAttribute("aria-label","Open help panel");btn.textContent="?";
btn.onclick=function(){isOpen=!isOpen;panel.classList.toggle("open",isOpen)};

var panel=document.createElement("div");panel.id="ncms-sp-panel";

var hdr=document.createElement("div");hdr.className="sp-hdr";
var h3=document.createElement("h3");h3.textContent=CFG.title;hdr.appendChild(h3);
var xBtn=document.createElement("button");xBtn.className="sp-x";xBtn.innerHTML="&times;";
xBtn.onclick=function(){isOpen=false;panel.classList.remove("open")};hdr.appendChild(xBtn);
panel.appendChild(hdr);

var tabs=document.createElement("div");tabs.className="sp-tabs";
var currentTab="home";
["home","tutorials","shortcuts"].forEach(function(t){
  var tab=document.createElement("button");tab.className="sp-tab"+(t==="home"?" active":"");
  tab.textContent=t==="home"?"Home":t==="tutorials"?"Tutorials":"Keys";tab.dataset.tab=t;
  tab.onclick=function(){currentTab=t;renderBody();
    tabs.querySelectorAll(".sp-tab").forEach(function(el){el.classList.toggle("active",el.dataset.tab===t)})};
  tabs.appendChild(tab);
});
panel.appendChild(tabs);

var body=document.createElement("div");body.className="sp-body";body.id="sp-body";
panel.appendChild(body);

function renderBody(){
  body.innerHTML="";
  if(currentTab==="home"){
    var g=document.createElement("p");g.className="sp-greeting";g.textContent=CFG.greeting;body.appendChild(g);
    var s=document.createElement("p");s.className="sp-sub";s.textContent="Browse help topics or follow a tutorial.";body.appendChild(s);
    var links=document.createElement("div");links.className="sp-links";
    DOC_LINKS.forEach(function(d){
      var a=document.createElement("a");a.className="sp-lnk";
      if(d.action==="help"){a.href="#";a.onclick=function(e){e.preventDefault();window.dispatchEvent(new KeyboardEvent("keydown",{key:"?"}))}}
      else{a.href=d.href;a.target="_blank";a.rel="noopener"}
      a.textContent=d.label;links.appendChild(a);
    });
    body.appendChild(links);
  } else if(currentTab==="tutorials"){
    TUTORIALS.forEach(function(t){
      var tut=document.createElement("div");tut.className="sp-tut";
      var title=document.createElement("div");title.className="sp-tut-title";title.textContent=t.title;
      var steps=document.createElement("div");steps.className="sp-tut-steps";
      t.steps.forEach(function(s){var step=document.createElement("div");step.className="sp-tut-step";step.textContent=s;steps.appendChild(step)});
      title.onclick=function(){steps.classList.toggle("open")};
      tut.appendChild(title);tut.appendChild(steps);body.appendChild(tut);
    });
  } else if(currentTab==="shortcuts"){
    SHORTCUTS.forEach(function(s){
      var row=document.createElement("div");row.className="sp-shortcut";
      var key=document.createElement("span");key.className="sp-key";key.textContent=s.key;
      var desc=document.createElement("span");desc.className="sp-kdesc";desc.textContent=s.desc;
      row.appendChild(key);row.appendChild(desc);body.appendChild(row);
    });
  }
}
renderBody();

root.appendChild(btn);root.appendChild(panel);document.body.appendChild(root);
})();`;
}
