"""Original Blender-authored game assets. Run with Blender 4.5 LTS -b -P this file."""
import bpy, math, random, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','assets')
random.seed(41)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def material(name,color,metal=0,rough=.6,emission=0,alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,alpha)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    if alpha<1: p.inputs['Alpha'].default_value=alpha; m.surface_render_method='DITHERED'
    m.diffuse_color=(*color,alpha); return m
mats={
'road':material('Asphalt',(.075,.087,.105),.12,.75),
'pavement':material('Concrete',(.24,.275,.3),0,.85),
'curb':material('Curb',(.34,.37,.4),0,.8),
'white':material('Road marking',(.65,.68,.66),0,.7),
'yellow':material('Lane amber',(.65,.43,.17),0,.7),
'concrete':material('Tower concrete',(.17,.21,.26),.05,.74),
'sand':material('Warm concrete',(.31,.29,.29),0,.77),
'blue':material('Blue facade',(.095,.15,.22),.25,.58),
'glass':material('Glass curtain',(.045,.095,.15),.65,.16),
'frame':material('Architectural steel',(.08,.115,.15),.62,.3),
'window':material('Lit amber windows',(.9,.57,.25),.12,.4,1.1),
'cyan':material('Neon teal',(.06,.79,.78),.25,.27,3),
'pink':material('Neon rose',(.86,.10,.38),.2,.25,3),
'gold':material('Streetlight amber',(1,.68,.28),0,.3,4),
'leaf':material('Palm fronds',(.07,.16,.13),0,.87),
'trunk':material('Palm bark',(.20,.17,.16),0,.92),
'water':material('Harbor water',(.035,.08,.13),.55,.2),
'container':material('Cargo teal',(.075,.23,.24),.35,.64),
'cargo':material('Cargo rust',(.35,.13,.12),.25,.74),
'silver':material('Pearl silver',(.59,.69,.75),.8,.22),
'carbon':material('Carbon graphite',(.018,.024,.032),.55,.3),
'rubber':material('Rubber',(.009,.011,.013),0,.8),
'chrome':material('Machined aluminum',(.6,.65,.68),.95,.18),
'carGlass':material('Smoked glazing',(.018,.055,.080),.55,.08),
'brake':material('Brake caliper',(.8,.07,.035),.4,.35),
'red':material('Rear LED',(1,.035,.025),.25,.22,4),
'head':material('Headlight LED',(.55,.82,1),.2,.18,3),
'seat':material('Leather',(.045,.05,.06),0,.62),
'police':material('Pursuit body',(.024,.041,.065),.65,.25),
'blueLED':material('Emergency blue',(.03,.1,1),.1,.25,4),
'hills':material('Coastal mountain',(.055,.075,.12),0,1),
}
city=[]; collisions=[]
def mesh(name,verts,faces,mat,collection=None):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    if collection is not None: collection.append(o)
    return o

def box(name,loc,size,mat,bevel=0,collection=None):
    x,y,z=[s/2 for s in size]
    v=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    o=mesh(name,v,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],mat,collection)
    o.location=loc
    if bevel:
        b=o.modifiers.new('Crafted bevel','BEVEL'); b.width=bevel; b.segments=2
        b.affect='EDGES'; n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def cb(name,x,z,h,w,d,height,mat): return box(name,(x,-z,h),(w,d,height),mat,collection=city)
def cylinder(name,loc,r,depth,mat,vertices=12,collection=None):
    v=[]
    for zz in [-depth/2,depth/2]:
        for i in range(vertices): a=i*2*math.pi/vertices; v.append((r*math.cos(a),r*math.sin(a),zz))
    f=[tuple(reversed(range(vertices))),tuple(range(vertices,2*vertices))]
    f.extend((i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices))
    o=mesh(name,v,f,mat,collection); o.location=loc; return o

def beam(name,a,b,r,mat,collection=None):
    vec=Vector(b)-Vector(a); o=cylinder(name,(Vector(a)+Vector(b))/2,r,vec.length,mat,8,collection)
    o.rotation_euler=vec.to_track_quat('Z','Y').to_euler(); return o

def text(name,word,x,z,h,size,mat,rot=0):
    curve=bpy.data.curves.new(name,'FONT'); curve.body=word; curve.align_x='CENTER'; curve.size=size; curve.extrude=.008
    o=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(o); o.location=(x,-z,h)
    o.rotation_euler=(math.pi/2,0,rot); o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False); city.append(o); return o

