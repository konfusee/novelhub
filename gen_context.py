"""NovelHub context: separate business data flows; shared Draw.io/PNG geometry."""
from pathlib import Path
import math, xml.etree.ElementTree as ET
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, FancyArrowPatch
OUT=Path(__file__).parent
W,H=3400,3350
CX,CY,R=1700,1600,700
INK='#000000'; MUTED='#000000'; BLUE='#000000'; TEAL='#000000'
# in/out are relative to NovelHub. Each label describes one data flow.
E={
'reader':('Reader','actor',[
('in','Profile data'),
('in','Browse catalog'),('out','Story catalog'),
('in','Search / filter'),('out','Search results'),
('in','View story / chapter'),('out','Story / chapter content'),
('in','Read / listen request'),('out','Story content / audio'),
('in','Reading position'),('out','Reading progress'),
('in','Follow / comment / rate'),('in','Content reports'),('out','Notifications'),
('in','Coin top-up request'),('out','Top-up status / coin balance'),
('in','Early chapter unlock request'),('out','Unlock result / chapter access')]),
'guest':('Guest','actor',[
('in','Registration data'),('out','Registration result'),
('in','Authentication request'),('out','Authentication result'),
('in','Browse catalog'),('out','Story catalog'),
('in','Search / filter'),('out','Search results'),
('in','View story / chapter'),('out','Story / chapter content'),
('in','Read / listen request'),('out','Limited story content / audio')]),
'author':('Author','actor',[
('in','Author application'),('out','Application result'),
('out','Story template / format rules'),('in','Formatted story / chapter'),
('in','PDF & media uploads'),('in','Rights / license declaration'),
('in','X-day lock & coin price'),('in','Publication submission'),
('out','Saved / imported drafts'),('out','Publication status / feedback'),
('out','Story statistics'),('out','Earnings balance / 70% share'),
('in','Withdrawal request'),('out','Withdrawal status / payout record')]),
'moderator':('Moderator','actor',[
('out','Pending submissions'),('out','Reports / reported content'),
('out','Similarity findings'),('out','AI review results / risk flags'),
('in','Publication review decisions'),
('in','Report resolutions / content actions'),('out','Moderation history')]),
'admin':('Admin','actor',[
('in','User-management changes'),('in','Role / permission changes'),
('in','Category / content changes'),('out','Administrative records'),
('out','System statistics / audit logs'),('in','Coin rate / revenue policy'),
('out','Pending withdrawal requests'),('in','Withdrawal approval / rejection'),
('in','Wallet / transaction controls'),('out','Finance / wallet reports'),
('out','System revenue / 30% share')]),
'storage':('VPSTTT Object\nStorage','external',[
('out','Media files / retrieval requests'),('in','Media URLs / file content')]),
'tts':('TTS Service','external',[
('out','Text & voice settings'),('in','Generated audio')]),
'embedding':('OpenAI Embedding\nService','external',[
('out','Text segments'),('in','Embedding vectors')]),
 'email':('Gmail SMTP\nService','external',[
('out','Recipient email / message'),('in','SMTP acceptance / error')]),
'ai':('OpenAI LLM\nService','external',[
('out','Author content / prompts'),('in','Writing / metadata suggestions'),
('out','Moderation content / criteria'),('in','Review suggestions / risk flags')]),
'oauth':('Authentication\nProvider\n(Google OAuth)','external',[
('out','Authentication request'),('in','Authentication result / identity')]),
'payment':('Payment Gateway','external',[
('out','Top-up / payout request'),('in','Payment / payout result')])}
assert sum(len(v[2]) for v in E.values()) == 78
boxes={
 'oauth':(3090,500,250,180),
 'payment':(3090,720,250,170),
 'guest':(60,1050,250,450),
 'reader':(60,1520,250,570),
 'ai':(60,500,250,190),
 'tts':(60,2110,250,190),
 'embedding':(3090,970,250,190),
 'storage':(3090,1190,250,160),
 'author':(3090,1370,250,650),
 'email':(60,2450,250,190),
 'moderator':(60,100,250,350),
 'admin':(3090,2800,250,450),
}
# Flow ports are evenly spaced inside each entity box.
port_offsets={
 'guest':[30,65,100,135,170,205,240,275,310,345,380,415],
 'reader':[25,56,87,118,149,180,211,242,273,304,335,366,397,428,459,490,521,552],
 'author':[35,79,123,167,211,255,299,343,387,431,475,519,563,607],
 'oauth':[48,129], 'payment':[42,128],
 'embedding':[35,116], 'storage':[44,121],
 'ai':[30,75,120,165], 'tts':[53,129], 'email':[55,115],
}
# Small deterministic offsets keep the layout from feeling mechanically perfect
# without sacrificing its visible alignment.
MICRO_X=(0,-6,4,-3,7,-4,3,-2,5,-5,2,-1,6,-3,1)
MICRO_Y=(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
MICRO_BEND=(0,2,-1,3,-2,1,-3,2,-1,0,2,-2,1,-1,3)
flows=[]
for names,side in [(['ai','guest','reader','tts','email'],'L'),(['oauth','payment','embedding','storage','author'],'R')]:
 group=[]
 for name in names:
  x,y,w,h=boxes[name]; n=len(E[name][2])
  for j,(direction,label) in enumerate(E[name][2]):
   ey=y+port_offsets[name][j]
   group.append(dict(entity=name,side=side,direction=direction,label=label,ey=ey))
 top=CY-R;bottom=CY+R
 above=[j for j,g in enumerate(group) if g['ey']<top]
 below=[j for j,g in enumerate(group) if g['ey']>bottom]
 above_pos={j:k for k,j in enumerate(above)}
 below_pos={j:k for k,j in enumerate(below)}
 for i,f in enumerate(group):
  if i in above_pos:
   ny=top+20+25*above_pos[i]
  elif i in below_pos:
   ny=bottom-20-25*(len(below)-1-below_pos[i])
  else:
   ny=f['ey']
  extent=math.sqrt(R*R-(ny-CY)**2)
  start=(310,f['ey']) if side=='L' else (3090,f['ey'])
  end=(CX-extent,ny) if side=='L' else (CX+extent,ny)
  if abs(f['ey']-ny)<1:
   f['points']=[start,end]
  else:
   if side=='R':
    bend=2750+6*i if f['ey']<ny else 2750-6*i
   else:
    bend=1050-6*i if f['ey']<ny else 1050+6*i
   f['points']=[start,(bend,f['ey']),(bend,ny),end]
  routed=abs(f['ey']-ny)>=1
  f['lx']=((start[0]+bend)/2 if routed else (start[0]+end[0])/2)
  f['ly']=f['ey']-16;f['lw']=660;f['lh']=32
 flows.extend(group)
# Upper/lower connections: vertical from the circle, one 90-degree bend,
# then a labeled horizontal segment to a side-positioned actor.
for name,side in [('moderator','T'),('admin','B')]:
 x,y,w,h=boxes[name];n=len(E[name][2])
 for i,(direction,label) in enumerate(E[name][2]):
  ey=y+25+(h-50)*i/(n-1)
  nx=CX+100-200*i/(n-1)+MICRO_BEND[i]
  extent=math.sqrt(R*R-(nx-CX)**2)
  ny=CY-extent if side=='T' else CY+extent
  ex=x+w if side=='T' else x
  f=dict(entity=name,side=side,direction=direction,label=label,
         points=[(ex,ey),(nx,ey),(nx,ny)],
         lx=(ex+nx)/2,ly=ey-16,lw=660,lh=32)
  flows.append(f)
for f in flows:
 f['source']=f['entity'];f['target']='novelhub'
 if f['direction']=='out':
  f['points'].reverse();f['source'],f['target']=f['target'],f['source']
# Check routing before writing.
segments=[]
for i,f in enumerate(flows):
 for a,b in zip(f['points'],f['points'][1:]):
  assert a[0]==b[0] or a[1]==b[1]
  segments.append((i,a,b))
violations=[]
for k,(i,a,b) in enumerate(segments):
 for j,c,d in segments[k+1:]:
  if i==j:continue
  h1=a[1]==b[1];h2=c[1]==d[1]
  if h1==h2:
   fixed,axis=(1,0) if h1 else (0,1)
   hit=abs(a[fixed]-c[fixed])<.01 and min(max(a[axis],b[axis]),max(c[axis],d[axis]))>max(min(a[axis],b[axis]),min(c[axis],d[axis]))+.01
  else:
   u,v,p,q=(a,b,c,d) if h1 else (c,d,a,b)
   hit=min(u[0],v[0])<=p[0]<=max(u[0],v[0]) and min(p[1],q[1])<=u[1]<=max(p[1],q[1])
  if hit:violations.append((i,j))
assert not violations,violations
mx=ET.Element('mxfile',host='app.diagrams.net',type='device')
dia=ET.SubElement(mx,'diagram',name='NovelHub Context',id='novelhub-context')
model=ET.SubElement(dia,'mxGraphModel',grid='1',page='1',pageWidth=str(W),pageHeight=str(H))
root=ET.SubElement(model,'root');ET.SubElement(root,'mxCell',id='0');ET.SubElement(root,'mxCell',id='1',parent='0')
fig=plt.figure(figsize=(W/100,H/100),dpi=100,facecolor='white');ax=fig.add_axes((0,0,1,1));ax.set(xlim=(0,W),ylim=(H,0),aspect='equal');ax.axis('off')
text_artists=[]
def vertex(id,label,x,y,w,h,style):
 c=ET.SubElement(root,'mxCell',id=id,value=label,style=style,vertex='1',parent='1')
 ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})
