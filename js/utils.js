window.KoujiUtils = (() => {
  const pad = (value) => String(value).padStart(2, "0");

  function toDate(value) {
    if (value instanceof Date) return value;
    if (!value) return new Date();
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function formatDate(value) {
    const date = toDate(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatDateJa(value) {
    if (!value) return "-";
    const date = toDate(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function addDays(value, amount) {
    const date = toDate(value);
    date.setDate(date.getDate() + Number(amount || 0));
    return formatDate(date);
  }

  function diffDays(start, end) {
    const startDate = toDate(start);
    const endDate = toDate(end);
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  function dayDelta(before, after) {
    const beforeDate = toDate(before);
    const afterDate = toDate(after);
    const diff = afterDate.getTime() - beforeDate.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

  function clampProgress(value) {
    const number = Number(value || 0);
    if (Number.isNaN(number)) return 0;
    return Math.min(100, Math.max(0, number));
  }

  function generateId(prefix = "ID") {
    const now = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${now}-${random}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getToday() {
    return formatDate(new Date());
  }

  function normalizeTask(task) {
    const start = formatDate(task.start || task.start_date || getToday());
    const end = formatDate(task.end || task.end_date || start);
    return {
      id: String(task.id || task.task_id || generateId("T")),
      project_id: String(task.project_id || ""),
      name: String(task.name || task.task_name || "未設定工程"),
      category: String(task.category || "その他"),
      start,
      end,
      progress: clampProgress(task.progress),
      contractor: String(task.contractor || ""),
      status: String(task.status || "未着手"),
      dependencies: String(task.dependencies || ""),
      memo: String(task.memo || ""),
      source: String(task.source || "manual"),
      is_manual_edited: Boolean(task.is_manual_edited),
    };
  }

  function normalizeProject(project) {
    return {
      project_id: String(project.project_id || generateId("P")),
      project_name: String(project.project_name || "未設定工事"),
      customer_name: String(project.customer_name || ""),
      site_address: String(project.site_address || ""),
      project_type: String(project.project_type || "その他"),
      planned_start: formatDate(project.planned_start || getToday()),
      planned_end: formatDate(project.planned_end || project.planned_start || getToday()),
      status: String(project.status || "予定"),
      manager: String(project.manager || ""),
      memo: String(project.memo || ""),
      project_folder: String(project.project_folder || project.folder || ""),
      deleted_at: String(project.deleted_at || ""),
      previous_folder: String(project.previous_folder || ""),
    };
  }

  function projectTasks(tasks, projectId) {
    return tasks
      .filter((task) => task.project_id === projectId)
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.name.localeCompare(b.name));
  }

  function taskDurationText(task) {
    return `${diffDays(task.start, task.end)}日`;
  }

  function taskToFrappe(task) {
    return {
      id: task.id,
      name: task.name,
      start: task.start,
      end: task.end,
      progress: clampProgress(task.progress),
      dependencies: task.dependencies || "",
      custom_class: `category-${task.category}`,
      category: task.category,
      contractor: task.contractor,
      status: task.status,
      memo: task.memo,
    };
  }

  return {
    toDate,
    formatDate,
    formatDateJa,
    addDays,
    diffDays,
    dayDelta,
    clampProgress,
    generateId,
    clone,
    getToday,
    normalizeTask,
    normalizeProject,
    projectTasks,
    taskDurationText,
    taskToFrappe,
  };
})();
