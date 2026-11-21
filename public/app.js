const academy=[
 ['01','bi-globe2','Web Security','Examine web applications, browser controls and common attack classes.'],
 ['02','bi-diagram-3','Network Security','Map traffic, boundaries and defensive network architecture.'],
 ['03','bi-bug','Malware','Understand payload behavior, indicators and containment.'],
 ['04','bi-person-raised-hand','Social Engineering','Trace manipulation tactics and human-aware defenses.'],
 ['05','bi-shield-check','Data Protection','Protect confidentiality, integrity and availability.'],
 ['06','bi-search','Vulnerability Research','Discover, validate and responsibly report weaknesses.']
];
document.getElementById('academyCards').innerHTML=academy.map(a=>`<div class="col-md-6 col-lg-4"><article class="academy-card"><div class="icon"><i class="bi ${a[1]}"></i></div><span>${a[0]} / FIELD GUIDE</span><h3>${a[2]}</h3><p>${a[3]}</p><i class="bi bi-arrow-up-right"></i></article></div>`).join('');

for(let i=0;i<28;i++){const p=document.createElement('span');p.className='particle';p.style.left=Math.random()*100+'%';p.style.animationDelay=(-Math.random()*12)+'s';p.style.opacity=.2+Math.random()*.6;document.getElementById('particles').appendChild(p)}
const termLines=['> initializing global trace','> 68 nodes synchronized','> anomaly signatures: 12','> threat level: elevated','> awaiting analyst input'];let li=0;setInterval(()=>{if(li<termLines.length){const el=document.createElement('div');el.textContent=termLines[li++];document.querySelector('#termLines').appendChild(el)}},850);

const counterObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const el=e.target;const target=+el.dataset.count;let n=0;const step=Math.max(1,Math.ceil(target/45));const tick=()=>{n=Math.min(target,n+step);el.textContent=n.toLocaleString();if(n<target)requestAnimationFrame(tick)};tick();counterObserver.unobserve(el)}}),{threshold:.6});document.querySelectorAll('[data-count]').forEach(el=>counterObserver.observe(el));

async function loadIncidents(){
  const search=incidentSearch.value||'';
  const sector=sectorFilter.value||'';
  document.getElementById('incidentRows').innerHTML='<div class="incident-loading"><span></span> Tracing records...</div>';
  try{
    const r=await fetch(`/api/incidents?search=${encodeURIComponent(search)}&sector=${encodeURIComponent(sector)}`);
    const incidents=await r.json();
    document.getElementById('incidentRows').innerHTML=incidents.map(i=>`<div class="incident-row"><div class="incident-name"><a href="${i.source}" target="_blank" rel="noopener"><b>${i.title}</b></a><small>${i.organization}</small></div><span>${i.year}</span><span class="sector-tag">${i.sector}</span><span class="severity ${i.severity}">${i.severity}</span><button class="save-incident" data-id="${i.id}" title="Save incident"><i class="bi bi-bookmark"></i></button></div>`).join('')||'<div class="incident-empty"><i class="bi bi-search"></i><span>No incidents matched this trace.</span></div>';
  }catch(e){document.getElementById('incidentRows').innerHTML='<div class="incident-empty">The archive could not be reached.</div>'}
}
const incidentSearch=document.getElementById('incidentSearch'),sectorFilter=document.getElementById('sectorFilter');incidentSearch.addEventListener('input',loadIncidents);sectorFilter.addEventListener('change',loadIncidents);loadIncidents();

document.addEventListener('click',async e=>{const save=e.target.closest('.save-incident');if(save){const r=await fetch(`/api/incidents/${save.dataset.id}/save`,{method:'POST'});if(r.status===401)return openAuth('signup');save.classList.add('saved');save.innerHTML='<i class="bi bi-bookmark-fill"></i>'}});