def palm(x,z,height=11):
    top=(x+.65,-z+.3,height)
    beam('Palm trunk',(x,-z,.2),top,.24,mats['trunk'],city)
    for i in range(9):
        a=i*math.tau/9; v=[]
        for j in range(6):
            t=j/5; rr=t*4.2; zz=height+.8*math.sin(t*math.pi)-t*t*1.7; width=.36*math.sin(t*math.pi)+.015
            v.extend([(top[0]+math.cos(a)*rr-math.sin(a)*width,top[1]+math.sin(a)*rr+math.cos(a)*width,zz),
                      (top[0]+math.cos(a)*rr+math.sin(a)*width,top[1]+math.sin(a)*rr-math.cos(a)*width,zz)])
        mesh('Palm sculpted frond',v,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(5)],mats['leaf'],city)

def streetlamp(x,z,side):
    cb('Lamp base',x,z,.3,.6,.6,.6,mats['frame']); cb('Lamp mast',x,z,4.3,.16,.16,8,mats['frame'])
    cb('Lamp arm',x-side*1,z,8.3,2.2,.13,.16,mats['frame']); cb('Lamp luminaire',x-side*2,z,8.2,.65,.35,.12,mats['gold'])

# The city is authored in meters, Blender Z up / -Y north.
cb('City foundation',0,0,-.18,440,440,.3,mats['road'])
roads=[-180,-90,0,90,180]
for p in roads:
    for t in range(-204,205,9):
        if all(abs(t-r)>13 for r in roads):
            cb('Lane dash',p,t,.014,.13,4,.02,mats['white']); cb('Lane dash',t,p,.015,4,.13,.02,mats['white'])
    for side in [-1,1]:
        cb('Double lane',p+side*.23,0,.018,.09,412,.02,mats['yellow'])
        cb('Double lane',0,p+side*.23,.019,412,.09,.02,mats['yellow'])
for x in roads:
    for z in roads:
        for k in range(-7,8,2):
            for side in [-1,1]:
                cb('Crosswalk',x+k,z+side*11.7,.022,1.05,2.5,.024,mats['white'])
                cb('Crosswalk',x+side*11.7,z+k,.023,2.5,1.05,.024,mats['white'])
        cb('Drain grille',x+9.5,z+9.5,.02,1.1,.8,.03,mats['frame'])

sign_words=['NIGHT','KAI','RELAY','COAST','METRO','CROWN','ECHO','RAVEN']
for ix,cx in enumerate([-135,-45,45,135]):
    for iz,cz in enumerate([-135,-45,45,135]):
        cb('Sidewalk island',cx,cz,.12,65,65,.25,mats['pavement'])
        for side in [-1,1]:
            cb('Raised curb',cx+side*32.5,cz,.16,.30,65,.33,mats['curb'])
            cb('Raised curb',cx,cz+side*32.5,.16,65,.3,.33,mats['curb'])
        for bx in [-18,18]:
            for bz in [-18,18]:
                x,z=cx+bx,cz+bz; w,d=random.choice([21,24,27]),random.choice([21,24,27]); h=random.choice([23,28,35,43,54])
                mat=random.choice([mats['concrete'],mats['sand'],mats['blue']])
                cb('Building podium',x,z,2.2,w+1,d+1,4.2,mats['frame'])
                cb('Building facade',x,z,(h+4)/2,w,d,h-4,mat)
                cb('Roof crown',x,z,h,w+1,d+1,.75,mats['frame'])
                cb('Roof plant',x-4,z,h+1.3,6,6,2.4,mats['concrete'])
                cb('Rooftop water tank',x+4,z+4,h+1.5,3,3,3,mats['frame'])
                collisions.append({'x':x,'z':z,'hx':(w+1)/2,'hz':(d+1)/2})
                for face in [-1,1]:
                    for floor in range(6,int(h)-1,4):
                        cb('Horizontal window ribbon',x,z+face*(d/2+.015),floor,w-2,.06,1.9,mats['glass'])
                        cb('Side window ribbon',x+face*(w/2+.015),z,floor,.06,d-2,1.9,mats['glass'])
                        for column in range(-int(w/2)+3,int(w/2)-2,4):
                            if random.random()<.31:
                                cb('Occupied window',x+column,z+face*(d/2+.06),floor,1.4,.06,1.5,mats['window'])
                            cb('Mullion',x+column,z+face*(d/2+.08),floor,.10,.10,2,mats['frame'])
                    for column in [-w/2+1,w/2-1]: cb('Facade vertical',x+column,z+face*d/2,h/2,.3,.3,h,mats['frame'])
                # Shops on the street-facing frontage.
                face=-1 if bz<0 else 1; shopz=z+face*(d/2+.1)
                for col in [-w/3,0,w/3]:
                    cb('Storefront glazing',x+col,shopz,1.8,w/3-.7,.12,2.65,mats['glass'])
                    cb('Shop interior band',x+col,shopz+face*.08,2.8,w/3-1,.1,.2,mats['gold'])
                    cb('Shop awning',x+col,shopz+face*.9,3.6,w/3-.4,1.7,.3,mats['container'])
                neon=mats['cyan'] if (ix+iz)%2==0 else mats['pink']
                cb('Shop fascia',x,shopz+face*.12,4.5,w-.8,.18,.85,neon)
                if face==-1:
                    text('Shop lettering',sign_words[(ix*4+iz+int(bx))%8],x,shopz-.22,4.1,.75,mats['white'])
                if random.random()<.6:
                    signx=x-w/2-.4
                    cb('Vertical sign',signx,shopz,10,.8,.8,9,neon)
                    for j in range(3): cb('Sign segment',signx,shopz-.45,8+j*2.3,.55,.12,1.25,mats['white'])
        for offset in [-25,0,25]:
            palm(cx-30,cz+offset,random.uniform(9,12)); streetlamp(cx+31,cz+offset,1)
            palm(cx+offset,cz+30,random.uniform(9,12))