def text(id,label,x,y,w,h,size=22,bold=False,color=INK,background=False):
 style=f'text;html=0;align=center;verticalAlign=middle;whiteSpace=wrap;fontFamily=Helvetica;fontSize={size};fontColor={color};fontStyle={1 if bold else 0};strokeColor=none;fillColor={"#FFFFFF" if background else "none"};fillOpacity={100 if background else 0};labelBackgroundColor=none;labelBorderColor=none;'
 vertex(id,label,x-w/2,y-h/2,w,h,style)
 a=ax.text(x,y,label,ha='center',va='center',fontsize=size*.72,fontweight='bold' if bold else 'normal',fontfamily='DejaVu Sans',color=color,linespacing=1.35,bbox=dict(facecolor='white',edgecolor='none',pad=2) if background else None)
 text_artists.append((a,x-w/2,y-h/2,w,h))
vertex('novelhub','',CX-R,CY-R,2*R,2*R,f'ellipse;fillColor=#FFFFFF;strokeColor={BLUE};strokeWidth=2.4;')
ax.add_patch(Circle((CX,CY),R,facecolor='#FFFFFF',edgecolor=BLUE,linewidth=1.75))
text('system-name','NovelHub',CX,CY,900,100,54,True,color=BLUE)
text('system-description',
     'AI-assisted platform for creating, publishing, discovering,\n'
     'reading, and moderating multimedia novels.',
     CX,CY+105,1100,120,24,False,color=BLUE)
