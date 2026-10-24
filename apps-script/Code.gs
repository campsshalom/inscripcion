/**
 * FormCamps2 · Recepción de inscripciones de participantes (Camp's · Campamento Shalom)
 *
 * Qué hace:
 *  - Recibe cada inscripción enviada desde la landing (index.html).
 *  - Guarda una fila en la Google Sheet "Inscripciones Participantes Camps",
 *    dentro de Mi unidad › CAMPS 2027 › Inscripciones (las carpetas se crean solas).
 *  - Guarda el comprobante de pago (si lo suben) en una carpeta de Google Drive
 *    y pone el enlace en la fila.
 *
 * Instalación: ver README.md del repositorio.
 * 1) Ejecuta la función `setup` una vez y acepta los permisos.
 * 2) Implementa como "Aplicación web" (Ejecutar como: Yo · Acceso: Cualquier persona).
 * 3) Copia la URL /exec en CONFIG.scriptUrl dentro de index.html.
 */

const SETTINGS = {
  SPREADSHEET_NAME: 'Inscripciones Participantes Camps',
  // Carpeta de Drive donde vive la hoja (se crea si no existe): Mi unidad › CAMPS 2027 › Inscripciones
  DRIVE_PATH: ['CAMPS 2027', 'Inscripciones'],
  SHEET_NAME: 'Inscripciones',
  FOLDER_NAME: 'Comprobantes de pago - Participantes Camps',
  MAX_FILE_MB: 10,
  // Si quieres recibir un correo con cada inscripción, escribe aquí tu correo. Déjalo vacío para no recibir.
  NOTIFY_EMAIL: ''
};

const HEADERS = [
  'Fecha de registro',
  'Nombre completo',
  'Cédula o pasaporte',
  'Fecha de nacimiento',
  'Edad',
  'Responsable (si es menor)',
  'Contacto del responsable',
  'WhatsApp',
  'Dirección',
  'Redes sociales',
  'Correo electrónico',
  'Enfermedad / medicamentos',
  'Alergias / intolerancias',
  'Contacto de emergencia',
  'Teléfono de emergencia',
  'Acepta datos e imagen',
  'Forma de pago',
  'Comprobante de pago',
  '¿Documento repetido?'
];

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
];

