(() => {
  const API = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://127.0.0.1:5000/api' : '/api';
  const mapWrap = document.querySelector('.map-wrap');
  const messages = document.getElementById('messages');
  const input = document.getElementById('chatInput');
  const send = document.getElementById('send');
  if (!mapWrap || !messages || !input || !send) return;
  const fallback = [{name:'Connaught Place',vehicles:134,level:'HIGH',lat:28.6328,lng:77.2197},{name:'India Gate',vehicles:153,level:'HIGH',lat:28.6129,lng:77.2295},{name:'Dhaula Kuan',vehicles:210,level:'SEVERE',lat:28.5918,lng:77.1616}];
  const overlay = document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.classList.add('traffic-network-overlay'); overlay.setAttribute('viewBox','0 0 1000 700');
  const legend = document.createElement('div'); legend.className='traffic-map-legend'; legend.innerHTML='<b>TRAFFIC</b><br><i class="green"></i>Normal <i class="yellow"></i>Moderate<br><i class="orange"></i>Heavy <i class="red"></i>Severe';
  mapWrap.append(overlay, legend);
  let traffic = fallback; let paths=[]; let raf=0; let start=performance.now();
  const levelClass = (item) => item.level.toLowerCase();
  const drawNetwork = () => {
    overlay.replaceChildren(); paths=[];
    const routes=[[120,170,430,300,760,180],[120,170,420,500,760,540],[430,300,760,180,900,350],[420,500,760,540,900,350],[430,300,420,500]];
    routes.forEach((route,index)=>{const d=`M ${route[0]} ${route[1]} C ${route[2]} ${route[3]} ${route[2]} ${route[3]} ${route[4]} ${route[5]}`; const base=document.createElementNS('http://www.w3.org/2000/svg','path');base.setAttribute('d',d);base.classList.add('traffic-road-base');overlay.appendChild(base);const road=document.createElementNS('http://www.w3.org/2000/svg','path');road.setAttribute('d',d);road.classList.add('traffic-road',levelClass(traffic[index%traffic.length]));overlay.appendChild(road);paths.push({d,level:traffic[index%traffic.length].level});});
  };
  const animate=now=>{const t=(now-start)/1000;const roadPaths=overlay.querySelectorAll('path');overlay.querySelectorAll('.traffic-vehicle').forEach((dot,index)=>{const p=paths[index%paths.length];const len=roadPaths[index%Math.max(1,roadPaths.length)];if(!len||!p)return;const total=len.getTotalLength();if(!Number.isFinite(total)||total<=0)return;const distance=(t*(p.level==='SEVERE'?18:p.level==='HIGH'?28:42)+index*75)%total;const point=len.getPointAtLength(Number.isFinite(distance)?distance:0);dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);});raf=requestAnimationFrame(animate);};
  const addVehicles=()=>{overlay.querySelectorAll('.traffic-vehicle').forEach(x=>x.remove());for(let i=0;i<Math.min(18,traffic.reduce((n,x)=>n+Math.ceil(x.vehicles/45),0));i++){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r',i%7===0?'5':'3');c.classList.add('traffic-vehicle');if(i===0)c.classList.add('emergency');overlay.appendChild(c);}};
  const render=()=>{drawNetwork();addVehicles();if(!raf)raf=requestAnimationFrame(animate);};
  const fetchTraffic=async()=>{try{const response=await fetch(`${API}/traffic-status?mode=ai`);if(!response.ok)throw Error('traffic unavailable');const data=await response.json();traffic=data.junctions.map(j=>{const vehicles=Object.values(j.densities||{}).reduce((a,b)=>a+Number(b),0);return {...j,vehicles,level:vehicles>=190?'SEVERE':vehicles>=130?'HIGH':vehicles>=90?'MODERATE':'LOW'};});}catch{traffic=fallback;}render();};
  const addMessage=(who,text,typing=false)=>{const el=document.createElement('div');el.className=`assistant-msg${typing?' tarrid-typing':''}`;el.innerHTML=`<b>${who}</b><br>${text}`;messages.appendChild(el);messages.parentElement.scrollTop=messages.parentElement.scrollHeight;return el;};
  const ask=async()=>{const text=input.value.trim();if(!text||send.disabled)return;input.value='';send.disabled=true;addMessage('You',text);const typing=addMessage('Tarrid AI','Live traffic data check kar raha hoon…',true);try{const response=await fetch(`${API}/ai/traffic`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});if(!response.ok)throw Error('assistant unavailable');const data=await response.json();typing.remove();addMessage('Tarrid AI',data.response);}catch{typing.remove();addMessage('Tarrid AI','Live traffic service temporarily unavailable. Demo traffic data map par visible hai.');}finally{send.disabled=false;}};
  send.onclick=ask;input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}};document.querySelectorAll('.suggestion').forEach(button=>{button.onclick=()=>{input.value=button.textContent;ask();};});
  document.querySelectorAll('.module-card').forEach((card,index)=>card.addEventListener('click',()=>{const item=traffic[index%traffic.length];if(window.trafficMap&&item?.lat)window.trafficMap.setView([item.lat,item.lng],13,{animate:true});}));
  fetchTraffic();setInterval(fetchTraffic,5000);
})();