for name,(x,y,w,h) in boxes.items():
 label,kind,_=E[name];color=BLUE if kind=='actor' else TEAL;fill='#FFFFFF'
 vertex(name,label,x,y,w,h,f'rounded=0;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;fontSize=20;fontStyle=1;fontColor={color};fillColor={fill};strokeColor={color};strokeWidth=1.7;')
 ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='square,pad=0',facecolor=fill,edgecolor=color,linewidth=1.2))
 a=ax.text(x+w/2,y+h/2,label,ha='center',va='center',fontsize=14.4,fontweight='bold',fontfamily='DejaVu Sans',color=color,linespacing=1.4)
 text_artists.append((a,x+8,y+8,w-16,h-16))
bounds={**boxes,'novelhub':(CX-R,CY-R,2*R,2*R)}
for i,f in enumerate(flows,1):
 pts=f['points'];color=BLUE if f['direction']=='in' else TEAL
 sx,sy,sw,sh=bounds[f['source']];tx,ty,tw,th=bounds[f['target']];p,q=pts[0],pts[-1]
 style=f'edgeStyle=none;rounded=0;html=0;endArrow=block;endFill=1;endSize=8;strokeColor={color};strokeWidth=1.5;exitX={(p[0]-sx)/sw};exitY={(p[1]-sy)/sh};exitPerimeter=0;entryX={(q[0]-tx)/tw};entryY={(q[1]-ty)/th};entryPerimeter=0;'
 c=ET.SubElement(root,'mxCell',id=f'flow-{i}',edge='1',parent='1',source=f['source'],target=f['target'],style=style)
 g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'});arr=ET.SubElement(g,'Array',**{'as':'points'})
 for x,y in pts[1:-1]:ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
 ax.plot([p[0] for p in pts],[p[1] for p in pts],color=color,linewidth=1)
 ax.add_patch(FancyArrowPatch(pts[-2],pts[-1],arrowstyle='-|>',mutation_scale=13,linewidth=1,color=color,shrinkA=0,shrinkB=0))
 text(f'label-{i}',f['label'],f['lx'],f['ly'],f['lw'],f['lh'],20,background=False)
fig.canvas.draw();renderer=fig.canvas.get_renderer()
for a,x,y,w,h in text_artists:
 b=a.get_window_extent(renderer).transformed(ax.transData.inverted())
 assert b.xmin>=x and b.xmax<=x+w and b.ymin>=y and b.ymax<=y+h,a.get_text()
ET.indent(mx);ET.ElementTree(mx).write(OUT/'novelhub_context_refined.drawio',encoding='utf-8',xml_declaration=True)
fig.savefig(OUT/'novelhub_context_refined.png',dpi=140,facecolor='white');plt.close(fig)
from PIL import Image
im=Image.open(OUT/'novelhub_context_refined.png');im.load();assert im.size==(4760,4690)
print(f'OK: {len(E)} entities; {len(flows)} distinct directed flows; no connector crossings; label bounds checked; PNG decoded.')
