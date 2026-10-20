#!/usr/bin/env python3
"""CONQUER Stone Quarry: actual 3D procedural scene -> 24 isometric azimuth SVG sprites.

Geometry is built in stable 3D world coordinates, no canvas rotation is used.
Camera has fixed orthographic isometric pitch and rotates in azimuth in 15° steps.
Generated faces depth-sort per azimuth for proper occlusion and verticality.
"""
import math, random, json
from pathlib import Path
from dataclasses import dataclass

O=Path(__file__).resolve().parents[1]/'src/assets/economy/stone_quarry_rotations'
O.mkdir(parents=True,exist_ok=True)
S=55.0; ELEV=math.asin(1/math.sqrt(3)); SIN_E=math.sin(ELEV); COS_E=math.cos(ELEV)
ORIGIN=(512,620)

rnd=random.Random(330195)

def vadd(a,b):return tuple(x+y for x,y in zip(a,b))
def vsub(a,b):return tuple(x-y for x,y in zip(a,b))
def vmul(a,b):return tuple(x*b for x in a)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def norm(a):return math.sqrt(dot(a,a))
def unit(a):
    l=norm(a)
    return vmul(a,1/l) if l>1e-8 else (1,0,0)

def mix(a,b,t):return vadd(vmul(a,1-t),vmul(b,t))

def rgb(hex): return tuple(int(hex[i:i+2],16) for i in (1,3,5))
def hexc(t):return '#'+''.join(f'{max(0,min(255,round(c))):02x}' for c in t)
def shade(col,f):return hexc(tuple(c*f for c in rgb(col)))

@dataclass
class Face:
    pts:list
    fill:str
    stroke:str='none'
    sw:float=0
    alpha:float=1
    kind:str=''

@dataclass
class Line:
    pts:list
    color:str
    w:float=1.0
    alpha:float=1.0
    kind:str=''

shapes=[]

def poly(pts,color,stroke='none',sw=0,alpha=1,kind=''):
    shapes.append(Face([tuple(v) for v in pts],color,stroke,sw,alpha,kind))
def line(points,color,w=1,alpha=1,kind=''):
    shapes.append(Line([tuple(v) for v in points],color,w,alpha,kind))

GROUND_COLORS=['#74644b','#8a7b5c','#968664','#695d45','#9e8c68']
STONE_COLORS=['#c7c2c4','#9f989d','#afa7a8','#756f73','#a99fa5','#aba8a7','#8c8389','#cdc4bd','#746e70','#b6b0b0']
WOOD=['#775033','#9a6e48','#a8794e','#b08355','#715035','#9a724f','#674833']

# Soil polygon is finite but transparent beyond irregular edge.
terrain=[]
for i in range(60):
    a=2*math.pi*i/60
    r=1+.04*math.sin(i*2.49)+.025*math.cos(i*5.17)
    terrain.append((math.cos(a)*7.65*r,math.sin(a)*6.45*r,-.18))
poly(terrain,'#756647',kind='terrain')
for i in range(450):
    x=rnd.uniform(-7,7);y=rnd.uniform(-5.85,5.85)
    if (x/7.65)**2+(y/6.45)**2>.84:continue
    w=rnd.uniform(.02,.15)
    line([(x,y,-.17),(x+w,y+rnd.uniform(-.05,.07),-.17)],rnd.choice(GROUND_COLORS),rnd.uniform(.5,1.6),rnd.uniform(.25,.62),'earth-detail')

# timber beam as polygonal rectangular prism with world-aligned wood grains
SUN=unit((-.45,-.65,1.4))
def beam(a,b,th=.20,wood='#956a42',details=True,kind='wood-beam'):
    a=tuple(a);b=tuple(b)
    d=unit(vsub(b,a))
    ref=(0,0,1) if abs(dot(d,(0,0,1)))<.92 else (0,1,0)
    u=unit(cross(d,ref));v=unit(cross(d,u))
    ring=[]
    for p in (a,b):
        ring.append([vadd(p,vadd(vmul(u,sgn1*th/2),vmul(v,sgn2*th/2))) for sgn1,sgn2 in [(-1,-1),(1,-1),(1,1),(-1,1)]])
    ra,rb=ring
    for i in range(4):
        j=(i+1)%4
        n=unit(cross(vsub(ra[j],ra[i]),vsub(rb[i],ra[i])))
        lit=max(.63,min(1.18,.87+.3*dot(n,SUN)))
        poly([ra[i],ra[j],rb[j],rb[i]],shade(wood,lit),'#4d3526',.46,1,kind)
        if details and i in (1,2):
            offset=mix(ra[i],ra[j],.38)
            offset2=mix(rb[i],rb[j],.38)
            line([mix(offset,offset2,.1),mix(offset,offset2,.88)],shade(wood,.68),.8,.42,kind+'-grain')
    poly(ra,shade(wood,.84),'#513625',.5,kind=kind)
    poly(rb,shade(wood,1.12),'#5e412b',.5,kind=kind)

