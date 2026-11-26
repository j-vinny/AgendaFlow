
const STORAGE_KEY = "agendaflow_v4";

let data = {
  clients: [],
  appointments: []
};

let currentMonth = new Date();
let selectedDate = new Date().toLocaleDateString("en-CA");
let editingAppointment = null;
let editingClient = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      data.clients = Array.isArray(parsed.clients) ? parsed.clients : [];
      data.appointments = Array.isArray(parsed.appointments) ? parsed.appointments : [];
    }
  } catch {
    data = { clients: [], appointments: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function id() {
  return crypto.randomUUID();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function getClientName(clientId) {
  const client = data.clients.find(item => item.id === clientId);
  return client ? client.name : "Cliente não encontrado";
}

function getStatusLabel(status) {
  const labels = {
    confirmed: "Confirmado",
    pending: "Pendente",
    completed: "Concluído",
    cancelled: "Cancelado"
  };

  return labels[status] || status;
}

function statusHTML(status) {
  return `<span class="status ${escapeHTML(status)}">${escapeHTML(getStatusLabel(status))}</span>`;
}

function renderStats() {
  const appointmentsToday = data.appointments.filter(item =>
    item.date === today() && item.status !== "cancelled"
  );

  const confirmed = data.appointments.filter(item =>
    item.status === "confirmed"
  );

  const pending = data.appointments.filter(item =>
    item.status === "pending"
  );

  $("#statToday").textContent = appointmentsToday.length;
  $("#statConfirmed").textContent = confirmed.length;
  $("#statClients").textContent = data.clients.length;
  $("#statPending").textContent = pending.length;

  $("#todayDisplay").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function appointmentRow(item) {
  return `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHTML(item.time)}</td>
      <td>${escapeHTML(getClientName(item.clientId))}</td>
      <td>${escapeHTML(item.service)}</td>
      <td>${statusHTML(item.status)}</td>
      <td>
        <button class="action-btn" data-edit-appointment="${escapeHTML(item.id)}">Editar</button>
        <button class="action-btn danger" data-delete-appointment="${escapeHTML(item.id)}">Excluir</button>
      </td>
    </tr>
  `;
}

function renderTable(container, appointments) {
  if (!appointments.length) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Nenhum agendamento encontrado.</td>
      </tr>
    `;
    return;
  }

  appointments.sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );

  container.innerHTML = appointments.map(appointmentRow).join("");
}

function filterAppointments(search, status) {
  const term = (search || "").toLowerCase();

  return data.appointments.filter(item => {
    const client = getClientName(item.clientId).toLowerCase();
    const service = item.service.toLowerCase();

    const matchesSearch = !term ||
      client.includes(term) ||
      service.includes(term);

    const matchesStatus = status === "all" ||
      !status ||
      item.status === status;

    return matchesSearch && matchesStatus;
  });
}

function renderDashboard() {
  const appointments = filterAppointments(
    $("#homeSearch").value,
    $("#homeStatus").value
  ).filter(item => item.date === today());

  renderTable($("#homeRows"), appointments);
}

function renderAppointments() {
  const appointments = filterAppointments(
    $("#allSearch").value,
    $("#allStatus").value
  );

  renderTable($("#allRows"), appointments);
}

function renderClients() {
  const container = $("#clientGrid");
  const search = $("#clientSearch").value.toLowerCase();

  const clients = data.clients.filter(client =>
    client.name.toLowerCase().includes(search) ||
    client.phone.toLowerCase().includes(search) ||
    (client.email || "").toLowerCase().includes(search)
  );

  if (!clients.length) {
    container.innerHTML = `<p class="empty-state">Nenhum cliente cadastrado.</p>`;
    return;
  }

  container.innerHTML = clients.map(client => `
    <article class="client-card">
      <div class="client-info">
        <h3>${escapeHTML(client.name)}</h3>
        <p>${escapeHTML(client.phone)}</p>
        <p>${escapeHTML(client.email || "Sem e-mail")}</p>
      </div>
      <div class="client-actions">
        <button class="action-btn" data-edit-client="${escapeHTML(client.id)}">Editar</button>
        <button class="action-btn danger" data-delete-client="${escapeHTML(client.id)}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const monthName = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  $("#monthLabel").textContent = monthName;

  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push('<div class="calendar-day empty"></div>');
  }

  for (let day = 1; day <= lastDay; day++) {
    const date = [
      year,
      String(month + 1).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");

    const hasAppointments = data.appointments.some(item =>
      item.date === date && item.status !== "cancelled"
    );

    const classes = [
      "calendar-day",
      date === today() ? "today" : "",
      date === selectedDate ? "selected" : ""
    ].filter(Boolean).join(" ");

    days.push(`
      <button class="${classes}" data-calendar-date="${date}">
        <span>${day}</span>
        ${hasAppointments ? '<i class="calendar-dot"></i>' : ""}
      </button>
    `);
  }

  $("#calendarDays").innerHTML = days.join("");
  renderSelectedDate();
}

function renderSelectedDate() {
  const appointments = data.appointments
    .filter(item => item.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  $("#selectedDateLabel").textContent = formatDate(selectedDate);

  if (!appointments.length) {
    $("#dayTimeline").innerHTML = `
      <p class="empty-state">Nenhum compromisso nesta data.</p>
    `;
    return;
  }

  $("#dayTimeline").innerHTML = appointments.map(item => `
    <div class="timeline-item">
      <strong>${escapeHTML(item.time)}</strong>
      <span>${escapeHTML(getClientName(item.clientId))}</span>
      <span>${escapeHTML(item.service)}</span>
      ${statusHTML(item.status)}
      <button class="action-btn" data-edit-appointment="${escapeHTML(item.id)}">Editar</button>
    </div>
  `).join("");
}

function renderClientOptions(selected = "") {
  const select = $("#appointmentClient");

  select.innerHTML = `
    <option value="">Selecione um cliente</option>
    ${data.clients.map(client => `
      <option value="${escapeHTML(client.id)}" ${client.id === selected ? "selected" : ""}>
        ${escapeHTML(client.name)}
      </option>
    `).join("")}
  `;
}

function openAppointmentModal(item = null) {
  editingAppointment = item ? item.id : null;

  $("#appointmentForm").reset();
  renderClientOptions(item?.clientId || "");

  $("#appointmentModalTitle").textContent = item
    ? "Editar agendamento"
    : "Novo agendamento";

  $("#appointmentDate").value = item?.date || selectedDate;
  $("#appointmentTime").value = item?.time || "";
  $("#appointmentService").value = item?.service || "";
  $("#appointmentPhone").value = item?.phone || "";
  $("#appointmentStatus").value = item?.status || "pending";
  $("#appointmentNotes").value = item?.notes || "";

  $("#appointmentModal").classList.add("active");
}

function closeAppointmentModal() {
  $("#appointmentModal").classList.remove("active");
  editingAppointment = null;
}

function saveAppointment(event) {
  event.preventDefault();

  const appointment = {
    id: editingAppointment || id(),
    clientId: $("#appointmentClient").value,
    service: $("#appointmentService").value.trim(),
    date: $("#appointmentDate").value,
    time: $("#appointmentTime").value,
    phone: $("#appointmentPhone").value.trim(),
    status: $("#appointmentStatus").value,
    notes: $("#appointmentNotes").value.trim()
  };

  if (!appointment.clientId || !appointment.service ||
      !appointment.date || !appointment.time) {
    showToast("Preencha todos os campos obrigatórios.");
    return;
  }

  if (editingAppointment) {
    data.appointments = data.appointments.map(item =>
      item.id === editingAppointment ? appointment : item
    );
  } else {
    data.appointments.push(appointment);
  }

  saveData();
  closeAppointmentModal();
  renderAll();
  showToast("Agendamento salvo com sucesso.");
}

function deleteAppointment(appointmentId) {
  if (!confirm("Deseja excluir este agendamento?")) return;

  data.appointments = data.appointments.filter(item =>
    item.id !== appointmentId
  );

  saveData();
  renderAll();
  showToast("Agendamento excluído.");
}

function openClientModal(client = null) {
  editingClient = client ? client.id : null;

  $("#clientForm").reset();

  $("#clientModalTitle").textContent = client
    ? "Editar cliente"
    : "Novo cliente";

  $("#clientName").value = client?.name || "";
  $("#clientPhone").value = client?.phone || "";
  $("#clientEmail").value = client?.email || "";

  $("#clientModal").classList.add("active");
}

function closeClientModal() {
  $("#clientModal").classList.remove("active");
  editingClient = null;
}

function saveClient(event) {
  event.preventDefault();

  const client = {
    id: editingClient || id(),
    name: $("#clientName").value.trim(),
    phone: $("#clientPhone").value.trim(),
    email: $("#clientEmail").value.trim()
  };

  if (!client.name || !client.phone) {
    showToast("Preencha o nome e o telefone.");
    return;
  }

  if (editingClient) {
    data.clients = data.clients.map(item =>
      item.id === editingClient ? client : item
    );
  } else {
    data.clients.push(client);
  }

  saveData();
  closeClientModal();
  renderAll();
  showToast("Cliente salvo com sucesso.");
}

function deleteClient(clientId) {
  const hasAppointments = data.appointments.some(item =>
    item.clientId === clientId
  );

  if (hasAppointments) {
    showToast("Este cliente possui agendamentos cadastrados.");
    return;
  }

  if (!confirm("Deseja excluir este cliente?")) return;

  data.clients = data.clients.filter(client =>
    client.id !== clientId
  );

  saveData();
  renderAll();
  showToast("Cliente excluído.");
}

function exportCSV() {
  const headers = [
    "Data",
    "Horário",
    "Cliente",
    "Serviço",
    "Telefone",
    "Status",
    "Observações"
  ];

  const rows = data.appointments.map(item => [
    formatDate(item.date),
    item.time,
    getClientName(item.clientId),
    item.service,
    item.phone,
    getStatusLabel(item.status),
    item.notes
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "agendaflow-agendamentos.csv";
  link.click();

  URL.revokeObjectURL(url);
  showToast("Agendamentos exportados.");
}

function setPage(page) {
  $$("[data-page].page-section").forEach(section => {
    section.classList.toggle("active", section.dataset.page === page);
  });

  $$(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const titles = {
    dashboard: "Visão geral",
    appointments: "Agendamentos",
    calendar: "Calendário",
    clients: "Clientes"
  };

  $("#pageTitle").textContent = titles[page] || titles.dashboard;
  $("#sidebar").classList.remove("open");

  renderAll();
}

function renderAll() {
  renderStats();
  renderDashboard();
  renderAppointments();
  renderClients();
  renderCalendar();
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest(".nav-link[data-page]");

  if (pageButton) {
    setPage(pageButton.dataset.page);
  }

  const goButton = event.target.closest("[data-go]");

  if (goButton) {
    setPage(goButton.dataset.go);
  }

  if (event.target.closest("[data-new-appointment]")) {
    openAppointmentModal();
  }

  if (event.target.closest("[data-new-client]")) {
    openClientModal();
  }

  const editAppointment = event.target.closest("[data-edit-appointment]");

  if (editAppointment) {
    const item = data.appointments.find(appointment =>
      appointment.id === editAppointment.dataset.editAppointment
    );

    if (item) openAppointmentModal(item);
  }

  const deleteAppointmentButton = event.target.closest("[data-delete-appointment]");

  if (deleteAppointmentButton) {
    deleteAppointment(deleteAppointmentButton.dataset.deleteAppointment);
  }

  const editClient = event.target.closest("[data-edit-client]");

  if (editClient) {
    const client = data.clients.find(item =>
      item.id === editClient.dataset.editClient
    );

    if (client) openClientModal(client);
  }

  const deleteClientButton = event.target.closest("[data-delete-client]");

  if (deleteClientButton) {
    deleteClient(deleteClientButton.dataset.deleteClient);
  }

  const calendarButton = event.target.closest("[data-calendar-date]");

  if (calendarButton) {
    selectedDate = calendarButton.dataset.calendarDate;
    renderCalendar();
  }

  if (event.target.closest("[data-close]")) {
    closeAppointmentModal();
    closeClientModal();
  }

  if (event.target.classList.contains("modal-backdrop")) {
    closeAppointmentModal();
    closeClientModal();
  }
});

$("#appointmentForm").addEventListener("submit", saveAppointment);
$("#clientForm").addEventListener("submit", saveClient);

$("#homeSearch").addEventListener("input", renderDashboard);
$("#homeStatus").addEventListener("change", renderDashboard);
$("#allSearch").addEventListener("input", renderAppointments);
$("#allStatus").addEventListener("change", renderAppointments);
$("#clientSearch").addEventListener("input", renderClients);

$("#prevMonth").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

$("#exportBtn").addEventListener("click", exportCSV);

$("#mobileMenu").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

loadData();
renderAll();
setPage("dashboard");