# Waterfront promenade, sea, port and cranes.
cb('Harbor seawall',213,0,.2,8,450,1.2,mats['concrete']); cb('Harbor water',385,0,-.9,340,900,.15,mats['water'])
for t in range(-210,211,12):
    cb('Promenade rail post',214,t,1.2,.12,.12,1.6,mats['chrome']); cb('Promenade handrail',214,t,1.8,.10,12,.1,mats['chrome'])
    cb('Promenade light',210,t,.4,.55,.55,.65,mats['gold'])
for z in [-160,-100,100,160]:
    cb('Harbor pier',255,z,-.1,80,25,1.5,mats['concrete'])
    for k in range(4):
        cb('Stacked shipping container',235+k*12,z,1.4,10,5.5,2.6,mats['container'] if k%2==0 else mats['cargo'])
        for rib in range(8): cb('Container corrugation',235+k*12-4+rib,z-2.8,1.4,.10,.12,2.3,mats['frame'])
    beam('Crane mast',(265,-z,0),(265,-z,29),.8,mats['yellow'],city)
    beam('Crane jib',(265,-z,29),(295,-z,32),.6,mats['yellow'],city)
    beam('Crane cable',(289,-z,31),(289,-z,7),.06,mats['frame'],city)
# Elevated railway along western boulevard, with station.
for z in range(-195,196,30):
    cb('Metro pier',-27,z,6,1.5,1.5,12,mats['concrete'])
cb('Metro viaduct',-27,0,12.1,8,430,1.1,mats['concrete'])
for x in [-29,-25]: cb('Metro track',x,0,12.85,.16,430,.18,mats['chrome'])
cb('Station deck',-27,45,13,13,44,.5,mats['frame']); cb('Station roof',-27,45,19,16,48,.5,mats['frame'])
for z in range(23,67,6):
    cb('Station glass frame',-33,z,16,.18,.18,5,mats['chrome'])
    cb('Station luminous ribbon',-34,z,18,.12,6,.3,mats['cyan'])
for z in [33,45,57]:
    cb('Metro train',-27,z,15,3.4,10,3,mats['silver']); cb('Metro train windows',-28.8,z,15.4,.1,8,1.1,mats['glass'])
# Distant skyline, tiered towers, mountain ridge.
for j in range(38):
    x=random.uniform(-460,460); z=random.choice([-310,310])+random.uniform(-55,55); h=random.uniform(35,100)
    cb('Skyline tower',x,z,h/2,random.uniform(14,29),random.uniform(14,24),h,mats['blue'])
    for floor in range(6,int(h),8): cb('Skyline illuminated band',x,z-13,floor,8,.15,.5,mats['window'])
for h,w in [(105,30),(118,25),(130,21),(140,17),(148,12)]: cb('Harbor landmark',260,270,h,w,w,9,mats['glass'])
beam('Landmark spire',(260,-270,149),(260,-270,170),.15,mats['gold'],city)
for x in range(-700,701,120):
    bpy.ops.mesh.primitive_cone_add(vertices=9,radius1=random.uniform(140,220),radius2=0,depth=random.uniform(70,140),location=(x,-600,20))
    o=bpy.context.object; o.name='Coastal mountain'; o.data.materials.append(mats['hills']); city.append(o)
# Road direction gantry at spawn corridor.
for x in [-10,10]: cb('Road sign gantry',x,-100,6,.24,.24,12,mats['frame'])
cb('Road sign support',0,-100,12,20,.24,.24,mats['frame'])
cb('Harbor direction board',0,-100,10.8,11,.25,2,mats['container']); text('Harbor signage','HARBOR  /  EAST',0,-100.20,10.2,1,mats['white'])

