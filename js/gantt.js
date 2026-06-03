window.KoujiGantt = (() => {
  let tableGantt = null;
  let onTaskClickHandler = () => {};
  let onTaskChangeHandler = () => {};
  const LEFT_COLUMN_WIDTH = 360;
  const MIN_CELL_WIDTH = 18;
  const MAX_CELL_WIDTH = 44;
  const ROW_HEIGHT = 52;
  const GRID_MIN_HEIGHT = 360;

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

  function addDays(date, amount) {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dayDiff(from, to) {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getRange(tasks) {
    if (!tasks.length) {
      const today = startOfMonth(new Date());
      return {
        rangeStart: today,
        rangeEnd: endOfMonth(today),
      };
    }
    const taskStarts = tasks.map((task) => toDate(task.start));
    const taskEnds = tasks.map((task) => toDate(task.end));
    const minStart = taskStarts.reduce((a, b) => (a < b ? a : b));
    const maxEnd = taskEnds.reduce((a, b) => (a > b ? a : b));
    return {
      rangeStart: startOfMonth(minStart),
      rangeEnd: endOfMonth(maxEnd),
    };
  }

  function getDayCells(rangeStart, rangeEnd) {
    const cells = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
      cells.push(new Date(d));
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

  function buildMarkup(tasks, dayCells, rangeStart, cellWidth, gridHeight) {
    const monthMap = new Map();
    dayCells.forEach((day) => {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    const monthHeaders = Array.from(monthMap.entries())
      .map(([key, count]) => {
        const [year, month] = key.split("-").map(Number);
        const width = count * cellWidth;
        return `<div class="tg-month" style="width:${width}px">${year}年${month + 1}月</div>`;
      })
      .join("");
    const dayHeaders = dayCells
      .map((day) => {
        const dow = day.getDay();
        const isSat = dow === 6;
        const isSun = dow === 0;
        const cls = isSun ? "sun" : isSat ? "sat" : "";
        return `
          <div class="tg-day ${cls}" style="width:${cellWidth}px">
            <strong>${day.getDate()}</strong>
            <span>${["日", "月", "火", "水", "木", "金", "土"][dow]}</span>
          </div>
        `;
      })
      .join("");

    const totalGridWidth = dayCells.length * cellWidth;
    const weekendCols = dayCells
      .map((day, i) => {
        const dow = day.getDay();
        if (dow !== 0 && dow !== 6) return "";
        return `<div class="tg-weekend-col" style="left:${i * cellWidth}px;width:${cellWidth}px"></div>`;
      })
      .join("");
    const dayLines = dayCells
      .map((_, i) => `<div class="tg-day-line" style="left:${i * cellWidth}px"></div>`)
      .join("");

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
        const startIdx = clamp(dayDiff(rangeStart, toDate(task.start)), 0, dayCells.length - 1);
        const endIdx = clamp(dayDiff(rangeStart, toDate(task.end)), startIdx, dayCells.length - 1);
        const barLeft = startIdx * cellWidth;
        const barWidth = (endIdx - startIdx + 1) * cellWidth;
        const color = getTaskColor(task, index);
        return `
          <div class="tg-grid-row tg-row" data-task-id="${escapeHtml(task.id)}" style="width:${totalGridWidth}px">
            <div class="tg-grid-bar"
                 data-task-id="${escapeHtml(task.id)}"
                 style="left:${barLeft}px;width:${barWidth}px;--bar-color:${color};">
              <div class="tg-grid-bar-progress" style="width:${progress}%"></div>
              <div class="tg-grid-bar-label ${progress >= 50 ? "is-label-light" : ""}">${progress}%</div>
              <button class="tg-resize-handle tg-resize-start" type="button" aria-label="開始日を変更" data-task-id="${escapeHtml(task.id)}" data-resize="start"></button>
              <button class="tg-resize-handle tg-resize-end" type="button" aria-label="終了日を変更" data-task-id="${escapeHtml(task.id)}" data-resize="end"></button>
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
            <div class="tg-months">${monthHeaders}</div>
            <div class="tg-days">${dayHeaders}</div>
          </div>
        </div>
        <div class="table-gantt-body" style="height:${gridHeight}px">
          <div class="tg-left-body">${leftRows}</div>
          <div class="tg-right-body" style="width:${totalGridWidth}px">
            <div class="tg-grid-overlay" style="width:${totalGridWidth}px">
              ${dayLines}
              ${weekendCols}
            </div>
            ${rightRows}
          </div>
        </div>
      </div>
    `;
  }

  function bindInteractions(container, tasks, rangeStart, cellWidth) {
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const rows = Array.from(container.querySelectorAll(".tg-row"));
    const body = container.querySelector(".table-gantt-body");
    const leftBody = container.querySelector(".tg-left-body");
    const rightBody = container.querySelector(".tg-right-body");
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

    let dragState = null;
    const onMove = (event) => {
      if (!dragState) return;
      event.preventDefault();
      const task = tasksById.get(dragState.taskId);
      if (!task) return;
      const x = event.clientX - dragState.gridRect.left + (body?.scrollLeft || 0);
      const targetIndex = Math.round(x / cellWidth);
      const startIndex = dayDiff(rangeStart, toDate(task.start));
      const endIndex = dayDiff(rangeStart, toDate(task.end));

      if (dragState.mode === "resize-start") {
        const nextStartIndex = clamp(targetIndex, 0, endIndex);
        const nextStart = KoujiUtils.formatDate(addDays(rangeStart, nextStartIndex));
        if (nextStart === dragState.lastDate) return;
        dragState.lastDate = nextStart;
        onTaskChangeHandler({
          id: task.id,
          start: nextStart,
          is_manual_edited: true,
        }, "ガント期間変更");
        return;
      }

      if (dragState.mode === "resize-end") {
        const nextEndIndex = Math.max(startIndex, targetIndex);
        const nextEnd = KoujiUtils.formatDate(addDays(rangeStart, nextEndIndex));
        if (nextEnd === dragState.lastDate) return;
        dragState.lastDate = nextEnd;
        onTaskChangeHandler({
          id: task.id,
          end: nextEnd,
          is_manual_edited: true,
        }, "ガント期間変更");
      }
    };

    const onUp = () => {
      if (!dragState) return;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      dragState = null;
    };

    container.querySelectorAll(".tg-resize-handle").forEach((handle) => {
      const taskId = handle.dataset.taskId;
      const resizeTarget = handle.dataset.resize;
      if (!taskId || !resizeTarget) return;
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragState = {
          mode: resizeTarget === "start" ? "resize-start" : "resize-end",
          taskId,
          gridRect: container.querySelector(".tg-right-body").getBoundingClientRect(),
          lastDate: "",
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

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      start: KoujiUtils.formatDate(task.start),
      end: KoujiUtils.formatDate(task.end),
      progress: KoujiUtils.clampProgress(task.progress),
    }));
    const { rangeStart, rangeEnd } = getRange(normalizedTasks);
    const dayCells = getDayCells(rangeStart, rangeEnd);
    const availableWidth = Math.max(container.clientWidth - LEFT_COLUMN_WIDTH - 16, 420);
    const cellWidth = clamp(Math.floor(availableWidth / dayCells.length), MIN_CELL_WIDTH, MAX_CELL_WIDTH);
    const gridHeight = Math.max(GRID_MIN_HEIGHT, normalizedTasks.length * ROW_HEIGHT);

    container.innerHTML = buildMarkup(normalizedTasks, dayCells, rangeStart, cellWidth, gridHeight);
    bindInteractions(container, normalizedTasks, rangeStart, cellWidth);

    tableGantt = {
      containerSelector,
      tasks: normalizedTasks,
      options,
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
