"""Offline path-traced posters of production geometry, not browser/GPU screenshots.
Requires Mitsuba 3.9.1, NumPy and Pillow. Live Three shaders remain a separate QA path.
"""
import argparse,json,time
from pathlib import Path
import numpy as np
import mitsuba as mi
from PIL import Image
mi.set_variant('llvm_ad_rgb')
parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('output');parser.add_argument('--samples',type=int,default=64);parser.add_argument('--only');parser.add_argument('--scale',type=float,default=1);args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)

def studio(config):
    w,h=512,256
    xx,yy=np.meshgrid(np.arange(w),np.arange(h))
    theta=(xx+.5)/w*2*np.pi;phi=(yy+.5)/h*np.pi
    directions=np.stack([np.sin(phi)*np.sin(theta),np.cos(phi),-np.sin(phi)*np.cos(theta)],axis=-1)
    radiance=np.broadcast_to(np.array(config['background']), (h,w,3)).copy()
    for light in config['lights']:
        m=np.array(light['matrix']).reshape(4,4).T;center=m[:3,3];normal=m[:3,2]
        denominator=directions@normal
        t=np.divide(center@normal,denominator,out=np.full((h,w),-1.),where=np.abs(denominator)>.0001)
        relative=directions*t[...,None]-center
        u=relative@m[:3,0];v=relative@m[:3,1]
        mask=(t>0)&(np.abs(u)<light['width']/2)&(np.abs(v)<light['height']/2)
        radiance[mask]=light['color']
    return mi.Bitmap(radiance.astype(np.float32))

def aces(x):
    a=np.array([[.59719,.35458,.04823],[.076,.90834,.01566],[.02840,.13383,.83777]])
    b=np.array([[1.60475,-.53108,-.07367],[-.10208,1.10813,-.00605],[-.00327,-.07276,1.07602]])
    v=x*1.25/.6;v=v@a.T
    v=(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081)
    v=np.clip(v@b.T,0,1)
    return np.where(v<=.0031308,12.92*v,1.055*np.power(v,1/2.4)-.055)

for path in sorted(Path(args.source).glob('*.json')):
    if args.only and args.only not in path.stem:continue
    config=json.loads(path.read_text());w=round(config['width']*args.scale);h=round(config['height']*args.scale)
    scene={'type':'scene','integrator':{'type':'path','max_depth':8,'hide_emitters':True},'environment':{'type':'envmap','bitmap':studio(config),'scale':.85},
      'sensor':{'type':'perspective','fov':33,'fov_axis':'y','to_world':mi.ScalarTransform4f().look_at(origin=[0,0,config['distance']],target=[0,0,0],up=[0,1,0]),
        'sampler':{'type':'independent','sample_count':args.samples},'film':{'type':'hdrfilm','width':w,'height':h,'pixel_format':'rgba','rfilter':{'type':'tent'}}},
      'key':{'type':'directional','direction':[3,-5,-7],'irradiance':{'type':'rgb','value':[1.0,.94,.87]}},
      'rim':{'type':'directional','direction':[-4,2,-4],'irradiance':{'type':'rgb','value':(np.array(config['accent'])*.9).tolist()}}}
    for i,mesh in enumerate(config['meshes']):
        m=mesh['material'];color=np.array(m['color'])
        if m['transmission']>0:
            bsdf={'type':'thindielectric','int_ior':m['ior'],'specular_transmittance':{'type':'rgb','value':[.96,.97,.99]}}
        elif m['opacity']<1:
            bsdf={'type':'blendbsdf','weight':m['opacity'],'bsdf_0':{'type':'null'},'bsdf_1':{'type':'diffuse','reflectance':{'type':'rgb','value':color.tolist()}}}
        elif m['metalness']>.5:
            bsdf={'type':'roughconductor','distribution':'ggx','material':'Al','alpha':max(.025,m['roughness']**2),'specular_reflectance':{'type':'rgb','value':np.clip(color,0,1).tolist()}}
        else:
            bsdf={'type':'roughplastic','distribution':'ggx','alpha':max(.04,m['roughness']**2),'diffuse_reflectance':{'type':'rgb','value':np.clip(color,0,1).tolist()}}
        scene[f'mesh_{i}']={'type':'ply','filename':mesh['filename'],'bsdf':bsdf}
    start=time.time();rendered=np.asarray(mi.render(mi.load_dict(scene),spp=args.samples));rgb=aces(rendered[...,:3]);alpha=np.clip(rendered[...,3:4],0,1)
    image=Image.fromarray(np.uint8(np.concatenate([rgb,alpha],axis=-1)*255),'RGBA')
    filename=out/f'{path.stem}.webp';image.save(filename,quality=88,method=6)
    print(f'{filename.name}: {w}x{h}, {filename.stat().st_size} bytes, {time.time()-start:.1f}s',flush=True)