# Round timber and cylindrical barrels

def cylinder(a,b,radius,n=10,col='#88603d',capcolor='#c39a69',kind='cylinder',stripes=False):
    a=tuple(a);b=tuple(b)
    d=unit(vsub(b,a))
    ref=(0,0,1) if abs(dot(d,(0,0,1)))<.96 else (0,1,0)
    u=unit(cross(d,ref));v=unit(cross(d,u))
    def ring(p,r):
        return [vadd(p,vadd(vmul(u,math.cos(i*2*math.pi/n)*r),vmul(v,math.sin(i*2*math.pi/n)*r))) for i in range(n)]
    aa=ring(a,radius);bb=ring(b,radius)
    for i in range(n):
        j=(i+1)%n
        nrm=unit(cross(vsub(aa[j],aa[i]),vsub(bb[i],aa[i])))
        light=.72+.28*dot(nrm,SUN)
        if stripes:light*=.92 if i%3==1 else 1
        poly([aa[i],aa[j],bb[j],bb[i]],shade(col,light),'#58402e',.52,kind=kind)
        if stripes:
            line([mix(aa[i],aa[j],.12),mix(bb[i],bb[j],.12)],'#4f3525',.8,.55,kind+'-seam')
    poly(aa,shade(capcolor,.8),'#5a3f2b',.8,kind=kind+'-cap')
    poly(bb,capcolor,'#5a3f2b',1.1,kind=kind+'-cap')
    return aa,bb

def ringline(cx,cy,cz,ra,n=12,color='#554039',width=2.6,axis='z',kind='ring'):
    pts=[]
    for i in range(n+1):
        t=math.pi*2*i/n
        if axis=='z':pts.append((cx+math.cos(t)*ra,cy+math.sin(t)*ra,cz))
        elif axis=='x':pts.append((cx,cy+math.cos(t)*ra,cz+math.sin(t)*ra))
        else:pts.append((cx+math.cos(t)*ra,cy,cz+math.sin(t)*ra))
    line(pts,color,width,1,kind)

# Deck platforms are constructed from actual boards at Z 0.17

def deck(cx,cy,wx,wy,dir='x',kind='deck'):
    # World rectangular platform and visible separate planks parallel X
    wood='#835e3e';rail=wx/2
    # supports slightly off ground
    for yy in [-wy/2+.15,wy/2-.15]:
        beam((cx-wx/2,cy+yy,.10),(cx+wx/2,cy+yy,.10),.15,'#5f402b',False,kind+'-joist')
    N=round(wy/.23)
    for i in range(N):
        y0=-wy/2+i*wy/N+.018;y1=-wy/2+(i+1)*wy/N-.012
        color=WOOD[(i*5+3)%len(WOOD)]
        poly([(cx-wx/2,cy+y0,.18),(cx+wx/2,cy+y0,.18),(cx+wx/2,cy+y1,.18),(cx-wx/2,cy+y1,.18)],color,'#533923',.7,kind=kind+'-plank')
        # edge seams with a little surface grain
        if i%2==0:
            line([(cx-wx/2+.3,cy+y0+.05,.187),(cx+wx/2-.22,cy+y0+.05,.187)],'#dab083',.6,.47,kind+'-wood-grain')
    # cross straps rope
    for x in [cx-wx*.33,cx+wx*.37]:
        line([(x,cy-wy/2,.25),(x,cy+wy/2,.25)],'#b7a17e',3,.9,kind+'-lash')
        line([(x+.065,cy-wy/2,.251),(x+.065,cy+wy/2,.251)],'#564332',1.2,.85,kind+'-lash-shadow')

deck(-3.35,1.0,5.2,3.0,kind='left-platform')
deck(-.3,.56,3.2,1.1,kind='connecting-bridge')
deck(.0,3.45,3.7,2.2,kind='front-platform')