# Batch evaluated static meshes by sector and material. The .blend still contains
# an authoring collection with individual objects for easy further editing.
def batch_objects(objects):
    groups={}; deps=bpy.context.evaluated_depsgraph_get()
    for o in objects:
        sector=(int(o.location.x//100),int(-o.location.y//100)); mat=o.data.materials[0]
        key=(sector,mat.name)
        if key not in groups: groups[key]=([],[],mat)
        verts,faces,_=groups[key]; off=len(verts)
        ev=o.evaluated_get(deps); data=ev.to_mesh()
        verts.extend(tuple(o.matrix_world@v.co) for v in data.vertices)
        faces.extend(tuple(off+i for i in poly.vertices) for poly in data.polygons)
        ev.to_mesh_clear()
    batch=[]
    for (sector,name),(v,f,m) in groups.items(): batch.append(mesh('City_%d_%d_%s'%(*sector,name),v,f,m))
    return batch
batch=batch_objects(city)
# Hide authoring objects only in the exported selection; keep them editable.
bpy.ops.object.select_all(action='DESELECT')
for o in batch: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'harbor-city.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
for o in batch: bpy.data.objects.remove(o,do_unlink=True)
with open(os.path.join(OUT,'world.json'),'w') as f: json.dump({'colliders':collisions,'roads':roads,'bounds':208},f)
# Save city authoring source before car production.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art-source','harbor-city.blend'))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

# HERO RAVEN: a hand-shaped coupe with lofted metal body, separate wheel assemblies,
# machined rims, brake discs, cabin glazing, LED signatures, diffuser and wing.
parts=[]
def carbox(name,loc,size,mat,bevel=.025): return box(name,loc,size,mat,bevel,parts)
def carmesh(name,v,f,mat): return mesh(name,v,f,mat,parts)
def loft_body():
    sections=[(-2.52,.90,.80),(-2.18,1.05,1.03),(-1.5,1.10,1.14),(-.7,1.05,1.14),(.2,1.08,1.13),(1.4,1.16,1.12),(2.05,1.12,1.06),(2.45,.99,.85)]
    v=[]
    for y,w,h in sections:
        v.extend([(-w*.91,y,.38),(-w,y,.70),(-w*.90,y,h),(-w*.60,y,h+.04),(w*.60,y,h+.04),(w*.90,y,h),(w,y,.70),(w*.91,y,.38)])
    f=[tuple(reversed(range(8))),tuple(range((len(sections)-1)*8,len(sections)*8))]
    for s in range(len(sections)-1):
        for i in range(8): f.append((s*8+i,s*8+(i+1)%8,(s+1)*8+(i+1)%8,(s+1)*8+i))
    o=carmesh('Sculpted widebody',v,f,mats['silver']); b=o.modifiers.new('Body crease softness','BEVEL'); b.width=.055; b.segments=3
    o.modifiers.new('Weighted body normals','WEIGHTED_NORMAL')
loft_body()
# Dark glass greenhouse and pearl roof.
cabin=[(-.83,-1.0,1.1),(.83,-1.0,1.1),(.65,-.30,1.76),(-.65,-.30,1.76),(-.65,.80,1.73),(.65,.80,1.73),(.88,1.58,1.12),(-.88,1.58,1.12)]
carmesh('Windshield',cabin[:4],[(0,1,2,3)],mats['carGlass'])
carmesh('Rear glazing',[cabin[i] for i in [4,5,6,7]],[(0,1,2,3)],mats['carGlass'])
carmesh('Driver window',[cabin[i] for i in [0,3,4,7]],[(0,1,2,3)],mats['carGlass'])
carmesh('Passenger window',[cabin[i] for i in [1,6,5,2]],[(0,1,2,3)],mats['carGlass'])
carmesh('Carbon roof',[cabin[i] for i in [3,2,5,4]],[(0,1,2,3)],mats['carbon'])
for side in [-1,1]:
    for a,b in [((side*.85,-1,1.1),(side*.65,-.30,1.77)),((side*.65,.8,1.75),(side*.89,1.58,1.12))]:
        o=beam('Cabin pillar',a,b,.045,mats['silver']); parts.append(o)
    carbox('Side skirt',(side*1.1,.25,.42),(.15,3.35,.16),mats['carbon'])
    carbox('Door handle',(side*1.10,.45,1.06),(.07,.24,.035),mats['chrome'],.01)
    carbox('Wing mirror',(side*1.20,-.8,1.28),(.28,.32,.14),mats['carbon'])
    carbox('Air intake',(side*1.11,1.20,.81),(.08,.50,.2),mats['carbon'])
    carbox('Seat',(side*.43,.35,1.0),(.62,.60,.60),mats['seat'],.11)
# Hood vents, bumpers, lights and engine deck.
for side in [-1,1]:
    carbox('Hood vent',(side*.57,-1.6,1.158),(.23,.55,.018),mats['carbon'],.01)
    carbox('Headlight eyebrow',(side*.64,-2.38,.91),(.58,.10,.055),mats['head'],.02)
    carbox('Front intake',(side*.62,-2.43,.60),(.54,.12,.20),mats['carbon'])
carbox('Front grille',(0,-2.50,.62),(.64,.05,.16),mats['carbon'])
carbox('Front splitter',(0,-2.39,.34),(2.10,.34,.10),mats['carbon'])
carbox('Rear black fascia',(0,2.37,.91),(1.93,.10,.28),mats['carbon'])
carbox('Continuous red lightbar',(0,2.43,1.025),(1.92,.07,.065),mats['red'],.025)
carbox('Rear bumper',(0,2.40,.59),(1.9,.1,.31),mats['silver'])
carbox('Rear diffuser',(0,2.34,.35),(1.96,.33,.17),mats['carbon'])
for x in [-.75,-.40,0,.40,.75]: carbox('Diffuser fin',(x,2.42,.26),(.045,.40,.20),mats['carbon'],.008)
for x in [-.86,.86]:
    o=cylinder('Titanium exhaust',(x,2.43,.46),.11,.18,mats['chrome'],20); o.rotation_euler=(math.pi/2,0,0); parts.append(o)
carbox('License plate',(0,2.463,.69),(.62,.035,.17),mats['carbon'],.012)
for x in [-.73,.73]: carbox('Wing stanchion',(x,1.93,1.29),(.08,.12,.28),mats['carbon'],.01)
carbox('Rear aero wing',(0,1.93,1.45),(2.18,.35,.07),mats['carbon'],.035)
for x in [-1.09,1.09]: carbox('Wing endplate',(x,1.93,1.45),(.035,.36,.20),mats['carbon'],.01)
# Wheels are parented to named pivots. Each whole assembly can rotate and steer.
for side in [-1,1]:
    for front,y in [(True,-1.60),(False,1.56)]:
        pivot=bpy.data.objects.new(('Wheel_FL' if side<0 else 'Wheel_FR') if front else ('Wheel_RL' if side<0 else 'Wheel_RR'),None)
        bpy.context.collection.objects.link(pivot); pivot.location=(side*1.09,y,.48); parts.append(pivot)
        wheel=[]
        tire=cylinder('Performance tire',(0,0,0),.46,.30,mats['rubber'],32,wheel); tire.rotation_euler=(0,math.pi/2,0)
        rim=cylinder('Forged rim',(side*.163,0,0),.35,.035,mats['chrome'],32,wheel); rim.rotation_euler=(0,math.pi/2,0)
        hub=cylinder('Hub',(side*.188,0,0),.10,.035,mats['carbon'],20,wheel); hub.rotation_euler=(0,math.pi/2,0)
        disc=cylinder('Brake disc',(0,0,0),.28,.02,mats['frame'],24,wheel); disc.rotation_euler=(0,math.pi/2,0)
        for i in range(10):
            a=i*math.tau/10; rr=.22
            spoke=box('Turbine spoke',(side*.19,math.sin(a)*rr,math.cos(a)*rr),(.04,.047,.39),mats['carbon'],.009,wheel); spoke.rotation_euler.x=-a+.25
        cal=box('Red brake caliper',(side*.11,.21,.06),(.10,.10,.32),mats['brake'],.03,wheel)
        for o in wheel: o.parent=pivot; parts.append(o)
# Save edit-friendly master and export evaluated modifiers.
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art-source','raven-coupe.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'raven-coupe.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
# Pursuit variant: same authored silhouette, different body material and roof strobes.
for o in parts:
    if o.type=='MESH':
        for i,m in enumerate(o.data.materials):
            if m==mats['silver']: o.data.materials[i]=mats['police']
carbox('Roof lightbar',(0,.25,1.86),(1.15,.26,.12),mats['carbon'])
carbox('Roof blue strobe',(-.33,.25,1.97),(.40,.25,.08),mats['blueLED'])
carbox('Roof red strobe',(.33,.25,1.97),(.40,.25,.08),mats['red'])
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'pursuit-coupe.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('ASSETS_COMPLETE',len(city),'city authoring objects',len(collisions),'colliders')
