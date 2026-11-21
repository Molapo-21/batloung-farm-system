'use strict';
const $ = (s) => document.querySelector(s);
if (localStorage.getItem('bf_token')) location.replace('index.html');

const showErr = (m) => { $('#err').innerHTML = `<div class="msg-err">${String(m).replace(/[<>&]/g, '')}</div>`; };

async function login() {
  const username = $('#u').value.trim(), password = $('#p').value;
  if (!username || !password) return showErr('Enter your username and password.');
  $('#go').disabled = true;
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('bf_token', data.token);
    localStorage.setItem('bf_admin', JSON.stringify(data.admin));
    location.replace('index.html');
  } catch (e) {
    showErr(e.message === 'Failed to fetch' ? 'Cannot reach the server.' : e.message);
    $('#go').disabled = false;
  }
}
$('#go').onclick = login;
['u', 'p'].forEach((id) => $('#' + id).addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); }));
$('#showPw').onclick = () => { const p = $('#p'); const s = p.type === 'password'; p.type = s ? 'text' : 'password'; $('#showPw').textContent = s ? 'Hide' : 'Show'; };

$('#fillDemo').onclick = () => { $('#u').value = 'Admin'; $('#p').value = '12345678'; $('#p').focus(); };