# Timber A-frame gantry on left: four strongly splayed legs, horizontal lintels, diagonals, pulley and sling
G=(-3.55,-1.00)
for y in [-2.25,1.20]:
    beam((-5.65,y-.25,0),(-4.9,y,4.75),.26,'#966c47',kind='left-gantry-leg')
    beam((-1.42,y-.25,0),(-2.18,y,4.75),.27,'#956944',kind='right-gantry-leg')
    beam((-4.90,y,4.68),(-2.18,y,4.68),.35,'#ae8051',kind='gantry-crossbeam')
    beam((-5.05,y,2.00),(-2.03,y,2.55),.16,'#7e5738',kind='gantry-diagonal')
    # rope wraps along the crossbeam end nodes
    for xx in (-4.96,-2.13):
        for j in range(4):
            line([(xx-.22,y-.16,4.70-j*.07),(xx+.22,y+.16,4.70-j*.07)],'#d0b28b',2.8,.95,'gantry-lashing')
for xx in [-4.9,-2.18]:
    beam((xx,-2.25,4.68),(xx,1.2,4.68),.23,'#926c49',kind='gantry-top-rails')
for zz in [1.52,2.67]:
    beam((-5.05,-2.2,zz),(-4.98,1.2,zz+.18),.16,'#885d3a',kind='gantry-lateral-brace')
# Gantry suspended stone basket at far side
pulley=(-3.55,-.90,4.6)
cylinder((-3.56,-.90,4.55),(-3.56,-.90,4.25),.15,col='#715137',capcolor='#9c774d',kind='gantry-pulley')
line([(-3.56,-.90,4.30),(-3.56,-.90,1.90)],'#c6a980',3.4,1,'gantry-rope')
line([(-3.58,-.88,1.90),(-3.9,-1.1,1.43)],'#bda278',2.3,1,'gantry-sling')
line([(-3.58,-.88,1.90),(-3.25,-1.1,1.43)],'#bda278',2.3,1,'gantry-sling')

# Rear stone pile + large loading heap at left + receiving pad heap

def boulder(x,y,z,rx,ry,rz,color,kind='rock'):
    n=6
    phase=rnd.random()*math.pi*2
    lower=[];higher=[]
    for i in range(n):
        t=i*math.pi*2/n+phase
        jitter=rnd.uniform(.78,1.22)
        lower.append((x+rx*math.cos(t)*jitter,y+ry*math.sin(t)*jitter,z))
        higher.append((x+rx*math.cos(t)*jitter*.67+rnd.uniform(-.05,.05),y+ry*math.sin(t)*jitter*.68+rnd.uniform(-.05,.05),z+rz*rnd.uniform(.76,1.15)))
    for i in range(n):
        nxt=(i+1)%n
        nrm=unit(cross(vsub(lower[nxt],lower[i]),vsub(higher[i],lower[i])))
        l=max(.58,min(1.25,.87+.35*dot(nrm,SUN)))
        poly([lower[i],lower[nxt],higher[nxt],higher[i]],shade(color,l),'#524d4e',.5,kind=kind)
    poly(higher,shade(color,1.07),'#534f50',.65,kind=kind+'-top')

def pile(cx,cy,sx,sy,high,count,kind):
    for i in range(count):
        u=rnd.uniform(-1,1);v=rnd.uniform(-1,1)
        rr=(u*u+v*v)**.5
        if rr>1:continue
        rx=rnd.uniform(.13,.37);ry=rnd.uniform(.14,.34);rz=rnd.uniform(.12,.34)
        xx=cx+u*sx;yy=cy+v*sy
        zz=.17+high*max(0,1-rr)**1.45+rnd.uniform(-.04,.15)
        boulder(xx,yy,zz,rx,ry,rz,rnd.choice(STONE_COLORS),kind)

pile(-3.30,.88,1.55,1.0,1.15,105,'gantry-stone-pile')
pile(.28,-2.95,2.05,1.22,1.30,130,'rear-quarry-pile')
pile(.20,3.43,1.25,.82,.82,84,'front-stone-pile')
for i in range(32):
    x=rnd.uniform(-6.35,6.25);y=rnd.uniform(-4.75,5.4)
    if (x+3.3)**2+(y-.9)**2<1.2 or (x-.4)**2+(y+2.9)**2<1.5:continue
    size=rnd.uniform(.07,.2)
    boulder(x,y,-.02,size,size*.83,size*.65,rnd.choice(STONE_COLORS),'scattered-stones')

