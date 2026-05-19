(() => {
  const FOLDERS = [
    { id: "pre-contract", label: "契約前" },
    { id: "active", label: "着手中" },
    { id: "completed", label: "完了" },
    { id: "trash", label: "ゴミ箱" },
  ];

  const state = {
    projects: [],
    tasks: [],
    changeLogs: [],
    selectedProjectId: "",
    selectedTaskId: "",
    currentFolder: "active",
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
    ensureCurrentFolderHasSelection();
    renderAll();

    if (!localState) {
      notify("サンプルデータで初期表示しました。まずはドラッグ編集を試してください。", "info");
    }
  }

  function bindElements() {
    const ids = [
      "folderTabs",
      "projectList",
      "projectTitle",
      "projectMeta",
      "summaryStart",
      "summaryEnd",
      "summaryTaskCount",
      "summaryStatus",
      "projectActionRow",
      "editProjectBtn",
      "moveProjectToTrashBtn",
      "restoreProjectBtn",
      "permanentDeleteProjectBtn",
      "quickStartInput",
      "quickEndInput",
      "startMinusBtn",
      "startPlusBtn",
      "endMinusBtn",
      "endPlusBtn",
      "shiftTasksByStartCheckbox",
      "applyProjectDatesBtn",
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
      "projectModalBackdrop",
      "projectForm",
      "projectModalTitle",
      "projectId",
      "projectName",
      "projectCustomer",
      "projectAddress",
      "projectType",
      "projectFolder",
      "projectStart",
      "projectEnd",
      "projectStatus",
      "projectManager",
      "projectMemo",
      "closeProjectModalBtn",
      "cancelProjectModalBtn",
      "deleteProjectInModalBtn",
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
      state.currentFolder = "active";
      ensureCurrentFolderHasSelection();
      renderAll();
      notify("サンプルデータを再読込しました。");
    });

    el.saveBtn.addEventListener("click", () => {
      persistLocal("ローカルに保存しました。GitHub/Vercel公開後も同じブラウザでは保持されます。");
    });

    el.folderTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (!button) return;
      state.currentFolder = button.dataset.folder;
      ensureCurrentFolderHasSelection();
      renderAll();
    });

    el.addProjectBtn.addEventListener("click", () => openProjectModal());
    el.editProjectBtn.addEventListener("click", () => openProjectModal(state.selectedProjectId));
    el.moveProjectToTrashBtn.addEventListener("click", () => moveProjectToTrash(state.selectedProjectId));
    el.restoreProjectBtn.addEventListener("click", () => restoreProject(state.selectedProjectId));
    el.permanentDeleteProjectBtn.addEventListener("click", () => permanentlyDeleteProject(state.selectedProjectId));

    el.startMinusBtn.addEventListener("click", () => stepProjectDate("start", -1));
    el.startPlusBtn.addEventListener("click", () => stepProjectDate("start", 1));
    el.endMinusBtn.addEventListener("click", () => stepProjectDate("end", -1));
    el.endPlusBtn.addEventListener("click", () => stepProjectDate("end", 1));
    el.applyProjectDatesBtn.addEventListener("click", applyProjectDates);

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
    el.taskForm.addEventListener("submit", saveTaskFromModal);
    el.deleteTaskInModalBtn.addEventListener("click", () => {
      const taskId = el.taskId.value;
      if (!taskId) return closeTaskModal();
      deleteTask(taskId);
      closeTaskModal();
    });

    el.closeProjectModalBtn.addEventListener("click", closeProjectModal);
    el.cancelProjectModalBtn.addEventListener("click", closeProjectModal);
    el.projectModalBackdrop.addEventListener("click", (event) => {
      if (event.target === el.projectModalBackdrop) closeProjectModal();
    });
    el.projectForm.addEventListener("submit", saveProjectFromModal);
    el.deleteProjectInModalBtn.addEventListener("click", () => {
      const projectId = el.projectId.value;
      closeProjectModal();
      if (projectId) moveProjectToTrash(projectId);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!el.modalBackdrop.hidden) closeTaskModal();
      if (!el.projectModalBackdrop.hidden) closeProjectModal();
    });
  }

  function setState(nextState) {
    state.projects = (nextState.projects || []).map(KoujiUtils.normalizeProject);
    state.tasks = (nextState.tasks || []).map(KoujiUtils.normalizeTask);
    state.changeLogs = nextState.changeLogs || [];
    state.projects.forEach((project) => {
      project.project_folder = getProjectFolder(project);
    });
  }

  function renderAll() {
    renderFolderTabs();
    renderProjectList();
    renderProjectSummary();
    renderGantt();
    renderTaskTable();
    renderLogs();
  }

  function renderFolderTabs() {
    FOLDERS.forEach((folder) => {
      const button = el.folderTabs.querySelector(`[data-folder="${folder.id}"]`);
      if (!button) return;
      const count = state.projects.filter((project) => getProjectFolder(project) === folder.id).length;
      button.classList.toggle("is-active", state.currentFolder === folder.id);
      const span = button.querySelector("span");
      if (span) span.textContent = count;
    });
  }

  function renderProjectList() {
    el.projectList.innerHTML = "";
    const projects = getProjectsByCurrentFolder();

    if (!projects.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state small";
      empty.textContent = `${getFolderLabel(state.currentFolder)}の工事はありません。`;
      el.projectList.appendChild(empty);
      return;
    }

    projects.forEach((project) => {
      const tasks = KoujiUtils.projectTasks(state.tasks, project.project_id);
      const card = document.createElement("article");
      card.className = `project-card ${project.project_id === state.selectedProjectId ? "is-active" : ""}`;
      card.tabIndex = 0;
      card.innerHTML = `
        <button class="project-main" type="button" data-action="select">
          <h3>${escapeHtml(project.project_name)}</h3>
          <p>${escapeHtml(project.customer_name || "顧客未設定")}</p>
          <p>${escapeHtml(project.planned_start)} 〜 ${escapeHtml(project.planned_end)}</p>
          <div class="badge-row">
            <span class="badge">${escapeHtml(project.project_type)}</span>
            <span class="badge">${escapeHtml(project.status)}</span>
            <span class="badge">${tasks.length}工程</span>
          </div>
        </button>
        <div class="project-card-actions">
          <button class="mini-btn" type="button" data-action="edit">編集</button>
          ${getProjectFolder(project) === "trash"
            ? `<button class="mini-btn" type="button" data-action="restore">復元</button><button class="mini-btn danger" type="button" data-action="delete-forever">完全削除</button>`
            : `<button class="mini-btn danger" type="button" data-action="trash">削除</button>`}
        </div>
      `;
      card.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action) return;
        if (action === "select") selectProject(project.project_id);
        if (action === "edit") openProjectModal(project.project_id);
        if (action === "trash") moveProjectToTrash(project.project_id);
        if (action === "restore") restoreProject(project.project_id);
        if (action === "delete-forever") permanentlyDeleteProject(project.project_id);
      });
      el.projectList.appendChild(card);
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
      el.quickStartInput.value = "";
      el.quickEndInput.value = "";
      setProjectControlsDisabled(true);
      return;
    }

    const tasks = getSelectedTasks();
    const folder = getProjectFolder(project);
    el.projectTitle.textContent = project.project_name;
    el.projectMeta.textContent = `${project.customer_name || "顧客未設定"} / ${project.site_address || "現場住所未設定"} / 担当：${project.manager || "未設定"} / ${getFolderLabel(folder)}`;
    el.summaryStart.textContent = project.planned_start;
    el.summaryEnd.textContent = project.planned_end;
    el.summaryTaskCount.textContent = `${tasks.length}件`;
    el.summaryStatus.textContent = project.status;
    el.quickStartInput.value = project.planned_start;
    el.quickEndInput.value = project.planned_end;

    setProjectControlsDisabled(false);
    const isTrash = folder === "trash";
    el.moveProjectToTrashBtn.hidden = isTrash;
    el.restoreProjectBtn.hidden = !isTrash;
    el.permanentDeleteProjectBtn.hidden = !isTrash;
  }

  function setProjectControlsDisabled(disabled) {
    [
      el.editProjectBtn,
      el.moveProjectToTrashBtn,
      el.restoreProjectBtn,
      el.permanentDeleteProjectBtn,
      el.quickStartInput,
      el.quickEndInput,
      el.startMinusBtn,
      el.startPlusBtn,
      el.endMinusBtn,
      el.endPlusBtn,
      el.shiftTasksByStartCheckbox,
      el.applyProjectDatesBtn,
      el.addTaskBtn,
      el.generateTemplateBtn,
      el.deleteSelectedBtn,
    ].forEach((item) => {
      if (item) item.disabled = disabled;
    });
  }

  function renderGantt() {
    const tasks = getSelectedTasks();
    if (!getSelectedProject()) {
      document.getElementById("gantt").innerHTML = `<div class="empty-state">工事を選択してください。</div>`;
      return;
    }
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

  function getProjectsByCurrentFolder() {
    return state.projects
      .filter((project) => getProjectFolder(project) === state.currentFolder)
      .sort((a, b) => String(a.planned_start).localeCompare(String(b.planned_start)) || String(a.project_name).localeCompare(String(b.project_name)));
  }

  function getSelectedProject() {
    const project = state.projects.find((item) => item.project_id === state.selectedProjectId);
    if (project && getProjectFolder(project) === state.currentFolder) return project;
    const first = getProjectsByCurrentFolder()[0] || null;
    if (first) state.selectedProjectId = first.project_id;
    return first;
  }

  function getSelectedTasks() {
    const project = getSelectedProject();
    if (!project) return [];
    return KoujiUtils.projectTasks(state.tasks, project.project_id);
  }

  function ensureCurrentFolderHasSelection() {
    if (!FOLDERS.some((folder) => folder.id === state.currentFolder)) state.currentFolder = "active";
    const currentProjects = getProjectsByCurrentFolder();
    const currentSelection = currentProjects.find((project) => project.project_id === state.selectedProjectId);
    if (!currentSelection) state.selectedProjectId = currentProjects[0]?.project_id || "";
    state.selectedTaskId = "";
  }

  function selectProject(projectId) {
    state.selectedProjectId = projectId;
    state.selectedTaskId = "";
    renderAll();
  }

  function addProjectLog(actionType, project, memo) {
    state.changeLogs.push({
      log_id: KoujiUtils.generateId("LOG"),
      timestamp: new Date().toLocaleString("ja-JP"),
      user: "prototype-user",
      project_id: project?.project_id || state.selectedProjectId,
      task_id: "",
      task_name: project?.project_name || "",
      action_type: actionType,
      memo,
    });
  }

  function openProjectModal(projectId = "") {
    const project = projectId ? state.projects.find((item) => item.project_id === projectId) : null;
    const today = KoujiUtils.getToday();
    el.projectModalTitle.textContent = project ? "工事情報編集" : "工事追加";
    el.projectId.value = project?.project_id || "";
    el.projectName.value = project?.project_name || "";
    el.projectCustomer.value = project?.customer_name || "";
    el.projectAddress.value = project?.site_address || "";
    el.projectType.value = project?.project_type || "その他";
    el.projectFolder.value = project ? getProjectFolder(project) : state.currentFolder === "trash" ? "active" : state.currentFolder;
    el.projectStart.value = project?.planned_start || today;
    el.projectEnd.value = project?.planned_end || KoujiUtils.addDays(today, 30);
    el.projectStatus.value = project?.status || "予定";
    el.projectManager.value = project?.manager || "";
    el.projectMemo.value = project?.memo || "";
    el.deleteProjectInModalBtn.style.visibility = project && getProjectFolder(project) !== "trash" ? "visible" : "hidden";
    el.projectModalBackdrop.hidden = false;
    el.projectModalBackdrop.classList.add("is-open");
    el.projectModalBackdrop.setAttribute("aria-hidden", "false");
    el.projectName.focus();
  }

  function closeProjectModal() {
    el.projectModalBackdrop.hidden = true;
    el.projectModalBackdrop.classList.remove("is-open");
    el.projectModalBackdrop.setAttribute("aria-hidden", "true");
    el.projectForm.reset();
  }

  function saveProjectFromModal(event) {
    event.preventDefault();
    const projectId = el.projectId.value || KoujiUtils.generateId("P");
    const plannedStart = el.projectStart.value;
    const plannedEnd = el.projectEnd.value;

    if (KoujiUtils.toDate(plannedEnd) < KoujiUtils.toDate(plannedStart)) {
      notify("完工予定日は着工予定日以降にしてください。", "error");
      return;
    }

    const existingIndex = state.projects.findIndex((project) => project.project_id === projectId);
    const existing = existingIndex >= 0 ? state.projects[existingIndex] : null;
    const folder = el.projectFolder.value;
    const project = KoujiUtils.normalizeProject({
      ...(existing || {}),
      project_id: projectId,
      project_name: el.projectName.value.trim(),
      customer_name: el.projectCustomer.value.trim(),
      site_address: el.projectAddress.value.trim(),
      project_type: el.projectType.value,
      project_folder: folder,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      status: el.projectStatus.value,
      manager: el.projectManager.value.trim(),
      memo: el.projectMemo.value.trim(),
      deleted_at: folder === "trash" ? existing?.deleted_at || new Date().toISOString() : "",
      previous_folder: folder === "trash" ? existing?.previous_folder || existing?.project_folder || "active" : "",
    });

    if (existingIndex >= 0) {
      const dateDelta = KoujiUtils.dayDelta(existing.planned_start, project.planned_start);
      state.projects[existingIndex] = project;
      if (dateDelta !== 0 && confirm("着工予定日が変わっています。工程全体も同じ日数だけ移動しますか？")) {
        shiftProjectTasks(project.project_id, dateDelta);
      }
      addProjectLog("工事情報編集", project, `工事「${project.project_name}」を編集`);
    } else {
      state.projects.push(project);
      addProjectLog("工事追加", project, `工事「${project.project_name}」を追加`);
    }

    state.currentFolder = getProjectFolder(project);
    state.selectedProjectId = project.project_id;
    state.selectedTaskId = "";
    closeProjectModal();
    renderAll();
    persistLocal("工事情報を保存しました。");
  }

  function moveProjectToTrash(projectId) {
    const index = state.projects.findIndex((project) => project.project_id === projectId);
    if (index < 0) return;
    const project = state.projects[index];
    if (getProjectFolder(project) === "trash") return;
    if (!confirm(`工事「${project.project_name}」をゴミ箱へ移動しますか？\n工程データは保持されます。`)) return;

    state.projects[index] = KoujiUtils.normalizeProject({
      ...project,
      project_folder: "trash",
      previous_folder: getProjectFolder(project),
      deleted_at: new Date().toISOString(),
    });
    addProjectLog("工事をゴミ箱へ移動", project, `工事「${project.project_name}」をゴミ箱へ移動`);
    state.currentFolder = "trash";
    state.selectedProjectId = project.project_id;
    state.selectedTaskId = "";
    renderAll();
    persistLocal("工事をゴミ箱へ移動しました。");
  }

  function restoreProject(projectId) {
    const index = state.projects.findIndex((project) => project.project_id === projectId);
    if (index < 0) return;
    const project = state.projects[index];
    const restoreFolder = project.previous_folder && project.previous_folder !== "trash" ? project.previous_folder : "active";
    state.projects[index] = KoujiUtils.normalizeProject({
      ...project,
      project_folder: restoreFolder,
      deleted_at: "",
      previous_folder: "",
    });
    addProjectLog("工事復元", project, `工事「${project.project_name}」を${getFolderLabel(restoreFolder)}へ復元`);
    state.currentFolder = restoreFolder;
    state.selectedProjectId = project.project_id;
    renderAll();
    persistLocal("工事を復元しました。");
  }

  function permanentlyDeleteProject(projectId) {
    const project = state.projects.find((item) => item.project_id === projectId);
    if (!project) return;
    if (getProjectFolder(project) !== "trash") {
      notify("完全削除はゴミ箱内の工事のみ実行できます。", "error");
      return;
    }
    if (!confirm(`工事「${project.project_name}」を完全削除しますか？\n関連する工程も削除されます。この操作は元に戻せません。`)) return;
    state.projects = state.projects.filter((item) => item.project_id !== projectId);
    state.tasks = state.tasks.filter((task) => task.project_id !== projectId);
    state.changeLogs = state.changeLogs.filter((log) => log.project_id !== projectId);
    state.selectedProjectId = "";
    state.selectedTaskId = "";
    ensureCurrentFolderHasSelection();
    renderAll();
    persistLocal("工事を完全削除しました。");
  }

  function applyProjectDates() {
    const project = getSelectedProject();
    if (!project) return;
    const newStart = el.quickStartInput.value;
    const newEnd = el.quickEndInput.value;
    if (!newStart || !newEnd) {
      notify("着工予定日と完工予定日を入力してください。", "error");
      return;
    }
    if (KoujiUtils.toDate(newEnd) < KoujiUtils.toDate(newStart)) {
      notify("完工予定日は着工予定日以降にしてください。", "error");
      return;
    }

    const index = state.projects.findIndex((item) => item.project_id === project.project_id);
    if (index < 0) return;
    const oldStart = project.planned_start;
    const oldEnd = project.planned_end;
    const dateDelta = KoujiUtils.dayDelta(oldStart, newStart);

    state.projects[index] = KoujiUtils.normalizeProject({
      ...project,
      planned_start: newStart,
      planned_end: newEnd,
    });

    if (dateDelta !== 0 && el.shiftTasksByStartCheckbox.checked) {
      shiftProjectTasks(project.project_id, dateDelta);
    }

    addProjectLog("工事日程変更", state.projects[index], `${oldStart}〜${oldEnd} → ${newStart}〜${newEnd}${dateDelta !== 0 && el.shiftTasksByStartCheckbox.checked ? ` / 工程も${dateDelta > 0 ? "+" : ""}${dateDelta}日移動` : ""}`);
    renderAll();
    persistLocal("工事日程を変更しました。");
  }

  function stepProjectDate(target, amount) {
    const input = target === "start" ? el.quickStartInput : el.quickEndInput;
    if (!input.value) input.value = KoujiUtils.getToday();
    input.value = KoujiUtils.addDays(input.value, amount);
    applyProjectDates();
  }

  function shiftProjectTasks(projectId, dateDelta) {
    if (!dateDelta) return;
    state.tasks = state.tasks.map((task) => {
      if (task.project_id !== projectId) return task;
      return KoujiUtils.normalizeTask({
        ...task,
        start: KoujiUtils.addDays(task.start, dateDelta),
        end: KoujiUtils.addDays(task.end, dateDelta),
        is_manual_edited: true,
      });
    });
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

    const existingTask = state.tasks.find((item) => item.id === taskId);
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
      dependencies: existingTask?.dependencies || "",
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
    const templateTasks = window.SAMPLE_DATA.templateTasks.map((template) => {
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
      ensureCurrentFolderHasSelection();
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

  function getProjectFolder(project) {
    if (!project) return "active";
    if (isValidFolder(project.project_folder)) return project.project_folder;
    if (project.status === "完了") return "completed";
    if (project.status === "進行中") return "active";
    return "pre-contract";
  }

  function isValidFolder(folderId) {
    return FOLDERS.some((folder) => folder.id === folderId);
  }

  function getFolderLabel(folderId) {
    return FOLDERS.find((folder) => folder.id === folderId)?.label || "未分類";
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