const PAGO_OPCIONES = ['Efectivo', 'Transferencia', 'Yappy'];
const CONSENTIMIENTO_OPCIONES = ['Sí', 'No'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------------ */
/* Configuración inicial: ejecútala UNA vez desde el editor            */
/* ------------------------------------------------------------------ */
function setup() {
  const props = PropertiesService.getScriptProperties();
  Logger.log('SPREADSHEET_ID antes: ' + (props.getProperty('SPREADSHEET_ID') || '(vacío)'));
  props.deleteProperty('SPREADSHEET_IN_FOLDER'); // fuerza la revisión de la carpeta
  props.deleteProperty('FOLDER_IN_PLACE');
  const target = getTargetFolder_();
  Logger.log('Carpeta destino: ' + target.getName() + ' → ' + target.getUrl());
  const ss = getSpreadsheet_();
  const parents = DriveApp.getFileById(ss.getId()).getParents();
  const where = [];
  while (parents.hasNext()) where.push(parents.next().getName());
  Logger.log('Hoja de inscripciones: ' + ss.getName() + ' → ' + ss.getUrl());
  Logger.log('La hoja está en: ' + (where.join(', ') || '(sin carpeta)'));
  Logger.log('Dueño de la hoja: ' + DriveApp.getFileById(ss.getId()).getOwner().getEmail() + ' · Script ejecutado por: ' + Session.getEffectiveUser().getEmail());
  const folder = getFolder_();
  const fp = folder.getParents();
  Logger.log('Carpeta de comprobantes: ' + folder.getName() + ' → ' + folder.getUrl() + ' (está en: ' + (fp.hasNext() ? fp.next().getName() : '?') + ')');
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                            */
/* ------------------------------------------------------------------ */
function doGet() {
  return json_({ ok: true, status: 'FormCamps2 activo' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'No llegaron datos.' });
    }

    const data = JSON.parse(e.postData.contents);

    // Campo trampa para bots: si viene lleno, respondemos "ok" sin guardar.
    if (data.website) {
      console.warn('Envío descartado: el campo trampa "website" vino lleno (' + String(data.website).slice(0, 60) + ').');
      return json_({ ok: true });
    }

    const error = validate_(data);
    if (error) return json_({ ok: false, error: error });

    // El archivo se guarda antes de tomar el candado para no bloquear a otros envíos.
    let fileUrl = '';
    if (data.comprobante && data.comprobante.data) {
      fileUrl = saveFile_(data);
    }

    lock.waitLock(20000);
    const sheet = getSheet_();
    const documento = docId_(data.documento);
    const repetido = isDuplicate_(sheet, documento) ? 'Sí' : '';
    const edad = parseInt(data.edad, 10);

    sheet.appendRow([
      new Date(),
      safe_(clean_(data.nombre, 120)),
      safe_(documento),
      birthDate_(data.nacimiento),
      isNaN(edad) ? '' : edad,
      safe_(clean_(data.responsable, 150)),
      safe_(clean_(data.responsableTel, 20)),
      safe_(clean_(data.whatsapp, 20)),
      safe_(clean_(data.direccion, 200)),
      safe_(clean_(data.redes, 150)),
      safe_(clean_(data.correo, 120).toLowerCase()),
      safe_(clean_(data.salud, 1000)),
      safe_(clean_(data.alergias, 1000)),
      safe_(clean_(data.emergencia, 150)),
      safe_(clean_(data.emergenciaTel, 20)),
      safe_(clean_(data.consentimiento, 5)),
      safe_(clean_(data.pago, 20)),
      fileUrl,
      repetido
    ]);
    SpreadsheetApp.flush();
    console.log('Inscripción guardada: fila ' + sheet.getLastRow() + ' de la pestaña "' + sheet.getName() + '" en ' + sheet.getParent().getUrl());
    lock.releaseLock();

    notify_(data, fileUrl, repetido);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'No se pudo guardar la inscripción. Detalle: ' + (err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ------------------------------------------------------------------ */
/* Validación                                                           */
/* ------------------------------------------------------------------ */
function validate_(d) {
  if (clean_(d.nombre, 200).length < 3) return 'Falta el nombre completo.';

  if (!/^[A-Z0-9-]{4,25}$/.test(docId_(d.documento))) return 'La cédula o pasaporte no tiene un formato válido.';

  if (!birthDate_(d.nacimiento)) return 'Falta la fecha de nacimiento.';

  if (clean_(d.whatsapp, 20).replace(/\D/g, '').length < 7) return 'Falta el número de WhatsApp.';

  const edad = parseInt(d.edad, 10);
  if (!isNaN(edad) && edad < 18) {
    if (clean_(d.responsable, 150).length < 3 || clean_(d.responsableTel, 20).replace(/\D/g, '').length < 7) {
      return 'Faltan los datos de la persona responsable.';
    }
  }

  const correo = clean_(d.correo, 120);
  if (correo && !EMAIL_RE.test(correo)) return 'El correo electrónico no es válido.';

  if (CONSENTIMIENTO_OPCIONES.indexOf(d.consentimiento) === -1) return 'Falta responder la autorización.';
  if (PAGO_OPCIONES.indexOf(d.pago) === -1) return 'Falta la forma de pago.';

  if (d.comprobante && d.comprobante.data) {
    const mime = String(d.comprobante.type || '');
    if (ALLOWED_MIME.indexOf(mime) === -1) return 'El tipo de archivo del comprobante no se acepta.';
    const approxBytes = Math.floor(String(d.comprobante.data).length * 3 / 4);
    if (approxBytes > SETTINGS.MAX_FILE_MB * 1024 * 1024) {
      return 'El comprobante pesa más de ' + SETTINGS.MAX_FILE_MB + ' MB.';
    }
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Drive y Sheets                                                       */
/* ------------------------------------------------------------------ */
function saveFile_(d) {
  const folder = getFolder_();
  const original = clean_(d.comprobante.name, 120) || 'comprobante';
  const extMatch = original.match(/\.[A-Za-z0-9]{2,5}$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : '';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const fileName = [docId_(d.documento), clean_(d.nombre, 80), stamp].join(' - ') + ext;

  const bytes = Utilities.base64Decode(String(d.comprobante.data));
  const blob = Utilities.newBlob(bytes, String(d.comprobante.type || 'application/octet-stream'), fileName);
  // El archivo queda privado: solo el dueño de la carpeta (y quienes él comparta) pueden verlo.
  return folder.createFile(blob).getUrl();
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;

  // 1) La hoja que ya usa el script (se conserva con sus inscripciones)
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (_) { /* fue borrada: se busca o se crea otra */ }
  }
  // Ya está en su carpeta: no hace falta revisar Drive en cada inscripción
  if (ss && props.getProperty('SPREADSHEET_IN_FOLDER') === id) return ss;

  const folder = getTargetFolder_();
  // 2) Una hoja con el mismo nombre que ya esté en la carpeta
  if (!ss) {
    const files = folder.getFilesByName(SETTINGS.SPREADSHEET_NAME);
    while (files.hasNext()) {
      const f = files.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS && !f.isTrashed()) { ss = SpreadsheetApp.open(f); break; }
    }
  }
  // 3) Si no hay ninguna, se crea
  if (!ss) {
    ss = SpreadsheetApp.create(SETTINGS.SPREADSHEET_NAME);
    prepareSheet_(ss.getSheets()[0]);
  }
  if (ss.getId() !== id) props.setProperty('SPREADSHEET_ID', ss.getId());
  try {
    moveToFolder_(ss.getId(), folder);
    props.setProperty('SPREADSHEET_IN_FOLDER', ss.getId());
  } catch (err) {
    // Sin permiso para moverla (p. ej. es de otra cuenta): se sigue usando donde está
    Logger.log('No se pudo mover la hoja a la carpeta: ' + err);
  }
  return ss;
}

// Devuelve (y crea si hace falta) la carpeta Mi unidad › CAMPS 2027 › Inscripciones.
function getTargetFolder_() {
  let folder = DriveApp.getRootFolder();
  SETTINGS.DRIVE_PATH.forEach(function (name) {
    const found = folder.getFoldersByName(name);
    folder = found.hasNext() ? found.next() : folder.createFolder(name);
  });
  return folder;
}

// Mueve el archivo a la carpeta si todavía no está ahí.
function moveToFolder_(fileId, folder) {
  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) return;
  }
  file.moveTo(folder);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SETTINGS.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    if (sheet.getLastRow() > 0) sheet = ss.insertSheet(SETTINGS.SHEET_NAME);
    prepareSheet_(sheet);
  }
  return sheet;
}

function prepareSheet_(sheet) {
  sheet.setName(SETTINGS.SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#0A7D94')
    .setFontColor('#FFFFFF')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange('C:C').setNumberFormat('@');
  sheet.getRange('D:D').setNumberFormat('dd/MM/yyyy');
  sheet.getRange('G:H').setNumberFormat('@');
  sheet.getRange('O:O').setNumberFormat('@');
  sheet.setColumnWidths(1, HEADERS.length, 170);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(5, 70);
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  let folder = null;

  // 1) La carpeta que ya usa el script (se conserva con sus comprobantes)
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { folder = DriveApp.getFolderById(id); if (folder.isTrashed()) folder = null; } catch (_) { folder = null; }
  }
  // Ya está en su lugar: no hace falta revisar Drive en cada inscripción
  if (folder && props.getProperty('FOLDER_IN_PLACE') === id) return folder;

  const target = getTargetFolder_();
  // 2) Una carpeta con el mismo nombre que ya esté en la ruta
  if (!folder) {
    const found = target.getFoldersByName(SETTINGS.FOLDER_NAME);
    if (found.hasNext()) folder = found.next();
  }
  // 3) Si no hay ninguna, se crea dentro de la ruta
  if (!folder) folder = target.createFolder(SETTINGS.FOLDER_NAME);
  if (folder.getId() !== id) props.setProperty('FOLDER_ID', folder.getId());

  try {
    const parents = folder.getParents();
    let inPlace = false;
    while (parents.hasNext()) if (parents.next().getId() === target.getId()) inPlace = true;
    if (!inPlace) folder.moveTo(target);
    props.setProperty('FOLDER_IN_PLACE', folder.getId());
  } catch (err) {
    Logger.log('No se pudo mover la carpeta de comprobantes: ' + err);
  }
  return folder;
}

function isDuplicate_(sheet, documento) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const values = sheet.getRange(2, 3, last - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).replace(/^'/, '').toUpperCase() === documento) return true;
  }
  return false;
}

