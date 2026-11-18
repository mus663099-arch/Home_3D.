const express=require('express');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const {Pool}=require('pg');
const crypto=require('crypto');
const path=require('path');
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:5});
const sessions=new Map();
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'200kb'}));
app.use(express.static(path.join(__dirname,'public')));
const loginLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false});
async function init(){
 await pool.query(`CREATE TABLE IF NOT EXISTS apps(
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'Ilova',
 description TEXT NOT NULL DEFAULT '',version TEXT NOT NULL DEFAULT '1.0',
 icon TEXT NOT NULL DEFAULT '',download_url TEXT NOT NULL,featured BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 const count=await pool.query('SELECT COUNT(*)::int AS n FROM apps');
 if(count.rows[0].n===0){
  await pool.query('INSERT INTO apps(name,category,description,version,icon,download_url,featured) VALUES ($1,$2,$3,$4,$5,$6,true),($7,$8,$9,$10,$11,$12,true)',
   ['UZB Calculator','Asboblar','Oddiy va qulay kalkulyator ilovasi.','1.0','https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=256','https://example.com/calculator.apk',
    'UZB Notes','Hosildorlik','Qaydlar va g‘oyalar uchun sodda ilova.','1.0','https://images.unsplash.com/photo-1517842645767-c639042777db?w=256','https://example.com/notes.apk']);
 }
}
function requireAdmin(req,res,next){
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 const expiry=sessions.get(token);
 if(!expiry||expiry<Date.now()){sessions.delete(token);return res.status(401).json({error:'Admin sifatida qayta kiring'});}
 next();
}
app.get('/api/apps',async(req,res)=>{try{const q=(req.query.q||'').toString().slice(0,80);const cat=(req.query.category||'').toString().slice(0,40);
 const result=await pool.query('SELECT * FROM apps WHERE ($1 = \'\' OR name ILIKE $2 OR description ILIKE $2) AND ($3 = \'\' OR category=$3) ORDER BY featured DESC, created_at DESC',[q,'%'+q+'%',cat]);res.json(result.rows);
 }catch(e){res.status(500).json({error:'Ma’lumotlarni yuklashda xatolik'});}});
app.post('/api/admin/login',loginLimit,(req,res)=>{if(!process.env.ADMIN_PASSWORD)return res.status(503).json({error:'Admin paroli sozlanmagan'});
 if(req.body.password!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'Parol noto‘g‘ri'});
 const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+12*60*60*1000);res.json({token});});
app.post('/api/admin/logout',requireAdmin,(req,res)=>{sessions.delete((req.headers.authorization||'').replace(/^Bearer /,''));res.json({ok:true});});
app.post('/api/apps',requireAdmin,async(req,res)=>{try{const {name,category,description,version,icon,download_url,featured}=req.body;
 if(!name||!download_url||!/^https?:\/\//i.test(download_url))return res.status(400).json({error:'Ilova nomi va to‘g‘ri yuklab olish havolasi kerak'});
 const r=await pool.query('INSERT INTO apps(name,category,description,version,icon,download_url,featured) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[name.slice(0,100),String(category||'Ilova').slice(0,40),String(description||'').slice(0,2000),String(version||'1.0').slice(0,30),String(icon||'').slice(0,500),download_url,!!featured]);res.status(201).json(r.rows[0]);
 }catch(e){res.status(500).json({error:'Saqlashda xatolik'});}});
app.put('/api/apps/:id',requireAdmin,async(req,res)=>{try{const {name,category,description,version,icon,download_url,featured}=req.body;
 if(!name||!download_url||!/^https?:\/\//i.test(download_url))return res.status(400).json({error:'Ilova nomi va to‘g‘ri yuklab olish havolasi kerak'});
 const r=await pool.query('UPDATE apps SET name=$1,category=$2,description=$3,version=$4,icon=$5,download_url=$6,featured=$7 WHERE id=$8 RETURNING *',[name,category,description,version,icon,download_url,!!featured,req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Ilova topilmadi'});res.json(r.rows[0]);
 }catch(e){res.status(500).json({error:'Yangilashda xatolik'});}});
app.delete('/api/apps/:id',requireAdmin,async(req,res)=>{try{await pool.query('DELETE FROM apps WHERE id=$1',[req.params.id]);res.json({ok:true});}catch(e){res.status(500).json({error:'O‘chirishda xatolik'});}});
app.get('/health',(_,res)=>res.json({ok:true,app:'UZB STORE'}));
const port=process.env.PORT||3000;
init().then(()=>app.listen(port,'0.0.0.0',()=>console.log('UZB STORE listening on '+port))).catch(e=>{console.error('Startup failed',e);process.exit(1);});
