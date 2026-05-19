/**
 * 工事工程ガント管理アプリ GAS API
 *
 * 使い方:
 * 1. Googleスプレッドシートを作成
 * 2. シート側で「拡張機能 > Apps Script」を開く
 * 3. この Code.gs を貼り付ける
 * 4. setupSheets() を1回実行して権限許可
 * 5. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員、または組織内
 * 6. 発行された /exec のURLをVercel側のGAS URL欄に貼り付ける
 */

// スプレッドシートに紐づくGASなら空欄でOK。
// スタンドアロンGASで使う場合だけ、スプレッドシートIDを入れてください。
const SPREADSHEET_ID = '';

const SHEETS = {
  PROJECTS: '01_projects',
  TASKS: '04_tasks',
  LOGS: '05_change_logs',
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
  'project_folder',
  'deleted_at',
  'previous_folder',
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
    const action = getParam_(e, 'action', 'loadAll');

    if (action === 'ping') {
      return jsonOutput_({ ok: true, message: 'pong', now: new Date().toISOString() });
    }

    if (action === 'loadAll') {
      return jsonOutput_(loadAll_());
    }

    if (action === 'listProjects') {
      return jsonOutput_({ ok: true, projects: readProjects_() });
    }

    if (action === 'listTasks') {
      const projectId = getParam_(e, 'project_id', '');
      const tasks = readTasks_().filter(task => !projectId || task.project_id === projectId);
      return jsonOutput_({ ok: true, tasks });
    }

    return jsonOutput_({ ok: false, message: 'unknown action: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, message: error.message, stack: error.stack });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const bodyText = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(bodyText);
    const action = body.action || 'saveAll';

    if (action === 'saveAll') {
      saveAll_(body);
      return jsonOutput_({ ok: true, message: 'saved', savedAt: new Date().toISOString() });
    }

    if (action === 'saveTasks') {
      writeTasks_(body.tasks || []);
      appendLogs_(body.changeLogs || []);
      return jsonOutput_({ ok: true, message: 'tasks saved', savedAt: new Date().toISOString() });
    }

    if (action === 'appendLogs') {
      appendLogs_(body.changeLogs || []);
      return jsonOutput_({ ok: true, message: 'logs appended', savedAt: new Date().toISOString() });
    }

    return jsonOutput_({ ok: false, message: 'unknown action: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, message: error.message, stack: error.stack });
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // lock未取得時の例外は無視
    }
  }
}

function setupSheets() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, SHEETS.PROJECTS, PROJECT_HEADERS);
  ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS);
  ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);
}

function loadAll_() {
  return {
    ok: true,
    projects: readProjects_(),
    tasks: readTasks_(),
    changeLogs: readLogs_(),
  };
}

function saveAll_(payload) {
  const ss = getSpreadsheet_();
  writeObjects_(ensureSheet_(ss, SHEETS.PROJECTS, PROJECT_HEADERS), PROJECT_HEADERS, payload.projects || []);
  writeObjects_(ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS), TASK_HEADERS, payload.tasks || []);
  writeObjects_(ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS), LOG_HEADERS, payload.changeLogs || []);
}

function readProjects_() {
  const ss = getSpreadsheet_();
  return readObjects_(ensureSheet_(ss, SHEETS.PROJECTS, PROJECT_HEADERS));
}

function readTasks_() {
  const ss = getSpreadsheet_();
  return readObjects_(ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS));
}

function readLogs_() {
  const ss = getSpreadsheet_();
  return readObjects_(ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS));
}

function writeTasks_(tasks) {
  const ss = getSpreadsheet_();
  writeObjects_(ensureSheet_(ss, SHEETS.TASKS, TASK_HEADERS), TASK_HEADERS, tasks);
}

function appendLogs_(logs) {
  if (!logs.length) return;
  const ss = getSpreadsheet_();
  const sheet = ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);
  const values = logs.map(log => LOG_HEADERS.map(header => normalizeWriteValue_(log[header])));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, LOG_HEADERS.length).setValues(values);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('スプレッドシートに紐づくGASではありません。SPREADSHEET_IDを設定してください。');
  }
  return active;
}

function ensureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const needsHeader = headers.some((header, index) => currentHeaders[index] !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values
    .slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = normalizeReadValue_(row[index]);
      });
      return obj;
    });
}

function writeObjects_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (!rows.length) return;

  const values = rows.map(row => headers.map(header => normalizeWriteValue_(row[header])));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function normalizeReadValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function normalizeWriteValue_(value) {
  if (value === undefined || value === null) return '';
  return value;
}

function getParam_(e, key, defaultValue) {
  return e && e.parameter && e.parameter[key] !== undefined ? e.parameter[key] : defaultValue;
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
