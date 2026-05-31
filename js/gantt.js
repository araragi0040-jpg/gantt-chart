// Workaround for frappe-gantt@1.0.3 dist bug:
// progress-handle mousedown writes to global y_on_start under strict mode.
window.y_on_start = window.y_on_start ?? 0;

window.KoujiGantt = (() => {
  let gantt = null;
  let onTaskClickHandler = () => {};
  let onTaskChangeHandler = () => {};

  function assertGanttLoaded() {
    if (typeof window.Gantt !== "function") {
      throw new Error("Frappe Ganttが読み込めていません。CDN接続を確認してください。");
    }
  }

  function render(containerSelector, tasks, options = {}) {
    assertGanttLoaded();
    const container = document.querySelector(containerSelector);
    if (!container) throw new Error(`${containerSelector} が見つかりません。`);
    container.innerHTML = "";

    onTaskClickHandler = options.onTaskClick || (() => {});
    onTaskChangeHandler = options.onTaskChange || (() => {});

    const frappeTasks = tasks.map(KoujiUtils.taskToFrappe);

    gantt = new window.Gantt(containerSelector, frappeTasks, {
      view_mode: options.viewMode || "Day",
      view_mode_select: false,
      date_format: "YYYY-MM-DD",
      bar_height: 30,
      column_width: 42,
      padding: 18,
      readonly: false,
      readonly_dates: false,
      readonly_progress: false,
      move_dependencies: false,
      scroll_to: "start",
      holidays: {
        "rgba(200, 117, 45, 0.08)": "weekend",
      },
      popup_on: "click",
      on_click: (task) => {
        onTaskClickHandler(task.id);
      },
      on_date_change: (task, start, end) => {
        const updated = {
          id: task.id,
          start: KoujiUtils.formatDate(start),
          end: KoujiUtils.formatDate(end),
          is_manual_edited: true,
        };
        onTaskChangeHandler(updated, "ガント日程変更");
      },
      on_progress_change: (task, progress) => {
        const updated = {
          id: task.id,
          progress: KoujiUtils.clampProgress(progress),
          is_manual_edited: true,
        };
        onTaskChangeHandler(updated, "進捗変更");
      },
      popup: ({ task }) => {
        const duration = KoujiUtils.diffDays(task.start, task.end);
        const category = task.category || "未分類";
        const contractor = task.contractor || "未設定";
        const status = task.status || "未着手";
        const memo = task.memo || "";
        return `
          <div class="gantt-popup">
            <strong>${escapeHtml(task.name)}</strong>
            <p>${escapeHtml(task.start)} 〜 ${escapeHtml(task.end)} / ${duration}日</p>
            <p>分類：${escapeHtml(category)}　担当：${escapeHtml(contractor)}</p>
            <p>状態：${escapeHtml(status)}　進捗：${Number(task.progress || 0)}%</p>
            ${memo ? `<p class="popup-memo">${escapeHtml(memo)}</p>` : ""}
            <p class="popup-note">一覧の行クリックで詳細編集できます。</p>
          </div>
        `;
      },
    });

    return gantt;
  }

  function changeViewMode(mode) {
    if (!gantt) return;
    if (typeof gantt.change_view_mode === "function") {
      gantt.change_view_mode(mode, true);
      return;
    }
    if (typeof gantt.update_options === "function") {
      gantt.update_options({ view_mode: mode });
    }
  }

  function refresh(tasks, viewMode = "Day") {
    if (!gantt) return null;
    // バージョン差異を避けるため、シンプルに再描画する。
    return render("#gantt", tasks, {
      viewMode,
      onTaskClick: onTaskClickHandler,
      onTaskChange: onTaskChangeHandler,
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  return {
    render,
    refresh,
    changeViewMode,
  };
})();
