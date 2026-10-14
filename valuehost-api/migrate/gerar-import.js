#!/usr/bin/env node
/* ============================================================
   Gerador de SQL de importação: Supabase (CSV/JSON) -> MySQL
   Uso:
     node gerar-import.js --users users.csv --states states.csv --out import.sql
   ou (posicional):
     node gerar-import.js users.csv states.csv import.sql

   Opcional:
     --only-email a@b.com,c@d.com   importa somente esses usuários
                                    (e apenas os estados deles)

   Aceita CSV (exportado do Supabase) ou JSON (array de objetos).
   ============================================================ */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { users: 'users.csv', states: 'states.csv', out: 'import.sql', onlyEmails: null };
  if (args.length && !args[0].startsWith('--')) {
    if (args[0]) out.users = args[0];
    if (args[1]) out.states = args[1];
    if (args[2]) out.out = args[2];
    return out;
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--users' && args[i + 1]) out.users = args[++i];
    else if (args[i] === '--states' && args[i + 1]) out.states = args[++i];
    else if (args[i] === '--out' && args[i + 1]) out.out = args[++i];
    else if (args[i] === '--only-email' && args[i + 1]) out.onlyEmails = args[++i].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  return out;
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadRecords(file) {
  if (!fs.existsSync(file)) {
    console.error('Arquivo não encontrado: ' + file);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  }
  const rows = parseCSV(raw);
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).filter(r => r.length > 1 || (r[0] || '').trim() !== '').map(cols => {
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = cols[i] != null ? cols[i] : ''; });
    return obj;
  });
}

function pick(obj, ...names) {
  for (const n of names) {
    if (obj[n] != null && String(obj[n]) !== '') return String(obj[n]);
  }
  return '';
}

function toMysqlDate(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return m ? m[1] + ' ' + m[2] : null;
}

function esc(v) {
  if (v == null) return "''";
  return "'" + String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/'/g, "''") + "'";
}

function main() {
  const args = parseArgs();

  let users = loadRecords(args.users);
  let states = loadRecords(args.states);

  if (args.onlyEmails && args.onlyEmails.length) {
    const keepIds = new Set();
    users = users.filter(u => {
      const email = pick(u, 'email').trim().toLowerCase();
      if (args.onlyEmails.indexOf(email) !== -1) {
        keepIds.add(pick(u, 'id'));
        return true;
      }
      return false;
    });
    const before = states.length;
    states = states.filter(s => keepIds.has(pick(s, 'user_id')));
    console.log('Filtro --only-email: mantendo ' + users.length + ' usuário(s); estados descartados: ' + (before - states.length) + '.');
  }

  const lines = [];
  const warnings = [];
  lines.push('-- ============================================================');
  lines.push('-- Importação gerada em ' + new Date().toISOString());
  lines.push('-- Usuários: ' + users.length + ' | Estados: ' + states.length);
  lines.push('-- Rodar no phpMyAdmin do ValueHost (banco prev0142_aprova)');
  lines.push('-- ============================================================');
  lines.push('SET NAMES utf8mb4;');
  lines.push('SET time_zone = \'+00:00\';');
  lines.push('START TRANSACTION;');
  lines.push('');

  lines.push('-- -------- USUÁRIOS --------');
  let usersOk = 0;
  for (const u of users) {
    const id = pick(u, 'id');
    const email = pick(u, 'email').trim().toLowerCase();
    if (!id || !email) { warnings.push('Usuário ignorado (sem id/email): ' + JSON.stringify(u).slice(0, 120)); continue; }
    const hash = pick(u, 'encrypted_password', 'password_hash');
    const confirmed = pick(u, 'email_confirmed_at') ? 1 : 0;
    const createdAt = toMysqlDate(pick(u, 'created_at')) || '1970-01-01 00:00:01';
    if (!hash) warnings.push('Usuário sem senha (precisará usar "Esqueci minha senha"): ' + email);
    lines.push(
      'INSERT INTO users (id, email, password_hash, email_confirmed, created_at) VALUES (' +
      esc(id) + ', ' + esc(email) + ', ' + esc(hash) + ', ' + confirmed + ', ' + esc(createdAt) +
      ');'
    );
    usersOk++;
  }
  lines.push('');

  lines.push('-- -------- ESTADOS --------');
  let statesOk = 0;
  for (const s of states) {
    const userId = pick(s, 'user_id');
    const rawData = pick(s, 'data');
    if (!userId || !rawData) { warnings.push('Estado ignorado (sem user_id/data).'); continue; }
    let minified;
    try {
      minified = JSON.stringify(JSON.parse(rawData));
    } catch (e) {
      warnings.push('JSON inválido no estado do usuário ' + userId + ' — ignorado.');
      continue;
    }
    const updatedAt = toMysqlDate(pick(s, 'updated_at')) || '1970-01-01 00:00:01';
    lines.push(
      'INSERT INTO states (user_id, data, updated_at) VALUES (' +
      esc(userId) + ', ' + esc(minified) + ', ' + esc(updatedAt) + ');'
    );
    statesOk++;
  }
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  fs.writeFileSync(args.out, lines.join('\n'), 'utf8');

  console.log('✔ Arquivo gerado: ' + path.resolve(args.out));
  console.log('  Usuários importados: ' + usersOk + ' de ' + users.length);
  console.log('  Estados importados:  ' + statesOk + ' de ' + states.length);
  if (warnings.length) {
    console.log('');
    console.log('⚠ Avisos (' + warnings.length + '):');
    warnings.slice(0, 50).forEach(w => console.log('  - ' + w));
    if (warnings.length > 50) console.log('  ... e mais ' + (warnings.length - 50));
  }
}

main();
