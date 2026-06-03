window.KoujiGantt = (() => {
  let gantt = null;
  let lastTasks = [];
  let lastViewMode = "Day";
  let lastScrollTo = "start";
  let onTaskClickHandler = () => {};
  let onTaskChangeHandler = () => {};
  let onIgnoredMoveHandler = () => {};

  const VIEW_MODE_SETTINGS = {
    Day: {
      name: "Day",
      step: "1d",
      padding: ["0d", "21d"],
      column_width: 60,
      snap_at: "1d",
      date_format: "YYYY-MM-DD",
      upper_text: (currentDate, previousDate) => {
        if (!previousDate || currentDate.getMonth() !== previousDate.getMonth()) {
          return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
        }
        return "";
      },
      lower_text: (currentDate) => `${currentDate.getDate()}`,
      thick_line: (currentDate) => currentDate.getDay() === 1,
    },
    Week: {
      name: "Week",
      step: "7d",
      padding: ["0d", "2m"],
      column_width: 150,
      snap_at: "1d",
      date_format: "YYYY-MM-DD",
      upper_text: (currentDate, previousDate) => {
        if (!previousDate || currentDate.getMonth() !== previousDate.getMonth()) {
          return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
        }
        return "";
      },
      lower_text: (currentDate) => {
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 6);
        return `${currentDate.getMonth() + 1}/${currentDate.getDate()}〜${endDate.getMonth() + 1}/${endDate.getDate()}`;
      },
      upper_text_frequency: 4,
      thick_line: (currentDate) => currentDate.getDate() >= 1 && currentDate.getDate() <= 7,
    },
    Month: {
      name: "Month",
      step: "1m",
      padding: ["0d", "6m"],
      column_width: 180,
      snap_at: "1d",
      date_format: "YYYY-MM-DD",
      upper_text: (currentDate, previousDate) => {
        if (!previousDate || currentDate.getFullYear() !== previousDate.getFullYear()) {
          return `${currentDate.getFullYear()}年`;
        }
        return "";
      },
      lower_text: (currentDate) => `${currentDate.getMonth() + 1}月`,
      thick_line: (currentDate) => currentDate.getMonth() % 3 === 0,
    },
  };

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
    onIgnoredMoveHandler = options.onIgnoredMove || (() => {});

    lastTasks = tasks;
    lastViewMode = options.viewMode || "Day";
    lastScrollTo = options.scrollTo || getFirstTaskStart(tasks) || "start";

    const originalTaskMap = new Map(tasks.map((task) => [task.id, { ...task }]));
    const frappeTasks = tasks.map(KoujiUtils.taskToFrappe);

    gantt = new window.Gantt(containerSelector, frappeTasks, {
      view_mode: lastViewMode,
      view_modes: buildViewModes(lastViewMode),
      view_mode_select: false,
      date_format: "YYYY-MM-DD",
      language: "ja",
      bar_height: 30,
      padding: 18,
      container_height: "auto",
      readonly: false,
      readonly_dates: false,
      readonly_progress: true,
      fixed_duration: false,
      move_dependencies: false,
      infinite_padding: false,
      snap_at: "1d",
      scroll_to: lastScrollTo,
      today_button: false,
      popup_on: "click",
      auto_move_label: true,
      on_click: (task) => {
        onTaskClickHandler(task.id);
      },
      on_date_change: (task, start, end) => {
        const original = originalTaskMap.get(task.id);
        const updatedStart = KoujiUtils.formatDate(start);
        const updatedEnd = KoujiUtils.formatDate(end);

        if (original && isWholeBarMove(original, updatedStart, updatedEnd)) {
          onIgnoredMoveHandler(task.id);
          window.setTimeout(() => refresh(lastTasks, lastViewMode, lastScrollTo), 0);
          return;
        }

        const updated = {
          id: task.id,
          start: updatedStart,
          end: updatedEnd,
          is_manual_edited: true,
        };
        onTaskChangeHandler(updated, "ガント期間変更");
      },
      on_progress_change: () => {
        // 現時点では進捗ドラッグは使わない。進捗は工程編集画面で変更する。
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
            <p class="popup-note">左右端をドラッグして期間変更できます。詳細編集は工程一覧から行ってください。</p>
          </div>
        `;
      },
    });

    window.requestAnimationFrame(() => {
      enhanceResizeHandles(container);
      markCentralDragDisabled(container);
    });

    return gantt;
  }

  function buildViewModes(selectedMode) {
    const modeNames = ["Day", "Week", "Month"];
    const selected = VIEW_MODE_SETTINGS[selectedMode] ? selectedMode : "Day";
    const ordered = [selected, ...modeNames.filter((mode) => mode !== selected)];
    return ordered.map((mode) => ({ ...VIEW_MODE_SETTINGS[mode] }));
  }

  function getFirstTaskStart(tasks) {
    if (!tasks || !tasks.length) return "start";
    return tasks
      .map((task) => task.start)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))[0] || "start";
  }

  function isWholeBarMove(original, updatedStart, updatedEnd) {
    const startDelta = KoujiUtils.dayDelta(original.start, updatedStart);
    const endDelta = KoujiUtils.dayDelta(original.end, updatedEnd);
    return startDelta !== 0 && startDelta === endDelta;
  }

  function enhanceResizeHandles(container) {
    const handleWidth = 14;
    container.querySelectorAll(".handle.left, .handle.right").forEach((handle) => {
      const currentX = Number(handle.getAttribute("x") || 0);
      handle.setAttribute("width", String(handleWidth));
      handle.setAttribute("rx", "6");
      handle.setAttribute("ry", "6");
      if (!handle.dataset.kgmWideHandle) {
        handle.setAttribute("x", String(currentX - handleWidth / 2));
        handle.dataset.kgmWideHandle = "true";
      }
      handle.classList.add("visible");
      handle.style.pointerEvents = "all";
    });
  }

  function markCentralDragDisabled(container) {
    container.querySelectorAll(".bar-wrapper").forEach((wrapper) => {
      wrapper.classList.add("kgm-resize-only");
      wrapper.setAttribute("title", "左右端で期間変更できます。中央ドラッグ移動は無効です。");
    });
  }

  function changeViewMode(mode) {
    lastViewMode = mode || "Day";
    return refresh(lastTasks, lastViewMode, getFirstTaskStart(lastTasks));
  }

  function refresh(tasks, viewMode = "Day", scrollTo = "start") {
    if (!gantt) return null;
    return render("#gantt", tasks, {
      viewMode,
      scrollTo: scrollTo || getFirstTaskStart(tasks),
      onTaskClick: onTaskClickHandler,
      onTaskChange: onTaskChangeHandler,
      onIgnoredMove: onIgnoredMoveHandler,
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