# Stone basket suspended from pulley (front of left heap)
for i in range(5):
    a=i*2*math.pi/5
    boulder(-3.56+math.cos(a)*.22,-.97+math.sin(a)*.19,1.37,.21,.2,.24,rnd.choice(STONE_COLORS),'gantry-basket-stone')

# Middle right hand crane support, central upright column, triangulated boom
C=(3.18,-.52)
for i in range(7):
    a=i*2*math.pi/7
    base=(C[0]+math.cos(a)*.95,C[1]+math.sin(a)*.83,0)
    beam(base,(C[0],C[1],1.38),.21,'#805638',kind='crane-foot')
# central rotating mast
cylinder((C[0],C[1],.18),(C[0],C[1],3.48),.30,col='#8e603d',capcolor='#b69061',kind='crane-mast',stripes=True)
# cap wooden box
beam((C[0]-.58,C[1]-.52,2.73),(C[0]+.58,C[1]+.43,2.73),.43,'#7f573a',kind='crane-pivot-box')
# boom from central near top to high away from center
apex=(4.47,-2.78,7.32)
beam((C[0],C[1],3.12),apex,.32,'#ad7d50',kind='crane-main-boom')
beam((C[0]+.12,C[1]+.13,3.33),(5.4,1.6,1.25),.23,'#926743',kind='crane-back-stay')
beam((C[0]+.12,C[1]+.10,3.4),(5.14,-.28,2.8),.17,'#a37750',kind='crane-angle-brace')
beam((4.15,-1.90,5.91),(5.14,-.28,2.8),.14,'#866044',kind='crane-diagonal-brace')
beam((4.13,-1.88,5.85),(C[0]+.13,C[1]+.13,3.32),.10,'#614531',kind='crane-truss')
# projecting hand lever at hinge
beam((C[0],C[1],2.86),(1.82,.12,2.78),.19,'#93613c',kind='crane-handle')
# axle pin at high apex
cylinder(vadd(apex,(0,-.18,0)),vadd(apex,(0,.18,0)),.18,col='#6b5038',capcolor='#b38b61',kind='crane-pulley-wheel')
# hanging rope vertical; two strands
line([apex,(apex[0],apex[1],3.40)],'#c5aa85',3.0,1,'crane-cable')
line([vadd(apex,(.07,-.05,0)),(apex[0]+.07,apex[1]-.05,3.45)],'#5d482f',.9,.85,'cable-contrast')
# hanging ring hook, from vertical rope
ringline(apex[0],apex[1],3.25,.22,12,'#414042',2.2,'z','crane-hook')
line([(apex[0],apex[1],3.40),(apex[0],apex[1],3.11)],'#353638',2.4,1,'crane-hook-pin')

# Vertical windlass barrel at base - also 3D, dark metal hoops in horizontal plan
cylinder((C[0],C[1],.86),(C[0],C[1],2.53),.72,col='#a3714b',capcolor='#987150',kind='crane-windlass',stripes=True)
for z in [1.02,1.46,2.17]:ringline(C[0],C[1],z,.735,15,'#54504d',3.3,'z','windlass-hoop')
for i in range(12):
    aa=i*math.pi*2/12
    line([(C[0]+math.cos(aa)*.72,C[1]+math.sin(aa)*.72,.95),(C[0]+math.cos(aa)*.72,C[1]+math.sin(aa)*.72,2.40)],'#4d3526',1.3,.62,'windlass-planking')

# Fallen barrel on right laid on X axis, ribbed staves and iron hoops
bb0=(5.55,2.07,.68);bb1=(7.06,2.07,.68)
cylinder(bb0,bb1,.63,12,col='#976b49',capcolor='#865c3d',kind='fallen-barrel',stripes=True)
for x in [5.70,6.88]:ringline(x,2.07,.68,.645,16,'#555152',4,'x','fallen-barrel-hoop')
ringline(7.063,2.07,.68,.57,16,'#4e3a2d',5,'x','fallen-barrel-rim')
# Add several small stacked timber planks near gantry
for j in range(4):
    beam((-1.75,1.88,.18+j*.16),(.0,2.01,.18+j*.16),.13,'#8e6541',kind='stored-timber')

# Isometric projector: 24 fixed-pitch orthographic views, each with per-element depth ordering

