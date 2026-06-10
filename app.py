import os, json, uuid, datetime, requests
from functools import wraps
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
app.secret_key = 'asset-reuse-secret-key-2026'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['DATABASE'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'asset_reuse.db')
CORS(app)
ASSET_PLATFORM_URL = 'http://asset.erp.didichuxing.com'

def get_db():
    db = sqlite3.connect(app.config['DATABASE'])
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, emp_no TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT DEFAULT 'user', password TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS reuse_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, expire_time TEXT, status TEXT DEFAULT '闲置', asset_tag TEXT, asset_name TEXT, brand TEXT, model TEXT, spec_config TEXT, start_date TEXT, location TEXT, owner_emp_no TEXT, owner_name TEXT, images TEXT DEFAULT '[]', creator_emp_no TEXT, creator_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS demand_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_name TEXT, asset_age TEXT, demand_location TEXT, demander_emp_no TEXT, demander_name TEXT, status TEXT DEFAULT '需求中', creator_emp_no TEXT, creator_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS asset_platform_cache (asset_tag TEXT PRIMARY KEY, data TEXT, fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    """)
    cur = db.execute("SELECT COUNT(*) FROM users WHERE role='admin'")
    if cur.fetchone()[0] == 0:
        db.execute("INSERT OR IGNORE INTO users (emp_no,name,role,password) VALUES (?,?,?,?)", ('admin','管理员','admin','admin123'))
    db.commit()
    db.close()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session: return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session: return redirect(url_for('login'))
        if session.get('role') != 'admin': return jsonify({'error':'无权限操作'}), 403
        return f(*args, **kwargs)
    return decorated

@app.route('/')
def index():
    if 'user_id' not in session: return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'GET': return render_template('login.html')
    emp_no = request.form.get('emp_no','').strip()
    password = request.form.get('password','').strip()
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE emp_no=? AND password=?", (emp_no, password)).fetchone()
    db.close()
    if user:
        session['user_id'] = user['id']; session['emp_no'] = user['emp_no']; session['name'] = user['name']; session['role'] = user['role']
        return redirect(url_for('index'))
    return render_template('login.html', error='工号或密码错误')

@app.route('/logout')
def logout():
    session.clear(); return redirect(url_for('login'))

@app.route('/api/register', methods=['POST'])
def api_register():
    d = request.json; emp_no=d.get('emp_no','').strip(); name=d.get('name','').strip(); pw=d.get('password','').strip()
    if not emp_no or not name or not pw: return jsonify({'error':'请填写完整信息'}), 400
    db = get_db()
    try:
        db.execute("INSERT INTO users (emp_no,name,role,password) VALUES (?,?,'user',?)", (emp_no,name,pw)); db.commit(); return jsonify({'msg':'注册成功'})
    except sqlite3.IntegrityError: return jsonify({'error':'该工号已注册'}), 400
    finally: db.close()

@app.route('/api/reuse-assets', methods=['GET'])
def list_reuse_assets():
    db = get_db(); sf=request.args.get('status',''); kw=request.args.get('keyword',''); page=int(request.args.get('page',1)); ps=int(request.args.get('page_size',12)); off=(page-1)*ps
    wc=['1=1']; p=[]
    if sf: wc.append('status=?'); p.append(sf)
    if kw: wc.append('(asset_name LIKE ? OR asset_tag LIKE ? OR brand LIKE ? OR model LIKE ?)'); p.extend([f'%{kw}%']*4)
    ws=' AND '.join(wc)
    total=db.execute(f"SELECT COUNT(*) FROM reuse_assets WHERE {ws}",p).fetchone()[0]
    rows=db.execute(f"SELECT * FROM reuse_assets WHERE {ws} ORDER BY created_at DESC LIMIT ? OFFSET ?",p+[ps,off]).fetchall(); db.close()
    items=[]
    for r in rows: it=dict(r); it['images']=json.loads(it['images']) if it['images'] else []; items.append(it)
    return jsonify({'items':items,'total':total,'page':page,'page_size':ps})

@app.route('/api/reuse-assets', methods=['POST'])
@login_required
def create_reuse_asset():
    d=request.json; db=get_db(); now=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute("INSERT INTO reuse_assets (expire_time,status,asset_tag,asset_name,brand,model,spec_config,start_date,location,owner_emp_no,owner_name,images,creator_emp_no,creator_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (d.get('expire_time',''),d.get('status','闲置'),d.get('asset_tag',''),d.get('asset_name',''),d.get('brand',''),d.get('model',''),d.get('spec_config',''),d.get('start_date',''),d.get('location',''),d.get('owner_emp_no',''),d.get('owner_name',''),json.dumps(d.get('images',[]),ensure_ascii=False),session.get('emp_no',''),session.get('name',''),now,now))
    db.commit(); db.close(); return jsonify({'msg':'创建成功'})

@app.route('/api/reuse-assets/<int:aid>', methods=['PUT'])
@login_required
def update_reuse_asset(aid):
    d=request.json; db=get_db(); now=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    a=db.execute("SELECT * FROM reuse_assets WHERE id=?",(aid,)).fetchone()
    if not a: db.close(); return jsonify({'error':'资产不存在'}),404
    if session.get('role')!='admin' and a['creator_emp_no']!=session.get('emp_no'): db.close(); return jsonify({'error':'无权限编辑'}),403
    db.execute("UPDATE reuse_assets SET expire_time=?,status=?,asset_tag=?,asset_name=?,brand=?,model=?,spec_config=?,start_date=?,location=?,owner_emp_no=?,owner_name=?,images=?,updated_at=? WHERE id=?",
        (d.get('expire_time',''),d.get('status',''),d.get('asset_tag',''),d.get('asset_name',''),d.get('brand',''),d.get('model',''),d.get('spec_config',''),d.get('start_date',''),d.get('location',''),d.get('owner_emp_no',''),d.get('owner_name',''),json.dumps(d.get('images',[]),ensure_ascii=False),now,aid))
    db.commit(); db.close(); return jsonify({'msg':'更新成功'})

@app.route('/api/reuse-assets/<int:aid>', methods=['DELETE'])
@admin_required
def delete_reuse_asset(aid):
    db=get_db(); db.execute("DELETE FROM reuse_assets WHERE id=?",(aid,)); db.commit(); db.close(); return jsonify({'msg':'删除成功'})

@app.route('/api/reuse-assets/<int:aid>', methods=['GET'])
def get_reuse_asset(aid):
    db=get_db(); r=db.execute("SELECT * FROM reuse_assets WHERE id=?",(aid,)).fetchone(); db.close()
    if not r: return jsonify({'error':'资产不存在'}),404
    it=dict(r); it['images']=json.loads(it['images']) if it['images'] else []; return jsonify(it)

@app.route('/api/demand-assets', methods=['GET'])
def list_demand_assets():
    db=get_db(); sf=request.args.get('status',''); kw=request.args.get('keyword',''); page=int(request.args.get('page',1)); ps=int(request.args.get('page_size',12)); off=(page-1)*ps
    wc=['1=1']; p=[]
    if sf: wc.append('status=?'); p.append(sf)
    if kw: wc.append('(asset_name LIKE ? OR demand_location LIKE ?)'); p.extend([f'%{kw}%']*2)
    ws=' AND '.join(wc)
    total=db.execute(f"SELECT COUNT(*) FROM demand_assets WHERE {ws}",p).fetchone()[0]
    rows=db.execute(f"SELECT * FROM demand_assets WHERE {ws} ORDER BY created_at DESC LIMIT ? OFFSET ?",p+[ps,off]).fetchall(); db.close()
    return jsonify({'items':[dict(r) for r in rows],'total':total,'page':page,'page_size':ps})

@app.route('/api/demand-assets', methods=['POST'])
@login_required
def create_demand_asset():
    d=request.json; db=get_db(); now=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute("INSERT INTO demand_assets (asset_name,asset_age,demand_location,demander_emp_no,demander_name,status,creator_emp_no,creator_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (d.get('asset_name',''),d.get('asset_age',''),d.get('demand_location',''),d.get('demander_emp_no',''),d.get('demander_name',''),d.get('status','需求中'),session.get('emp_no',''),session.get('name',''),now,now))
    db.commit(); db.close(); return jsonify({'msg':'创建成功'})

@app.route('/api/demand-assets/<int:did>', methods=['PUT'])
@login_required
def update_demand_asset(did):
    d=request.json; db=get_db(); now=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    a=db.execute("SELECT * FROM demand_assets WHERE id=?",(did,)).fetchone()
    if not a: db.close(); return jsonify({'error':'需求不存在'}),404
    if session.get('role')!='admin' and a['creator_emp_no']!=session.get('emp_no'): db.close(); return jsonify({'error':'无权限编辑'}),403
    db.execute("UPDATE demand_assets SET asset_name=?,asset_age=?,demand_location=?,demander_emp_no=?,demander_name=?,status=?,updated_at=? WHERE id=?",
        (d.get('asset_name',''),d.get('asset_age',''),d.get('demand_location',''),d.get('demander_emp_no',''),d.get('demander_name',''),d.get('status',''),now,did))
    db.commit(); db.close(); return jsonify({'msg':'更新成功'})

@app.route('/api/demand-assets/<int:did>', methods=['DELETE'])
@admin_required
def delete_demand_asset(did):
    db=get_db(); db.execute("DELETE FROM demand_assets WHERE id=?",(did,)); db.commit(); db.close(); return jsonify({'msg':'删除成功'})

@app.route('/api/demand-assets/<int:did>', methods=['GET'])
def get_demand_asset(did):
    db=get_db(); r=db.execute("SELECT * FROM demand_assets WHERE id=?",(did,)).fetchone(); db.close()
    if not r: return jsonify({'error':'需求不存在'}),404
    return jsonify(dict(r))

@app.route('/api/asset-platform/query', methods=['GET'])
def query_asset_platform():
    tag=request.args.get('asset_tag','').strip()
    if not tag: return jsonify({'error':'请输入资产标签号'}),400
    db=get_db()
    cached=db.execute("SELECT * FROM asset_platform_cache WHERE asset_tag=?",(tag,)).fetchone()
    if cached:
        ct=datetime.datetime.strptime(cached['fetched_at'],'%Y-%m-%d %H:%M:%S')
        if (datetime.datetime.now()-ct).seconds<3600: db.close(); return jsonify({'source':'cache','data':json.loads(cached['data'])})
    try:
        resp=requests.get(f'{ASSET_PLATFORM_URL}/api/asset/query',params={'assetTag':tag},timeout=10)
        if resp.status_code==200:
            result=resp.json()
            db.execute("INSERT OR REPLACE INTO asset_platform_cache (asset_tag,data,fetched_at) VALUES (?,?,?)",(tag,json.dumps(result,ensure_ascii=False),datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            db.commit(); db.close(); return jsonify({'source':'platform','data':result})
        else: db.close(); return jsonify({'source':'none','data':{},'msg':'未在资产平台查询到该标签号信息，请手动填写'})
    except requests.RequestException: db.close(); return jsonify({'source':'none','data':{},'msg':'资产平台暂不可达，请手动填写'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({'error':'未选择文件'}),400
    file=request.files['file']
    if file.filename=='': return jsonify({'error':'未选择文件'}),400
    ext=os.path.splitext(file.filename)[1].lower()
    if ext not in ['.jpg','.jpeg','.png','.gif','.bmp','.webp']: return jsonify({'error':'仅支持图片格式'}),400
    fn=f"{uuid.uuid4().hex}{ext}"; fp=os.path.join(app.config['UPLOAD_FOLDER'],fn); file.save(fp)
    return jsonify({'url':f'/static/uploads/{fn}','filename':fn})

@app.route('/api/stats')
def get_stats():
    db=get_db()
    rt=db.execute("SELECT COUNT(*) FROM reuse_assets").fetchone()[0]
    ri=db.execute("SELECT COUNT(*) FROM reuse_assets WHERE status='闲置'").fetchone()[0]
    rd=db.execute("SELECT COUNT(*) FROM reuse_assets WHERE status='已利旧'").fetchone()[0]
    re_=db.execute("SELECT COUNT(*) FROM reuse_assets WHERE status='已失效'").fetchone()[0]
    dt=db.execute("SELECT COUNT(*) FROM demand_assets").fetchone()[0]
    da=db.execute("SELECT COUNT(*) FROM demand_assets WHERE status='需求中'").fetchone()[0]
    db.close()
    return jsonify({'reuse':{'total':rt,'idle':ri,'done':rd,'expired':re_},'demand':{'total':dt,'active':da}})

@app.route('/api/session')
def get_session():
    if 'user_id' in session: return jsonify({'logged_in':True,'emp_no':session.get('emp_no',''),'name':session.get('name',''),'role':session.get('role','')})
    return jsonify({'logged_in':False})

if __name__ == '__main__':
     os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
     init_db()
     port = int(os.environ.get('PORT', 5200))
     app.run(host='0.0.0.0', port=5200, debug=False, threaded=True)
