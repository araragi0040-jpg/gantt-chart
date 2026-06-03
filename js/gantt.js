window.KoujiGantt = (() => {
  let tableGantt = null;
  let onTaskClickHandler = () => {};
  let onTaskChangeHandler = () => {};
  const LEFT_COLUMN_WIDTH = 520;
  const ROW_HEIGHT = 52;
  const GRID_MIN_HEIGHT = 360;

  const VIEW_CONFIG = {
    Day: { unit: "day", dayWidth: 26 },
    Week: { unit: "week", dayWidth: 13 },
    Month: { unit: "month", dayWidth: 4.4 },
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toDate(dateText) {
    return KoujiUtils.toDate(dateText);
  }

  function formatMd(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function addDays(date, amount) {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dayDiff(from, to) {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  function normalizeViewMode(viewMode) {
    return VIEW_CONFIG[viewMode] ? viewMode : "Day";
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(d, diff);
  }

  function endOfWeek(date) {
    return addDays(startOfWeek(date), 6);
  }

  function startOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function endOfMonth(date) {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getRange(tasks, viewMode) {
    if (!tasks.length) {
      const today = KoujiUtils.toDate(KoujiUtils.getToday());
      return {
        rangeStart: today,
        rangeEnd: addDays(today, 30),
      };
    }

    const taskStarts = tasks.map((task) => toDate(task.start));
    const taskEnds = tasks.map((task) => toDate(task.end));
    const minStart = taskStarts.reduce((a, b) => (a < b ? a : b));
    const maxEnd = taskEnds.reduce((a, b) => (a > b ? a : b));

    if (viewMode === "Week") {
      return {
        rangeStart: startOfWeek(minStart),
        rangeEnd: endOfWeek(maxEnd),
      };
    }

    if (viewMode === "Month") {
      return {
        rangeStart: startOfMonth(minStart),
        rangeEnd: endOfMonth(maxEnd),
      };
    }

    return {
      rangeStart: minStart,
      rangeEnd: maxEnd,
    };
  }

  function getTimelineCells(rangeStart, rangeEnd, viewMode) {
    const cells = [];

    if (viewMode === "Week") {
      for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 7)) {
        const cellStart = new Date(d);
        const cellEnd = new Date(Math.min(endOfWeek(d).getTime(), rangeEnd.getTime()));
        cells.push({ start: cellStart, end: cellEnd, label: `${formatMd(cellStart)}〜${formatMd(cellEnd)}` });
      }
      return cells;
    }

    if (viewMode === "Month") {
      for (let d = new Date(rangeStart); d <= rangeEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const cellStart = new Date(d);
        const cellEnd = new Date(Math.min(endOfMonth(d).getTime(), rangeEnd.getTime()));
        cells.push({ start: cellStart, end: cellEnd, label: `${cellStart.getFullYear()}年${cellStart.getMonth() + 1}月` });
      }
      return cells;
    }

    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
      cells.push({ start: new Date(d), end: new Date(d), label: String(d.getDate()) });
    }
    return cells;
  }

  function getTaskColor(task, index) {
    const fromCategory = {
      新築: "#d77d30",
      改装: "#d9a132",
      内装: "#5d86bf",
      外構: "#8f74b6",
      その他: "#c8752d",
    };
    if (fromCategory[task.category]) return fromCategory[task.category];
    const fallback = ["#d77d30", "#d9a132", "#5d86bf", "#8f74b6", "#6ea36c", "#d06b6b"];
    return fallback[index % fallback.length];
  }

  function cellWidth(cell, dayWidth) {
    return (dayDiff(cell.start, cell.end) + 1) * dayWidth;
  }

  function getXFromDate(rangeStart, date, dayWidth) {
    return dayDiff(rangeStart, date) * dayWidth;
  }

  function getDateFromX(rangeStart, x, dayWidth) {
    return addDays(rangeStart, Math.round(x / dayWidth));
  }

  function buildTopHeaders(cells, dayWidth, viewMode) {
    if (viewMode === "Day") {
      const monthMap = new Map();
      cells.forEach((cell) => {
        const day = cell.start;
        const key = `${day.getFullYear()}-${day.getMonth()}`;
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      });

      return Array.from(monthMap.entries())
        .map(([key, count]) => {
          const [year, month] = key.split("-").map(Number);
          return `<div class="tg-month" style="width:${count * dayWidth}px">${year}年${month + 1}月</div>`;
        })
        .join("");
    }

    return cells
      .map((cell) => `<div class="tg-month" style="width:${cellWidth(cell, dayWidth)}px">${escapeHtml(cell.label)}</div>`)
      .join("");
  }

  function buildBottomHeaders(cells, dayWidth, viewMode) {
    if (viewMode === "Week") {
      return cells
        .map((cell) => `<div class="tg-day" style="width:${cellWidth(cell, dayWidth)}px"><strong>週</strong><span>${escapeHtml(cell.label)}</span></div>`)
        .join("");
    }

    if (viewMode === "Month") {
      return cells
        .map((cell) => `<div class="tg-day" style="width:${cellWidth(cell, dayWidth)}px"><strong>${cell.start.getMonth() + 1}月</strong><span>${dayDiff(cell.start, cell.end) + 1}日</span></div>`)
        .join("");
    }

    return cells
      .map((cell) => {
        const day = cell.start;
        const dow = day.getDay();
        const cls = dow === 0 ? "sun" : dow === 6 ? "sat" : "";
        return `
          <div class="tg-day ${cls}" style="width:${dayWidth}px">
            <strong>${day.getDate()}</strong>
            <span>${["日", "月", "火", "水", "木", "金", "土"][dow]}</span>
          </div>
        `;
      })
      .join("");
  }

  function buildGridGuides(cells, dayWidth, viewMode) {
    let left = 0;
    const lines = [];
    const weekends = [];

    cells.forEach((cell) => {
      const width = cellWidth(cell, dayWidth);
      lines.push(`<div class="tg-day-line" style="left:${left}px"></div>`);

      if (viewMode === "Day") {
        const dow = cell.start.getDay();
        if (dow === 0 || dow === 6) {
          weekends.push(`<div class="tg-weekend-col" style="left:${left}px;width:${width}px"></div>`);
        }
      }

      left += width;
    });

    return { lines: lines.join(""), weekends: weekends.join("") };
  }

  function buildMarkup(tasks, cells, rangeStart, rangeEnd, dayWidth, gridHeight, viewMode) {
    const topHeaders = buildTopHeaders(cells, dayWidth, viewMode);
    const bottomHeaders = buildBottomHeaders(cells, dayWidth, viewMode);
    const totalGridWidth = (dayDiff(rangeStart, rangeEnd) + 1) * dayWidth;
    const guides = buildGridGuides(cells, dayWidth, viewMode);

    const leftRows = tasks
      .map((task, index) => {
        const progress = Number(task.progress || 0);
        return `
          <div class="tg-left-row tg-row" data-task-id="${escapeHtml(task.id)}">
            <div class="tg-no">${index + 1}</div>
            <div class="tg-name">${escapeHtml(task.name)}</div>
            <div class="tg-date">${escapeHtml(formatMd(toDate(task.start)))}</div>
            <div class="tg-date">${escapeHtml(formatMd(toDate(task.end)))}</div>
            <div class="tg-percent">${progress}%</div>
          </div>
        `;
      })
      .join("");

    const rightRows = tasks
      .map((task, index) => {
        const progress = Number(task.progress || 0);
        const barLeft = clamp(getXFromDate(rangeStart, toDate(task.start), dayWidth), 0, totalGridWidth - dayWidth);
        const barRight = clamp(getXFromDate(rangeStart, toDate(task.end), dayWidth) + dayWidth, barLeft + dayWidth, totalGridWidth);
        const barWidth = barRight - barLeft;
        const color = getTaskColor(task, index);
        return `
          <div class="tg-grid-row tg-row" data-task-id="${escapeHtml(task.id)}" style="width:${totalGridWidth}px">
            <div class="tg-grid-bar"
                 data-task-id="${escapeHtml(task.id)}"
                 style="left:${barLeft}px;width:${barWidth}px;--bar-color:${color};">
              <button class="tg-resize-handle start" type="button" aria-label="開始日を調整" data-task-id="${escapeHtml(task.id)}" data-resize="start"></button>
              <div class="tg-grid-bar-progress" style="width:${progress}%"></div>
              <div class="tg-grid-bar-label ${progress >= 50 ? "is-label-light" : ""}">${progress}%</div>
              <button class="tg-resize-handle end" type="button" aria-label="終了日を調整" data-task-id="${escapeHtml(task.id)}" data-resize="end"></button>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="table-gantt">
        <div class="table-gantt-head">
          <div class="tg-left-head">
            <div>No.</div>
            <div>工程名</div>
            <div>開始日</div>
            <div>終了日</div>
            <div>進捗率</div>
          </div>
          <div class="tg-right-head" style="width:${totalGridWidth}px">
            <div class="tg-months">${topHeaders}</div>
            <div class="tg-days">${bottomHeaders}</div>
          </div>
        </div>
        <div class="table-gantt-body" style="height:${gridHeight}px">
          <div class="tg-left-body">${leftRows}</div>
          <div class="tg-right-body" style="width:${totalGridWidth}px">
            <div class="tg-grid-overlay" style="width:${totalGridWidth}px">
              ${guides.lines}
              ${guides.weekends}
            </div>
            ${rightRows}
          </div>
        </div>
      </div>
    `;
  }

  function bindInteractions(container, tasks, rangeStart, rangeEnd, dayWidth) {
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const rows = Array.from(container.querySelectorAll(".tg-row"));
    const body = container.querySelector(".table-gantt-body");
    const leftBody = container.querySelector(".tg-left-body");
    const rightBody = container.querySelector(".tg-right-body");
    const rightRectTarget = container.querySelector(".tg-right-body");

    if (body && leftBody && rightBody) {
      body.addEventListener("scroll", () => {
        leftBody.scrollTop = body.scrollTop;
        rightBody.scrollTop = body.scrollTop;
        rightBody.scrollLeft = body.scrollLeft;
      });
    }

    rows.forEach((row) => {
      const taskId = row.dataset.taskId;
      if (!taskId) return;
      row.addEventListener("click", (event) => {
        if (event.target.closest(".tg-resize-handle")) return;
        if (event.target.closest(".tg-grid-bar")) return;
        onTaskClickHandler(taskId);
      });
    });

    container.querySelectorAll(".tg-grid-bar").forEach((bar) => {
      const taskId = bar.dataset.taskId;
      if (!taskId) return;
      bar.addEventListener("click", (event) => {
        if (event.target.closest(".tg-resize-handle")) return;
        onTaskClickHandler(taskId);
      });
    });

    let dragState = null;

    const updatePreview = (nextStart, nextEnd) => {
      const barLeft = clamp(getXFromDate(rangeStart, nextStart, dayWidth), 0, getXFromDate(rangeStart, rangeEnd, dayWidth));
      const barRight = clamp(getXFromDate(rangeStart, nextEnd, dayWidth) + dayWidth, barLeft + dayWidth, getXFromDate(rangeStart, rangeEnd, dayWidth) + dayWidth);
      dragState.bar.style.left = `${barLeft}px`;
      dragState.bar.style.width = `${barRight - barLeft}px`;
    };

    const onMove = (event) => {
      if (!dragState) return;
      event.preventDefault();
      const x = event.clientX - dragState.gridRect.left + (body?.scrollLeft || 0);
      const pointedDate = getDateFromX(rangeStart, clamp(x, 0, getXFromDate(rangeStart, rangeEnd, dayWidth)), dayWidth);

      let nextStart = dragState.startDate;
      let nextEnd = dragState.endDate;

      if (dragState.mode === "start") {
        nextStart = pointedDate > dragState.endDate ? dragState.endDate : pointedDate;
      }
      if (dragState.mode === "end") {
        nextEnd = pointedDate < dragState.startDate ? dragState.startDate : pointedDate;
      }

      const nextStartText = KoujiUtils.formatDate(nextStart);
      const nextEndText = KoujiUtils.formatDate(nextEnd);
      if (nextStartText === dragState.nextStart && nextEndText === dragState.nextEnd) return;

      dragState.nextStart = nextStartText;
      dragState.nextEnd = nextEndText;
      updatePreview(nextStart, nextEnd);
    };

    const onUp = () => {
      if (!dragState) return;
      const nextStart = dragState.nextStart || KoujiUtils.formatDate(dragState.startDate);
      const nextEnd = dragState.nextEnd || KoujiUtils.formatDate(dragState.endDate);
      const changed = nextStart !== KoujiUtils.formatDate(dragState.startDate) || nextEnd !== KoujiUtils.formatDate(dragState.endDate);

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      if (changed) {
        onTaskChangeHandler({
          id: dragState.taskId,
          start: nextStart,
          end: nextEnd,
          is_manual_edited: true,
        }, "ガント期間変更");
      }
      dragState = null;
    };

    container.querySelectorAll(".tg-resize-handle").forEach((handle) => {
      const taskId = handle.dataset.taskId;
      if (!taskId) return;
      handle.addEventListener("mousedown", (event) => {
        const task = tasksById.get(taskId);
        if (!task) return;
        event.preventDefault();
        event.stopPropagation();
        dragState = {
          mode: handle.dataset.resize,
          taskId,
          bar: handle.closest(".tg-grid-bar"),
          gridRect: rightRectTarget.getBoundingClientRect(),
          startDate: toDate(task.start),
          endDate: toDate(task.end),
          nextStart: task.start,
          nextEnd: task.end,
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }

  function render(containerSelector, tasks, options = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) throw new Error(`${containerSelector} が見つかりません。`);
    container.innerHTML = "";

    onTaskClickHandler = options.onTaskClick || (() => {});
    onTaskChangeHandler = options.onTaskChange || (() => {});

    const viewMode = normalizeViewMode(options.viewMode || "Day");
    const config = VIEW_CONFIG[viewMode];
    const normalizedTasks = tasks.map((task) => ({
      ...task,
      start: KoujiUtils.formatDate(task.start),
      end: KoujiUtils.formatDate(task.end),
      progress: KoujiUtils.clampProgress(task.progress),
    }));
    const { rangeStart, rangeEnd } = getRange(normalizedTasks, viewMode);
    const cells = getTimelineCells(rangeStart, rangeEnd, viewMode);
    const gridHeight = Math.max(GRID_MIN_HEIGHT, normalizedTasks.length * ROW_HEIGHT);

    container.innerHTML = buildMarkup(normalizedTasks, cells, rangeStart, rangeEnd, config.dayWidth, gridHeight, viewMode);
    bindInteractions(container, normalizedTasks, rangeStart, rangeEnd, config.dayWidth);

    tableGantt = {
      containerSelector,
      tasks: normalizedTasks,
      options: { ...options, viewMode },
    };
    return tableGantt;
  }

  function changeViewMode() {
    if (!tableGantt) return;
    render(tableGantt.containerSelector, tableGantt.tasks, tableGantt.options);
  }

  function refresh(tasks, viewMode = "Day") {
    if (!tableGantt) return null;
    return render("#gantt", tasks, {
      viewMode,
      onTaskClick: onTaskClickHandler,
      onTaskChange: onTaskChangeHandler,
    });
  }

  return {
    render,
    refresh,
    changeViewMode,
  };
})();