const authModal=new bootstrap.Modal(document.getElementById('authModal'));let authMode='signup';
const authSubmit=document.getElementById('authSubmit');
let originalAuthSubmit=authSubmit.innerHTML;
function openAuth(mode){setAuthMode(mode);authModal.show()}
function setAuthMode(mode){authMode=mode;document.getElementById('nameField').classList.toggle('d-none',mode==='login');document.getElementById('authTitle').textContent=mode==='login'?'Welcome back.':'Create your trace.';document.getElementById('authSubtitle').textContent=mode==='login'?'Continue your cybersecurity journey.':'Join the global learning network.';authSubmit.innerHTML=(mode==='login'?'Log in':'Create account')+' <i class="bi bi-arrow-right"></i>';originalAuthSubmit=authSubmit.innerHTML;document.getElementById('authSwitch').innerHTML=mode==='login'?'New to CYBERTRACE? <button type="button" data-switch-auth="signup">Create an account</button>':'Already have an account? <button type="button" data-switch-auth="login">Log in</button>';document.getElementById('authError').textContent='';}
document.querySelectorAll('[data-auth]').forEach(b=>b.addEventListener('click',()=>openAuth(b.dataset.auth)));
document.getElementById('authSwitch').addEventListener('click',e=>{const button=e.target.closest('[data-switch-auth]');if(button)setAuthMode(button.dataset.switchAuth)});
document.getElementById('authForm').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);const payload={name:form.get('name'),email:form.get('email'),password:form.get('password')};const submittingMode=authMode;try{const r=await fetch(`/api/auth/${submittingMode==='signup'?'signup':'login'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});let data={};try{data=await r.json()}catch(error){throw new Error(`Server responded with HTTP ${r.status}.`)}if(!r.ok){document.getElementById('authError').textContent=data.error||`Request failed (${r.status}).`;showToast(data.error||'Authentication request failed');return}document.getElementById('authError').textContent='';if(submittingMode==='signup'&&data.created){try{await fetch('http://localhost:8080/php/signup.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:payload.name,email:payload.email})})}catch(error){console.warn('PHP name/email database is unavailable:',error)}setAuthMode('login');form.reset();document.querySelector('#authForm input[name="email"]').value=data.email;showToast('Account created! Now log in to enter.');return}authModal.hide();applyUser(data.user);if(data.user.mustChangePassword){const newPassword=prompt('Your password was reset. Enter a new password (minimum 8 characters):');if(newPassword&&newPassword.length>=8){const change=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:newPassword})});if(change.ok)showToast('Password changed successfully.')}else showToast('Temporary password must be replaced.')}else showToast('Welcome back, analyst.')}catch(error){const message=error instanceof TypeError?'CYBERTRACE is not reachable. Start the server with npm start on port 3000.':error.message||'Could not reach CYBERTRACE.';document.getElementById('authError').textContent=message;showToast(message)}finally{authSubmit.disabled=false;authSubmit.innerHTML=originalAuthSubmit}}

async function handleGoogleCredential(response){const r=await fetch('/api/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential})});const data=await r.json();if(!r.ok){document.getElementById('authError').textContent=data.error;return}document.getElementById('authError').textContent='';authModal.hide();applyUser(data.user)}
async function setupGoogleSignIn(){const config=await fetch('/api/auth/google/config').then(r=>r.json());if(!config.clientId){document.getElementById('googleButton').addEventListener('click',()=>{document.getElementById('authError').textContent='Google sign-in needs GOOGLE_CLIENT_ID configured by the server.'});return}const gis=document.createElement('script');gis.src='https://accounts.google.com/gsi/client';gis.onload=()=>{google.accounts.id.initialize({client_id:config.clientId,callback:handleGoogleCredential});document.getElementById('googleButton').addEventListener('click',()=>google.accounts.id.prompt())};document.head.appendChild(gis)}
setupGoogleSignIn();

const dashboard=new bootstrap.Offcanvas(document.getElementById('dashboardPanel'));async function applyUser(user){if(!user)return;document.querySelector('[data-auth="login"].btn-link-ct')?.classList.add('d-none');const btn=document.getElementById('accountBtn');btn.classList.remove('d-none');btn.textContent=user.name.split(' ')[0];btn.onclick=()=>openDashboard();document.querySelectorAll('[data-auth="login"]').forEach(b=>b.classList.add('d-none'));document.querySelectorAll('[data-auth="signup"]').forEach(b=>b.textContent=b.id==='challengeBtn'?b.textContent:'Sign up')}
async function refreshUser(){const r=await fetch('/api/auth/me');const d=await r.json();if(d.user)applyUser(d.user)}async function openDashboard(){const r=await fetch('/api/dashboard');if(r.status===401)return openAuth('login');const d=await r.json();document.getElementById('dashName').textContent=d.user.name;document.getElementById('dashInitial').textContent=d.user.name[0];document.getElementById('dashXP').textContent=d.user.xp;document.getElementById('dashStreak').textContent=d.user.streak;document.getElementById('dashProgress').innerHTML=d.progress.length?d.progress.map(p=>`<div class="progress-row"><span>${p.lab_id}</span><b>${p.score}%</b></div>`).join(''):'<div class="progress-row"><span>No labs completed</span></div>';const ctx=document.getElementById('progressChart');if(window.ctChart)window.ctChart.destroy();window.ctChart=new Chart(ctx,{type:'doughnut',data:{labels:['Completed','Remaining'],datasets:[{data:[d.progress.length,5-d.progress.length,],backgroundColor:['#a3f36b','#263548'],borderWidth:0}]},options:{cutout:'78%',plugins:{legend:{display:false}}}});dashboard.show();if(d.user.role==='admin'){document.getElementById('logoutBtn').insertAdjacentHTML('beforebegin','<button class="btn-ct-outline w-100 mb-2" id="adminBtn">Administrator panel</button>');document.getElementById('adminBtn').addEventListener('click',()=>showAdmin())}}
document.getElementById('accountBtn').addEventListener('click',openDashboard);
document.getElementById('logoutBtn').addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST'});location.reload()});
async function showAdmin(search=''){
  const [statsRes,usersRes,kaliRes]=await Promise.all([fetch('/api/admin/stats'),fetch('/api/admin/users'+(search?'?search='+encodeURIComponent(search):'')),fetch('/api/admin/kali/environments')]);
  if(!statsRes.ok||!usersRes.ok)return;
  const d=await statsRes.json(); const users=await usersRes.json();const kali=kaliRes.ok?await kaliRes.json():{configured:false,environments:[]};
  document.getElementById('dashProgress').innerHTML=`
    <div class="admin-search"><input id="adminUserSearch" type="search" placeholder="Search name or email"><i class="bi bi-search"></i></div>
    <div class="admin-stat-grid"><div><strong>${d.users}</strong><span>Total users</span></div><div><strong>${d.admins}</strong><span>Admins</span></div><div><strong>${d.active}</strong><span>Active</span></div><div><strong>${d.suspended}</strong><span>Suspended</span></div><div><strong>${d.today}</strong><span>New today</span></div></div>
    <h6>REGISTERED ACCOUNTS · NEWEST FIRST</h6>
    <div class="admin-users">${users.length?users.map(u=>`<article class="admin-user" data-user-id="${u.id}"><div class="admin-user-main"><span class="admin-avatar">${escapeHtml(u.name[0].toUpperCase())}</span><div><b>${escapeHtml(u.name)}</b><small>${escapeHtml(u.email)}</small></div></div><div class="admin-user-meta"><span class="status-dot ${u.status==='suspended'?'suspended':''}">${u.status||'active'}</span><span>${u.role==='admin'?'Admin':'User'}</span></div><div class="admin-user-dates"><span>Registered</span><b>${formatDate(u.created_at)}</b><span>Last login</span><b>${u.last_login?formatDate(u.last_login):'Never'}</b></div><div class="admin-actions"><button data-action="profile">Profile</button><button data-action="role">${u.role==='admin'?'Make user':'Make admin'}</button><button data-action="status">${u.status==='suspended'?'Reactivate':'Suspend'}</button><button data-action="reset">Reset</button><button class="danger" data-action="delete">Delete</button></div></article>`).join(''):'<div class="admin-empty">No accounts matched this search.</div>'}
    <h6 class="mt-4">KALI LINUX INFRASTRUCTURE</h6>
    <div class="admin-kali"><p>${kali.configured?'Provider connected':'Provider not configured — real VM infrastructure is unavailable'}</p><div>${kali.environments.length?kali.environments.map(e=>`<article class="kali-admin-row"><div><b>${escapeHtml(e.name)}</b><small>${escapeHtml(e.email)}</small></div><span>${escapeHtml(e.status||'unavailable')}</span><b>${e.cpu_limit?e.cpu_limit+' CPU':''} ${e.memory_limit_mb?e.memory_limit_mb+' MB':''}</b><button data-kali-admin-action="stop" data-kali-user="${e.user_id}">Stop</button><button data-kali-admin-action="reset" data-kali-user="${e.user_id}">Reset</button></article>`).join(''):'<span>No private Kali environments provisioned.</span>'}</div></div>
    `;
  const searchInput=document.getElementById('adminUserSearch'); if(searchInput){searchInput.value=search;searchInput.addEventListener('input',()=>{clearTimeout(window.adminSearchTimer);window.adminSearchTimer=setTimeout(()=>showAdmin(searchInput.value.trim()),300)})}
}
function escapeHtml(value){const div=document.createElement('div');div.textContent=String(value);return div.innerHTML}
function formatDate(value){if(!value)return 'Never';const date=new Date(String(value).replace(' ','T')+'Z');return Number.isNaN(date.getTime())?'Unknown':date.toLocaleString()}
refreshUser();
async function authGate(){try{const r=await fetch('/api/auth/me');const d=await r.json();if(d.user){applyUser(d.user)}else{openAuth('signup')}}catch(error){openAuth('signup');showToast('Unable to confirm login status. Check the server connection.')}}
authGate();
const togglePassword=document.getElementById('togglePassword');
if(togglePassword){togglePassword.addEventListener('click',()=>{const input=document.querySelector('#authForm input[name="password"]');const showing=input.type==='text';input.type=showing?'password':'text';togglePassword.innerHTML=`<i class="bi bi-${showing?'eye':'eye-slash'}"></i>`;togglePassword.setAttribute('aria-label',showing?'Show password':'Hide password')})}

const ctToast=document.getElementById('ctToast');
let toastTimer;
function showToast(message){if(!ctToast)return;ctToast.querySelector('span').textContent=message;ctToast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ctToast.classList.remove('show'),2600)}

document.addEventListener('click',async event=>{
  const button=event.target.closest('.admin-actions button'); if(!button)return;
  const card=button.closest('.admin-user'); const id=card.dataset.userId; const action=button.dataset.action;
  if(action==='profile'){
    const res=await fetch('/api/admin/users/'+id); if(!res.ok)return showToast('Could not load profile'); const u=await res.json();
    card.innerHTML=`<div class="admin-profile"><button class="profile-back" data-action="back">← Back to accounts</button><h6>User profile</h6><div class="profile-grid"><div><span>Name</span><b>${escapeHtml(u.name)}</b></div><div><span>Email</span><b>${escapeHtml(u.email)}</b></div><div><span>Role</span><b>${u.role}</b></div><div><span>Status</span><b>${u.status||'active'}</b></div><div><span>Registered</span><b>${formatDate(u.created_at)}</b></div><div><span>Last login</span><b>${u.last_login?formatDate(u.last_login):'Never'}</b></div></div></div>`;
  }else if(action==='role'){
    const role=card.querySelector('[data-action="role"]').textContent.includes('Make admin')?'admin':'member';
    const res=await fetch('/api/admin/users/'+id+'/role',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})}); const d=await res.json(); if(!res.ok)return showToast(d.error||'Could not change role');showToast('User role updated');showAdmin(document.getElementById('adminUserSearch')?.value||'');
  }else if(action==='status'){
    const status=card.querySelector('[data-action="status"]').textContent.includes('Reactivate')?'active':'suspended';
    const res=await fetch('/api/admin/users/'+id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); const d=await res.json(); if(!res.ok)return showToast(d.error||'Could not update status');showToast(status==='suspended'?'Account suspended':'Account reactivated');showAdmin(document.getElementById('adminUserSearch')?.value||'');
  }else if(action==='reset'){
    if(!confirm('Generate a one-time temporary password for this user?'))return;
    const res=await fetch('/api/admin/users/'+id+'/reset-password',{method:'POST'});const d=await res.json();if(!res.ok)return showToast(d.error||'Could not reset password');prompt('One-time temporary password. Copy it securely now:',d.temporaryPassword);
  }else if(action==='delete'){
    if(!confirm('Permanently delete this account and its progress?'))return;
    const res=await fetch('/api/admin/users/'+id,{method:'DELETE'});const d=await res.json();if(!res.ok)return showToast(d.error||'Could not delete account');showToast('Account deleted');showAdmin(document.getElementById('adminUserSearch')?.value||'');
  }
});
document.addEventListener('click',event=>{if(event.target.closest('.profile-back'))showAdmin(document.getElementById('adminUserSearch')?.value||'')});
setInterval(()=>{const panel=document.getElementById('dashboardPanel');if(panel&&panel.classList.contains('show')&&document.querySelector('.admin-users'))showAdmin(document.getElementById('adminUserSearch')?.value||'')},15000);

const labState={scenario:'xss',step:1,completed:false,history:[]};
const labScenarios={
  xss:{target:'XSS-LAB-01',prompt:'root@cybertrace:~/xss-lab',title:'XSS Defense',tag:'DEFENSE MODULE / CROSS-SITE SCRIPTING',steps:[
    {objective:'List the project files',hint:'Use: ls',command:'ls',message:'app.js  index.html  security  server.log'},
    {objective:'Find dangerous DOM rendering',hint:'Search for user input sinks: grep innerHTML app.js',command:'grep innerHTML app.js',message:'app.js:42  output.innerHTML = userComment;\n[!] User-controlled HTML is rendered directly.'},
    {objective:'Inspect the payload logged on the server',hint:'Read the attack log: cat server.log',command:'cat server.log',message:'PAYLOAD: <img src=x onerror=alert(\'XSS\')>\nEVENT: script executed in victim context\nRISK: session theft, UI manipulation, data exfiltration'},
    {objective:'Identify the correct defense',hint:'Type: explain xss',command:'explain xss',message:'Stored or reflected XSS happens when untrusted text becomes executable HTML.\nDefenses: context-aware output encoding, DOM text APIs, CSP, and input validation.'},
    {objective:'Search for the secure text API',hint:'Try: grep textContent security/*.js',command:'grep textcontent security/*.js',message:'security/sanitize.js: textContent escapes markup and renders user input as plain text.'},
    {objective:'Apply the XSS defense',hint:'Run: patch textcontent',command:'patch textcontent',message:'PATCHED: output.innerHTML -> output.textContent\nCSP reminder: script-src self and disable unsafe-inline.'},
    {objective:'Verify the incident is blocked',hint:'Run: test xss',command:'test xss',message:'[PASS] Payload rendered as text\n[PASS] No script execution\n[PASS] No inline HTML sink detected\nXSS defense confirmed.'}
  ]},
  sql:{target:'SQLI-LAB-02',prompt:'root@cybertrace:~/sqli-lab',title:'SQL Injection Defense',tag:'DEFENSE MODULE / DATABASE',steps:[
    {objective:'Inspect the vulnerable query',hint:'Use: cat database.js',command:'cat database.js',message:'query = "SELECT * FROM users WHERE email = \'" + email + "\'";\n[!] String concatenation creates an injection path.'},
    {objective:'View the malicious input',hint:'Use: cat payload.txt',command:'cat payload.txt',message:"' OR '1'='1 --"},
    {objective:'Observe why it works',hint:'Run: explain sql',command:'explain sql',message:'The attacker input changes the SQL structure. The database receives logic instead of only a literal email value.'},
    {objective:'Find the parameterized query',hint:'Use: grep prepare security/*.js',command:'grep prepare security/*.js',message:'security/database.js: db.prepare("SELECT * FROM users WHERE email=?")'},
    {objective:'Apply parameter binding',hint:'Run: patch prepared_statement',command:'patch prepared_statement',message:'PATCHED: user input is bound as data, never concatenated into SQL syntax.'},
    {objective:'Verify the defense',hint:'Run: test sql',command:'test sql',message:'[PASS] Injection payload rejected as data\n[PASS] Prepared statement executed\n[PASS] Unauthorized rows were not returned'}
  ]},
  password:{target:'AUTH-LAB-03',prompt:'root@cybertrace:~/auth-lab',title:'Password Hardening',tag:'DEFENSE MODULE / AUTHENTICATION',steps:[
    {objective:'Inspect password storage',hint:'Use: cat auth.js',command:'cat auth.js',message:'CREATE: password_hash = plainTextPassword;\n[!] Plaintext passwords are stored directly.'},
    {objective:'Explain the risk',hint:'Run: explain hashing',command:'explain hashing',message:'Database exposure must not reveal reusable passwords. Hash with bcrypt or Argon2 and use a unique random salt.'},
    {objective:'Find the secure implementation',hint:'Use: grep bcrypt security/*.js',command:'grep bcrypt security/*.js',message:'security/auth.js: bcrypt.hash(password, 12)\nsecurity/auth.js: bcrypt.compare(password, hash)'},
    {objective:'Apply secure hashing',hint:'Run: patch bcrypt',command:'patch bcrypt',message:'PATCHED: plaintext storage removed. Password is hashed with a unique salt.'},
    {objective:'Verify authentication',hint:'Run: test auth',command:'test auth',message:'[PASS] Password hash is non-reversible\n[PASS] Login comparison succeeds\n[PASS] Wrong password rejected'}
  ]},
  permissions:{target:'PERM-LAB-04',prompt:'root@cybertrace:~/perm-lab',title:'File Permission Defense',tag:'DEFENSE MODULE / SYSTEM HARDENING',steps:[
    {objective:'Inspect file permissions',hint:'Use: ls -l',command:'ls -l',message:'-rwxrwxrwx secrets.env\n-rw-r--r-- app.js\n[!] Secrets are readable and writable by everyone.'},
    {objective:'Identify the exposed secret',hint:'Use: cat secrets.env',command:'cat secrets.env',message:'DATABASE_URL=postgres://admin:demo-pass@localhost/app\nAPI_KEY=training-key-redacted'},
    {objective:'Explain least privilege',hint:'Run: explain permissions',command:'explain permissions',message:'Users receive only the permissions needed for their role. Secret files should be accessible only to the application account.'},
    {objective:'Restrict the secret file',hint:'Run: chmod 600 secrets.env',command:'chmod 600 secrets.env',message:'-rw------- secrets.env\nOwner: read/write only.'},
    {objective:'Verify permissions',hint:'Run: test permissions',command:'test permissions',message:'[PASS] Other users cannot read secrets.env\n[PASS] Secret file uses owner-only access'}
  ]}
};
function escapeLabText(text){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
const terminalScreen=document.getElementById('terminalScreen');
const terminalForm=document.getElementById('terminalForm');
const terminalCommand=document.getElementById('terminalCommand');
function addTerminalLine(text,type='output'){const line=document.createElement('div');line.className=`terminal-line ${type}`;line.textContent=text;terminalScreen.appendChild(line);terminalScreen.scrollTop=terminalScreen.scrollHeight}
function renderLab(){const scenario=labScenarios[labState.scenario];document.getElementById('targetName').textContent=scenario.target;document.getElementById('terminalPromptLabel').textContent=scenario.prompt;document.getElementById('scenarioTag').textContent=scenario.tag;document.getElementById('missionTitle').textContent=scenario.title;updateLabStep(labState.step);terminalScreen.innerHTML=`<div class="terminal-line welcome">CYBERTRACE // ${escapeLabText(scenario.title.toUpperCase())}</div><div class="terminal-line">[SESSION] ${escapeLabText(scenario.target)} isolated sandbox active.</div><div class="terminal-line">Type <b>help</b>, <b>hint</b>, or begin with the next objective.</div>`}
function updateLabStep(step){labState.step=step;const scenario=labScenarios[labState.scenario];const item=scenario.steps[step-1];document.getElementById('labProgressLabel').textContent=`STEP ${step} / ${scenario.steps.length}`;document.getElementById('missionText').textContent=item?item.objective:'';document.getElementById('objectiveText').textContent=item?item.objective:'Scenario complete';document.getElementById('hintCopy').classList.add('d-none');document.getElementById('labHint').innerHTML='<i class="bi bi-lightbulb"></i> Reveal hint';document.getElementById('missionSteps').innerHTML=scenario.steps.map((stepItem,index)=>`<button class="${index+1<step?'done':index+1===step?'active':''}" data-mission-step="${index+1}"><b>${String(index+1).padStart(2,'0')}</b><span>${escapeLabText(stepItem.objective)}</span></button>`).join('')}
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{labState.scenario=button.dataset.scenario;labState.step=1;labState.completed=false;document.querySelectorAll('[data-scenario]').forEach(item=>item.classList.toggle('active',item===button));renderLab()}));
document.getElementById('labHint').addEventListener('click',()=>{const hint=document.getElementById('hintCopy');const scenario=labScenarios[labState.scenario];hint.textContent=scenario.steps[labState.step-1].hint;hint.classList.toggle('d-none')});
document.getElementById('resetLab').addEventListener('click',()=>{labState.step=1;labState.completed=false;renderLab();addTerminalLine('[RESET] Scenario restored to step 1.','success')});
terminalForm.onsubmit=async event=>{event.preventDefault();const raw=terminalCommand.value.trim();if(!raw)return;labState.history.push(raw);commandHistoryIndex=labState.history.length;addTerminalLine(`root@cybertrace:~$ ${raw}`,'command');terminalCommand.value='';const normalized=raw.toLowerCase().replace(/\s+/g,' ').trim();
  if(normalized==='help'){addTerminalLine('SAFE COMMANDS: help · ls · cat <file> · grep <text> <file> · curl <url> · explain <topic> · patch <defense> · test <module> · clear · hint');return}
  if(normalized==='hint'){const item=labScenarios[labState.scenario].steps[labState.step-1];addTerminalLine(item.hint,'success');return}
  if(normalized==='clear'){terminalScreen.innerHTML='';return}
  if(normalized==='whoami'){addTerminalLine('root (isolated simulator account)');return}
  if(normalized==='pwd'){addTerminalLine(labScenarios[labState.scenario].prompt.replace('root@cybertrace:','/home/cybertrace/'));return}
  if(normalized==='id'){addTerminalLine('uid=1000(root) gid=1000(root) groups=1000(root),cybertrace-sim');return}
  if(normalized==='date'){addTerminalLine(new Date().toLocaleString());return}
  if(normalized==='neofetch'){addTerminalLine('CYBERTRACE TRAINING OS\n-------------------------\nKernel: Browser Terminal 1.0\nShell: ct-sh\nEnvironment: Isolated Sandbox\nSecurity: No real system access');return}
  if(normalized.startsWith('echo ')){addTerminalLine(raw.slice(5));return}
  const scenario=labScenarios[labState.scenario];const item=scenario.steps[labState.step-1];
  if(normalized===item.command){addTerminalLine(item.message,'success');if(labState.step<scenario.steps.length){updateLabStep(labState.step+1)}else{labState.completed=true;addTerminalLine(`MODULE COMPLETE — ${scenario.title} defense verified · 50 XP earned`,'complete');try{const response=await fetch('/api/labs/'+labState.scenario+'/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score:100})});if(response.status===401)openAuth('login');else refreshUser()}catch(error){}}return}
  addTerminalLine(`[DENIED] That command is not the next step. Type hint or help for guidance.`,'error')};
let commandHistoryIndex=labState.history.length;
terminalCommand.addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
    event.preventDefault();
    if(!labState.history.length)return;
    if(event.key==='ArrowUp')commandHistoryIndex=Math.max(0,commandHistoryIndex-1);
    else commandHistoryIndex=Math.min(labState.history.length,commandHistoryIndex+1);
    terminalCommand.value=commandHistoryIndex<labState.history.length?labState.history[commandHistoryIndex]:'';
  }
});
renderLab();
(function initializeWorldInterface(){
  const boot=document.getElementById('bootScreen');
  if(boot){
    const progress=document.getElementById('bootProgress');
    const percent=document.getElementById('bootPercent');
    const status=document.getElementById('bootStatus');
    const stages=['VERIFYING NODE','LOADING THREAT GRID','SYNCING INTELLIGENCE','SECURE SESSION READY'];
    let value=0;
    const timer=setInterval(()=>{value=Math.min(100,value+Math.floor(Math.random()*17)+8);if(progress)progress.style.width=value+'%';if(percent)percent.textContent=value+'%';const stage=Math.min(stages.length-1,Math.floor(value/26));if(status)status.textContent=stages[stage];if(value>=100){clearInterval(timer);setTimeout(()=>boot.classList.add('hidden'),280)}},120);
  }
  const orbit=document.getElementById('cursorOrbit');
  if(orbit&&matchMedia('(pointer:fine)').matches){window.addEventListener('mousemove',event=>{orbit.style.left=event.clientX+'px';orbit.style.top=event.clientY+'px'});document.querySelectorAll('a,button,input').forEach(element=>{element.addEventListener('mouseenter',()=>{orbit.style.width='38px';orbit.style.height='38px'});element.addEventListener('mouseleave',()=>{orbit.style.width='24px';orbit.style.height='24px'})})}
  const clock=document.getElementById('navClock');
  function updateClock(){if(clock)clock.textContent=new Date().toISOString().slice(11,19)+'Z'}updateClock();setInterval(updateClock,1000);
  const sections=[...document.querySelectorAll('main section[id]')];
  const navLinks=[...document.querySelectorAll('.navbar-nav a')];
  const sectionObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){navLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${entry.target.id}`))}})},{rootMargin:'-35% 0px -55%',threshold:.01});sections.forEach(section=>sectionObserver.observe(section));
})();

const trainingCategories=[
 {id:'web',icon:'bi-browser-chrome',title:'WEB PENETRATION TESTING',short:'HTTP, web architecture, DNS and the OWASP attack surface.',difficulty:'Beginner → Advanced',missions:['Understand Websites','HTTP Fundamentals','DNS Resolution','Technology Identification','Request Analysis','Local Directory Discovery','Authentication Security','XSS','SQL Injection','CSRF','IDOR','Security Misconfiguration','Vulnerability Reporting','Final Assessment']},
 {id:'network',icon:'bi-diagram-3',title:'NETWORK RECONNAISSANCE',short:'IP addressing, TCP/UDP, ports and local simulated discovery.',difficulty:'Beginner → Advanced',missions:['Network Fundamentals','IP Addressing','TCP and UDP','Port Analysis','DNS Basics','Discovery','Nmap Simulation','Service Identification','Network Diagram']},
 {id:'linux',icon:'bi-terminal',title:'LINUX FUNDAMENTALS',short:'Files, users, permissions, processes and Bash fundamentals.',difficulty:'Beginner',missions:['Terminal Basics','File Management','Users and Groups','Permissions','Processes','System Administration','Bash Fundamentals']},
 {id:'password',icon:'bi-key',title:'PASSWORD SECURITY',short:'Hashing, strength, auditing and rate-limited local testing.',difficulty:'Beginner → Intermediate',missions:['Password Hashing','Hash Identification','Strength Analysis','Sample Hash Audit','Brute-force Concepts','Secure Authentication']},
 {id:'analysis',icon:'bi-radioactive',title:'NETWORK ANALYSIS',short:'Packets, HTTP, DNS, TCP handshakes and suspicious traffic.',difficulty:'Intermediate',missions:['Packet Fundamentals','HTTP Analysis','DNS Traffic','TCP Handshakes','Suspicious Traffic','Log Analysis']},
 {id:'webvuln',icon:'bi-bug',title:'WEB VULNERABILITY TESTING',short:'XSS, SQLi, CSRF, IDOR, SSRF and secure coding labs.',difficulty:'Intermediate → Advanced',missions:['XSS Lab','SQL Injection Lab','CSRF Lab','IDOR Lab','SSRF Concepts','Upload Security','Input Validation','Secure Coding']},
 {id:'forensics',icon:'bi-search',title:'DIGITAL FORENSICS',short:'Log investigation, metadata, hashes and incident timelines.',difficulty:'Intermediate',missions:['Log Investigation','File Metadata','File Hashes','Incident Timeline','Suspicious Files','Evidence Handling']},
 {id:'ctf',icon:'bi-trophy',title:'CTF CHALLENGES',short:'Capture-the-flag missions across three difficulty tiers.',difficulty:'Beginner → Advanced',missions:['Welcome CTF','Metadata Mystery','Hidden Web Route','Log Trail','Privilege Puzzle','Final Vault']}
];

function renderLearningGrid(filter=''){
 const grid=document.getElementById('learningGrid');if(!grid)return;
 const needle=String(filter).trim().toLowerCase();
 grid.innerHTML=trainingCategories.filter(c=>!needle||(`${c.title} ${c.short} ${c.missions.join(' ')}`.toLowerCase().includes(needle))).map(c=>`<article class="learning-card"><div class="learning-card-head"><i class="bi ${c.icon}"></i><span>${c.difficulty}</span></div><h3>${c.title}</h3><p>${c.short}</p><div class="learning-missions">${c.missions.slice(0,4).map((m,i)=>`<button data-launch-category="${c.id}" data-launch-mission="${m}"><b>${String(i+1).padStart(2,'0')}</b><span>${m}</span><i class="bi bi-arrow-right"></i></button>`).join('')}</div><button class="learning-enter" data-launch-category="${c.id}" data-launch-mission="${c.missions[0]}">ENTER LEARNING PATH <i class="bi bi-arrow-right"></i></button></article>`).join('')||'<div class="training-empty">No learning paths matched your search.</div>';
}
renderLearningGrid();
document.getElementById('trainingSearch')?.addEventListener('input',e=>renderLearningGrid(e.target.value));

const trainingTools=[
 ['Nmap','bi-radar','nmap','Simulated local host and service discovery'],['Wireshark','bi-router','wireshark','Inspect provided packet captures'],['Burp Suite','bi-send','burp','HTTP request and response inspector'],['Gobuster','bi-folder2-open','gobuster','Authorized local directory discovery'],['Nikto','bi-shield-exclamation','nikto','Simulated web configuration audit'],['SQLmap','bi-database','sqlmap','Educational SQLi detection lab'],['John','bi-key-fill','john','Rate-limited sample hash auditing'],['Metasploit','bi-broadcast','metasploit','Isolated vulnerability education'],['Network','bi-hdd-network','ping','Local network diagnostics'],['Hash','bi-fingerprint','hash','Calculate sample text hashes'],['Logs','bi-list-columns-reverse','logscan','Investigate provided logs']
];
function renderToolLauncher(){const grid=document.getElementById('launcherGrid');if(!grid)return;grid.innerHTML=trainingTools.map(t=>`<button data-tool="${t[2]}"><i class="bi ${t[1]}"></i><b>${t[0]}</b><span>${t[3]}</span></button>`).join('')}
renderToolLauncher();
const toolLauncher=document.getElementById('toolLauncher');
document.getElementById('openToolLauncher')?.addEventListener('click',()=>{toolLauncher.classList.add('open');toolLauncher.setAttribute('aria-hidden','false')});
document.getElementById('closeToolLauncher')?.addEventListener('click',()=>{toolLauncher.classList.remove('open');toolLauncher.setAttribute('aria-hidden','true')});

const fsState={cwd:'/home/analyst',files:{'/home/analyst/README.txt':'CYBERTRACE isolated training filesystem.\nUse ls, cat, grep, find and help.','/home/analyst/mission.txt':'Complete the objectives using only controlled lab commands.','/home/analyst/web/index.html':'<title>TraceShop Lab</title>','/home/analyst/web/comments.txt':'Unsafe example: <img src=x onerror=alert(1)>','/var/log/access.log':'10.10.10.5 - GET /login 200\n10.10.10.5 - POST /login 401\n10.10.10.8 - GET /admin 403','/var/log/auth.log':'Jan 21 10:14: sudo analyst : session opened','/home/analyst/secrets.env':'DATABASE_PASSWORD=lab-only-secret'}};
const tabs=[{id:'main',title:'terminal 1',cwd:'/home/analyst',history:[],historyIndex:0,output:[]}];let activeTab='main';let workMission={category:'linux',title:'Terminal Fundamentals',difficulty:'BEGINNER',hint:'Start with ls and pwd.',objectives:['List files','Read mission.txt','Show working directory']};let workStep=0;
const workstation=document.getElementById('ctWorkstation');
function workPrint(text,type=''){const term=document.getElementById('workTerminal');const line=document.createElement('div');line.className='work-line '+type;if(type==='command')line.textContent=text;else line.textContent=text;term.appendChild(line);term.scrollTop=term.scrollHeight}
function renderTabs(){document.getElementById('workstationTabs').innerHTML=tabs.map((t,i)=>`<button class="${t.id===activeTab?'active':''}" data-tab="${t.id}"><i></i><span>${t.title}</span>${i?'':'<b>01</b>'}</button>`).join('')+'<button class="add-tab" id="addWorkTab"><i class="bi bi-plus"></i></button>'}
function resetWorkTerminal(){const tab=tabs.find(t=>t.id===activeTab);tab.output=[];document.getElementById('workTerminal').innerHTML='';workPrint('CYBERTRACE // ISOLATED TRAINING ENVIRONMENT','success');workPrint('No commands are sent to the host machine.');workPrint('Type help for commands or hint for mission guidance.')}
function openWorkstation(category,title){const cat=trainingCategories.find(c=>c.id===category)||trainingCategories[2];workMission={category, title:title||cat.missions[0],difficulty:cat.difficulty,hint:'Use ls, cat, grep and the mission hint; all targets are local lab data.',objectives:cat.missions.slice(0,3).map(m=>`Explore: ${m}`)};workStep=0;document.getElementById('workMissionTitle').textContent=workMission.title;document.getElementById('workMissionDifficulty').textContent=workMission.difficulty.toUpperCase();document.getElementById('workMissionHint').textContent=workMission.hint;document.getElementById('workMissionObjectives').innerHTML=workMission.objectives.map(o=>`<li>${o}</li>`).join('');document.getElementById('workMissionProgress').style.width='0%';document.getElementById('workMissionProgressLabel').textContent='0%';workstation.classList.add('open');workstation.setAttribute('aria-hidden','false');document.body.classList.add('workstation-open');renderTabs();resetWorkTerminal();setTimeout(()=>document.getElementById('workTerminalCommand')?.focus(),100)}
document.addEventListener('click',e=>{const launch=e.target.closest('[data-launch-category]');if(launch){openWorkstation(launch.dataset.launchCategory,launch.dataset.launchMission)}const tab=e.target.closest('[data-tab]');if(tab){activeTab=tab.dataset.tab;renderTabs()}if(e.target.closest('#addWorkTab')){const id='tab-'+(tabs.length+1);tabs.push({id,title:'terminal '+(tabs.length+1),cwd:'/home/analyst',history:[],historyIndex:0,output:[]});activeTab=id;renderTabs();resetWorkTerminal()}});
document.getElementById('exitWorkstation')?.addEventListener('click',()=>{workstation.classList.remove('open');workstation.setAttribute('aria-hidden','true');document.body.classList.remove('workstation-open')});
document.getElementById('fullscreenTerminal')?.addEventListener('click',()=>{if(!document.fullscreenElement)workstation.requestFullscreen?.();else document.exitFullscreen?.()});
document.getElementById('clearWorkTerminal')?.addEventListener('click',()=>{document.getElementById('workTerminal').innerHTML='' });
document.getElementById('resetWorkTerminal')?.addEventListener('click',resetWorkTerminal);

function resolvePath(path){if(!path)return fsState.cwd;if(path.startsWith('/'))return path.replace(/\/[^/]+\/\.\.\//g,'/');const base=fsState.cwd==='/'?'':fsState.cwd;return (base+'/'+path).replace(/\/+/g,'/')}
function normalDir(path){return path.replace(/\/$/,'')||'/'}
const commandNames=['ls','cd','pwd','mkdir','touch','cat','echo','cp','mv','rm','grep','find','chmod','whoami','hostname','uname','date','history','ps','ip','help','clear','hint','nmap','wireshark','burp','gobuster','nikto','sqlmap','john','metasploit','ping','hash','logscan','neofetch','tar','curl'];
function controlledCommand(raw){
 const parts=raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)||[];const cmd=(parts.shift()||'').toLowerCase();
 const arg=parts.join(' ').replace(/^["']|["']$/g,'');const tab=tabs.find(t=>t.id===activeTab);const print=workPrint;
 if(cmd==='clear'){document.getElementById('workTerminal').innerHTML='';return true}
 if(cmd==='help'){print('ls cd pwd mkdir touch cat echo cp mv rm grep find chmod whoami hostname uname date history ps ip\nTools: nmap wireshark burp gobuster nikto sqlmap john metasploit ping hash logscan');print('Controlled commands may only inspect isolated lab data.');return true}
 if(cmd==='hint'){print(workMission.hint,'success');return true}
 if(cmd==='pwd'){print(fsState.cwd);return true}
 if(cmd==='whoami'){print('analyst');return true}
 if(cmd==='hostname'){print('cybertrace-lab');return true}
 if(cmd==='uname'){print(arg.includes('-a')?'CYBERTRACE Training OS 1.0 browser-sandbox x86_64':'CYBERTRACE');return true}
 if(cmd==='date'){print(new Date().toLocaleString());return true}
 if(cmd==='history'){print(tab.history.map((h,i)=>`  ${i+1}  ${h}`).join('\n')||'No command history');return true}
 if(cmd==='ps'){print('  PID  COMMAND\n    1  training-session\n   42  browser-terminal');return true}
 if(cmd==='ip'){print(arg==='a'||arg.includes('addr')?'1: lo inet 127.0.0.1/8\n2: eth0 inet 10.10.10.20/24':'10.10.10.20  lab-network-only');return true}
 if(cmd==='ls'){print(arg.includes('-l')?'-rw-r--r-- mission.txt\n-rw-r--r-- README.txt\ndrwxr-xr-x web':'mission.txt  README.txt  web');return true}
 if(cmd==='cd'){fsState.cwd=!arg||arg==='~'?'/home/analyst':normalDir(resolvePath(arg));print(fsState.cwd);return true}
 if(cmd==='mkdir'){if(!arg){print('mkdir: missing operand','error');return true}print(`created isolated directory ${arg}`,'success');return true}
 if(cmd==='touch'){if(!arg){print('touch: missing operand','error');return true}fsState.files[resolvePath(arg)]='';print(`created ${arg}`,'success');return true}
 if(cmd==='echo'){print(arg);return true}
 if(cmd==='cat'){if(!arg){print('cat: missing file operand','error');return true}const path=resolvePath(arg);if(fsState.files[path])print(fsState.files[path]);else print(`cat: ${arg}: file not found`,'error');return true}
 if(cmd==='grep'){const [q,file]=arg.split(/\s+/);if(!q){print('grep: missing pattern','error');return true}const entries=file&&fsState.files[resolvePath(file)]?[ [resolvePath(file),fsState.files[resolvePath(file)]]]:Object.entries(fsState.files);let found=false;entries.forEach(([p,c])=>c.split('\n').forEach(line=>{if(line.toLowerCase().includes(q.toLowerCase())){print(`${p}:${line}`);found=true}}));if(!found)print(`No match for ${q}`);return true}
 if(cmd==='find'){print('/home/analyst/README.txt\n/home/analyst/mission.txt\n/home/analyst/web/index.html\n/var/log/access.log\n/var/log/auth.log');return true}
 if(cmd==='cp'||cmd==='mv'){const [src,dst]=arg.split(/\s+/);if(!src||!dst){print(`${cmd}: source and destination required`,'error');return true}print(`${cmd}: isolated copy/move authorized: ${src} -> ${dst}`,'success');return true}
 if(cmd==='rm'){print(arg==='-rf /'?`rm: blocked — host and root files are unavailable`:'rm: isolated file operation completed','success');return true}
 if(cmd==='chmod'){print(arg.includes('600')?'mode of secrets.env changed to owner read/write':'permission mode updated in isolated filesystem','success');return true}
 if(cmd==='nmap'){print('Starting CYBERTRACE Nmap simulation\n10.10.10.5  open 80/tcp  http  (lab-web)\n10.10.10.5  open 443/tcp https  (lab-web)\n10.10.10.20 open 22/tcp  ssh   (lab-session)\nScan confined to 10.10.10.0/24');return true}
 if(cmd==='ping'){if(arg&&arg!=='10.10.10.5'&&arg!=='lab-web.local'){print('ping: blocked — only authorized lab hosts are accepted','error');return true}print('PING 10.10.10.5 (lab-web): 3 packets transmitted, 3 received');return true}
 if(cmd==='gobuster'){print('Gobuster-style local directory discovery\n/ (200)  /login (200)  /admin (403)  /backup (301)\nAuthorized lab target only.');return true}
 if(cmd==='nikto'){print('Nikto-style lab audit\n[+] Server banner: TraceShop/1.0\n[+] Missing security headers detected\n[+] Directory /backup is exposed\n[+] Remediation: headers, access controls, remove backup files');return true}
 if(cmd==='burp'){print('BURP-style HTTP inspector ready\nGET /login HTTP/1.1\nHost: lab-web.local\nCookie: session=LAB-DEMO-SESSION\nResponse: 200 OK | Set-Cookie: Secure; HttpOnly');return true}
 if(cmd==='wireshark'||cmd==='logscan'){print('PCAP/log source: isolated-samples\n10.10.10.5 -> 10.10.10.20 DNS A lab-web.local\n10.10.10.20 -> 10.10.10.5 SYN\n10.10.10.5 -> 10.10.10.20 SYN/ACK\nSuspicious sample: repeated POST /login, 401 responses');return true}
 if(cmd==='sqlmap'){print('SQLmap-style education: testing lab-web.local/login only\n[SAFE] Parameter id: possible SQL injection class\n[INFO] No real database or public target queried\nRemediation: parameterized query');return true}
 if(cmd==='john'){print('John-style sample hash audit\nRate limit: 2 attempts per second\nFound sample hash format: bcrypt\n[LAB] Weak sample password rejected\nUse strong, unique passwords and Argon2/bcrypt.');return true}
 if(cmd==='metasploit'){print('Metasploit-style vulnerability education\nModule: auxiliary/trace/check-http-misconfig\nTarget: lab-web.local (authorized)\nStatus: header misconfiguration identified\nRemediation: enable HSTS and remove debug routes');return true}
 if(cmd==='hash'){print(arg?'SHA-256(sample): 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8':'Usage: hash <sample-text>');return true}
 if(cmd==='curl'){if(arg&&/https?:\/\/[^/]*10\.10|lab-web\.local/.test(arg))print('HTTP/1.1 200 OK\nX-Lab-Target: authorized-simulator\nContent-Type: text/html');else print('curl: blocked — supply only lab-web.local or the 10.10.10.0/24 lab network','error');return true}
 if(cmd==='neofetch'){print('CYBERTRACE TRAINING OS\nKernel: Browser Terminal 1.0\nShell: ct-sh\nEnvironment: Isolated Sandbox');return true}
 print(`command not found: ${cmd}. Type help for controlled commands.`,'error');return true;
}

function completeWorkMission(){workStep=Math.min(workMission.objectives.length,workStep+1);const percent=Math.round(workStep/workMission.objectives.length*100);document.getElementById('workMissionProgress').style.width=percent+'%';document.getElementById('workMissionProgressLabel').textContent=percent+'%';if(percent===100){workPrint('MISSION COMPLETE — 100 XP and achievement earned','complete');fetch('/api/training/missions/'+encodeURIComponent(workMission.title)+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course:workMission.category,score:100,seconds:120,description:workMission.title})}).then(r=>r.ok?r.json():null).then(d=>{if(d?.user&&typeof applyUser==='function')applyUser(d.user)}).catch(()=>{})}}

const workTerminalForm=document.getElementById('workTerminalForm');const workTerminalCommand=document.getElementById('workTerminalCommand');
workTerminalForm?.addEventListener('submit',e=>{e.preventDefault();const raw=workTerminalCommand.value.trim();if(!raw)return;const tab=tabs.find(t=>t.id===activeTab);tab.history.push(raw);tab.historyIndex=tab.history.length;workPrint('analyst@cybertrace:~$ '+raw,'command');workTerminalCommand.value='';controlledCommand(raw);if(['ls','pwd','cat','nmap','gobuster','grep','whoami','ping'].includes(raw.split(/\s+/)[0].toLowerCase()))completeWorkMission()});
docume

document.getElementById('launcherGrid')?.addEventListener('click', e => {
    const tool = e.target.closest('[data-tool]');
    if (!tool) return;

    toolLauncher.classList.remove('open');

    openWorkstation(
        tool.dataset.tool === 'nmap' || tool.dataset.tool === 'ping'
            ? 'network'
            : 'linux',
        'Educational ' + tool.dataset.tool + ' Lab'
    );

    setTimeout(() => {
        workTerminalCommand.value = tool.dataset.tool + ' ';
        workTerminalCommand.focus();
    }, 120);
});
