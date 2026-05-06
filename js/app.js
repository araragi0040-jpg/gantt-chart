(() => {
  const state = {
    projects: [],
    tasks: [],
    changeLogs: [],
    selectedProjectId: "",
    selectedTaskId: "",
    viewMode: "Day",
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    bindEvents();

    const gasUrl = KoujiApi.loadGasUrl();
    el.gasUrlInput.value = gasUrl;

    const localState = KoujiApi.loadLocalState();
    const initial = localState || KoujiApi.loadSampleState();
    setState(initial);
    state.selectedProjectId = state.projects[0]?.project_id || "";
    renderAll();

    if (!localState) {
      notify("サンプルデータで初期表示しました。まずはドラッグ編集を試してください。", "info");
    }
  }

  function bindElements() {
    const ids = [
      "projectList",
      "projectTitle",
      "projectMeta",
      "summaryStart",
      "summaryEnd",
      "summaryTaskCount",
      "summaryStatus",
      "taskTableBody",
      "changeLogList",
      "viewModeSelect",
      "loadSampleBtn",
      "saveBtn",
      "addProjectBtn",
      "addTaskBtn",
      "generateTemplateBtn",
      "deleteSelectedBtn",
      "clearLogsBtn",
      "gasUrlInput",
      "loadFromGasBtn",
      "saveToGasBtn",
      "modalBackdrop",
      "taskForm",
      "modalTitle",
      "taskId",
      "taskName",
      "taskCategory",
      "taskStart",
      "taskEnd",
      "taskProgress",
      "taskContractor",
      "taskStatus",
      "taskMemo",
      "closeModalBtn",
      "cancelModalBtn",
      "deleteTaskInModalBtn",
      "toast",
    ];
    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    el.loadSampleBtn.addEventListener("click", () => {
      if (!confirm("サンプルデータを再読込します。画面内の未保存変更は上書きされます。よろしいですか？")) return;
      setState(KoujiApi.loadSampleState());
      state.selectedProjectId = state.projects[0]?.project_id || "";
      state.selectedTaskId = "";
      renderAll();
      notify("サンプルデータを再読込しました。");
    });

    el.saveBtn.addEventListener("click", () => {
      persistLocal("ローカルに保存しました。GitHub/Vercel公開後も同じブラウザでは保持されます。");
    });

    el.addProjectBtn.addEventListener("click", addProject);
    el.addTaskBtn.addEventListener("click", () => openTaskModal());
    el.generateTemplateBtn.addEventListener("click", generateTemplateTasks);
    el.deleteSelectedBtn.addEventListener("click", deleteSelectedTask);
    el.clearLogsBtn.addEventListener("click", clearLogs);

    el.viewModeSelect.addEventListener("change", (event) => {
      state.viewMode = event.target.value;
      renderGantt();
    });

    el.gasUrlInput.addEventListener("change", (event) => {
      KoujiApi.saveGasUrl(event.target.value.trim());
      notify("GAS URLをブラウザに保存しました。", "info");
    });

    el.loadFromGasBtn.addEventListener("click", loadFromGas);
    el.saveToGasBtn.addEventListener("click", saveToGas);

    el.closeModalBtn.addEventListener("click", closeTaskModal);
    el.cancelModalBtn.addEventListener("click", closeTaskModal);
    el.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === el.modalBackdrop) closeTaskModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !el.modalBackdrop.hidden) closeTaskModal();
    });
    el.taskForm.addEventListener("submit", saveTaskFromModal);
    el.deleteTaskInModalBtn.addEventListener("click", () => {
      const taskId = el.taskId.value;
      if (!taskId) return closeTaskModal();
      deleteTask(taskId);
      closeTaskModal();
    });
  }

  function setState(nextState) {
    state.projects = (nextState.projects || []).map(KoujiUtils.normalizeProject);
    state.tasks = (nextState.tasks || []).map(KoujiUtils.normalizeTask);
    state.changeLogs = nextState.changeLogs || [];
  }

  function renderAll() {
    renderProjectList();
    renderProjectSummary();
    renderGantt();
    renderTaskTable();
    renderLogs();
  }

  function renderProjectList() {
    el.projectList.innerHTML = "";
    state.projects.forEach((project) => {
      const tasks = KoujiUtils.projectTasks(state.tasks, project.project_id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `project-card ${project.project_id === state.selectedProjectId ? "is-active" : ""}`;
      button.innerHTML = `
        <h3>${escapeHtml(project.project_name)}</h3>
        <p>${escapeHtml(project.customer_name || "顧客未設定")}</p>
        <p>${escapeHtml(project.planned_start)} 〜 ${escapeHtml(project.planned_end)}</p>
        <div class="badge-row">
          <span class="badge">${escapeHtml(project.project_type)}</span>
          <span class="badge">${escapeHtml(project.status)}</span>
          <span class="badge">${tasks.length}工程</span>
        </div>
      `;
      button.addEventListener("click", () => {
        state.selectedProjectId = project.project_id;
        state.selectedTaskId = "";
        renderAll();
      });
      el.projectList.appendChild(button);
    });
  }

  function renderProjectSummary() {
    const project = getSelectedProject();
    if (!project) {
      el.projectTitle.textContent = "-";
      el.projectMeta.textContent = "工事を選択してください。";
      el.summaryStart.textContent = "-";
      el.summaryEnd.textContent = "-";
      el.summaryTaskCount.textContent = "-";
      el.summaryStatus.textContent = "-";
      return;
    }
    const tasks = getSelectedTasks();
    el.projectTitle.textContent = project.project_name;
    el.projectMeta.textContent = `${project.customer_name || "顧客未設定"} / ${project.site_address || "現場住所未設定"} / 担当：${project.manager || "未設定"}`;
    el.summaryStart.textContent = project.planned_start;
    el.summaryEnd.textContent = project.planned_end;
    el.summaryTaskCount.textContent = `${tasks.length}件`;
    el.summaryStatus.textContent = project.status;
  }

  function renderGantt() {
    const tasks = getSelectedTasks();
    if (!tasks.length) {
      document.getElementById("gantt").innerHTML = `<div class="empty-state">工程がありません。「工程を追加」または「テンプレート工程を追加」を押してください。</div>`;
      return;
    }

    try {
      KoujiGantt.render("#gantt", tasks, {
        viewMode: state.viewMode,
        onTaskClick: (taskId) => {
          state.selectedTaskId = taskId;
          renderTaskTable();
        },
        onTaskChange: (partialTask, actionType) => {
          updateTask(partialTask.id, partialTask, actionType || "ガント編集");
        },
      });
    } catch (error) {
      console.error(error);
      document.getElementById("gantt").innerHTML = `<div class="empty-state error">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderTaskTable() {
    const tasks = getSelectedTasks();
    el.taskTableBody.innerHTML = "";
    tasks.forEach((task) => {
      const tr = document.createElement("tr");
      tr.className = `task-row ${task.id === state.selectedTaskId ? "is-selected" : ""}`;
      tr.innerHTML = `
        <td><strong>${escapeHtml(task.name)}</strong><br><span class="muted">${escapeHtml(task.memo || "")}</span></td>
        <td>${escapeHtml(task.category)}</td>
        <td>${escapeHtml(task.start)}</td>
        <td>${escapeHtml(task.end)}</td>
        <td>${KoujiUtils.taskDurationText(task)}</td>
        <td>${Number(task.progress || 0)}%</td>
        <td>${escapeHtml(task.contractor || "-")}</td>
        <td><span class="badge">${escapeHtml(task.status)}</span></td>
      `;
      tr.addEventListener("click", () => {
        state.selectedTaskId = task.id;
        openTaskModal(task.id);
        renderTaskTable();
      });
      el.taskTableBody.appendChild(tr);
    });
  }

  function renderLogs() {
    el.changeLogList.innerHTML = "";
    const logs = [...state.changeLogs].slice(-20).reverse();
    if (!logs.length) {
      const li = document.createElement("li");
      li.textContent = "まだ変更履歴はありません。";
      el.changeLogList.appendChild(li);
      return;
    }
    logs.forEach((log) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(log.action_type)}</strong> / ${escapeHtml(log.task_name || "-")} / ${escapeHtml(log.timestamp)}<br>${escapeHtml(log.memo || "")}`;
      el.changeLogList.appendChild(li);
    });
  }

  function getSelectedProject() {
    return state.projects.find((project) => project.project_id === state.selectedProjectId) || state.projects[0] || null;
  }

  function getSelectedTasks() {
    const project = getSelectedProject();
    if (!project) return [];
    state.selectedProjectId = project.project_id;
    return KoujiUtils.projectTasks(state.tasks, project.project_id);
  }

  function addProject() {
    const name = prompt("工事名を入力してください", "新規工事");
    if (!name) return;
    const today = KoujiUtils.getToday();
    const project = KoujiUtils.normalizeProject({
      project_id: KoujiUtils.generateId("P"),
      project_name: name,
      customer_name: "",
      site_address: "",
      project_type: "その他",
      planned_start: today,
      planned_end: KoujiUtils.addDays(today, 30),
      status: "予定",
      manager: "",
      memo: "",
    });
    state.projects.push(project);
    state.selectedProjectId = project.project_id;
    addLog("工事追加", "", `工事「${project.project_name}」を追加`);
    renderAll();
    persistLocal("工事を追加しました。");
  }

  function openTaskModal(taskId = "") {
    const project = getSelectedProject();
    if (!project) {
      notify("先に工事を選択してください。", "error");
      return;
    }

    const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
    el.modalTitle.textContent = task ? "工程編集" : "工程追加";
    el.taskId.value = task?.id || "";
    el.taskName.value = task?.name || "";
    el.taskCategory.value = task?.category || "その他";
    el.taskStart.value = task?.start || project.planned_start || KoujiUtils.getToday();
    el.taskEnd.value = task?.end || task?.start || project.planned_start || KoujiUtils.getToday();
    el.taskProgress.value = task?.progress ?? 0;
    el.taskContractor.value = task?.contractor || "";
    el.taskStatus.value = task?.status || "未着手";
    el.taskMemo.value = task?.memo || "";
    el.deleteTaskInModalBtn.style.visibility = task ? "visible" : "hidden";
    el.modalBackdrop.hidden = false;
    el.modalBackdrop.classList.add("is-open");
    el.modalBackdrop.setAttribute("aria-hidden", "false");
    el.taskName.focus();
  }

  function closeTaskModal() {
    el.modalBackdrop.hidden = true;
    el.modalBackdrop.classList.remove("is-open");
    el.modalBackdrop.setAttribute("aria-hidden", "true");
    el.taskForm.reset();
  }

  function saveTaskFromModal(event) {
    event.preventDefault();
    const project = getSelectedProject();
    const taskId = el.taskId.value || KoujiUtils.generateId("T");
    const start = el.taskStart.value;
    const end = el.taskEnd.value;
    if (KoujiUtils.toDate(end) < KoujiUtils.toDate(start)) {
      notify("終了日は開始日以降にしてください。", "error");
      return;
    }

    const task = KoujiUtils.normalizeTask({
      id: taskId,
      project_id: project.project_id,
      name: el.taskName.value.trim(),
      category: el.taskCategory.value,
      start,
      end,
      progress: el.taskProgress.value,
      contractor: el.taskContractor.value.trim(),
      status: el.taskStatus.value,
      memo: el.taskMemo.value.trim(),
      source: el.taskId.value ? "manual" : "manual-add",
      is_manual_edited: true,
    });

    const existingIndex = state.tasks.findIndex((item) => item.id === taskId);
    if (existingIndex >= 0) {
      state.tasks[existingIndex] = { ...state.tasks[existingIndex], ...task };
      addLog("工程編集", task.id, `「${task.name}」を編集`);
    } else {
      state.tasks.push(task);
      addLog("工程追加", task.id, `「${task.name}」を追加`);
    }

    state.selectedTaskId = task.id;
    closeTaskModal();
    renderAll();
    persistLocal("工程を保存しました。");
  }

  function updateTask(taskId, partialTask, actionType = "工程更新") {
    const index = state.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) return;

    const before = { ...state.tasks[index] };
    const next = KoujiUtils.normalizeTask({
      ...state.tasks[index],
      ...partialTask,
      is_manual_edited: true,
    });

    state.tasks[index] = next;
    state.selectedTaskId = taskId;
    addLog(actionType, taskId, buildChangeMemo(before, next));
    renderProjectSummary();
    renderTaskTable();
    renderLogs();
    KoujiApi.saveLocalState(state);
  }

  function buildChangeMemo(before, next) {
    const changes = [];
    if (before.start !== next.start || before.end !== next.end) {
      changes.push(`${before.start}〜${before.end} → ${next.start}〜${next.end}`);
    }
    if (Number(before.progress) !== Number(next.progress)) {
      changes.push(`進捗 ${before.progress}% → ${next.progress}%`);
    }
    if (!changes.length) changes.push("工程情報を更新");
    return `「${next.name}」 ${changes.join(" / ")}`;
  }

  function deleteSelectedTask() {
    if (!state.selectedTaskId) {
      notify("削除する工程を一覧またはガントから選択してください。", "error");
      return;
    }
    deleteTask(state.selectedTaskId);
  }

  function deleteTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (!confirm(`工程「${task.name}」を削除しますか？`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== taskId);
    state.selectedTaskId = "";
    addLog("工程削除", taskId, `「${task.name}」を削除`);
    renderAll();
    persistLocal("工程を削除しました。");
  }

  function generateTemplateTasks() {
    const project = getSelectedProject();
    if (!project) return;
    if (!confirm("選択中の工事にテンプレート工程を追加します。既存工程は残ります。よろしいですか？")) return;

    const existingCount = getSelectedTasks().length;
    const templateTasks = window.SAMPLE_DATA.templateTasks.map((template, index) => {
      const start = KoujiUtils.addDays(project.planned_start, template.offset);
      const end = KoujiUtils.addDays(start, template.duration - 1);
      return KoujiUtils.normalizeTask({
        id: KoujiUtils.generateId("T"),
        project_id: project.project_id,
        name: template.name,
        category: template.category,
        start,
        end,
        progress: 0,
        contractor: template.contractor,
        status: "未着手",
        dependencies: "",
        memo: existingCount ? "テンプレートから追加" : "テンプレートから生成",
        source: "template",
        is_manual_edited: false,
      });
    });

    state.tasks.push(...templateTasks);
    addLog("テンプレート追加", "", `${templateTasks.length}件の工程を追加`);
    renderAll();
    persistLocal("テンプレート工程を追加しました。不要工程は削除・調整してください。");
  }

  function clearLogs() {
    if (!confirm("変更履歴をクリアしますか？")) return;
    state.changeLogs = [];
    renderLogs();
    persistLocal("変更履歴をクリアしました。", false);
  }

  async function loadFromGas() {
    const gasUrl = el.gasUrlInput.value.trim();
    KoujiApi.saveGasUrl(gasUrl);
    try {
      notify("GASから読み込み中です...", "info");
      const data = await KoujiApi.fetchFromGas(gasUrl);
      setState(data);
      state.selectedProjectId = state.projects[0]?.project_id || "";
      state.selectedTaskId = "";
      renderAll();
      persistLocal("GASからデータを読み込みました。", false);
    } catch (error) {
      console.error(error);
      notify(error.message, "error");
    }
  }

  async function saveToGas() {
    const gasUrl = el.gasUrlInput.value.trim();
    KoujiApi.saveGasUrl(gasUrl);
    try {
      notify("GASへ保存中です...", "info");
      await KoujiApi.saveToGas(gasUrl, state);
      persistLocal("GASとローカルに保存しました。", false);
    } catch (error) {
      console.error(error);
      notify(error.message, "error");
    }
  }

  function addLog(actionType, taskId, memo) {
    const task = state.tasks.find((item) => item.id === taskId);
    state.changeLogs.push({
      log_id: KoujiUtils.generateId("LOG"),
      timestamp: new Date().toLocaleString("ja-JP"),
      user: "prototype-user",
      project_id: state.selectedProjectId,
      task_id: taskId,
      task_name: task?.name || "",
      action_type: actionType,
      memo,
    });
  }

  function persistLocal(message, showToast = true) {
    KoujiApi.saveLocalState(state);
    if (showToast) notify(message);
  }

  function notify(message, type = "success") {
    el.toast.textContent = message;
    el.toast.className = `toast is-show ${type}`;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      el.toast.className = "toast";
    }, 3200);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
