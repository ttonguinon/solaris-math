/**
 * Solaris Math · Matemáticas que despegan — Servidor en Google Sheets (Apps Script)
 *
 * Instalación (una sola vez):
 *  1. Crea una hoja de cálculo nueva en blanco (sheets.new). En ella: Extensiones → Apps Script. Borra lo que haya y pega este código. Guarda.
 *  2. Elige la función "configurar" en la barra superior y presiona Ejecutar. Acepta los permisos.
 *  3. Implementar → Nueva implementación → tipo "Aplicación web".
 *     Ejecutar como: Yo.  Quién tiene acceso: Cualquier usuario.  → Implementar.
 *  4. Copia la "URL de la aplicación web" y pégala en index.html, en la línea NUBE_URL.
 */

// ---------------- Ajustes (deben coincidir con la app) ----------------
const NOTA_MINIMA = 9;          // aciertos para aprobar un tema
const TOTAL_EJERCICIOS = 15;    // ejercicios por tema
const TOTAL_TEMAS = 53;         // temas de la ruta completa (37 originales + 16 alineados con los DBA)
const MAX_FALLIDOS = 5;         // intentos de PIN antes de bloquear
const MINUTOS_BLOQUEO = 15;
const MAX_DISPOSITIVOS = 5;     // sesiones abiertas a la vez por estudiante

// Columnas visibles primero; las técnicas (al final) quedan ocultas.
const COLUMNAS = {
  Estudiantes: ['apodo','grado','temas_aprobados','temas_validados','promedio','prueba_hasta','alta','ultimo_acceso',
                'id','apodo_clave','pin_hash','sal','tokens','fallidos','bloqueado_hasta','progreso_json'],
  Progreso:    ['apodo','tema','grado_tema','mejor_nota','estado','actualizado','id','tema_clave'],
  Intentos:    ['fecha','apodo','tema','grado_tema','nota','total','resultado','id','tema_clave'],
  Diplomas:    ['codigo','apodo','fecha','promedio','temas_practicados','temas_validados','id']
};
const OCULTAS = {Estudiantes: 8, Progreso: 2, Intentos: 2, Diplomas: 1};
const COLUMNAS_TEXTO = ['apodo','grado','id','apodo_clave','pin_hash','sal','tokens','progreso_json','codigo','tema_clave','alta','ultimo_acceso','fecha','actualizado'];

