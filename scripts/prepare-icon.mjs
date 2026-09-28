import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
// Small code-native DBK monogram. Runs only in CI before the desktop build.
const size=256,rgba=Buffer.alloc(size*(size*4+1));
const glyphs=['111101110010010','100011001010100','100011110011000','100011001010100','111101110010010'];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const offset=y*(size*4+1)+1+x*4;
 const gx=Math.floor((x-30)/13),gy=Math.floor((y-90)/15);
 const ink=gx>=0&&gx<15&&gy>=0&&gy<5&&glyphs[gy][gx]==='1';
 const cornerX=Math.max(0,32-x,x-(size-33)),cornerY=Math.max(0,32-y,y-(size-33));
 const alpha=cornerX*cornerX+cornerY*cornerY>32*32?0:255;
 rgba[offset]=ink?23:180;rgba[offset+1]=ink?34:219;rgba[offset+2]=ink?22:164;rgba[offset+3]=alpha;
}
function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,crc]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
mkdirSync('src-tauri/icons',{recursive:true});writeFileSync('src-tauri/icons/icon.png',png);writeFileSync('src-tauri/icons/icon.ico',Buffer.concat([ico,png]));