function notify_(d, fileUrl, repetido) {
  if (!SETTINGS.NOTIFY_EMAIL) return;
  try {
    const edad = parseInt(d.edad, 10);
    const body = [
      'Nueva inscripción de participante:',
      '',
      'Nombre: ' + clean_(d.nombre, 120),
      'Cédula o pasaporte: ' + docId_(d.documento),
      'Edad: ' + (isNaN(edad) ? '—' : edad),
      'WhatsApp: ' + clean_(d.whatsapp, 20),
      'Correo: ' + clean_(d.correo, 120),
      'Forma de pago: ' + clean_(d.pago, 20),
      'Comprobante: ' + (fileUrl || 'No adjuntó'),
      repetido ? '\nAtención: este documento ya estaba registrado.' : '',
      '',
      'Hoja: ' + getSpreadsheet_().getUrl()
    ].join('\n');
    MailApp.sendEmail(SETTINGS.NOTIFY_EMAIL, 'Nueva inscripción Camps: ' + clean_(d.nombre, 80), body);
  } catch (err) {
    console.error('No se pudo enviar el aviso por correo', err);
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */
function clean_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function docId_(value) {
  return clean_(value, 40).toUpperCase().replace(/\s+/g, '');
}

// Convierte "AAAA-MM-DD" en una fecha de la hoja; devuelve '' si no es válida.
function birthDate_(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean_(value, 10));
  if (!m) return '';
  const date = new Date(+m[1], +m[2] - 1, +m[3]);
  if (date.getMonth() !== +m[2] - 1 || date > new Date()) return '';
  return date;
}

// Evita que un texto que empiece con = + - @ se interprete como fórmula en la hoja.
function safe_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
