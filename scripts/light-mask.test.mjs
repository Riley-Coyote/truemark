import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/brand/light-mask.ts',import.meta.url),'utf8');
const {softenLightMask} = await import(`data:text/javascript;base64,${Buffer.from(ts.transpile(source,{module:ts.ModuleKind.ESNext})).toString('base64')}`);
test('mask smoothing preserves white/black interiors and softens edges symmetrically',()=>{
 const width=101,height=51;
 const pixels=new Uint8ClampedArray(width*height*4).fill(255);
 for(let y=0;y<height;y++) for(let x=26;x<=74;x++) {
  const at=(y*width+x)*4; pixels[at]=pixels[at+1]=pixels[at+2]=0;
 }
 softenLightMask(pixels,width,height);
 const value=x=>pixels[(25*width+x)*4];
 assert.equal(value(0),255); assert.equal(value(50),0); assert.equal(value(100),255);
 assert.ok(value(26)>0&&value(26)<255);
 for(let x=0;x<width;x++) assert.equal(value(x),value(100-x));
 for(let i=3;i<pixels.length;i+=4) assert.equal(pixels[i],255);
});
