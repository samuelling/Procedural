d=document.body;d.hidden=0;d.innerHTML='<canvas id=c style=position:fixed;top:0;left:0;width:100%;height:100%>';
g=c.getContext('webgl');P=g.createProgram();
[35633,35632].map((T,i)=>{g.shaderSource(S=g.createShader(T),i?`__GLSL__`:'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');g.compileShader(S);g.attachShader(P,S)});
g.linkProgram(P);g.useProgram(P);g.bindBuffer(34962,g.createBuffer());g.bufferData(34962,new Int8Array([-3,1,1,-3,1,1]),35044);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,5120,0,0,0);
(L=t=>{c.width!=(W=innerWidth)|c.height!=(H=innerHeight)&&g.viewport(0,0,c.width=W,c.height=H);g.uniform3f(g.getUniformLocation(P,'r'),W,H,t/1e3);g.drawArrays(4,0,3);requestAnimationFrame(L)})(0)
