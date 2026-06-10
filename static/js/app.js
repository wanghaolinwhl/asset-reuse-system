 var currentUser=null;var reuseImages=[];var editingAssetId=null;
 async function init(){
   var r=await fetch('/api/session');var d=await r.json();
   if(!d.logged_in){window.location.href='/login';return}
   currentUser=d;
   document.getElementById('userName').textContent=d.name;
   document.getElementById('userRole').textContent=d.role==='admin'?'管理员':'普通用户';
   if(d.role==='admin')document.getElementById('adminNav').style.display='flex';
   loadStats();loadReuseAssets();loadDemandAssets();
 }
 function navTo(page){
   document.querySelectorAll('.page-section').forEach(function(el){el.classList.remove('active')});
   document.getElementById('page-'+page).classList.add('active');
   document.querySelectorAll('.nav-item').forEach(function(el){el.classList.toggle('active',el.dataset.page===page)});
   if(page==='platform')loadReuseAssets();
   if(page==='demand-list')loadDemandAssets();
   if(page==='my-assets')loadMyAssets();
   if(page==='admin')loadAdminData();
 }
 function toggleSub(id){document.getElementById(id).classList.toggle('show')}
 function statusBadge(s){
   var m={'闲置':'idle','已利旧':'done','已失效':'expired','需求中':'demand','已满足':'done','已关闭':'expired'};
   return '<span class="status-badge status-'+(m[s]||'idle')+'">'+s+'</span>';
 }
 async function loadStats(){
   var r=await fetch('/api/stats');var d=await r.json();
   document.getElementById('statsRow').innerHTML=
     '<div class="stat-card"><div class="label">利旧资产总数</div><div class="value total">'+d.reuse.total+'</div></div>'+
     '<div class="stat-card"><div class="label">闲置中</div><div class="value idle">'+d.reuse.idle+'</div></div>'+
     '<div class="stat-card"><div class="label">已利旧</div><div class="value done">'+d.reuse.done+'</div></div>'+
     '<div class="stat-card"><div class="label">已失效</div><div class="value expired">'+d.reuse.expired+'</div></div>'+
     '<div class="stat-card"><div class="label">需求中</div><div class="value demand">'+d.demand.active+'</div></div>';
 }
 var reusePage=1;
 async function loadReuseAssets(page){
   if(page)reusePage=page;
   var kw=document.getElementById('searchKw').value;
   var st=document.getElementById('filterStatus').value;
   var r=await fetch('/api/reuse-assets?page='+reusePage+'&page_size=10&keyword='+encodeURIComponent(kw)+'&status='+st);
   var d=await r.json();
   var html='';
   d.items.forEach(function(a){
     html+='<tr><td>'+a.asset_tag+'</td><td>'+a.asset_name+'</td><td>'+(a.brand||'')+' '+(a.model||'')+'</td><td>'+(a.spec_config||'-')+'</td><td>'+(a.location||'-')+'</td><td>'+(a.owner_name||'-')+'</td><td>'+statusBadge(a.status)+'</td><td>'+(a.expire_time||'-')+'</td><td><button class="btn-sm btn-view" onclick="viewAsset('+a.id+')">详情</button></td></tr>';
   });
   document.getElementById('reuseTable').innerHTML=html||'<tr><td colspan="9" style="text-align:center;color:#999;padding:40px">暂无数据</td></tr>';
   renderPagination('reusePagination',d.page,Math.ceil(d.total/d.page_size),'loadReuseAssets');
 }
 var demandPage=1;
 async function loadDemandAssets(page){
   if(page)demandPage=page;
   var kw=document.getElementById('demandSearchKw').value;
   var st=document.getElementById('demandFilterStatus').value;
   var r=await fetch('/api/demand-assets?page='+demandPage+'&page_size=10&keyword='+encodeURIComponent(kw)+'&status='+st);
   var d=await r.json();
   var html='';
   d.items.forEach(function(a){
     html+='<tr><td>'+a.asset_name+'</td><td>'+(a.asset_age||'-')+'</td><td>'+(a.demand_location||'-')+'</td><td>'+(a.demander_name||'-')+'</td><td>'+statusBadge(a.status)+'</td><td>'+(a.created_at||'-')+'</td></tr>';
   });
   document.getElementById('demandTable').innerHTML=html||'<tr><td colspan="6" style="text-align:center;color:#999;padding:40px">暂无数据</td></tr>';
   renderPagination('demandPagination',d.page,Math.ceil(d.total/d.page_size),'loadDemandAssets');
 }
 function renderPagination(id,curr,total,fnName){
   if(total<=1){document.getElementById(id).innerHTML='';return}
   var html='<button '+(curr<=1?'disabled':'')+' onclick="'+fnName+'('+(curr-1)+')">上一页</button>';
   for(var i=1;i<=total&&i<=7;i++){
     html+='<button class="'+(i===curr?'active':'')+'" onclick="'+fnName+'('+i+')">'+i+'</button>';
   }
   html+='<button '+(curr>=total?'disabled':'')+' onclick="'+fnName+'('+(curr+1)+')">下一页</button>';
   document.getElementById(id).innerHTML=html;
 }
 async function viewAsset(id){
   var r=await fetch('/api/reuse-assets/'+id);var a=await r.json();
   if(a.error){alert(a.error);return}
   var imgs=a.images&&a.images.length?'<div class="asset-images" style="margin-top:12px">'+a.images.map(function(i){return '<img src="'+i.url+'" style="width:120px;height:120px" onclick="showLightbox(this.src)">'}).join('')+'</div>':'<p style="color:#999">无图片</p>';
   document.getElementById('detailContent').innerHTML=
     '<div class="form-row"><div class="form-group"><label>资产标签号</label><div>'+(a.asset_tag||'-')+'</div></div><div class="form-group"><label>资产名称</label><div>'+(a.asset_name||'-')+'</div></div></div>'+
     '<div class="form-row"><div class="form-group"><label>品牌</label><div>'+(a.brand||'-')+'</div></div><div class="form-group"><label>型号</label><div>'+(a.model||'-')+'</div></div></div>'+
     '<div class="form-row"><div class="form-group"><label>规格配置</label><div>'+(a.spec_config||'-')+'</div></div><div class="form-group"><label>启用日期</label><div>'+(a.start_date||'-')+'</div></div></div>'+
     '<div class="form-row"><div class="form-group"><label>资产地点</label><div>'+(a.location||'-')+'</div></div><div class="form-group"><label>状态</label><div>'+statusBadge(a.status)+'</div></div></div>'+
     '<div class="form-row"><div class="form-group"><label>责任人</label><div>'+(a.owner_name||'-')+' ('+(a.owner_emp_no||'-')+')</div></div><div class="form-group"><label>失效时间</label><div>'+(a.expire_time||'-')+'</div></div></div>'+
     '<div class="form-group"><label>实物图片</label>'+imgs+'</div>'+
     '<div style="color:#999;font-size:12px;margin-top:8px">创建人: '+(a.creator_name||'-')+' | 创建时间: '+(a.created_at||'-')+'</div>';
   document.getElementById('detailModal').classList.add('show');
 }
 function showLightbox(src){document.getElementById('lightboxImg').src=src;document.getElementById('lightbox').style.display='flex'}
 function closeModal(id){document.getElementById(id).classList.remove('show')}
 async function autoFillAsset(){
   var tag=document.getElementById('r_asset_tag').value.trim();
   if(!tag)return;
   var hint=document.getElementById('autoFillHint');
   hint.className='auto-fill-hint';hint.style.display='none';
   try{
     var r=await fetch('/api/asset-platform/query?asset_tag='+encodeURIComponent(tag));
     var d=await r.json();
     if(d.source==='platform'||d.source==='cache'){
       var data=d.data;
       if(data.asset_name)document.getElementById('r_asset_name').value=data.asset_name;
       if(data.brand)document.getElementById('r_brand').value=data.brand;
       if(data.model)document.getElementById('r_model').value=data.model;
       if(data.spec_config)document.getElementById('r_spec_config').value=data.spec_config;
       if(data.start_date)document.getElementById('r_start_date').value=data.start_date;
       if(data.location)document.getElementById('r_location').value=data.location;
       if(data.owner_emp_no)document.getElementById('r_owner_emp_no').value=data.owner_emp_no;
       if(data.owner_name)document.getElementById('r_owner_name').value=data.owner_name;
       hint.textContent='已从资产平台自动填充信息';hint.className='auto-fill-hint show';
     } else {
       hint.textContent=d.msg||'未查询到信息，请手动填写';hint.className='auto-fill-hint error show';
     }
   }catch(e){hint.textContent='查询失败，请手动填写';hint.className='auto-fill-hint error show'}
 }
 async function handleUpload(input,previewId){
   var files=input.files;if(!files.length)return;
   var preview=document.getElementById(previewId);
   for(var i=0;i<files.length;i++){
     var fd=new FormData();fd.append('file',files[i]);
     try{
       var r=await fetch('/api/upload',{method:'POST',body:fd});
       var d=await r.json();
       if(d.url){
         reuseImages.push({url:d.url,filename:d.filename});
         var div=document.createElement('div');div.className='img-item';
         div.innerHTML='<img src="'+d.url+'"><div class="remove" onclick="removeImage(this,'+reuseImages.length+')">&times;</div>';
         preview.appendChild(div);
       }else{alert(d.error||'上传失败')}
     }catch(e){alert('上传失败')}
   }
   input.value='';
 }
 function removeImage(el,idx){reuseImages.splice(idx-1,1);el.parentElement.remove()}
 async function submitReuseAsset(){
   var data={
     asset_tag:document.getElementById('r_asset_tag').value.trim(),
     asset_name:document.getElementById('r_asset_name').value.trim(),
     brand:document.getElementById('r_brand').value.trim(),
     model:document.getElementById('r_model').value.trim(),
     spec_config:document.getElementById('r_spec_config').value.trim(),
     start_date:document.getElementById('r_start_date').value,
     location:document.getElementById('r_location').value.trim(),
     expire_time:document.getElementById('r_expire_time').value,
     status:document.getElementById('r_status').value,
     owner_emp_no:document.getElementById('r_owner_emp_no').value.trim(),
     owner_name:document.getElementById('r_owner_name').value.trim(),
     images:reuseImages
   };
   if(!data.asset_name){alert('资产名称不能为空');return}
   var url=editingAssetId?'/api/reuse-assets/'+editingAssetId:'/api/reuse-assets';
   var method=editingAssetId?'PUT':'POST';
   var r=await fetch(url,{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   var d=await r.json();
   if(d.error){alert(d.error)}else{alert(editingAssetId?'更新成功':'创建成功');editingAssetId=null;reuseImages=[];resetReuseForm();navTo('platform');loadStats()}
 }
 async function submitDemandAsset(){
   var data={
     asset_name:document.getElementById('d_asset_name').value.trim(),
     asset_age:document.getElementById('d_asset_age').value.trim(),
     demand_location:document.getElementById('d_demand_location').value.trim(),
     demander_emp_no:document.getElementById('d_demander_emp_no').value.trim(),
     demander_name:document.getElementById('d_demander_name').value.trim(),
     status:'需求中'
   };
   if(!data.asset_name){alert('资产名称不能为空');return}
   var r=await fetch('/api/demand-assets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   var d=await r.json();
   if(d.error){alert(d.error)}else{alert('创建成功');resetDemandForm();navTo('demand-list');loadStats()}
 }
 function resetReuseForm(){
   ['r_asset_tag','r_asset_name','r_brand','r_model','r_spec_config','r_start_date','r_location','r_expire_time','r_owner_emp_no','r_owner_name'].forEach(function(id){document.getElementById(id).value=''});
   document.getElementById('r_status').value='闲置';document.getElementById('reuseImages').innerHTML='';
   document.getElementById('autoFillHint').style.display='none';reuseImages=[];editingAssetId=null;
 }
 function resetDemandForm(){['d_asset_name','d_asset_age','d_demand_location','d_demander_emp_no','d_demander_name'].forEach(function(id){document.getElementById(id).value=''})}
 async function loadMyAssets(){
   if(!currentUser)return;
   var r1=await fetch('/api/reuse-assets?page=1&page_size=200');var d1=await r1.json();
   var my1=d1.items.filter(function(a){return a.creator_emp_no===currentUser.emp_no});
   var h1='';my1.forEach(function(a){h1+='<tr><td>'+a.asset_tag+'</td><td>'+a.asset_name+'</td><td>'+statusBadge(a.status)+'</td><td>'+(a.expire_time||'-')+'</td><td><button class="btn-sm btn-edit" onclick="editReuseAsset('+a.id+')">编辑</button></td></tr>'});
   document.getElementById('myReuseTable').innerHTML=h1||'<tr><td colspan="5" style="text-align:center;color:#999;padding:30px">暂无发布</td></tr>';
   var r2=await fetch('/api/demand-assets?page=1&page_size=200');var d2=await r2.json();
   var my2=d2.items.filter(function(a){return a.creator_emp_no===currentUser.emp_no});
   var h2='';my2.forEach(function(a){h2+='<tr><td>'+a.asset_name+'</td><td>'+(a.demand_location||'-')+'</td><td>'+statusBadge(a.status)+'</td><td><button class="btn-sm btn-edit" onclick="editDemandAsset('+a.id+')">编辑</button></td></tr>'});
   document.getElementById('myDemandTable').innerHTML=h2||'<tr><td colspan="4" style="text-align:center;color:#999;padding:30px">暂无发布</td></tr>';
 }
 async function editReuseAsset(id){
   var r=await fetch('/api/reuse-assets/'+id);var a=await r.json();
   if(a.error){alert(a.error);return}
   editingAssetId=id;reuseImages=a.images||[];
   document.getElementById('r_asset_tag').value=a.asset_tag||'';
   document.getElementById('r_asset_name').value=a.asset_name||'';
   document.getElementById('r_brand').value=a.brand||'';
   document.getElementById('r_model').value=a.model||'';
   document.getElementById('r_spec_config').value=a.spec_config||'';
   document.getElementById('r_start_date').value=a.start_date||'';
   document.getElementById('r_location').value=a.location||'';
   document.getElementById('r_expire_time').value=a.expire_time||'';
   document.getElementById('r_status').value=a.status||'闲置';
   document.getElementById('r_owner_emp_no').value=a.owner_emp_no||'';
   document.getElementById('r_owner_name').value=a.owner_name||'';
   var prev=document.getElementById('reuseImages');prev.innerHTML='';
   reuseImages.forEach(function(img,idx){
     var div=document.createElement('div');div.className='img-item';
     div.innerHTML='<img src="'+img.url+'"><div class="remove" onclick="removeImage(this,'+(idx+1)+')">&times;</div>';
     prev.appendChild(div);
   });
   navTo('create-reuse');
 }
 async function editDemandAsset(id){
   var r=await fetch('/api/demand-assets/'+id);var a=await r.json();
   if(a.error){alert(a.error);return}
   document.getElementById('d_asset_name').value=a.asset_name||'';
   document.getElementById('d_asset_age').value=a.asset_age||'';
   document.getElementById('d_demand_location').value=a.demand_location||'';
   document.getElementById('d_demander_emp_no').value=a.demander_emp_no||'';
   document.getElementById('d_demander_name').value=a.demander_name||'';
   navTo('create-demand');
 }
 async function loadAdminData(){
   if(!currentUser||currentUser.role!=='admin')return;
   var r1=await fetch('/api/reuse-assets?page=1&page_size=200');var d1=await r1.json();
   var h1='';d1.items.forEach(function(a){
     h1+='<tr><td>'+a.id+'</td><td>'+a.asset_tag+'</td><td>'+a.asset_name+'</td><td>'+statusBadge(a.status)+'</td><td>'+(a.creator_name||'-')+'</td><td><button class="btn-sm btn-edit" onclick="editReuseAsset('+a.id+')">编辑</button><button class="btn-sm btn-delete" onclick="deleteReuseAsset('+a.id+')">删除</button></td></tr>';
   });
   document.getElementById('adminReuseTable').innerHTML=h1||'<tr><td colspan="6" style="text-align:center;color:#999;padding:30px">暂无数据</td></tr>';
   var r2=await fetch('/api/demand-assets?page=1&page_size=200');var d2=await r2.json();
   var h2='';d2.items.forEach(function(a){
     h2+='<tr><td>'+a.id+'</td><td>'+a.asset_name+'</td><td>'+(a.demander_name||'-')+'</td><td>'+statusBadge(a.status)+'</td><td>'+(a.creator_name||'-')+'</td><td><button class="btn-sm btn-edit" onclick="editDemandAsset('+a.id+')">编辑</button><button class="btn-sm btn-delete" onclick="deleteDemandAsset('+a.id+')">删除</button></td></tr>';
   });
   document.getElementById('adminDemandTable').innerHTML=h2||'<tr><td colspan="6" style="text-align:center;color:#999;padding:30px">暂无数据</td></tr>';
   var r3=await fetch('/api/admin/users');var d3=await r3.json();
   var h3='';d3.forEach(function(u){
     h3+='<tr><td>'+u.id+'</td><td>'+u.emp_no+'</td><td>'+u.name+'</td><td>'+(u.role==='admin'?'管理员':'普通用户')+'</td><td><button class="btn-sm btn-edit" onclick="toggleRole('+u.id+',\''+(u.role==='admin'?'user':'admin')+'\')">设为'+(u.role==='admin'?'普通用户':'管理员')+'</button></td></tr>';
   });
   document.getElementById('adminUserTable').innerHTML=h3||'<tr><td colspan="5" style="text-align:center;color:#999;padding:30px">暂无数据</td></tr>';
 }
 async function deleteReuseAsset(id){
   if(!confirm('确认删除该利旧资产？'))return;
   var r=await fetch('/api/reuse-assets/'+id,{method:'DELETE'});
   var d=await r.json();
   if(d.error){alert(d.error)}else{alert('删除成功');loadAdminData();loadStats()}
 }
 async function deleteDemandAsset(id){
   if(!confirm('确认删除该需求资产？'))return;
   var r=await fetch('/api/demand-assets/'+id,{method:'DELETE'});
   var d=await r.json();
   if(d.error){alert(d.error)}else{alert('删除成功');loadAdminData();loadStats()}
 }
 async function toggleRole(uid,role){
   var r=await fetch('/api/admin/users/'+uid+'/role',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:role})});
   var d=await r.json();
   if(d.error){alert(d.error)}else{alert('更新成功');loadAdminData()}
 }
 init();
