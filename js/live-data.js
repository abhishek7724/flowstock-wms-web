import { invoke, select } from './supabase-client.js';
export const bootstrapContext=(company_id=null)=>invoke('context-bootstrap',company_id?{company_id}:{});
export const onboardCompany=payload=>invoke('company-onboard',payload);
export const updateModule=(company_id,module_key,enabled)=>invoke('module-update',{company_id,module_key,enabled});
export const createOmsOrder=payload=>invoke('oms-order-create',payload);
export const allocateOrder=(order_id,rule_code=null)=>invoke('wms-order-allocate',{action:'ALLOCATE',order_id,rule_code});
export const releaseAllocatedOrder=(order_id,wave_id=null)=>invoke('wms-order-allocate',{action:'RELEASE',order_id,wave_id});
export const waveCommand=payload=>invoke('wms-wave',payload);
export const taskCommand=payload=>invoke('wms-task',payload);
export const planReplenishment=payload=>invoke('wms-replenishment',payload);
export const packShipCommand=payload=>invoke('wms-pack-ship',payload);
export const queuePrint=payload=>invoke('print-job',payload);
export const printConfig=payload=>invoke('print-config',payload);

export async function loadOperationalData(context){
 const companyId=context.companyId,facilityId=context.facilityId,clientId=context.clientId||null;if(!companyId||!facilityId)return{};
 const fc=q=>{q=q.eq('company_id',companyId).eq('facility_id',facilityId);return clientId?q.eq('client_id',clientId):q.is('client_id',null)};
 const [items,locations,balances,lpns,tasks,events,orders,channels,waves,carriers,printers,agents,printJobs,packContainers,shipments]=await Promise.all([
  select('wms_items','id,client_id,sku,description,base_uom,category,lot_controlled,serial_controlled,expiry_controlled,active',q=>{q=q.eq('company_id',companyId).eq('active',true).order('sku');return clientId?q.or(`client_id.is.null,client_id.eq.${clientId}`):q.is('client_id',null)}),
  select('wms_locations','id,code,location_type,lpn_controlled,lpn_required,blocked,max_units,zone_id,pickable,allocatable,replenishable',q=>q.eq('company_id',companyId).eq('facility_id',facilityId).order('sequence_no').order('code')),
  select('wms_inventory_balances','id,item_id,location_id,lpn_id,lot_code,serial_code,status,expiry_date,on_hand_qty,allocated_qty',q=>fc(q).gt('on_hand_qty',0)),
  select('wms_lpns','id,code',q=>fc(q)),
  select('wms_tasks','id,task_number,task_type,priority,status,item_id,qty,from_location_id,to_location_id,lpn_id,target_lpn_id,reference_type,reference_id,assigned_user_id,allocation_id,wave_id,exception_code',q=>fc(q).order('priority').limit(100)),
  select('wms_business_events','id,event_name,object_type,object_id,payload,created_at',q=>fc(q).order('created_at',{ascending:false}).limit(12)),
  context.modules?.OMS?select('wms_sales_orders','id,order_number,customer_code,status,priority,dispatch_by,risk_score,channel_id,wms_sales_order_lines(id,line_no,item_id,ordered_qty,allocated_qty,picked_qty,shipped_qty,cancelled_qty)',q=>fc(q).order('created_at',{ascending:false}).limit(100)):Promise.resolve([]),
  context.modules?.OMS?select('wms_sales_channels','id,code,name,channel_type',q=>{q=q.eq('company_id',companyId).eq('active',true);return clientId?q.eq('client_id',clientId):q.is('client_id',null)}):Promise.resolve([]),
  context.modules?.WMS?select('wms_waves','id,wave_number,status,order_count,line_count,template_id,planned_at,released_at',q=>fc(q).order('planned_at',{ascending:false}).limit(30)):Promise.resolve([]),
  context.modules?.SHIPPING?select('wms_carriers','id,code,name',q=>q.eq('company_id',companyId).eq('active',true)):Promise.resolve([]),
  (context.modules?.SHIPPING||context.modules?.AUTOMATION)?select('wms_printers','id,code,name,printer_type,transport,agent_id,device_uri,document_format,cloud_endpoint,credential_secret_name,queue_name,active',q=>fc(q).eq('active',true).order('code')):Promise.resolve([]),
  (context.modules?.SHIPPING||context.modules?.AUTOMATION)?select('wms_print_agents','id,code,name,facility_id,active,last_seen_at,version',q=>q.eq('company_id',companyId).eq('facility_id',facilityId).order('code')):Promise.resolve([]),
  (context.modules?.SHIPPING||context.modules?.AUTOMATION)?select('wms_print_jobs','id,printer_id,job_type,document_format,copies,status,attempts,last_error,created_at,completed_at',q=>fc(q).order('created_at',{ascending:false}).limit(50)):Promise.resolve([]),
  context.modules?.SHIPPING?select('wms_pack_containers','id,order_id,container_no,status,package_type,weight,lpn_id,created_at,closed_at,wms_pack_lines(id,order_line_id,qty,lot_code,serial_code)',q=>fc(q).order('created_at',{ascending:false}).limit(50)):Promise.resolve([]),
  context.modules?.SHIPPING?select('wms_shipments','id,shipment_number,order_id,status,tracking_no,manifest_no,package_count,pack_complete,shipped_at',q=>fc(q).order('created_at',{ascending:false}).limit(50)):Promise.resolve([])
 ]);
 const im=new Map(items.map(x=>[x.id,x])),lm=new Map(locations.map(x=>[x.id,x])),pm=new Map(lpns.map(x=>[x.id,x])),cm=new Map(channels.map(x=>[x.id,x])),prm=new Map(printers.map(x=>[x.id,x]));
 const packedByLine=new Map();for(const c of packContainers)for(const pl of (c.wms_pack_lines||[]))packedByLine.set(pl.order_line_id,(packedByLine.get(pl.order_line_id)||0)+Number(pl.qty||0));
 return{
  items:items.map(i=>({id:i.id,sku:i.sku,description:i.description,uom:i.base_uom,category:i.category||'—',lot:i.lot_controlled,serial:i.serial_controlled,expiry:i.expiry_controlled})),
  locations:locations.map(l=>({id:l.id,code:l.code,zone:'—',type:l.location_type,lpnControlled:l.lpn_controlled,lpnRequired:l.lpn_required,blocked:l.blocked,capacity:l.max_units??'—',pickable:l.pickable,allocatable:l.allocatable,replenishable:l.replenishable})),
  inventory:balances.map(b=>({id:b.id,itemId:b.item_id,sku:im.get(b.item_id)?.sku||'UNKNOWN',location:lm.get(b.location_id)?.code||'UNKNOWN',locationId:b.location_id,lpn:b.lpn_id?(pm.get(b.lpn_id)?.code||'LPN'):null,lpnId:b.lpn_id,lot:b.lot_code,serial:b.serial_code,expiry:b.expiry_date,status:b.status,qty:Number(b.on_hand_qty),allocated:Number(b.allocated_qty)})),
  tasks:tasks.map(t=>({uuid:t.id,id:t.task_number,type:t.task_type,priority:t.priority,status:t.status,qty:Number(t.qty||0),from:lm.get(t.from_location_id)?.code||'—',to:lm.get(t.to_location_id)?.code||'—',ref:t.reference_type||'—',referenceId:t.reference_id,assignee:t.assigned_user_id?'Assigned':'Unassigned',exception:t.exception_code||null,waveId:t.wave_id})),
  events:events.map(e=>({time:new Date(e.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),event:e.event_name,ref:e.object_type||'—',detail:summary(e.payload)})),
  channels:channels.map(c=>({id:c.id,code:c.code,name:c.name,type:c.channel_type})),
  orders:orders.map(o=>{const lines=o.wms_sales_order_lines||[];const qty=lines.reduce((s,l)=>s+Number(l.ordered_qty)-Number(l.cancelled_qty||0),0),allocated=lines.reduce((s,l)=>s+Number(l.allocated_qty),0),picked=lines.reduce((s,l)=>s+Number(l.picked_qty),0),shipped=lines.reduce((s,l)=>s+Number(l.shipped_qty),0);return{id:o.id,number:o.order_number,channel:cm.get(o.channel_id)?.name||'Manual',customer:o.customer_code||'—',lines:lines.length,lineData:lines.map(l=>({...l,sku:im.get(l.item_id)?.sku||'UNKNOWN',packed_qty:packedByLine.get(l.id)||0})),qty,allocated,picked,shipped,status:o.status,priority:o.priority,dispatchBy:o.dispatch_by?new Date(o.dispatch_by).toLocaleString():'—',risk:o.risk_score||0}}),
  waves:waves.map(w=>({id:w.id,number:w.wave_number,strategy:w.template_id?'Template':'Ad hoc',orders:w.order_count,lines:w.line_count,status:w.status,plannedAt:w.planned_at,releasedAt:w.released_at})),
  carriers:carriers.map(c=>({id:c.id,code:c.code,name:c.name,services:'Configured services'})),
  printers:printers.map(p=>({id:p.id,code:p.code,name:p.name,type:p.printer_type,transport:p.transport,agentId:p.agent_id,deviceUri:p.device_uri,format:p.document_format,cloudEndpoint:p.cloud_endpoint,credentialSecretName:p.credential_secret_name,queue:p.queue_name,active:p.active})),
  printAgents:agents.map(a=>({id:a.id,code:a.code,name:a.name,active:a.active,lastSeen:a.last_seen_at?new Date(a.last_seen_at).toLocaleString():'Never',version:a.version||'—'})),
  printJobs:printJobs.map(j=>({id:j.id.slice(0,8),uuid:j.id,printer:prm.get(j.printer_id)?.code||'—',type:j.job_type,format:j.document_format,copies:j.copies,status:j.status,attempts:j.attempts,error:j.last_error||'',createdAt:new Date(j.created_at).toLocaleString()})),
  packContainers:packContainers.map(c=>({id:c.id,orderId:c.order_id,number:c.container_no,status:c.status,type:c.package_type,weight:c.weight??'—',lpn:c.lpn_id?pm.get(c.lpn_id)?.code||'LPN':'—',packedQty:(c.wms_pack_lines||[]).reduce((n,x)=>n+Number(x.qty||0),0)})),
  shipments:shipments.map(s=>({id:s.id,number:s.shipment_number,orderId:s.order_id,status:s.status,tracking:s.tracking_no||'—',manifest:s.manifest_no||'—',packages:s.package_count,packComplete:s.pack_complete}))
 };
}
function summary(p){if(!p||typeof p!=='object')return'';return[p.order_number,p.receipt_number,p.task_number,p.shipment_number,p.qty!=null?`${p.qty} qty`:null,p.short_qty?`short ${p.short_qty}`:null].filter(Boolean).join(' · ')||'Business event'}
