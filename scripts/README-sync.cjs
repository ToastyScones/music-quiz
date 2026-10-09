'use strict';

/* If README.md can't be found, make no modifications to index.html. */
/*
 * Regenerates the "Troubleshooting" <details> body in music-quiz/index.html
 * directly from the "## Troubleshooting" section of README.md, so the two
 * never drift apart. The block between the markers below is machine-generated;
 * do not edit it by hand.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const README_PATH = path.join(ROOT, 'README.md');
const INDEX_PATH = path.join(ROOT, 'music-quiz', 'index.html');

const BEGIN = '<!-- README:BEGIN -->';
const END = '<!-- README:END -->';
const BASE = 12; // leading spaces to match the surrounding HTML content indent
const pad = (n) => ' '.repeat(n);

function extractSection(readme) {
  const lines = readme.replace(/\r\n/g, '\n').split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##\s+Troubleshooting\b/.test(lines[i])) { start = i; break; }
  }
  if (start === -1) throw new Error('Troubleshooting section not found in README.md');
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

function linkify(html) {
  return html.replace(/(https?:\/\/[^\s<>"']+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return linkify(out);
}

function convert(markdownLines) {
  const out = [];
  const stack = []; // frames: { level, liOpen, ulIndent, liIndent }
  let para = null;

  const flushPara = () => {
    if (para !== null) {
      out.push(pad(BASE) + `<p>${inline(para.join(' '))}</p>`);
      para = null;
    }
  };

  const closeAll = () => {
    flushPara();
    while (stack.length > 0) {
      const fr = stack[stack.length - 1];
      if (fr.liOpen) { out.push(pad(fr.liIndent) + '</li>'); fr.liOpen = false; }
      out.push(pad(fr.ulIndent) + '</ul>');
      stack.pop();
    }
  };

  const openFrame = (ulIndent, liIndent, level, content) => {
    const fr = { level, liOpen: true, ulIndent, liIndent };
    stack.push(fr);
    out.push(pad(ulIndent) + '<ul>');
    out.push(pad(liIndent) + `<li>${content}`);
  };

  for (const rawLine of markdownLines) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim() === '') { closeAll(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^(\s*)(?:[*+-])\s+(.*)$/);

    if (heading) {
      closeAll();
      const lvl = heading[1].length;
      out.push(pad(BASE) + `<h${lvl}>${inline(heading[2])}</h${lvl}>`);
      continue;
    }

    if (bullet) {
      flushPara();
      const level = bullet[1].length;
      const content = inline(bullet[2]);
      const top = stack.length - 1;

      if (top === -1) {
        openFrame(BASE, BASE + 2, level, content);
      } else if (level > stack[top].level) {
        const parent = stack[top];
        openFrame(parent.liIndent + 2, parent.liIndent + 4, level, content);
      } else if (level === stack[top].level) {
        const fr = stack[top];
        if (fr.liOpen) { out.push(pad(fr.liIndent) + '</li>'); fr.liOpen = false; }
        out.push(pad(fr.liIndent) + `<li>${content}`);
        fr.liOpen = true;
      } else {
        while (stack.length > 0 && stack[stack.length - 1].level > level) {
          const fr = stack[stack.length - 1];
          if (fr.liOpen) { out.push(pad(fr.liIndent) + '</li>'); fr.liOpen = false; }
          out.push(pad(fr.ulIndent) + '</ul>');
          stack.pop();
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (parent.liOpen) { out.push(pad(parent.liIndent) + '</li>'); parent.liOpen = false; }
          }
        }
        if (stack.length === 0) {
          openFrame(BASE, BASE + 2, level, content);
        } else {
          const fr = stack[stack.length - 1];
          if (fr.liOpen) { out.push(pad(fr.liIndent) + '</li>'); }
          out.push(pad(fr.liIndent) + `<li>${content}`);
          fr.liOpen = true;
        }
      }
      continue;
    }

    closeAll();
    if (para === null) para = [];
    para.push(line.trim());
  }
  closeAll();

  return out.join('\n');
}

function main() {
  if (!fs.existsSync(README_PATH)) {
    console.log('README-sync: README.md not found; index.html left unchanged.');
    return;
  }
  const section = extractSection(fs.readFileSync(README_PATH, 'utf8'));
  const html = convert(section);

  let index = fs.readFileSync(INDEX_PATH, 'utf8');
  const b = index.indexOf(BEGIN);
  const e = index.indexOf(END);
  if (b === -1 || e === -1) throw new Error('README markers not found in index.html');
  index = index.slice(0, b + BEGIN.length) + `\n${html}` + index.slice(e);
  fs.writeFileSync(INDEX_PATH, index);

  const count = (re, s) => (s.match(re) || []).length;
  console.log('README-sync: wrote', section.length, 'markdown lines.');
  console.log('  <ul>=' + count(/<ul>/g, html),
    '</ul>=' + count(/<\/ul>/g, html),
    '<li>=' + count(/<li>/g, html),
    ' <a href>=' + count(/<a href=/g, html),
    ' <h3>=' + count(/<h3>/g, html),
    ' <h4>=' + count(/<h4>/g, html),
    ' <strong>=' + count(/<strong>/g, html));
  console.log('  lists balanced:', count(/<ul>/g, html) === count(/<\/ul>/g, html) ? 'yes' : 'NO');
}

main();
