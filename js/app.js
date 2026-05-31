(() => {
  const FOLDERS = [
    { id: "pre-contract", label: "契約前" },
    { id: "active", label: "着手中" },
    { id: "completed", label: "完了" },
    { id: "trash", label: "ゴミ箱" },
  ];

  const AUTOSAVE_DELAY_MS = 12000;

  const state = {
    projects: [],
    tasks: [],
    changeLogs: [],
    selectedProjectId: "",
    selectedTaskId: "",
    currentFolder: "active",
    viewMode: "Day",
    viewType: "gantt",
    serverRevision: "",
    autosaveTimer: null,
    isSavingToGas: false,
    gasDirty: false,
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error(error);
      notify("初期化に失敗しました。画面を再読み込みしてください。", "error");
    });
  });

  async function init() {
    bindElements();
    bindEvents();

    const gasUrl = KoujiApi.loadGasUrl();
    el.gasUrlInput.value = gasUrl;

    let initial = null;
    if (gasUrl) {
      try {
        const remote = await KoujiApi.fetchFromGas(gasUrl);
        initial = remote;
        notify("共有データを読み込みました。", "info");
      } catch (error) {
        console.warn(error);
      }
    }

    if (!initial) {
      const localState = KoujiApi.loadLocalState();
      initial = localState || KoujiApi.loadSampleState();
      if (!localState) {
        notify("初期データを表示しました。", "info");
      }
    }

    setState(initial);
    ensureCurrentFolderHasSelection();
    renderAll();
    syncTaskMemoCount();
    KoujiApi.saveLocalState(getPersistableState());
  }

  function bindElements() {
    const ids = [
      "folderTabs",
      "projectList",
      "projectTitle",
      "projectMeta",
      "ganttWrap",
      "viewGanttBtn",
      "viewTableBtn",
      "taskTableSection",
      "taskTableBody",
      "openProjectDrawerBtn",
      "closeProjectDrawerBtn",
      "projectDrawer",
      "projectDrawerBackdrop",
      "openDetailDrawerBtn",
      "closeDetailDrawerBtn",
      "detailDrawer",
      "cancelProjectEditBtn",
      "addProjectBtn",
      "applyProjectInfoBtn",
      "projectId",
      "projectName",
      "projectCustomer",
      "projectAddress",
      "projectType",
      "projectFolder",
      "projectStatus",
      "projectManager",
      "projectMemo",
      "quickStartInput",
      "quickEndInput",
      "startMinusBtn",
      "startPlusBtn",
      "endMinusBtn",
      "endPlusBtn",
      "shiftTasksByStartCheckbox",
      "applyProjectDatesBtn",
      "addTaskBtn",
      "generateTemplateBtn",
      "taskId",
      "taskName",
      "taskStart",
      "taskEnd",
      "taskProgress",
      "taskMemo",
      "taskMemoCount",
      "saveTaskBtn",
      "cancelTaskEditBtn",
      "deleteTaskBtn",
      "viewModeSelect",
      "loadSampleBtn",
      "saveBtn",
      "gasUrlInput",
      "loadFromGasBtn",
      "toast",
    ];

    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    el.openProjectDrawerBtn.addEventListener("click", () => setProjectDrawerOpen(true));
    el.closeProjectDrawerBtn.addEventListener("click", () => setProjectDrawerOpen(false));
    el.projectDrawerBackdrop.addEventListener("click", () => setProjectDrawerOpen(false));
    el.openDetailDrawerBtn.addEventListener("click", () => setDetailDrawerOpen(true));
    el.closeDetailDrawerBtn.addEventListener("click", () => setDetailDrawerOpen(false));

    el.viewGanttBtn.addEventListener("click", () => {
      state.viewType = "gantt";
      renderViewType();
    });
    el.viewTableBtn.addEventListener("click", () => {
      state.viewType = "table";
      renderViewType();
    });
    document.querySelectorAll("[data-deco-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.decoAction;
        if (action === "board") return;
        notify("このメニューは準備中です。", "info");
      });
    });

    el.loadSampleBtn.addEventListener("click", () => {
      if (!confirm("初期データを再読込します。現在の内容は上書きされます。よろしいですか？")) return;
      setState(KoujiApi.loadSampleState());
      state.currentFolder = "active";
      ensureCurrentFolderHasSelection();
      renderAll();
      persistLocalOnly(true, "初期データを再読込しました。");
    });

    el.saveBtn.addEventListener("click", async () => {
      await saveNow();
    });

    el.folderTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (!button) return;
      state.currentFolder = button.dataset.folder;
      ensureCurrentFolderHasSelection();
      renderAll();
    });

    el.projectList.addEventListener("click", (event) => {
      const card = event.target.closest(".project-card");
      if (!card) return;
      const projectId = card.dataset.projectId;
      const action = event.target.closest("[data-action]")?.dataset.action || "select";

      if (action === "select") selectProject(projectId);
      if (action === "edit") {
        selectProject(projectId);
        setDetailDrawerOpen(true, "project");
      }
      if (action === "trash") moveProjectToTrash(projectId);
      if (action === "restore") restoreProject(projectId);
      if (action === "delete-forever") permanentlyDeleteProject(projectId);
    });

    el.addProjectBtn.addEventListener("click", addProjectQuick);
    el.applyProjectInfoBtn.addEventListener("click", saveProjectFromDrawer);
    el.cancelProjectEditBtn.addEventListener("click", resetProjectForm);

    el.startMinusBtn.addEventListener("click", () => stepProjectDate("start", -1));
    el.startPlusBtn.addEventListener("click", () => stepProjectDate("start", 1));
    el.endMinusBtn.addEventListener("click", () => stepProjectDate("end", -1));
    el.endPlusBtn.addEventListener("click", () => stepProjectDate("end", 1));
    el.applyProjectDatesBtn.addEventListener("click", applyProjectDates);

    el.addTaskBtn.addEventListener("click", () => {
      if (!prepareNewTaskForm()) return;
      setDetailDrawerOpen(true, "task");
      el.taskName.focus();
    });
    el.generateTemplateBtn.addEventListener("click", generateTemplateTasks);
    el.saveTaskBtn.addEventListener("click", saveTaskFromDrawer);
    el.cancelTaskEditBtn.addEventListener("click", resetTaskForm);
    el.deleteTaskBtn.addEventListener("click", () => {
      const taskId = el.taskId.value || state.selectedTaskId;
      if (taskId) deleteTask(taskId);
    });
    el.taskMemo.addEventListener("input", syncTaskMemoCount);

    el.viewModeSelect.addEventListener("change", (event) => {
      state.viewMode = event.target.value;
      renderGantt();
      markDirty({ queueGas: true });
    });

    el.gasUrlInput.addEventListener("change", (event) => {
      KoujiApi.saveGasUrl(event.target.value.trim());
      notify("GAS URLを保存しました。", "info");
    });

    el.loadFromGasBtn.addEventListener("click", loadFromGas);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setProjectDrawerOpen(false);
      setDetailDrawerOpen(false);
    });
  }

  function setState(nextState) {
    state.projects = (nextState.projects || []).map(KoujiUtils.normalizeProject);
    state.tasks = (nextState.tasks || []).map(KoujiUtils.normalizeTask);
    state.changeLogs = nextState.changeLogs || [];
    state.serverRevision = nextState.revision || "";
    state.projects.forEach((project) => {
      project.project_folder = getProjectFolder(project);
    });
  }

  function getPersistableState() {
    return {
      projects: state.projects,
      tasks: state.tasks,
      changeLogs: state.changeLogs,
      revision: state.serverRevision,
    };
  }

  function renderAll() {
    renderFolderTabs();
    renderProjectList();
    renderProjectSummary();
    renderViewType();
    renderGantt();
    renderTaskTable();
  }

  function renderViewType() {
    const showTable = state.viewType === "table";
    el.taskTableSection.hidden = !showTable;
    el.ganttWrap.hidden = showTable;
    el.viewTableBtn.classList.toggle("is-active", showTable);
    el.viewGanttBtn.classList.toggle("is-active", !showTable);
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
      card.dataset.projectId = project.project_id;
      card.innerHTML = `
        <button class="project-main" type="button" data-action="select">
          <h3>${escapeHtml(project.project_name)}</h3>
          <p>${escapeHtml(project.customer_name || "担当未設定")}</p>
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
      el.projectList.appendChild(card);
    });
  }

  function renderProjectSummary() {
    const project = getSelectedProject();
    if (!project) {
      el.projectTitle.textContent = "工程表";
      el.projectMeta.textContent = "工事を選択してください。";
      clearProjectForm();
      clearTaskForm();
      setProjectControlsDisabled(true);
      return;
    }

    const tasks = getSelectedTasks();
    const folder = getProjectFolder(project);

    el.projectTitle.textContent = `${project.project_name}（${tasks.length}工程）`;
    el.projectMeta.textContent = `${project.customer_name || "顧客未設定"} / ${project.site_address || "現場住所未設定"} / 担当：${project.manager || "未設定"} / ${getFolderLabel(folder)}`;

    el.projectId.value = project.project_id;
    el.projectName.value = project.project_name;
    el.projectCustomer.value = project.customer_name;
    el.projectAddress.value = project.site_address;
    el.projectType.value = project.project_type;
    el.projectFolder.value = folder;
    el.projectStatus.value = project.status;
    el.projectManager.value = project.manager;
    el.projectMemo.value = project.memo;
    el.quickStartInput.value = project.planned_start;
    el.quickEndInput.value = project.planned_end;

    setProjectControlsDisabled(false);
    renderTaskEditor();
  }

  function renderTaskEditor() {
    const project = getSelectedProject();
    const task = state.tasks.find((item) => item.id === state.selectedTaskId && item.project_id === project?.project_id);
    if (!project) {
      clearTaskForm();
      return;
    }
    if (!task) {
      prepareNewTaskForm(false);
      return;
    }
    setTaskForm(task);
  }

  function renderGantt() {
    const tasks = getSelectedTasks();
    if (!getSelectedProject()) {
      document.getElementById("gantt").innerHTML = `<div class="empty-state">工事を選択してください。</div>`;
      return;
    }
    if (!tasks.length) {
      document.getElementById("gantt").innerHTML = `<div class="empty-state">工程がありません。「工程を追加」または「ひな形を追加」を押してください。</div>`;
      return;
    }

    try {
      KoujiGantt.render("#gantt", tasks, {
        viewMode: state.viewMode,
        onTaskClick: (taskId) => {
          state.selectedTaskId = taskId;
          renderTaskTable();
          renderTaskEditor();
          setDetailDrawerOpen(true, "task");
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
    tasks.forEach((task, index) => {
      const tr = document.createElement("tr");
      tr.className = `task-row ${task.id === state.selectedTaskId ? "is-selected" : ""}`;
      const progress = Number(task.progress || 0);
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(task.name)}</strong></td>
        <td>${escapeHtml(task.start)}</td>
        <td>${escapeHtml(task.end)}</td>
        <td>
          <div class="progress-cell">
            <span>${progress}%</span>
            <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          </div>
        </td>
      `;
      tr.addEventListener("click", () => {
        state.selectedTaskId = task.id;
        renderTaskEditor();
        renderTaskTable();
        setDetailDrawerOpen(true, "task");
      });
      el.taskTableBody.appendChild(tr);
    });
  }

  function syncTaskMemoCount() {
    if (!el.taskMemoCount) return;
    const length = (el.taskMemo.value || "").length;
    el.taskMemoCount.textContent = `${length} / 200`;
  }

  function setProjectControlsDisabled(disabled) {
    [
      el.applyProjectInfoBtn,
      el.cancelProjectEditBtn,
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
      el.saveTaskBtn,
      el.cancelTaskEditBtn,
      el.deleteTaskBtn,
    ].forEach((item) => {
      if (item) item.disabled = disabled;
    });
  }

  function setProjectDrawerOpen(open) {
    el.projectDrawer.classList.toggle("is-open", open);
    el.projectDrawer.setAttribute("aria-hidden", String(!open));
    el.projectDrawerBackdrop.hidden = !open;
  }

  function setDetailDrawerOpen(open, targetSection = "") {
    el.detailDrawer.classList.toggle("is-open", open);
    el.detailDrawer.setAttribute("aria-hidden", String(!open));
    if (open && targetSection) {
      const sections = el.detailDrawer.querySelectorAll("details.detail-section");
      sections.forEach((section) => {
        section.open = section.dataset.section === targetSection;
      });
    }
  }

  function clearProjectForm() {
    el.projectId.value = "";
    el.projectName.value = "";
    el.projectCustomer.value = "";
    el.projectAddress.value = "";
    el.projectType.value = "その他";
    el.projectFolder.value = "active";
    el.projectStatus.value = "予定";
    el.projectManager.value = "";
    el.projectMemo.value = "";
    el.quickStartInput.value = "";
    el.quickEndInput.value = "";
  }

  function clearTaskForm() {
    el.taskId.value = "";
    el.taskName.value = "";
    el.taskStart.value = "";
    el.taskEnd.value = "";
    el.taskProgress.value = 0;
    el.taskMemo.value = "";
    syncTaskMemoCount();
  }

  function setTaskForm(task) {
    el.taskId.value = task.id;
    el.taskName.value = task.name;
    el.taskStart.value = task.start;
    el.taskEnd.value = task.end;
    el.taskProgress.value = Number(task.progress || 0);
    el.taskMemo.value = task.memo || "";
    syncTaskMemoCount();
  }

  function prepareNewTaskForm() {
    const project = getSelectedProject();
    if (!project) {
      notify("先に工事を選択してください。", "error");
      return false;
    }
    clearTaskForm();
    el.taskStart.value = project.planned_start || KoujiUtils.getToday();
    el.taskEnd.value = project.planned_start || KoujiUtils.getToday();
    return true;
  }

  function addProjectQuick() {
    const today = KoujiUtils.getToday();
    const folder = state.currentFolder === "trash" ? "active" : state.currentFolder;
    const project = KoujiUtils.normalizeProject({
      project_id: KoujiUtils.generateId("P"),
      project_name: "新規工事",
      customer_name: "",
      site_address: "",
      project_type: "その他",
      project_folder: folder,
      planned_start: today,
      planned_end: KoujiUtils.addDays(today, 30),
      status: folder === "pre-contract" ? "契約前" : "予定",
      manager: "",
      memo: "",
      deleted_at: "",
      previous_folder: "",
    });

    state.projects.push(project);
    state.currentFolder = folder;
    state.selectedProjectId = project.project_id;
    state.selectedTaskId = "";
    addProjectLog("工事追加", project, `工事「${project.project_name}」を追加`);
    renderAll();
    setProjectDrawerOpen(false);
    setDetailDrawerOpen(true, "project");
    markDirty({ queueGas: true, toast: "新規工事を追加しました。" });
    el.projectName.focus();
  }

  function resetProjectForm() {
    const selected = getSelectedProject();
    if (!selected) return;
    renderProjectSummary();
    notify("工事の入力を取り消しました。", "info");
  }

  function resetTaskForm() {
    const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId);
    if (selectedTask) {
      setTaskForm(selectedTask);
    } else {
      prepareNewTaskForm();
    }
    notify("工程の入力を取り消しました。", "info");
  }

  function saveProjectFromDrawer() {
    const selected = getSelectedProject();
    if (!selected) {
      notify("保存する工事がありません。", "error");
      return;
    }

    const plannedStart = el.quickStartInput.value || selected.planned_start;
    const plannedEnd = el.quickEndInput.value || selected.planned_end;
    if (KoujiUtils.toDate(plannedEnd) < KoujiUtils.toDate(plannedStart)) {
      notify("完工予定日は着工予定日以降にしてください。", "error");
      return;
    }

    const folder = el.projectFolder.value;
    const project = KoujiUtils.normalizeProject({
      ...selected,
      project_id: selected.project_id,
      project_name: el.projectName.value.trim() || "未設定工事",
      customer_name: el.projectCustomer.value.trim(),
      site_address: el.projectAddress.value.trim(),
      project_type: el.projectType.value,
      project_folder: folder,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      status: el.projectStatus.value,
      manager: el.projectManager.value.trim(),
      memo: el.projectMemo.value.trim(),
      deleted_at: folder === "trash" ? selected.deleted_at || new Date().toISOString() : "",
      previous_folder: folder === "trash" ? selected.previous_folder || getProjectFolder(selected) : "",
    });

    const index = state.projects.findIndex((item) => item.project_id === project.project_id);
    if (index < 0) return;

    const dateDelta = KoujiUtils.dayDelta(selected.planned_start, project.planned_start);
    state.projects[index] = project;
    if (dateDelta !== 0 && el.shiftTasksByStartCheckbox.checked) {
      shiftProjectTasks(project.project_id, dateDelta);
    }
    addProjectLog("工事情報編集", project, `工事「${project.project_name}」を編集`);

    state.currentFolder = getProjectFolder(project);
    state.selectedProjectId = project.project_id;
    renderAll();
    markDirty({ queueGas: true, toast: "工事情報を保存しました。" });
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
    markDirty({ queueGas: true, toast: "工事をゴミ箱へ移動しました。" });
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
    markDirty({ queueGas: true, toast: "工事を復元しました。" });
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
    markDirty({ queueGas: true, toast: "工事を完全削除しました。" });
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

    addProjectLog(
      "工事日程変更",
      state.projects[index],
      `${oldStart}〜${oldEnd} → ${newStart}〜${newEnd}${dateDelta !== 0 && el.shiftTasksByStartCheckbox.checked ? ` / 工程も${dateDelta > 0 ? "+" : ""}${dateDelta}日移動` : ""}`
    );
    renderAll();
    markDirty({ queueGas: true, toast: "工事日程を変更しました。" });
  }

  function stepProjectDate(target, amount) {
    const input = target === "start" ? el.quickStartInput : el.quickEndInput;
    if (!input.value) input.value = KoujiUtils.getToday();
    input.value = KoujiUtils.addDays(input.value, amount);
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

  function saveTaskFromDrawer() {
    const project = getSelectedProject();
    if (!project) {
      notify("先に工事を選択してください。", "error");
      return;
    }
    const taskId = el.taskId.value || KoujiUtils.generateId("T");
    const start = el.taskStart.value;
    const end = el.taskEnd.value;
    if (!start || !end) {
      notify("開始日と終了日を入力してください。", "error");
      return;
    }
    if (KoujiUtils.toDate(end) < KoujiUtils.toDate(start)) {
      notify("終了日は開始日以降にしてください。", "error");
      return;
    }

    const existingTask = state.tasks.find((item) => item.id === taskId);
    const task = KoujiUtils.normalizeTask({
      id: taskId,
      project_id: project.project_id,
      name: el.taskName.value.trim() || "未設定工程",
      category: existingTask?.category || "その他",
      start,
      end,
      progress: el.taskProgress.value,
      contractor: existingTask?.contractor || "",
      status: existingTask?.status || "未着手",
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
    renderAll();
    markDirty({ queueGas: true, toast: "工程を保存しました。" });
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
    markDirty({ queueGas: true });
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

  function deleteTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (!confirm(`工程「${task.name}」を削除しますか？`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== taskId);
    state.selectedTaskId = "";
    addLog("工程削除", taskId, `「${task.name}」を削除`);
    renderAll();
    markDirty({ queueGas: true, toast: "工程を削除しました。" });
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
    markDirty({ queueGas: true, toast: "テンプレート工程を追加しました。" });
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
      persistLocalOnly(false);
      notify("GASからデータを読み込みました。");
    } catch (error) {
      console.error(error);
      notify(error.message, "error");
    }
  }

  async function saveNow() {
    persistLocalOnly(false);
    const gasUrl = el.gasUrlInput.value.trim();
    if (!gasUrl) {
      notify("ローカルに保存しました。", "info");
      return;
    }
    await saveToGas({ isAuto: false });
  }

  async function saveToGas({ isAuto }) {
    const gasUrl = el.gasUrlInput.value.trim();
    if (!gasUrl) return;
    if (state.isSavingToGas) {
      state.gasDirty = true;
      return;
    }

    state.isSavingToGas = true;
    KoujiApi.saveGasUrl(gasUrl);

    try {
      if (!isAuto) notify("共有データへ保存中です...", "info");
      const result = await KoujiApi.saveToGas(gasUrl, getPersistableState(), state.serverRevision);
      state.serverRevision = result.revision || state.serverRevision;
      state.gasDirty = false;
      persistLocalOnly(false);
      if (!isAuto) notify("保存しました。");
    } catch (error) {
      console.error(error);
      if (error.code === "CONFLICT") {
        notify("他の端末で先に更新されています。GASから再読込して確認してください。", "error");
      } else {
        notify(error.message || "保存に失敗しました。", "error");
      }
    } finally {
      state.isSavingToGas = false;
      if (state.gasDirty) {
        scheduleGasAutosave();
      }
    }
  }

  function scheduleGasAutosave() {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = window.setTimeout(() => {
      saveToGas({ isAuto: true }).catch((error) => {
        console.error(error);
      });
    }, AUTOSAVE_DELAY_MS);
  }

  function persistLocalOnly(showToast = false, message = "") {
    KoujiApi.saveLocalState(getPersistableState());
    if (showToast && message) notify(message);
  }

  function markDirty({ queueGas = false, toast = "" } = {}) {
    persistLocalOnly(false);
    if (toast) notify(toast);
    if (queueGas) {
      state.gasDirty = true;
      if (el.gasUrlInput.value.trim()) scheduleGasAutosave();
    }
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
    setProjectDrawerOpen(false);
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
