const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const tutor = require('./tutor');

const app = express();
const db = new Database(path.join(__dirname, 'cybertrace.db'));
const usersDb = new Database(path.join(__dirname, 'cybertrace-users.db'));
db.pragma('journal_mode = WAL');
usersDb.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

usersDb.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  password_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  must_change_password INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const existingUserColumns=usersDb.prepare('PRAGMA table_info(users)').all().map(column=>column.name);
if(!existingUserColumns.includes('status')) usersDb.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
if(!existingUserColumns.includes('last_login')) usersDb.exec('ALTER TABLE users ADD COLUMN last_login DATETIME');
if(!existingUserColumns.includes('must_change_password')) usersDb.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');

db.exec(`
CREATE TABLE IF NOT EXISTS incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, organization TEXT, year INTEGER, sector TEXT, severity TEXT, summary TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, lab_id TEXT, score INTEGER, completed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS saved_incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, incident_id INTEGER, saved_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, incident_id));
CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS missions (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER, title TEXT, description TEXT, order_index INTEGER, FOREIGN KEY(course_id) REFERENCES courses(id));
CREATE TABLE IF NOT EXISTS achievements (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mission_id INTEGER, achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(mission_id) REFERENCES missions(id));
CREATE TABLE IF NOT EXISTS practice_time (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, duration INTEGER, practice_date DATE, FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS private_learning_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, course_id INTEGER, progress INTEGER, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id));
CREATE TABLE IF NOT EXISTS kali_environments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider_environment_id TEXT,
  status TEXT DEFAULT 'unavailable',
  desktop_url TEXT,
  terminal_url TEXT,
  cpu_limit INTEGER,
  memory_limit_mb INTEGER,
  disk_limit_gb INTEGER,
  started_at DATETIME,
  ended_at DATETIME,
  last_activity DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS kali_session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  environment_id INTEGER,
  event TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const incidentCount = db.prepare('SELECT COUNT(*) count FROM incidents').get().count;
if (!incidentCount) {
  const insert = db.prepare('INSERT INTO incidents (title, organization, year, sector, severity, summary, source) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const incidents = [
    ['SolarWinds Supply Chain Attack','SolarWinds',2020,'Supply Chain','Critical','A compromised software update delivered malware to thousands of organizations.', 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-077a'],
    ['Colonial Pipeline Disruption','Colonial Pipeline',2021,'Energy','High','Ransomware forced a major fuel pipeline operator offline, disrupting regional supply.', 'https://www.cisa.gov/news-events/news/colonial-pipeline-ransomware-attack'],
    ['MOVEit Data Theft','Progress Software',2023,'Data Breach','Critical','A mass-exploitation campaign targeted a managed file-transfer platform.', 'https://www.cisa.gov/news-events/alerts/2023/06/16/moveit-transfer-vulnerability-exploited-impact-data'],
    ['Log4Shell Vulnerability','Apache',2021,'Software','Critical','A widely deployed logging library contained a remote code execution flaw.', 'https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-44228'],
    ['Equifax Data Breach','Equifax',2017,'Finance','Critical','An unpatched application vulnerability exposed sensitive records for 147 million people.', 'https://www.congress.gov/bill/116th-congress/house-bill/1236'],
    ['Ukraine Power Grid Attack','Ukrenergo',2015,'Infrastructure','High','Attackers disrupted power distribution through compromised operational systems.', 'https://www.cisa.gov/news-events/ics-advisories/icsa-14-098-01'],
    ['WannaCry Ransomware','Microsoft / NHS',2017,'Malware','Critical','Wormable ransomware spread rapidly using an exploited Windows vulnerability.', 'https://www.cisa.gov/news-events/alerts/2017/05/12/indicators-associated-wannacry-ransomware'],
    ['MGM Resorts Cyberattack','MGM Resorts',2023,'Hospitality','High','Social engineering enabled access that disrupted hotels and casino operations.', 'https://www.justice.gov/opa/media/1375221']
  ];
  incidents.forEach(i => insert.run(...i));
}

const oldUsersTable=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if(oldUsersTable){
  const oldUsers=db.prepare('SELECT id,name,email,password,role,xp,streak,created_at FROM users').all();
  const migrate=usersDb.prepare('INSERT OR IGNORE INTO users (id,name,email,password_hash,role,xp,streak,created_at) VALUES (?,?,?,?,?,?,?,?)');
  oldUsers.forEach(u=>migrate.run(u.id,u.name,u.email,u.password,u.role||'member',u.xp||0,u.streak||0,u.created_at||null));
  db.exec('DROP TABLE users');
}

const admin = usersDb.prepare('SELECT id FROM users WHERE email = ?').get('admin@cybertrace.io');
if (!admin) {
  // No hard-coded password: use ADMIN_INITIAL_PASSWORD or generate a random one and print it once.
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(initialPassword, 12);
  usersDb.prepare('INSERT OR IGNORE INTO users (name,email,password_hash,role,xp,streak,must_change_password) VALUES (?,?,?,?,?,?,1)').run('CyberTrace Admin','admin@cybertrace.io',hash,'admin',0,0);
  if (!process.env.ADMIN_INITIAL_PASSWORD) console.log('\n[SETUP] Admin created: admin@cybertrace.io  password: ' + initialPassword + '  (change it after first login)\n');
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.SESSION_SECRET) { console.error('SESSION_SECRET must be set in production.'); process.exit(1); }
if (isProd) app.set('trust proxy', 1);
app.use(session({ secret: process.env.SESSION_SECRET || 'cybertrace-dev-secret-change-in-production', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 7 } }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false });

function refreshSessionUser(req){
  if (!req.session.user) return null;
  const fresh = usersDb.prepare('SELECT id,name,email,role,status,xp,streak,must_change_password FROM users WHERE id=?').get(req.session.user.id);
  if (!fresh || fresh.status === 'suspended') { req.session.destroy(()=>{}); return null; }
  req.session.user = {id:fresh.id,name:fresh.name,email:fresh.email,role:fresh.role,xp:fresh.xp,streak:fresh.streak,mustChangePassword:Boolean(fresh.must_change_password)};
  return req.session.user;
}
function authRequired(req,res,next){ if (!refreshSessionUser(req)) return res.status(401).json({error:'Authentication required'}); next(); }
function adminRequired(req,res,next){ const u = refreshSessionUser(req); if (!u) return res.status(401).json({error:'Authentication required'}); if (u.role !== 'admin') return res.status(403).json({error:'Administrator access required'}); next(); }

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skipSuccessfulRequests: true });
app.use('/api', authLimiter);
app.use(['/api/auth/login','/api/auth/signup'], loginLimiter);
app.post('/api/auth/signup', async (req,res) => {
  const {name,email,password} = req.body;
  const cleanName=String(name||'').trim();
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(cleanName.length < 2) return res.status(400).json({error:'Please enter your full name'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({error:'Please enter a valid email address'});
  if(typeof password!=='string' || password.length < 8) return res.status(400).json({error:'Password must contain at least 8 characters'});
  if(Buffer.byteLength(password) > 72) return res.status(400).json({error:'Password must be at most 72 bytes'});
  try {
    const hash = await bcrypt.hash(password,12);
    usersDb.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(cleanName,cleanEmail,hash);
    res.status(201).json({created:true,email:cleanEmail,name:cleanName});
  } catch(e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({error:'An account with this email already exists'});
    console.error(e); res.status(500).json({error:'Could not create account'});
  }
});
app.post('/api/auth/login', async (req,res) => {
  try {
    const cleanEmail=String(req.body.email||'').trim().toLowerCase();
    const password=typeof req.body.password==='string'?req.body.password:'';
    const user = usersDb.prepare('SELECT * FROM users WHERE email=?').get(cleanEmail);
    if (!user || !password || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:'Invalid email or password'});
    if(user.status==='suspended') return res.status(403).json({error:'This account has been suspended. Contact an administrator.'});
    usersDb.prepare('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?').run(user.id);
    const sessionUser = {id:user.id,name:user.name,email:user.email,role:user.role,xp:user.xp,streak:user.streak,mustChangePassword:Boolean(user.must_change_password)};
    req.session.regenerate(err=>{
      if(err) return res.status(500).json({error:'Could not start a session'});
      req.session.user = sessionUser;
      res.json({user:sessionUser});
    });
  } catch(e) { res.status(500).json({error:'Login failed'}); }
});
app.post('/api/auth/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/auth/me',(req,res)=>res.json({user:req.session.user||null}));
app.get('/api/incidents',(req,res)=>{
  const {search='',sector=''}=req.query;
  let sql='SELECT * FROM incidents WHERE 1=1'; const params=[];
  if(search){sql+=' AND (title LIKE ? OR organization LIKE ? OR summary LIKE ?)';params.push(`%${search}%`,`%${search}%`,`%${search}%`)}
  if(sector){sql+=' AND sector=?';params.push(sector)}
  sql+=' ORDER BY year DESC'; res.json(db.prepare(sql).all(...params));
});
const LAB_IDS = new Set(['xss','sql','password','permissions']);
app.post('/api/labs/:labId/progress',authRequired,(req,res)=>{
  if(!LAB_IDS.has(req.params.labId)) return res.status(400).json({error:'Unknown lab'});
  const uid=req.session.user.id;
  const score=Math.max(0,Math.min(100,Number(req.body.score)||0));
  const firstPass=score>=70 && !db.prepare('SELECT 1 FROM progress WHERE user_id=? AND lab_id=? AND score>=70').get(uid,req.params.labId);
  db.prepare('INSERT INTO progress (user_id,lab_id,score) VALUES (?,?,?)').run(uid,req.params.labId,score);
  // XP and streak are awarded only the first time a lab is passed (no repeat farming).
  if(firstPass) usersDb.prepare('UPDATE users SET xp=xp+50, streak=CASE WHEN streak<99 THEN streak+1 ELSE streak END WHERE id=?').run(uid);
  const user=usersDb.prepare('SELECT name,email,role,xp,streak FROM users WHERE id=?').get(uid); req.session.user={id:uid,mustChangePassword:req.session.user.mustChangePassword,...user};
  res.json({ok:true,awarded:firstPass?50:0,user:req.session.user});
});

// Workstation missions (this endpoint was called by the client but missing on the server).
app.post('/api/training/missions/:title/complete',authRequired,(req,res)=>{
  const uid=req.session.user.id;
  const title=String(req.params.title||'').trim().slice(0,100);
  const course=String(req.body.course||'general').replace(/[^a-z0-9-]/gi,'').slice(0,30)||'general';
  if(!title) return res.status(400).json({error:'Mission title required'});
  const seconds=Math.max(0,Math.min(3600,Math.round(Number(req.body.seconds)||0)));
  const labId='mission:'+course+':'+title;
  const first=!db.prepare('SELECT 1 FROM progress WHERE user_id=? AND lab_id=?').get(uid,labId);
  // Daily cap so the endpoint cannot be used to mass-farm XP.
  const today=db.prepare("SELECT COUNT(*) c FROM progress WHERE user_id=? AND lab_id LIKE 'mission:%' AND date(completed_at)=date('now')").get(uid).c;
  const award=first && today<10;
  db.prepare('INSERT INTO progress (user_id,lab_id,score) VALUES (?,?,100)').run(uid,labId);
  if(seconds) db.prepare("INSERT INTO practice_time (user_id,duration,practice_date) VALUES (?,?,date('now'))").run(uid,seconds);
  if(award) usersDb.prepare('UPDATE users SET xp=xp+100 WHERE id=?').run(uid);
  const user=usersDb.prepare('SELECT name,email,role,xp,streak FROM users WHERE id=?').get(uid);
  req.session.user={id:uid,mustChangePassword:req.session.user.mustChangePassword,...user};
  res.json({ok:true,awarded:award?100:0,user:req.session.user});
});

// AI Kali tutor. Uses Grok (xAI) when XAI_API_KEY is set and the learner is logged in; otherwise an offline tutor.
const tutorLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false });
app.post('/api/tutor', tutorLimiter, async (req,res)=>{
  const message=String(req.body.message||'').trim().slice(0,1000);
  if(!message) return res.status(400).json({error:'Please type a question for the tutor'});
  const history=tutor.normalizeHistory(req.body.history);
  const context=tutor.sanitizeContext(req.body.context);
  const user=req.session.user?refreshSessionUser(req):null;
  if(tutor.isConfigured() && user){
    try{ return res.json({reply:await tutor.askAI({message,history,context}),source:'ai'}); }
    catch(e){ console.error('[tutor] AI request failed:',e.message); }
  }
  res.json({reply:tutor.offlineAnswer(message,context),source:'offline',aiAvailable:tutor.isConfigured(),needsLogin:tutor.isConfigured()&&!user});
});

// Cybersecurity news (RSS aggregation, cached 15 minutes) and optional Albanian headline translation.
const news = require('./news');
app.get('/api/news', async (req,res)=>{
  try { res.json({...(await news.getNews()), translationAvailable: tutor.isConfigured()}); }
  catch(e){ console.error('[news]',e.message); res.status(502).json({error:'News sources are unreachable right now. Please try again later.'}); }
});
app.post('/api/news/translate', authRequired, tutorLimiter, async (req,res)=>{
  const titles=(Array.isArray(req.body.titles)?req.body.titles:[]).slice(0,40).map(t=>String(t).slice(0,220));
  if(!titles.length) return res.status(400).json({error:'No headlines to translate'});
  if(!tutor.isConfigured()) return res.status(503).json({error:'Translation needs XAI_API_KEY to be set on the server.'});
  try { res.json({titles: await tutor.translateTitles(titles)}); }
  catch(e){ console.error('[news] translate failed:',e.message); res.status(502).json({error:'Translation failed. Try again.'}); }
});
app.get('/api/dashboard',authRequired,(req,res)=>{
  const user=usersDb.prepare('SELECT id,name,email,role,status,xp,streak,last_login,must_change_password,created_at FROM users WHERE id=?').get(req.session.user.id);
  const progress=db.prepare('SELECT lab_id,MAX(score) score,MAX(completed_at) completed_at FROM progress WHERE user_id=? GROUP BY lab_id').all(req.session.user.id);
  const training=db.prepare('SELECT c.title course,MAX(plp.progress) progress FROM private_learning_progress plp JOIN courses c ON c.id=plp.course_id WHERE plp.user_id=? GROUP BY c.id').all(req.session.user.id);
  const practice=db.prepare('SELECT COALESCE(SUM(duration),0) seconds FROM practice_time WHERE user_id=?').get(req.session.user.id);
  res.json({user,progress,training,practice});
});
app.post('/api/incidents/:id/save',authRequired,(req,res)=>{
  try{db.prepare('INSERT INTO saved_incidents (user_id,incident_id) VALUES (?,?)').run(req.session.user.id,Number(req.params.id));return res.json({ok:true})}catch(e){res.json({ok:true,already:true})}
});
app.get('/api/incidents/saved/list',authRequired,(req,res)=>res.json(db.prepare('SELECT i.* FROM incidents i JOIN saved_incidents s ON s.incident_id=i.id WHERE s.user_id=?').all(req.session.user.id)));
app.delete('/api/incidents/:id/save',authRequired,(req,res)=>{db.prepare('DELETE FROM saved_incidents WHERE user_id=? AND incident_id=?').run(req.session.user.id,Number(req.params.id));res.json({ok:true})});
app.get('/api/admin/stats',adminRequired,(req,res)=>res.json({
  users:usersDb.prepare('SELECT COUNT(*) c FROM users').get().c,
  admins:usersDb.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c,
  active:usersDb.prepare("SELECT COUNT(*) c FROM users WHERE COALESCE(status,'active')='active'").get().c,
  suspended:usersDb.prepare("SELECT COUNT(*) c FROM users WHERE status='suspended'").get().c,
  today:usersDb.prepare("SELECT COUNT(*) c FROM users WHERE date(created_at)=date('now')").get().c,
  incidents:db.prepare('SELECT COUNT(*) c FROM incidents').get().c,
  completions:db.prepare('SELECT COUNT(*) c FROM progress').get().c,
  top:usersDb.prepare('SELECT name,xp,streak FROM users ORDER BY xp DESC LIMIT 5').all()
}));
app.get('/api/admin/users',adminRequired,(req,res)=>{
  const search=String(req.query.search||'').trim().toLowerCase();
  let users;
  if(search) users=usersDb.prepare("SELECT id,name,email,role,status,xp,streak,password_updated_at,last_login,created_at,must_change_password FROM users WHERE lower(name) LIKE ? OR lower(email) LIKE ? ORDER BY created_at DESC").all(`%${search}%`,`%${search}%`);
  else users=usersDb.prepare('SELECT id,name,email,role,status,xp,streak,password_updated_at,last_login,created_at,must_change_password FROM users ORDER BY created_at DESC').all();
  res.json(users);
});
app.get('/api/admin/users/:id',adminRequired,(req,res)=>{
  const user=usersDb.prepare('SELECT id,name,email,role,status,xp,streak,password_updated_at,last_login,created_at,must_change_password FROM users WHERE id=?').get(Number(req.params.id));
  if(!user)return res.status(404).json({error:'User not found'});
  res.json(user);
});
app.patch('/api/admin/users/:id/role',adminRequired,(req,res)=>{
  const role=req.body.role==='admin'?'admin':'member';
  if(Number(req.params.id)===req.session.user.id&&role==='member')return res.status(400).json({error:'You cannot remove your own administrator role'});
  usersDb.prepare('UPDATE users SET role=? WHERE id=?').run(role,Number(req.params.id));
  res.json({ok:true,role});
});
app.patch('/api/admin/users/:id/status',adminRequired,(req,res)=>{
  const status=req.body.status==='suspended'?'suspended':'active';
  if(Number(req.params.id)===req.session.user.id&&status==='suspended')return res.status(400).json({error:'You cannot suspend your own account'});
  usersDb.prepare('UPDATE users SET status=? WHERE id=?').run(status,Number(req.params.id));
  res.json({ok:true,status});
});
app.delete('/api/admin/users/:id',adminRequired,(req,res)=>{
  const id=Number(req.params.id);
  if(id===req.session.user.id)return res.status(400).json({error:'You cannot delete your own account'});
  const result=usersDb.prepare('DELETE FROM users WHERE id=?').run(id);
  if(!result.changes)return res.status(404).json({error:'User not found'});
  db.prepare('DELETE FROM progress WHERE user_id=?').run(id);
  db.prepare('DELETE FROM saved_incidents WHERE user_id=?').run(id);
  db.prepare('DELETE FROM achievements WHERE user_id=?').run(id);
  db.prepare('DELETE FROM practice_time WHERE user_id=?').run(id);
  db.prepare('DELETE FROM private_learning_progress WHERE user_id=?').run(id);
  // NOTE: stop/destroy this user's Kali VM via the provider before removing the row (not done here).
  db.prepare('DELETE FROM kali_environments WHERE user_id=?').run(id);
  res.json({ok:true});
});
app.post('/api/admin/users/:id/reset-password',adminRequired,async(req,res)=>{
  const id=Number(req.params.id);
  const user=usersDb.prepare('SELECT id,password_hash FROM users WHERE id=?').get(id);
  if(!user)return res.status(404).json({error:'User not found'});
  if(user.password_hash==='GOOGLE_ACCOUNT')return res.status(400).json({error:'Google accounts do not use a CYBERTRACE password'});
  const temporaryPassword=crypto.randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g,'A')+'7!';
  const hash=await bcrypt.hash(temporaryPassword,12);
  usersDb.prepare('UPDATE users SET password_hash=?,password_updated_at=CURRENT_TIMESTAMP,must_change_password=1 WHERE id=?').run(hash,id);
  res.json({ok:true,temporaryPassword});
});
app.post('/api/auth/change-password',authRequired,async(req,res)=>{
  const password=typeof req.body.password==='string'?req.body.password:'';
  if(password.length<8||Buffer.byteLength(password)>72)return res.status(400).json({error:'Password must be 8 to 72 characters'});
  try{
    const hash=await bcrypt.hash(password,12);
    usersDb.prepare('UPDATE users SET password_hash=?,password_updated_at=CURRENT_TIMESTAMP,must_change_password=0 WHERE id=?').run(hash,req.session.user.id);
    req.session.user.mustChangePassword=false;
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Could not change password'})}
});
app.get('/api/auth/google/config',(req,res)=>res.json({clientId:process.env.GOOGLE_CLIENT_ID||''}));
app.post('/api/auth/google', async (req,res) => {
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId) return res.status(503).json({error:'Google sign-in is not configured. Set GOOGLE_CLIENT_ID on the server.'});
  try {
    const credential=String(req.body.credential||'');
    if(!credential) return res.status(400).json({error:'Missing Google credential'});
    const response=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if(!response.ok) return res.status(401).json({error:'Google credential verification failed'});
    const profile=await response.json();
    if(profile.aud!==clientId || (profile.email_verified!=='true' && profile.email_verified!==true)) return res.status(401).json({error:'Google account could not be verified'});
    const email=String(profile.email||'').trim().toLowerCase();
    const name=String(profile.name||email.split('@')[0]).trim();
    let user=usersDb.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!user){
      const result=usersDb.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(name,email,'GOOGLE_ACCOUNT');
      user=usersDb.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
    }
    if(user.status==='suspended') return res.status(403).json({error:'This account has been suspended. Contact an administrator.'});
    usersDb.prepare('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?').run(user.id);
    req.session.user={id:user.id,name:user.name,email:user.email,role:user.role,xp:user.xp,streak:user.streak,mustChangePassword:false};
    res.json({user:req.session.user});
  } catch(e) { res.status(502).json({error:'Could not verify Google account'}); }
});
app.get('/api/stats',(req,res)=>res.json({
  incidents:db.prepare('SELECT COUNT(*) c FROM incidents').get().c,
  users:usersDb.prepare('SELECT COUNT(*) c FROM users').get().c,
  labs:db.prepare('SELECT COUNT(DISTINCT lab_id) c FROM progress').get().c,
  completions:db.prepare('SELECT COUNT(*) c FROM progress').get().c
}));
app.get('/api/health',(req,res)=>res.json({ok:true,service:'CYBERTRACE',timestamp:new Date().toISOString()}));

// Kali API routes
const KALI_CONTROL_API_URL=String(process.env.KALI_CONTROL_API_URL||'').replace(/\/$/,'')
const KALI_CONTROL_API_TOKEN=String(process.env.KALI_CONTROL_API_TOKEN||'')
const KALI_SESSION_TIMEOUT_MINUTES=Number(process.env.KALI_SESSION_TIMEOUT_MINUTES)||120
async function kaliProviderRequest(action,user,environmentId){
  if(!KALI_CONTROL_API_URL||!KALI_CONTROL_API_TOKEN)throw Object.assign(new Error('Real Kali infrastructure is not configured on this server.'),{status:503,code:'KALI_INFRASTRUCTURE_MISSING'})
  const url=new URL(`/v1/environments${environmentId?'/'+encodeURIComponent(environmentId):''}/${action}`,KALI_CONTROL_API_URL)
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${KALI_CONTROL_API_TOKEN}`},body:JSON.stringify({userId:user.id,userEmail:user.email,sessionMinutes:KALI_SESSION_TIMEOUT_MINUTES,reset:action==='reset'})})
  const data=await response.json().catch(()=>({error:'Invalid response from Kali infrastructure provider'}))
  if(!response.ok)throw Object.assign(new Error(data.error||'Kali provider request failed.'),{status:response.status||502,code:data.code||'KALI_PROVIDER_ERROR'})
  return data
}
function getOrCreateKaliEnvironment(user){
  let environment=db.prepare('SELECT * FROM kali_environments WHERE user_id=?').get(user.id)
  if(!environment){const result=db.prepare('INSERT INTO kali_environments (user_id,status) VALUES (?,\'unavailable\')').run(user.id);environment=db.prepare('SELECT * FROM kali_environments WHERE id=?').get(result.lastInsertRowid)}
  return environment
}
function saveKaliEvent(environmentId,event,details=''){db.prepare('INSERT INTO kali_session_events (environment_id,event,details) VALUES (?,?,?)').run(environmentId,event,details.slice(0,500))}
app.get('/api/kali/status',authRequired,(req,res)=>{
  const environment=getOrCreateKaliEnvironment(req.session.user)
  res.json({configured:Boolean(KALI_CONTROL_API_URL&&KALI_CONTROL_API_TOKEN),environment:{id:environment.provider_environment_id||null,status:environment.status,desktopUrl:environment.desktop_url||null,terminalUrl:environment.terminal_url||null,cpuLimit:environment.cpu_limit, memoryLimitMb:environment.memory_limit_mb,diskLimitGb:environment.disk_limit_gb,startedAt:environment.started_at,endedAt:environment.ended_at,lastActivity:environment.last_activity},sessionTimeoutMinutes:KALI_SESSION_TIMEOUT_MINUTES})
})
app.post('/api/kali/:action(start|stop|restart|reset|reconnect)',authRequired,async(req,res)=>{
  const action=req.params.action;const environment=getOrCreateKaliEnvironment(req.session.user)
  try{
    const data=await kaliProviderRequest(action,req.session.user,environment.provider_environment_id)
    const status=data.status||({start:'starting',restart:'starting',reset:'resetting',stop:'stopped',reconnect:'starting'}[action]||'unknown')
    db.prepare('UPDATE kali_environments SET provider_environment_id=?,status=?,desktop_url=?,terminal_url=?,cpu_limit=?,memory_limit_mb=?,disk_limit_gb=?,started_at=CASE WHEN ? IN (\'start\',\'restart\',\'reset\',\'reconnect\') THEN CURRENT_TIMESTAMP ELSE started_at END,ended_at=CASE WHEN ?=\'stop\' THEN CURRENT_TIMESTAMP ELSE ended_at END,last_activity=CURRENT_TIMESTAMP WHERE id=?').run(data.environmentId||environment.provider_environment_id||null,status,data.desktopUrl||null,data.terminalUrl||null,Number(data.cpuLimit)||null,Number(data.memoryLimitMb)||null,Number(data.diskLimitGb)||null,action,action,environment.id)
    saveKaliEvent(environment.id,action,JSON.stringify({status,providerEnvironmentId:data.environmentId||null}))
    res.json({ok:true,status,desktopUrl:data.desktopUrl||null,terminalUrl:data.terminalUrl||null,environmentId:data.environmentId||environment.provider_environment_id||null})
  }catch(error){saveKaliEvent(environment.id,action+'-failed',error.message);res.status(error.status||502).json({error:error.message,code:error.code||'KALI_PROVIDER_ERROR'})}
})
app.get('/api/admin/kali/environments',adminRequired,(req,res)=>{const rows=db.prepare('SELECT * FROM kali_environments ORDER BY last_activity DESC').all();const lookup=usersDb.prepare('SELECT name,email,role FROM users WHERE id=?');const environments=rows.map(k=>({...k,...(lookup.get(k.user_id)||{name:'(deleted user)',email:'',role:''})}));res.json({configured:Boolean(KALI_CONTROL_API_URL&&KALI_CONTROL_API_TOKEN),environments})})
app.post('/api/admin/kali/environments/:userId/:action(stop|reset)',adminRequired,async(req,res)=>{const userId=Number(req.params.userId);const user=usersDb.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(userId);if(!user)return res.status(404).json({error:'User not found'});const environment=getOrCreateKaliEnvironment(user);try{const data=await kaliProviderRequest(req.params.action,user,environment.provider_environment_id);db.prepare('UPDATE kali_environments SET status=?,ended_at=CASE WHEN ?=\'stop\' THEN CURRENT_TIMESTAMP ELSE ended_at END,last_activity=CURRENT_TIMESTAMP WHERE id=?').run(data.status||(req.params.action==='stop'?'stopped':'resetting'),req.params.action,environment.id);saveKaliEvent(environment.id,'admin-'+req.params.action,'Administrator '+req.session.user.email+' performed '+req.params.action);res.json({ok:true,status:data.status||'updated'})}catch(error){res.status(error.status||502).json({error:error.message,code:error.code||'KALI_PROVIDER_ERROR'})}})

// Static SPA fallback and listener
const publicDir=path.join(__dirname,'public');
const hasPublic=fs.existsSync(path.join(publicDir,'index.html'));
const FLAT_FILES=['index.html','app.js','tutor-ui.js','news-ui.js','styles-rebuilt.css','styles.css'];
if(hasPublic) app.use(express.static(publicDir));
else FLAT_FILES.forEach(f=>app.get('/'+f,(req,res)=>res.sendFile(path.join(__dirname,f))));
app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
app.get('*',(req,res)=>res.sendFile(hasPublic?path.join(publicDir,'index.html'):path.join(__dirname,'index.html')));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`CYBERTRACE running at http://localhost:${PORT}`));

