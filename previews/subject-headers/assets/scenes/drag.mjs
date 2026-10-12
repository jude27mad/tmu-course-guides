// Pixel deltas map directly to rotation. Only released motion is damped.
export function createDragState(){
 let x=0,y=0,last=0;
 const d={yaw:0,pitch:0,velocityX:0,velocityY:0,active:false,
  begin(px,py,t){x=px;y=py;last=t;d.active=true;d.velocityX=d.velocityY=0;},
  move(px,py,t,width){if(!d.active)return;const k=3.8/Math.max(240,width),dx=(px-x)*k,dy=(py-y)*k,dt=Math.max(.012,(t-last)/1000);d.yaw+=dx;d.pitch=Math.max(-.9,Math.min(.9,d.pitch+dy));d.velocityX=Math.max(-3,Math.min(3,dx/dt));d.velocityY=Math.max(-2,Math.min(2,dy/dt));x=px;y=py;last=t;},
  end(t){d.active=false;if(t-last>100)d.velocityX=d.velocityY=0;},
  cancel(){d.active=false;d.velocityX=d.velocityY=0;},
  step(dt){if(d.active)return;const decay=Math.exp(-4.2*dt),integral=(1-decay)/4.2;d.yaw+=d.velocityX*integral;d.pitch=Math.max(-.9,Math.min(.9,d.pitch+d.velocityY*integral));d.velocityX*=decay;d.velocityY*=decay;}
 };return d;
}
