// excalidraw-to-svg.mjs — 把 .excalidraw JSON 转成静态 SVG（无依赖）
// 用法: node scripts/excalidraw-to-svg.mjs [file1.excalidraw ...]
// 不传文件则处理 docs/public/diagrams/ 下所有 .excalidraw
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const diagramsDir = path.join(root, 'docs', 'public', 'diagrams');

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(diagramsDir).filter(f => f.endsWith('.excalidraw')).map(f => path.join(diagramsDir, f));

const fontStack = (ff) => {
  // Excalidraw fontFamily: 1=Virgil(hand), 2=Helvetica, 3=Cascadia(mono), 5=Excalifont
  // 用单引号避免破坏 XML 属性
  if (ff === 3) return `'Cascadia Code', 'JetBrains Mono', Consolas, monospace`;
  if (ff === 2) return `Helvetica, Arial, sans-serif`;
  return `'Virgil', 'Segoe UI', system-ui, sans-serif`;
};

// 颜色: "transparent" → none
const fillOf = (c) => (c && c !== 'transparent') ? c : 'none';

// 估算文本宽度（粗略，字符数 × fontSize × 0.6）
function textWidth(text, fontSize) {
  const lines = text.split('\n');
  return Math.max(...lines.map(l => l.length * fontSize * 0.6));
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
}

function renderText(el, offsetX = 0, offsetY = 0) {
  const fs_ = el.fontSize || 16;
  const lines = (el.text || '').split('\n');
  const fam = fontStack(el.fontFamily || 1);
  const anchor = el.textAlign === 'center' ? 'middle' : (el.textAlign === 'right' ? 'end' : 'start');
  const x = el.x + offsetX + (el.textAlign === 'center' ? (el.width || textWidth(el.text, fs_)) / 2 : (el.textAlign === 'right' ? (el.width || textWidth(el.text, fs_)) : 0));
  const lineHeight = (el.lineHeight || 1.25) * fs_;
  const totalH = lines.length * lineHeight;
  let startY;
  if (el.verticalAlign === 'middle') startY = el.y + offsetY + (el.height || totalH) / 2 - totalH / 2 + fs_ * 0.85;
  else if (el.verticalAlign === 'bottom') startY = el.y + offsetY + (el.height || totalH) - totalH + fs_ * 0.85;
  else startY = el.y + offsetY + fs_;
  const opacity = el.opacity != null ? el.opacity / 100 : 1;
  const tspans = lines.map((ln, i) =>
    `<tspan x="${x.toFixed(1)}" dy="${i === 0 ? 0 : lineHeight}" text-anchor="${anchor}">${escapeXml(ln)}</tspan>`
  ).join('');
  return `<text x="${x.toFixed(1)}" y="${startY.toFixed(1)}" font-size="${fs_}" font-family="${fam}" fill="${el.strokeColor || '#1e1e1e'}" opacity="${opacity}">${tspans}</text>`;
}

function renderShape(el) {
  const opacity = el.opacity != null ? el.opacity / 100 : 1;
  const fill = fillOf(el.backgroundColor);
  const stroke = el.strokeColor || '#1e1e1e';
  const sw = el.strokeWidth || 1;
  const dash = el.strokeStyle === 'dashed' ? ' stroke-dasharray="8 6"' : (el.strokeStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '');
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${dash}`;
  let shape = '';
  if (el.type === 'rectangle') {
    const rx = el.roundness ? 8 : 0;
    shape = `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" ry="${rx}" ${common}/>`;
  } else if (el.type === 'ellipse') {
    shape = `<ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" ${common}/>`;
  } else if (el.type === 'diamond') {
    const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
    shape = `<polygon points="${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}" ${common}/>`;
  } else if (el.type === 'arrow' || el.type === 'line') {
    const pts = (el.points || [[0,0]]).map(p => [el.x + p[0], el.y + p[1]]);
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const stroke = el.strokeColor || '#1e1e1e';
    const arrowhead = el.type === 'arrow' && pts.length >= 2 ? arrowHead(pts, stroke) : '';
    shape = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${dash}/>${arrowhead}`;
  }
  // 内联文本（简化的旧格式: text 属性直接挂在 shape 上）
  let textSvg = '';
  if (el.text) {
    textSvg = renderText({ ...el, x: el.x, y: el.y, width: el.width, height: el.height }, 0, 0);
  }
  return shape + textSvg;
}

function arrowHead(pts, stroke) {
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const size = 10;
  // 两侧翼
  const px = -uy, py = ux;
  const p1 = [b[0] - ux * size + px * size * 0.5, b[1] - uy * size + py * size * 0.5];
  const p2 = [b[0] - ux * size - px * size * 0.5, b[1] - uy * size - py * size * 0.5];
  return `<polygon points="${b[0].toFixed(1)},${b[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" fill="${stroke}" stroke="${stroke}"/>`;
}

function convert(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const els = data.elements || [];
  // 计算 bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of els) {
    if (e.type === 'arrow' || e.type === 'line') {
      for (const p of (e.points || [[0,0]])) {
        const px = e.x + p[0], py = e.y + p[1];
        minX = Math.min(minX, px); minY = Math.min(minY, py);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
    } else {
      minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + (e.width || 0)); maxY = Math.max(maxY, e.y + (e.height || 0));
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  const pad = 20;
  const vx = minX - pad, vy = minY - pad, vw = (maxX - minX) + pad * 2, vh = (maxY - minY) + pad * 2;
  const body = els.map(e => e.type === 'text' ? renderText(e) : renderShape(e)).join('\n  ');
  const bg = data.appState?.viewBackgroundColor || '#ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}"/>
  ${body}
</svg>`;
  const out = filePath.replace(/\.excalidraw$/, '.svg');
  fs.writeFileSync(out, svg);
  console.log(`✓ ${path.basename(out)}  (${els.length} elements, ${vw.toFixed(0)}×${vh.toFixed(0)})`);
}

for (const f of files) {
  try { convert(f); } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exit(1); }
}
