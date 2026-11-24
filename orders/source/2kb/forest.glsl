precision highp float;
uniform vec3 r;                                   // width, height, seconds
float h(float n){return fract(sin(n*91.7)*4e4);}  // one random number per integer
float n(vec2 p){vec2 i=floor(p),f=p-i;f*=f*(3.-2.*f);float a=i.x+i.y*57.;return mix(mix(h(a),h(a+1.),f.x),mix(h(a+57.),h(a+58.),f.x),f.y);}
float f(vec2 p){return n(p)*.5+n(p*2.1)*.3+n(p*4.7)*.2;}
void main(){
  vec2 u=(gl_FragCoord.xy-.5*r.xy)/r.y,v=u-vec2(.25,.2),p;
  float t=r.z,l=length(v),s=exp(-5.*l);
  vec3 F=mix(vec3(.58,.7,.66),vec3(1.,.92,.65),s),c=F+s*s;       // mist with a low sun in it
  for(float i=10.;i>0.;i--){                                     // ten rows of trees, far to near
    float z=.8+i*i*.35,e=z/r.y*1.5,
      X=u.x*z+t*.5+i*31.,                                        // the camera drifts sideways
      y=u.y*z+1.8-f(vec2(X*.2,i*3.))*1.6,                        // height above rolling ground
      k=floor(X/3.),R=h(k+i*13.),H=7.+9.*h(k*3.+i),
      x=X-k*3.-.7-R*1.6+sin(t+k)*.01*y,                          // distance from this tree's axis, swaying
      q=y/H,w=n(p=vec2(X,y)*4.),W=n(p*5.),T=fract(-y*.9-R*9.+w*.4),
      m=smoothstep(e,0.,abs(x)-.15+.12*q)*step(q,.9),            // trunk, tapering
      d=R>.5?abs(x)-(1.-q)*H*.15*(.4+.6*T)-.25*w-.1*W+.2+step(y,R*8.)   // conifer: drooping tiers
            :length(vec2(x,(y-H*.7)*.7))-H*.3*(1.2-f(p*.22+i)*1.1)-.3*w-.1*W+.2,      // broadleaf: a ragged cloud
      L=smoothstep(e,0.,d),
      b=step(y,.7*sqrt(max(0.,1.-pow(x*2.-3.,2.))))*step(.6,h(k*5.+i)),   // some trees have a boulder beside them
      M=step(length(vec2(x+.6,y*2.-.3-R*.2)),.08+.07*R)*step(.15+R*.1,y),   // a mushroom cap by the roots
      g=step(y,.3*pow(n(vec2(X*20.,i)),2.)+.12*pow(n(vec2(X*5.,i)),3.)*abs(sin(X*40.)));                     // ground, with a fringe of grass
    vec3 C=mix(mix(vec3(.2,.15,.1)*(.5+n(vec2(x*30.,y*2.))),vec3(.8)-.6*step(.7,n(vec2(k,y*4.))),step(R,.2))*(1.+x*5.),   // bark, or birch, lit from one side   // bark, or birch
               vec3(.1+R*.2+.4*step(.9,h(k)),.3,.1)*(.4+w*.6+W*.6+q*.5-.5*T*step(.5,R)),L);   // leaves, a few turned, each tier shading the next
    C=mix(C,mix(vec3(.4),vec3(.2,.35,.1),w*y*3.),b);
    C=mix(C,vec3(.8,.15,.1)+step(.8,W),M);
    p=vec2(mod(X-t*.8,40.)-20.,y);                               // a deer walks through the sixth row
    M=max(M,T=i==6.?max(max(step(length((p-vec2(0,1.1))/vec2(.7,.3)),1.),step(length((p-vec2(.7,1.6))/vec2(.15,.5)),1.)),max(step(length(p-vec2(.85,2.)),.17),step(abs(abs(p.x)-.5+.1*sin(t*4.+p.x)),.05)*step(y,1.1))):0.);
    C=mix(C,vec3(.3,.2,.12),T);                                                          // stone, mossy on top
    C=mix(C,mix(vec3(.22,.17,.1),vec3(.2,.38,.1),n(vec2(X*2.,y*6.+i)))*(.4+w*.5+W*.4+.5*step(.6,n(vec2(X*.6,z)))),g);   // with patches of sun
    c=mix(c,mix(F,C,exp(-z*.07-.3*exp(-y*y))),max(max(g,b),max(max(m,M),L)));        // each row sinks into the mist
    if(i==3.)c=mix(c,vec3(.7,.4,.1),step(.98,n(vec2(u.x*30.+sin(t+u.y*9.),u.y*30.+t*3.))));   // leaves coming down
    if(i==5.)c+=vec3(1.,.9,.6)*(pow(n(vec2(atan(v.x,v.y)*7.,t*.2)),3.)*min(l*4.,1.)+pow(n(u*70.+t*.3),40.)*9.)*.6*exp(-2.5*l);   // shafts of light with dust in them
  }
  gl_FragColor=vec4(c*(1.-.5*dot(u,u)),1.);
}