// ---------------- Entrada web ----------------
function doPost(e){
  const lock = LockService.getScriptLock();
  try{
    lock.waitLock(20000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const accion = ACCIONES[d.accion];
    if(!accion) return json_({ok:false, error:'accion_desconocida'});
    return json_(accion(d));
  }catch(err){
    return json_({ok:false, error:'servidor', detalle: String((err && err.message) || err)});
  }finally{
    try{ lock.releaseLock(); }catch(_){}
  }
}

function doGet(e){
  const codigo = e && e.parameter && e.parameter.codigo;
  if(!codigo) return json_({ok:true, app:'Solaris Math', mensaje:'Servidor activo'});
  const t = tabla_('Diplomas');
  const i = t.filas.findIndex(f => String(f[t.c('codigo')]).toUpperCase() === String(codigo).trim().toUpperCase());
  const d = i >= 0 ? t.obj(i) : null;
  const cuerpo = d
    ? `<div class="ok">✓ Diploma válido</div><p>Solaris Math certifica que <b>${esc_(d.apodo)}</b> completó la ruta de aprendizaje de matemáticas de 1.º a 11.º.</p>
       <p>Fecha: <b>${esc_(d.fecha)}</b><br>Promedio: <b>${esc_(d.promedio)}</b> / 10<br>Temas practicados: <b>${esc_(d.temas_practicados)}</b> · validados en prueba: <b>${esc_(d.temas_validados)}</b></p>`
    : `<div class="no">✗ No encontramos ese código</div><p>Revisa que esté bien escrito: <b>${esc_(codigo)}</b></p>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Verificación de diploma · Solaris Math</title>
    <style>body{font-family:system-ui,sans-serif;background:#F4F7FF;color:#1F2A44;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}
    .t{background:#fff;max-width:460px;border-radius:18px;padding:24px;box-shadow:0 8px 24px rgba(30,91,184,.15);border-top:8px solid #F28C1B}
    h1{color:#1E5BB8;font-size:1.4rem;margin:0 0 12px}.ok{color:#1FA463;font-size:1.5rem;font-weight:800}.no{color:#E63946;font-size:1.5rem;font-weight:800}
    p{line-height:1.5}</style></head><body><div class="t"><h1>Solaris Math · Matemáticas que despegan</h1>${cuerpo}</div></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Verificación de diploma');
}

const ACCIONES = {registrar: registrar_, entrar: entrar_, guardar: guardar_, diploma: diploma_};

// ---------------- Acciones ----------------
function registrar_(d){
  const apodo = limpiarApodo_(d.apodo), pin = String(d.pin || '');
  if(!apodo || !/^\d{4}$/.test(pin)) return {ok:false, error:'datos_invalidos'};
  const clave = claveApodo_(apodo), t = tabla_('Estudiantes');
  if(t.filas.some(f => String(f[t.c('apodo_clave')]) === clave)) return {ok:false, error:'apodo_en_uso'};
  const sal = Utilities.getUuid(), token = Utilities.getUuid(), ahora = fecha_();
  const o = {apodo, grado: String(d.grado || '').slice(0,10), temas_aprobados:0, temas_validados:0, promedio:'', prueba_hasta:'',
             alta: ahora, ultimo_acceso: ahora, id: 'e' + Utilities.getUuid().replace(/-/g,'').slice(0,12), apodo_clave: clave,
             pin_hash: hash_(sal + pin), sal, tokens: token, fallidos: 0, bloqueado_hasta: '', progreso_json: '{}'};
  t.agregar([o]);
  return {ok:true, id:o.id, token, apodo, grado:o.grado, progreso:{}};
}

function entrar_(d){
  const clave = claveApodo_(d.apodo || ''), pin = String(d.pin || ''), t = tabla_('Estudiantes');
  const i = t.filas.findIndex(f => String(f[t.c('apodo_clave')]) === clave);
  if(i < 0) return {ok:false, error:'credenciales'};
  const o = t.obj(i), ahora = Date.now(), bloq = Number(o.bloqueado_hasta) || 0;
  if(bloq > ahora) return {ok:false, error:'bloqueado', minutos: Math.ceil((bloq - ahora) / 60000)};
  if(hash_(o.sal + pin) !== String(o.pin_hash)){
    const fall = (Number(o.fallidos) || 0) + 1;
    if(fall >= MAX_FALLIDOS){
      t.actualizar(i, {fallidos:0, bloqueado_hasta: ahora + MINUTOS_BLOQUEO * 60000});
      return {ok:false, error:'bloqueado', minutos: MINUTOS_BLOQUEO};
    }
    t.actualizar(i, {fallidos: fall});
    return {ok:false, error:'credenciales', quedan: MAX_FALLIDOS - fall};
  }
  const token = Utilities.getUuid();
  const tokens = [token].concat(String(o.tokens || '').split(',').filter(Boolean)).slice(0, MAX_DISPOSITIVOS).join(',');
  t.actualizar(i, {tokens, fallidos:0, bloqueado_hasta:'', ultimo_acceso: fecha_()});
  return {ok:true, id:o.id, token, apodo:o.apodo, grado:o.grado, progreso: leerJSON_(o.progreso_json)};
}

function guardar_(d){
  const s = sesion_(d);
  if(!s) return {ok:false, error:'sesion'};
  const previo = leerJSON_(s.o.progreso_json);
  const nuevo = mezclarProgreso_(previo, d.progreso || {});
  const vp = previo._val || {}, vn = nuevo._val || {};
  const cambios = Object.keys(nuevo).filter(k => k[0] !== '_' && (previo[k] !== nuevo[k] || !!vp[k] !== !!vn[k]));
  const r = resumen_(nuevo);
  s.t.actualizar(s.i, {progreso_json: JSON.stringify(nuevo), temas_aprobados: r.aprobados, temas_validados: r.validados,
                       promedio: r.promedio, prueba_hasta: nuevo._ubic ? nuevo._ubic.hasta : '', ultimo_acceso: fecha_()});
  const temas = d.temas || {};
  if(cambios.length) guardarFilasProgreso_(s.o, nuevo, cambios, temas);
  if(d.intento && temas[d.intento.clave]){
    const it = d.intento, nota = Math.max(0, Math.min(TOTAL_EJERCICIOS, Number(it.nota) || 0));
    tabla_('Intentos').agregar([{fecha: fecha_(), apodo: s.o.apodo, tema: temas[it.clave].n, grado_tema: temas[it.clave].g,
      nota, total: TOTAL_EJERCICIOS, resultado: nota >= NOTA_MINIMA ? 'Aprobado' : 'No aprobado', id: s.o.id, tema_clave: it.clave}]);
  }
  return {ok:true, progreso: nuevo};
}

function diploma_(d){
  const s = sesion_(d);
  if(!s) return {ok:false, error:'sesion'};
  const prog = leerJSON_(s.o.progreso_json), r = resumen_(prog);
  if(r.aprobados < TOTAL_TEMAS) return {ok:false, error:'ruta_incompleta'};
  const t = tabla_('Diplomas');
  const i = t.filas.findIndex(f => String(f[t.c('id')]) === s.o.id);
  if(i >= 0) return {ok:true, codigo: String(t.obj(i).codigo), fecha: String(t.obj(i).fecha)};
  const codigo = 'SM-' + Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
  const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  t.agregar([{codigo, apodo: s.o.apodo, fecha, promedio: r.promedio, temas_practicados: r.aprobados - r.validados, temas_validados: r.validados, id: s.o.id}]);
  return {ok:true, codigo, fecha};
}

// ---------------- Lógica de progreso ----------------
function mezclarProgreso_(a, b){
  const res = {}, val = {}, va = a._val || {}, vb = b._val || {};
  const claves = {};
  Object.keys(a).concat(Object.keys(b)).forEach(k => { if(k[0] !== '_') claves[k] = true; });
  Object.keys(claves).forEach(k => {
    const reales = [];
    if(typeof a[k] === 'number' && !va[k]) reales.push(a[k]);
    if(typeof b[k] === 'number' && !vb[k]) reales.push(b[k]);
    const mejor = reales.length ? Math.max.apply(null, reales) : undefined;
    const validado = !!(va[k] || vb[k]);
    if(mejor !== undefined && (mejor >= NOTA_MINIMA || !validado)) res[k] = Math.max(0, Math.min(TOTAL_EJERCICIOS, mejor));
    else if(validado){ res[k] = NOTA_MINIMA; val[k] = true; }
  });
  if(Object.keys(val).length) res._val = val;
  const ua = a._ubic, ub = b._ubic;
  if(ua || ub) res._ubic = (!ua || (ub && Number(ub.hasta) > Number(ua.hasta))) ? ub : ua;
  return res;
}

function resumen_(p){
  const v = p._val || {};
  const claves = Object.keys(p).filter(k => k[0] !== '_');
  const aprobados = claves.filter(k => p[k] >= NOTA_MINIMA).length;
  const validados = claves.filter(k => v[k]).length;
  const reales = claves.filter(k => !v[k] && p[k] >= NOTA_MINIMA);
  const promedio = reales.length ? Math.round(reales.reduce((s,k) => s + p[k], 0) / reales.length / TOTAL_EJERCICIOS * 100) / 10 : '';
  return {aprobados, validados, promedio};
}

function guardarFilasProgreso_(o, prog, claves, temas){
  const t = tabla_('Progreso'), cid = t.c('id'), ck = t.c('tema_clave'), pos = {};
  t.filas.forEach((f, j) => { if(String(f[cid]) === o.id) pos[f[ck]] = j; });
  const nuevas = [];
  claves.forEach(k => {
    const validado = !!(prog._val || {})[k], nota = prog[k], meta = temas[k] || {};
    const fila = {apodo: o.apodo, tema: meta.n || k, grado_tema: meta.g || '', mejor_nota: validado ? '' : nota,
                  estado: validado ? 'Validado en prueba' : nota >= NOTA_MINIMA ? 'Aprobado' : 'En proceso',
                  actualizado: fecha_(), id: o.id, tema_clave: k};
    if(pos[k] !== undefined) t.actualizar(pos[k], fila); else nuevas.push(fila);
  });
  if(nuevas.length) t.agregar(nuevas);
}

// ---------------- Menú para el profesor ----------------
function onOpen(){
  SpreadsheetApp.getUi().createMenu('Solaris Math')
    .addItem('Actualizar panel', 'actualizarPanel')
    .addItem('Restablecer PIN del estudiante seleccionado', 'restablecerPin')
    .addSeparator()
    .addItem('Configurar hojas', 'configurar')
    .addToUi();
}

function configurar(){
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', libro.getId());
  Object.keys(COLUMNAS).forEach(nombre => {
    const h = hoja_(nombre), cols = COLUMNAS[nombre];
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#1E5BB8').setFontColor('#FFFFFF');
    cols.forEach((c, i) => { if(COLUMNAS_TEXTO.indexOf(c) >= 0) h.getRange(2, i + 1, Math.max(h.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
    const oc = OCULTAS[nombre];
    if(oc) h.hideColumns(cols.length - oc + 1, oc);
  });
  if(!libro.getSheetByName('Panel')) libro.insertSheet('Panel', 0);
  ['Hoja 1','Hoja1','Sheet1'].forEach(n => {           // borra la pestaña vacía que trae una hoja nueva
    const h = libro.getSheetByName(n);
    if(h && h.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(h);
  });
  actualizarPanel();
  try{ SpreadsheetApp.getUi().alert('¡Listo! Las pestañas quedaron creadas. Ahora publica el script como Aplicación web (paso 3 de la guía).'); }catch(e){}
}

function actualizarPanel(){
  const libro = libro_();
  const h = libro.getSheetByName('Panel') || libro.insertSheet('Panel', 0);
  const est = tabla_('Estudiantes'), ints = tabla_('Intentos'), dip = tabla_('Diplomas');
  const hace7 = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const activos = est.filas.filter(f => String(f[est.c('ultimo_acceso')]) >= hace7).length;
  const stats = {};
  ints.filas.forEach(f => {
    const k = f[ints.c('tema')], s = stats[k] || (stats[k] = {grado: f[ints.c('grado_tema')], intentos: 0, aprobados: 0, suma: 0});
    s.intentos++; s.suma += Number(f[ints.c('nota')]) || 0;
    if(f[ints.c('resultado')] === 'Aprobado') s.aprobados++;
  });
  const filas = Object.keys(stats).map(k => { const s = stats[k];
    return [k, s.grado, s.intentos, s.aprobados, Math.round(s.aprobados / s.intentos * 100) / 100, Math.round(s.suma / s.intentos * 10) / 10]; })
    .sort((a, b) => a[4] - b[4]);
  h.clear();
  const resumen = [['Panel de Solaris Math', ''], ['Actualizado', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')],
    ['Estudiantes registrados', est.filas.length], ['Activos en los últimos 7 días', activos], ['Ejercicios resueltos (rondas × 15)', ints.filas.length * TOTAL_EJERCICIOS],
    ['Diplomas emitidos', dip.filas.length], ['', ''], ['Temas ordenados de más difícil a más fácil (según intentos)', '']];
  h.getRange(1, 1, resumen.length, 2).setValues(resumen);
  h.getRange(1, 1).setFontSize(16).setFontWeight('bold').setFontColor('#1E5BB8');
  h.getRange(8, 1).setFontWeight('bold');
  const cab = [['Tema', 'Grado', 'Intentos', 'Aprobados', '% de aprobación', 'Nota promedio (de 15)']];
  h.getRange(9, 1, 1, 6).setValues(cab).setFontWeight('bold').setBackground('#F28C1B').setFontColor('#FFFFFF');
  if(filas.length){
    h.getRange(10, 1, filas.length, 6).setValues(filas);
    h.getRange(10, 5, filas.length, 1).setNumberFormat('0%');
  }
  h.autoResizeColumns(1, 6);
}

function restablecerPin(){
  const ui = SpreadsheetApp.getUi(), h = SpreadsheetApp.getActiveSheet();
  if(h.getName() !== 'Estudiantes' || h.getActiveRange().getRow() < 2){ ui.alert('Ve a la hoja "Estudiantes" y selecciona la fila del estudiante.'); return; }
  const t = tabla_('Estudiantes'), i = h.getActiveRange().getRow() - 2, o = t.obj(i);
  const r = ui.prompt('Restablecer PIN', `Nuevo PIN de 4 dígitos para "${o.apodo}":`, ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton() !== ui.Button.OK) return;
  const pin = r.getResponseText().trim();
  if(!/^\d{4}$/.test(pin)){ ui.alert('El PIN debe tener exactamente 4 números.'); return; }
  const sal = Utilities.getUuid();
  t.actualizar(i, {sal, pin_hash: hash_(sal + pin), tokens: '', fallidos: 0, bloqueado_hasta: ''});
  ui.alert(`Listo. "${o.apodo}" ya puede entrar con el PIN ${pin}. Sus sesiones abiertas se cerraron.`);
}

// ---------------- Utilidades ----------------
function libro_(){
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function hoja_(nombre){
  const libro = libro_();
  const h = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
  const cols = COLUMNAS[nombre];
  if(h.getLastRow() === 0 || String(h.getRange(1, 1).getValue()) !== cols[0]) h.getRange(1, 1, 1, cols.length).setValues([cols]);
  return h;
}
function tabla_(nombre){
  const h = hoja_(nombre), cab = COLUMNAS[nombre];
  const n = h.getLastRow() - 1;
  const filas = n > 0 ? h.getRange(2, 1, n, cab.length).getValues() : [];
  return {
    h, cab, filas,
    c(col){ const i = cab.indexOf(col); if(i < 0) throw new Error('Falta la columna ' + col); return i; },
    obj(i){ const o = {}; cab.forEach((col, j) => o[col] = filas[i][j]); return o; },
    actualizar(i, cambios){
      const fila = filas[i];
      Object.keys(cambios).forEach(k => fila[this.c(k)] = cambios[k]);
      h.getRange(i + 2, 1, 1, cab.length).setValues([fila]);
    },
    agregar(objs){
      const valores = objs.map(o => cab.map(col => o[col] === undefined ? '' : o[col]));
      const desde = h.getLastRow() + 1;
      h.getRange(desde, 1, valores.length, cab.length).setValues(valores);
      valores.forEach(v => filas.push(v));
    }
  };
}
function sesion_(d){
  if(!d.id || !d.token) return null;
  const t = tabla_('Estudiantes');
  const i = t.filas.findIndex(f => String(f[t.c('id')]) === String(d.id));
  if(i < 0) return null;
  const o = t.obj(i);
  if(String(o.tokens || '').split(',').indexOf(String(d.token)) < 0) return null;
  return {t, i, o};
}
function limpiarApodo_(s){
  s = String(s || '').trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,29}$/u.test(s) && /\p{L}/u.test(s) ? s : '';
}
function claveApodo_(s){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function hash_(texto){
  return 'h' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function fecha_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function leerJSON_(s){ try{ return JSON.parse(s || '{}') || {}; }catch(e){ return {}; } }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
