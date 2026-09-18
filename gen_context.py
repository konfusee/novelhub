"""NovelHub context: separate business data flows; shared Draw.io/PNG geometry."""
from pathlib import Path
import math, xml.etree.ElementTree as ET
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, FancyArrowPatch
OUT=Path(__file__).parent
W,H=3400,3000
CX,CY,R=1700,1500,550
INK='#000000'; MUTED='#000000'; BLUE='#000000'; TEAL='#000000'
# in/out are relative to NovelHub. Each label describes one data flow.
E={
'reader':('Reader','actor',[
('in','Profile data'),
('in','Browse catalog'),
('out','Story catalog'),
('in','Search / filter'),
('out','Search results'),
('in','View story / chapter'),
('out','Story / chapter content'),
('in','Read / listen request'),
('out','Story content / audio'),
('in','Reading position'),
('out','Reading progress'),
('in','Follow / comment / rate'),
('in','Content reports'),
('out','Notifications')]),
'guest':('Guest','actor',[
('in','Registration data'),
('out','Registration result'),
('in','Authentication request'),
('out','Authentication result'),
('in','Browse catalog'),
('out','Story catalog'),
('in','Search / filter'),
('out','Search results'),
('in','View story / chapter'),
('out','Story / chapter content'),
('in','Read / listen request'),
('out','Story content / audio')]),
'author':('Author','actor',[
('in','Author application'),
('out','Application result'),
('in','Story & chapter drafts'),
('in','PDF & media uploads'),
('in','Usage-rights declarations'),
('in','Publication submissions'),
('out','Saved / imported drafts'),
('out','Publication status & review feedback'),
('out','Story statistics')]),
'moderator':('Moderator','actor',[
('out','Pending submissions'),
('out','Reports & reported content'),
('out','Similarity findings'),
('in','Publication review decisions'),
('in','Report resolutions & content actions'),
('out','Moderation history')]),
'admin':('Admin','actor',[
('in','User-management changes'),
('in','Role & permission changes'),
('in','Category & platform-content changes'),
('out','Administrative records'),
('out','Escalated reports'),
('in','Escalation decisions'),
('out','System statistics & audit logs')]),
 'storage':('Object Storage','external',[
('out','Media files / retrieval requests'),('in','Media URLs / file content')]),
 'tts':('TTS Service','external',[
('out','Text & voice settings'),('in','Generated audio')]),
 'embedding':('Vector Embedding\nService','external',[
('out','Text segments'),('in','Embedding vectors')]),
 'email':('Email Service','external',[
('out','Recipient email & message content')]),
 'ai':('AI Service','external',[
('out','Content for summarization / tagging'),('in','Summaries & metadata')]),
 'oauth':('Authentication\nProvider\n(Google OAuth)','external',[
('out','Authentication request'),('in','Authentication result & identity')])}
assert sum(len(v[2]) for v in E.values()) == 59
boxes={
 'oauth':(3090,700,250,180),
 'guest':(60,1050,250,450),
 'reader':(60,1520,250,450),
 'ai':(60,700,250,190),
 'tts':(60,2150,250,190),
 'embedding':(3090,1200,250,190),
 'storage':(3090,1410,250,160),
 'author':(3090,1580,250,500),
 'email':(60,2450,250,160),
 'moderator':(60,200,250,295),
 'admin':(3090,2550,250,328),
}
 # Keep side ports inside the circle's vertical span so most connectors stay straight.
port_offsets={
 'guest':[30,65,100,135,170,205,240,275,310,345,380,415],
 'reader':[25,54,83,112,141,170,199,228,257,286,315,344,373,402],
 'author':[32,72,120,168,220,272,320,368,416],
 'oauth':[48,129], 'embedding':[35,116], 'storage':[44,121],
 'ai':[29,138], 'tts':[53,129], 'email':[79],
}
# Small deterministic offsets keep the layout from feeling mechanically perfect
# without sacrificing its visible alignment.
MICRO_X=(0,-6,4,-3,7,-4,3,-2,5,-5,2,-1,6,-3,1)
MICRO_Y=(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
MICRO_BEND=(0,2,-1,3,-2,1,-3,2,-1,0,2,-2,1,-1,3)
flows=[]
for names,side in [(['ai','guest','reader','tts','email'],'L'),(['oauth','embedding','storage','author'],'R')]:
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
   ny=top+50+40*above_pos[i]
  elif i in below_pos:
   ny=bottom-120+25*below_pos[i]
  else:
   ny=f['ey']
  extent=math.sqrt(R*R-(ny-CY)**2)
  start=(310,f['ey']) if side=='L' else (3090,f['ey'])
  end=(CX-extent,ny) if side=='L' else (CX+extent,ny)
  if abs(f['ey']-ny)<1:
   f['points']=[start,end]
  else:
   if side=='R':
    bend=2300+8*i if f['ey']<ny else 2300-8*i
   else:
    bend=1100-8*i if f['ey']<ny else 1100+8*i
   f['points']=[start,(bend,f['ey']),(bend,ny),end]
  f['lx']=(650 if side=='L' else 2750)+MICRO_X[i%len(MICRO_X)]
  f['ly']=f['ey']-16+MICRO_Y[i%len(MICRO_Y)];f['lw']=660;f['lh']=32
 flows.extend(group)
# Upper/lower connections: vertical from the circle, one 90-degree bend,
# then a labeled horizontal segment to a side-positioned actor.
for name,side in [('moderator','T'),('admin','B')]:
 x,y,w,h=boxes[name];n=len(E[name][2])
 for i,(direction,label) in enumerate(E[name][2]):
  ey=([195,232,281,315,362,420] if side=='T' else [2580,2616,2665,2699,2750,2790,2836])[i]
  nx=((1910-74*i) if side=='T' else (1930-69*i))+MICRO_BEND[i]
  extent=math.sqrt(R*R-(nx-CX)**2)
  ny=CY-extent if side=='T' else CY+extent
  ex=x+w if side=='T' else x
  f=dict(entity=name,side=side,direction=direction,label=label,
         points=[(ex,ey),(nx,ey),(nx,ny)],
         lx=(800 if side=='T' else 2600)+MICRO_X[i+3],
         ly=ey-16+MICRO_Y[i+3],lw=660,lh=32)
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
im=Image.open(OUT/'novelhub_context_refined.png');im.load();assert im.size==(4760,4200)
print(f'OK: {len(E)} entities; {len(flows)} distinct directed flows; no connector crossings; label bounds checked; PNG decoded.')
