import bpy, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));OUT=os.path.join(ROOT,'public','assets')
for fn in ['raven-coupe.glb','pursuit-coupe.glb']:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT,fn))
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={};original=[]
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        original.append(o);m=o.data.materials[0];key=(o.parent,m)
        if key not in groups:groups[key]=([],[],m,o.parent)
        vs,fs,_,parent=groups[key];offset=len(vs);ev=o.evaluated_get(deps);d=ev.to_mesh();matrix=parent.matrix_world.inverted()@o.matrix_world if parent else o.matrix_world
        vs.extend(tuple(matrix@v.co) for v in d.vertices);fs.extend(tuple(offset+i for i in p.vertices) for p in d.polygons);ev.to_mesh_clear()
    for key,(vs,fs,mat,parent) in groups.items():
        d=bpy.data.meshes.new(mat.name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new('Craft_'+mat.name,d);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat)
    for o in original:bpy.data.objects.remove(o,do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,fn),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
# A beveled navigation gate, authored and saved in Blender too.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,emit):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=.5;p.inputs['Roughness'].default_value=.3;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit;return m
cyan=mat('Navigation cyan',(.02,.75,.72),3);dark=mat('Gate graphite',(.02,.035,.05),0)
def rod(a,b,r,material):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(material)
path=[(-9,0,.1),(-9,0,5.5),(-7,0,7),(7,0,7),(9,0,5.5),(9,0,.1)]
for a,b in zip(path,path[1:]):rod(a,b,.23,dark);rod((a[0],a[1]-.18,a[2]),(b[0],b[1]-.18,b[2]),.09,cyan)
for x in [-9,9]:
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,0,.32));o=bpy.context.object;o.scale=(.9,.7,.64);o.data.materials.append(dark)
for x in [-1,0,1]:rod((x-.25,-.22,6.65),(x+.20,-.22,6.35),.07,cyan);rod((x+.20,-.22,6.35),(x-.25,-.22,6.05),.07,cyan)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art-source','navigation-gate.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'navigation-gate.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
print('OPTIMIZED')