def render(angle):
    az=math.radians(angle+45) # Keep 0-degree front-left three-quarter view akin reference
    cs=math.cos(az);sn=math.sin(az)
    def project(p):
        x,y,z=p
        return (ORIGIN[0]+S*(x*cs-y*sn),ORIGIN[1]+S*((x*sn+y*cs)*SIN_E-z*COS_E))
    def depth(p):return (p[0]*sn+p[1]*cs)*COS_E+p[2]*SIN_E
    # Sort far to near by camera depth, and slight priority for any ground texture.
    def sort_key(sh):
        dep=sum(depth(p) for p in sh.pts)/len(sh.pts)
        if sh.kind=='terrain':dep-=15
        if sh.kind=='earth-detail':dep-=14
        return dep
    def f(p):return f'{p:.2f}'.rstrip('0').rstrip('.')
    out=[f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
<title id="title">CONQUER Stone Quarry — isometric azimuth {angle} degrees</title>
<desc id="desc">True world-space geometry projected with a fixed isometric camera elevation of 35.264 degrees and yaw {angle} degrees. Vertical structures remain upright at every viewpoint.</desc>
''']
    prev=None
    for sh in sorted(shapes,key=sort_key):
        if sh.kind!=prev:
            if prev is not None:out.append('</g>')
            out.append(f'<g data-part="{sh.kind}">');prev=sh.kind
        pp=[project(p) for p in sh.pts]
        if isinstance(sh,Face):
            attrs=f' fill="{sh.fill}"'
            if sh.stroke!='none':attrs+=f' stroke="{sh.stroke}" stroke-width="{f(sh.sw)}" stroke-linejoin="round"'
            if sh.alpha!=1:attrs+=f' opacity="{f(sh.alpha)}"'
            out.append('<polygon points="'+' '.join(f'{f(x)},{f(y)}' for x,y in pp)+'"'+attrs+'/>')
        else:
            attrs=f' fill="none" stroke="{sh.color}" stroke-width="{f(sh.w)}" stroke-linecap="round" stroke-linejoin="round"'
            if sh.alpha!=1:attrs+=f' opacity="{f(sh.alpha)}"'
            out.append('<polyline points="'+' '.join(f'{f(x)},{f(y)}' for x,y in pp)+'"'+attrs+'/>')
    if prev is not None:out.append('</g>')
    out.append('</svg>')
    return '\n'.join(out)+'\n'

def main():
    sprites=[]
    for i in range(24):
        a=i*15
        name=f'stone_quarry_{a:03d}.svg'
        text=render(a)
        (O/name).write_text(text,encoding='utf-8')
        sprites.append({'degrees':a,'path':'./stone_quarry_rotations/'+name})
    manifest={
        'asset':'stone_quarry',
        'engine':'3d-world-projected-to-svg',
        'frame_count':24,
        'angle_step_degrees':15,
        'camera_pitch_degrees':round(math.degrees(ELEV),6),
        'azimuth_rotation_degrees':360,
        'projection':'orthographic isometric; view remains upright; actual 3D model transforms and occlusion',
        'world_anchor':'scene center',
        'viewBox':'0 0 1024 1024',
        'transparent_background':True,
        'generator':'tools/generate-stone-quarry-isometric.py',
        'sprites':sprites
    }
    (O.parent/'stone_quarry_rotations.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    preview='''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cava di pietra: 24 angoli isometrici</title><style>body{font:16px system-ui;background:#1d221e;color:#eadfca;padding:24px}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}figure{margin:0;padding:8px;border-radius:10px;background:#353c34}img{width:100%;aspect-ratio:1}figcaption{text-align:center;padding:5px}</style></head><body><h1>Cava di pietra — rotazioni isometriche reali</h1><p>24 viste, camera isometrica fissa, rotazione in azimut di 15°. Tutti i pali rimangono verticali.</p><main>'''
    preview+=''.join(f'<figure><img src="./stone_quarry_rotations/stone_quarry_{i*15:03d}.svg" alt="Cava vista a {i*15}°"><figcaption>{i*15:03d}°</figcaption></figure>' for i in range(24))+'</main></body></html>\n'
    (O.parent/'stone_quarry_rotation_preview.html').write_text(preview,encoding='utf-8')
    print('wrote',len(sprites),'frames;',len(shapes),'geometry elements;',sum((O/f'stone_quarry_{i*15:03d}.svg').stat().st_size for i in range(24)),'bytes')

if __name__=='__main__':main()
