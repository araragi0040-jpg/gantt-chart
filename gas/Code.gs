/**
 * 工事工程ガント管理アプリ GAS API 初期版
 *
 * 使い方:
 * 1. Googleスプレッドシートを作成
 * 2. 拡張機能 > Apps Script にこの Code.gs を貼り付け
 * 3. SPREADSHEET_ID を設定
 * 4. setupSheets() を一度実行してシート作成
 * 5. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 必要に応じて設定
 * 6. 発行URLをフロント画面の GAS URL に貼り付け
 */

const SPREADSHEET_ID = 'ここにスプレッドシートIDを入れてください';

const SHEETS = {
  PROJECTS: '01_工事台帳',
  TASKS: '04_工程データ',
  LOGS: '05_変更履歴',
};

const PROJECT_HEADERS = [
  'project_id',
  'project_name',
  'customer_name',
  'site_address',
  'project_type',
  'planned_start',
  'planned_end',
  'status',
  'manager',
  'memo',
];

const TASK_HEADERS = [
  'id',
  'project_id',
  'name',
  'category',
  'start',
  'end',
  'progress',
  'contractor',
  'status',
  'dependencies',
  'memo',
  'source',
  'is_manual_edited',
];

const LOG_HEADERS = [
  'log_id',
  'timestamp',
  'user',
  'project_id',
  'task_id',
  'task_name',
  'action_type',
  'memo',
];

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'loadAll';

    if (action === 'ping') {
      return jsonOutput({ ok: true, message: 'pong' });
    }

    if (action === 'loadAll') {
      return jsonOutput(loadAll());
    }

    return jsonOutput({ ok: false, message: 'unknown action: ' + action });
  } catch (error) {
    return jsonOutput({ ok: false, message: error.message, stack: error.stack });
  }
}

function doPost(e) {
  try {
    const bodyText = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(bodyText);
    const action = body.action || 'saveAll';

    if (action === 'saveAll') {
      saveAll(body);
      return jsonOutput({ ok: true, message: 'saved' });
    }

    return jsonOutput({ ok: false, message: 'unknown action: ' + action });
  } catch (error) {
    return jsonOutput({ ok: false, message: error.message, stack: error.stack });
  }
}

function setupSheets() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, SHEETS.PROJECTS, PROJECT_HEADERS);
  ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS);
  ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);
}

function loadAll() {
  const ss = getSpreadsheet_();
  const projectsSheet = ensureSheet_(ss, SHEETS.PROJECTS, PROJECT_HEADERS);
  const tasksSheet = ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS);
  const logsSheet = ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);

  return {
    ok: true,
    projects: readObjects_(projectsSheet),
    tasks: readObjects_(tasksSheet),
    changeLogs: readObjects_(logsSheet),
  };
}

function saveAll(payload) {
  const ss = getSpreadsheet_();
  const projectsSheet = ensureSheet_(ss, SHEETS.PROJECTS, PROJECT_HEADERS);
  const tasksSheet = ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS);
  const logsSheet = ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);

  writeObjects_(projectsSheet, PROJECT_HEADERS, payload.projects || []);
  writeObjects_(tasksSheet, TASK_HEADERS, payload.tasks || []);
  writeObjects_(logsSheet, LOG_HEADERS, payload.changeLogs || []);
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入れてください') {
    throw new Error('SPREADSHEET_ID が未設定です。');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  const needsHeader = headers.some((header, index) => currentHeaders[index] !== header);
  if (needsHeader) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(cell => cell !== '')).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = normalizeCell_(row[index]);
    });
    return obj;
  });
}

function writeObjects_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (!rows.length) return;
  const values = rows.map(row => headers.map(header => row[header] ?? ''));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function normalizeCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
