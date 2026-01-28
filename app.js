/* ========================================
   ESCALA CCB - APPLICATION LOGIC
   Sistema de Escalas para Porteiros
   ======================================== */

// ========================================
// DATA MANAGEMENT (now uses Firebase)
// ========================================

// Church info
const CHURCH_INFO = {
    name: 'Congregação Cristã no Brasil',
    city: 'Ituiutaba-MG',
    neighborhood: 'Novo Tempo II'
};

// Month names in Portuguese
const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Cache for data
let membersCache = { porteiros: [], auxiliares: [], som: [], brigadista_irmao: [], brigadista_irma: [] };
let schedulesCache = [];
let somSchedulesCache = [];
let brigadistaSchedulesCache = [];

// ========================================
// LOGIN HANDLERS
// ========================================

function showLoginForm(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.login-tab');

    tabs.forEach(tab => tab.classList.remove('active'));

    if (type === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        tabs[1].classList.add('active');
    }

    hideError();
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const result = await loginUser(email, password);

    if (!result.success) {
        document.getElementById('login-error').textContent = result.error;
        document.getElementById('login-error').style.display = 'block';
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
        document.getElementById('register-error').textContent = 'As senhas não coincidem.';
        document.getElementById('register-error').style.display = 'block';
        return;
    }

    const result = await registerUser(email, password);

    if (!result.success) {
        document.getElementById('register-error').textContent = result.error;
        document.getElementById('register-error').style.display = 'block';
    }
}

async function handleLogout() {
    if (confirm('Deseja sair da sua conta?')) {
        await logoutUser();
    }
}

// ========================================
// INITIALIZATION
// ========================================

async function initApp() {
    showLoading('Carregando dados...');

    setupTabNavigation();
    setupMemberForm();
    setupYearSelector();
    setCurrentMonthYear();

    // Setup Som tab
    setupSomYearSelector();
    setSomCurrentMonthYear();

    // Setup Brigadista tab
    setupBrigadistaYearSelector();
    setBrigadistaCurrentMonthYear();

    // Load data from Firebase
    await loadDataFromFirebase();

    updateDashboard();
    updateNextServices();

    hideLoading();
}

async function loadDataFromFirebase() {
    try {
        membersCache = await loadMembersFromDb();
        schedulesCache = await loadSchedulesFromDb();
        somSchedulesCache = await loadSomSchedulesFromDb();
        brigadistaSchedulesCache = await loadBrigadistaSchedulesFromDb();
        loadMembers();
        loadSchedules();
        loadSomSchedules();
        loadBrigadistaSchedules();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// ========================================
// TAB NAVIGATION
// ========================================

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

// ========================================
// MEMBERS MANAGEMENT
// ========================================

function getMembers() {
    return membersCache;
}

async function saveMembers(members) {
    membersCache = members;
    await saveMembersToDb(members);
}

function setupMemberForm() {
    const form = document.getElementById('member-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            addMember();
        });
    }
}

async function addMember() {
    const nameInput = document.getElementById('member-name');
    const typeSelect = document.getElementById('member-type');

    const name = nameInput.value.trim();
    const type = typeSelect.value;

    if (!name || !type) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    showLoading('Salvando...');

    const members = getMembers();
    const newMember = {
        id: Date.now(),
        name: name,
        availability: {
            wednesday: document.querySelector('input[name="availability"][value="wednesday"]').checked,
            sunday_morning: document.querySelector('input[name="availability"][value="sunday_morning"]').checked,
            sunday_night: document.querySelector('input[name="availability"][value="sunday_night"]').checked
        },
        oncePerMonth: document.getElementById('member-once-month').checked,
        partnerId: document.getElementById('member-partner').value || null
    };

    if (type === 'porteiro') {
        members.porteiros.push(newMember);
    } else if (type === 'auxiliar') {
        members.auxiliares.push(newMember);
    } else if (type === 'som') {
        if (!members.som) members.som = [];
        members.som.push(newMember);
    } else if (type === 'brigadista_irmao') {
        if (!members.brigadista_irmao) members.brigadista_irmao = [];
        members.brigadista_irmao.push(newMember);
    } else if (type === 'brigadista_irma') {
        if (!members.brigadista_irma) members.brigadista_irma = [];
        members.brigadista_irma.push(newMember);
    }

    await saveMembers(members);
    loadMembers();
    updateDashboard();

    hideLoading();

    // Reset form
    nameInput.value = '';
    typeSelect.value = '';
    document.getElementById('member-once-month').checked = false;
    document.getElementById('member-partner').value = '';

    // Update partner dropdowns since we added a new member
    updatePartnerDropdown();

    nameInput.focus();
}

function updatePartnerDropdown() {
    const select = document.getElementById('member-partner');
    if (!select) return;

    const members = getMembers();
    const allMembers = [
        ...members.porteiros.map(m => ({ ...m, role: 'Porteiro' })),
        ...members.auxiliares.map(m => ({ ...m, role: 'Auxiliar' })),
        ...(members.som || []).map(m => ({ ...m, role: 'Som' }))
    ];

    // Save current selection to restore if possible
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- Ninguém (Sem vínculo) --</option>';

    allMembers.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.name} (${m.role})</option>`;
    });

    select.value = currentVal;
}

async function removeMember(type, id) {
    if (!confirm('Tem certeza que deseja remover este membro?')) {
        return;
    }

    showLoading('Removendo...');

    const members = getMembers();

    if (type === 'porteiro') {
        members.porteiros = members.porteiros.filter(m => m.id !== id);
    } else if (type === 'auxiliar') {
        members.auxiliares = members.auxiliares.filter(m => m.id !== id);
    } else if (type === 'som') {
        if (members.som) {
            members.som = members.som.filter(m => m.id !== id);
        }
    } else if (type === 'brigadista_irmao') {
        if (members.brigadista_irmao) {
            members.brigadista_irmao = members.brigadista_irmao.filter(m => m.id !== id);
        }
    } else if (type === 'brigadista_irma') {
        if (members.brigadista_irma) {
            members.brigadista_irma = members.brigadista_irma.filter(m => m.id !== id);
        }
    }

    await saveMembers(members);
    loadMembers();
    updateDashboard();

    hideLoading();
}

function loadMembers() {
    const members = getMembers();

    // Update partner dropdown
    updatePartnerDropdown();

    // Porteiros
    const porteirosList = document.getElementById('porteiros-list');
    const porteirosEmpty = document.getElementById('porteiros-empty');

    if (porteirosList) {
        porteirosList.innerHTML = '';

        if (members.porteiros.length === 0) {
            porteirosEmpty.style.display = 'block';
        } else {
            porteirosEmpty.style.display = 'none';
            members.porteiros.forEach(member => {
                porteirosList.innerHTML += `
                    <li class="member-item">
                        <span class="member-name">${member.name}</span>
                        <button class="btn-danger" onclick="removeMember('porteiro', ${member.id})">
                            Remover
                        </button>
                    </li>
                `;
            });
        }
    }

    // Auxiliares
    const auxiliaresList = document.getElementById('auxiliares-list');
    const auxiliaresEmpty = document.getElementById('auxiliares-empty');

    if (auxiliaresList) {
        auxiliaresList.innerHTML = '';

        if (members.auxiliares.length === 0) {
            auxiliaresEmpty.style.display = 'block';
        } else {
            auxiliaresEmpty.style.display = 'none';
            members.auxiliares.forEach(member => {
                auxiliaresList.innerHTML += `
                    <li class="member-item">
                        <span class="member-name">${member.name}</span>
                        <button class="btn-danger" onclick="removeMember('auxiliar', ${member.id})">
                            Remover
                        </button>
                    </li>
                `;
            });
        }
    }

    // Operadores de Som
    const somList = document.getElementById('som-list');
    const somEmpty = document.getElementById('som-empty');

    if (somList) {
        somList.innerHTML = '';
        const somMembers = members.som || [];

        if (somMembers.length === 0) {
            somEmpty.style.display = 'block';
        } else {
            somEmpty.style.display = 'none';
            somMembers.forEach(member => {
                somList.innerHTML += `
                    <li class="member-item">
                        <span class="member-name">${member.name}</span>
                        <button class="btn-danger" onclick="removeMember('som', ${member.id})">
                            Remover
                        </button>
                    </li>
                `;
            });
        }
    }

    // Brigadistas (Irmãos)
    const brigadistaIrmaoList = document.getElementById('brigadista-irmao-list');
    const brigadistaIrmaoEmpty = document.getElementById('brigadista-irmao-empty');

    if (brigadistaIrmaoList) {
        brigadistaIrmaoList.innerHTML = '';
        const brigadistaIrmaoMembers = members.brigadista_irmao || [];

        if (brigadistaIrmaoMembers.length === 0) {
            brigadistaIrmaoEmpty.style.display = 'block';
        } else {
            brigadistaIrmaoEmpty.style.display = 'none';
            brigadistaIrmaoMembers.forEach(member => {
                brigadistaIrmaoList.innerHTML += `
                    <li class="member-item">
                        <span class="member-name">${member.name}</span>
                        <button class="btn-danger" onclick="removeMember('brigadista_irmao', ${member.id})">
                            Remover
                        </button>
                    </li>
                `;
            });
        }
    }

    // Brigadistas (Irmãs)
    const brigadistaIrmaList = document.getElementById('brigadista-irma-list');
    const brigadistaIrmaEmpty = document.getElementById('brigadista-irma-empty');

    if (brigadistaIrmaList) {
        brigadistaIrmaList.innerHTML = '';
        const brigadistaIrmaMembers = members.brigadista_irma || [];

        if (brigadistaIrmaMembers.length === 0) {
            brigadistaIrmaEmpty.style.display = 'block';
        } else {
            brigadistaIrmaEmpty.style.display = 'none';
            brigadistaIrmaMembers.forEach(member => {
                brigadistaIrmaList.innerHTML += `
                    <li class="member-item">
                        <span class="member-name">${member.name}</span>
                        <button class="btn-danger" onclick="removeMember('brigadista_irma', ${member.id})">
                            Remover
                        </button>
                    </li>
                `;
            });
        }
    }
}

// ========================================
// SCHEDULE MANAGEMENT
// ========================================

function getSchedules() {
    return schedulesCache;
}

async function saveSchedulesData(schedules) {
    schedulesCache = schedules;
    await saveSchedulesToDb(schedules);
}

function setupYearSelector() {
    const yearSelect = document.getElementById('year-select');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();

    for (let year = currentYear - 1; year <= currentYear + 5; year++) {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}

function setCurrentMonthYear() {
    const now = new Date();
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');

    if (monthSelect) monthSelect.value = now.getMonth();
    if (yearSelect) yearSelect.value = now.getFullYear();
}

function getServiceDays(month, year) {
    const services = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();

        // Wednesday (3)
        if (dayOfWeek === 3) {
            services.push({
                date: date,
                type: 'Quarta - Noite',
                cssClass: 'wednesday'
            });
        }

        // Sunday (0)
        if (dayOfWeek === 0) {
            services.push({
                date: date,
                type: 'Domingo - Manhã (Jovens/Crianças)',
                cssClass: 'sunday-morning'
            });
            services.push({
                date: date,
                type: 'Domingo - Noite',
                cssClass: 'sunday-night'
            });
        }
    }

    return services;
}

function generateScheduleForm() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    const members = getMembers();

    if (members.porteiros.length < 2 || members.auxiliares.length < 2) {
        alert('É necessário ter pelo menos 2 porteiros e 2 auxiliares cadastrados para gerar a escala.');
        return;
    }

    const services = getServiceDays(month, year);

    // Update title
    document.getElementById('schedule-title').textContent = `Escala de ${MONTH_NAMES[month]} ${year}`;

    // Generate table rows
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';

    // Check if there's a saved schedule for this month
    const schedules = getSchedules();
    const existingSchedule = schedules.find(s => s.month === month && s.year === year);

    services.forEach((service, index) => {
        const dateStr = formatDate(service.date);
        const serviceId = `${year}-${month}-${index}`;

        // Get saved values if exist
        let savedData = null;
        if (existingSchedule) {
            savedData = existingSchedule.services.find(s => s.serviceId === serviceId);
        }

        const row = document.createElement('tr');
        row.className = service.cssClass;
        row.innerHTML = `
            <td class="date-cell">${dateStr}</td>
            <td class="culto-cell">${service.type}</td>
            <td>${createMemberSelect('porteiro-principal', serviceId, members.porteiros, savedData?.porteiroPrincipal)}</td>
            <td>${createMemberSelect('porteiro-lateral', serviceId, members.porteiros, savedData?.porteiroLateral)}</td>
            <td>${createMemberSelect('auxiliar-principal', serviceId, members.auxiliares, savedData?.auxiliarPrincipal)}</td>
            <td>${createMemberSelect('auxiliar-lateral', serviceId, members.auxiliares, savedData?.auxiliarLateral)}</td>
        `;

        tbody.appendChild(row);
    });

    // Show the form
    document.getElementById('schedule-form-container').style.display = 'block';
}

function createMemberSelect(prefix, serviceId, members, selectedValue = '') {
    let options = '<option value="">Selecione...</option>';

    members.forEach(member => {
        const selected = selectedValue === member.name ? 'selected' : '';
        options += `<option value="${member.name}" ${selected}>${member.name}</option>`;
    });

    return `<select id="${prefix}-${serviceId}" class="member-select">${options}</select>`;
}

function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const dayName = DAY_NAMES[date.getDay()];

    return `${day}/${month}/${year} (${dayName})`;
}

async function saveSchedule() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    showLoading('Salvando escala...');

    const rows = document.querySelectorAll('#schedule-body tr');
    const servicesData = [];

    rows.forEach((row, index) => {
        const serviceId = `${year}-${month}-${index}`;
        const dateCell = row.querySelector('.date-cell').textContent;
        const cultoCell = row.querySelector('.culto-cell').textContent;

        servicesData.push({
            serviceId: serviceId,
            date: dateCell,
            type: cultoCell,
            porteiroPrincipal: document.getElementById(`porteiro-principal-${serviceId}`)?.value || '',
            porteiroLateral: document.getElementById(`porteiro-lateral-${serviceId}`)?.value || '',
            auxiliarPrincipal: document.getElementById(`auxiliar-principal-${serviceId}`)?.value || '',
            auxiliarLateral: document.getElementById(`auxiliar-lateral-${serviceId}`)?.value || ''
        });
    });

    const schedules = getSchedules();

    // Remove existing schedule for this month if any
    const existingIndex = schedules.findIndex(s => s.month === month && s.year === year);
    if (existingIndex !== -1) {
        schedules.splice(existingIndex, 1);
    }

    // Add new schedule
    schedules.push({
        id: Date.now(),
        month: month,
        year: year,
        monthName: MONTH_NAMES[month],
        services: servicesData,
        createdAt: new Date().toISOString()
    });

    await saveSchedulesData(schedules);
    loadSchedules();
    updateDashboard();

    hideLoading();
    alert('Escala salva com sucesso!');
}

function loadSchedules() {
    const schedules = getSchedules();
    const list = document.getElementById('saved-schedules-list');
    const empty = document.getElementById('schedules-empty');

    if (!list) return;

    list.innerHTML = '';

    if (schedules.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';

        // Sort by year and month descending
        schedules.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        schedules.forEach(schedule => {
            list.innerHTML += `
                <div class="schedule-item">
                    <div class="schedule-item-info">
                        <span class="schedule-item-icon">📅</span>
                        <span class="schedule-item-name">${schedule.monthName} ${schedule.year}</span>
                    </div>
                    <div class="schedule-item-actions">
                        <button class="btn-secondary" onclick="loadSavedSchedule(${schedule.month}, ${schedule.year})">
                            📝 Editar
                        </button>
                        <button class="btn-primary" onclick="generatePDFForSchedule(${schedule.month}, ${schedule.year})">
                            📄 PDF
                        </button>
                        <button class="btn-danger" onclick="deleteSchedule(${schedule.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
    }
}

function loadSavedSchedule(month, year) {
    document.getElementById('month-select').value = month;
    document.getElementById('year-select').value = year;
    generateScheduleForm();
}

async function deleteSchedule(id) {
    if (!confirm('Tem certeza que deseja excluir esta escala?')) {
        return;
    }

    showLoading('Excluindo...');

    let schedules = getSchedules();
    schedules = schedules.filter(s => s.id !== id);
    await saveSchedulesData(schedules);
    loadSchedules();
    updateDashboard();

    hideLoading();
}

// ========================================
// AI SCHEDULER HELPER
// ========================================

function generateAISchedule() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    // Check if there are enough members
    const members = getMembers();
    if (members.porteiros.length < 2 || members.auxiliares.length < 2) {
        alert('É necessário ter pelo menos 2 porteiros e 2 auxiliares cadastrados para usar a IA.');
        return;
    }

    if (!confirm('A IA vai preencher a escala automaticamente respeitando as disponibilidades. Os dados atuais do formulário serão substituídos. Deseja continuar?')) {
        return;
    }

    showLoading('IA está montando a escala...');

    // Small delay to allow UI to render the loading state
    setTimeout(() => {
        try {
            const generatedSchedule = AI_SCHEDULER.generate(month, year, members);

            // Fill the form
            generatedSchedule.forEach(item => {
                const serviceId = `${year}-${month}-${item.serviceIndex}`;

                // Construct ID for the select element
                // item.role is like 'porteiroPrincipal', but ID uses 'porteiro-principal'
                const selectId = item.role.replace(/([A-Z])/g, "-$1").toLowerCase() + '-' + serviceId;

                const selectEl = document.getElementById(selectId);
                if (selectEl) {
                    selectEl.value = item.member.name;
                }
            });

            hideLoading();
            alert('Escala preenchida com sucesso! Verifique os resultados e salve.');
        } catch (error) {
            console.error(error);
            hideLoading();
            alert('Erro ao gerar escala: ' + error.message);
        }
    }, 500);
}

// ========================================
// PDF GENERATION
// ========================================

function generatePDF() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    generatePDFForSchedule(month, year);
}

// Botão para gerar PDF de Porteiros
function generatePDFPorteirosBtn() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    const schedules = getSchedules();
    const schedule = schedules.find(s => s.month === month && s.year === year);

    if (!schedule) {
        alert('Salve a escala antes de gerar o PDF.');
        return;
    }

    generatePDFPorteiros(month, year, schedule);
}

// Botão para gerar PDF de Auxiliares
function generatePDFAuxiliaresBtn() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    const schedules = getSchedules();
    const schedule = schedules.find(s => s.month === month && s.year === year);

    if (!schedule) {
        alert('Salve a escala antes de gerar o PDF.');
        return;
    }

    generatePDFAuxiliares(month, year, schedule);
}

function generatePDFForSchedule(month, year) {
    const schedules = getSchedules();
    const schedule = schedules.find(s => s.month === month && s.year === year);

    if (!schedule) {
        // Try to get current form data
        saveSchedule();
        return;
    }

    // Gerar os dois PDFs separados
    generatePDFPorteiros(month, year, schedule);

    // Pequeno delay para evitar problemas de popup blocker
    setTimeout(() => {
        generatePDFAuxiliares(month, year, schedule);
    }, 500);
}

// PDF para IRMÃOS (Porteiros)
function generatePDFPorteiros(month, year, schedule) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    // Separar serviços: Domingo Manhã vs outros cultos
    const morningServices = schedule.services.filter(s => s.type.includes('Manhã'));
    const regularServices = schedule.services.filter(s => !s.type.includes('Manhã'));

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Congregação Cristã no Brasil', 105, 12, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${CHURCH_INFO.city} - ${CHURCH_INFO.neighborhood}`, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Escala dos Irmãos (Porteiros) - ${MONTH_NAMES[month]} ${year}`, 105, 27, { align: 'center' });

    let currentY = 40;

    // TABELA 1: Cultos Regulares (Quarta e Domingo Noite)
    if (regularServices.length > 0) {
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('CULTOS REGULARES (Quarta e Domingo Noite)', 15, currentY);
        currentY += 5;

        const headers = [['Data', 'Culto', 'Porteiro Principal', 'Porteiro Lateral']];
        const data = regularServices.map(service => [
            service.date,
            service.type,
            service.porteiroPrincipal || '-',
            service.porteiroLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 64, 175],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 55 },
                2: { cellWidth: 47 },
                3: { cellWidth: 47 }
            },
            margin: { left: 10, right: 10 }
        });

        currentY = doc.lastAutoTable.finalY + 15;
    }

    // TABELA 2: Domingo Manhã
    if (morningServices.length > 0) {
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DOMINGO MANHA (Jovens/Criancas)', 15, currentY);
        currentY += 5;

        const morningHeaders = [['Data', 'Porteiro Principal', 'Porteiro Lateral']];
        const morningData = morningServices.map(service => [
            service.date,
            service.porteiroPrincipal || '-',
            service.porteiroLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: morningHeaders,
            body: morningData,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 64, 175],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 70 },
                2: { cellWidth: 70 }
            },
            margin: { left: 10, right: 10 }
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        105,
        pageHeight - 10,
        { align: 'center' }
    );

    // Save
    const fileName = `Escala_Porteiros_${MONTH_NAMES[month]}_${year}.pdf`;

    try {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const newWindow = window.open(pdfUrl, '_blank');

        if (!newWindow) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
    } catch (error) {
        console.error('Erro ao gerar PDF de Porteiros:', error);
    }
}

// PDF para IRMÃS (Auxiliares da Porta)
function generatePDFAuxiliares(month, year, schedule) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    // Separar serviços: Domingo Manhã vs outros cultos
    const morningServices = schedule.services.filter(s => s.type.includes('Manhã'));
    const regularServices = schedule.services.filter(s => !s.type.includes('Manhã'));

    // Header
    doc.setFillColor(199, 21, 133);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Congregação Cristã no Brasil', 105, 12, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${CHURCH_INFO.city} - ${CHURCH_INFO.neighborhood}`, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Escala das Irmãs (Auxiliares da Porta) - ${MONTH_NAMES[month]} ${year}`, 105, 27, { align: 'center' });

    let currentY = 40;

    // TABELA 1: Cultos Regulares (Quarta e Domingo Noite)
    if (regularServices.length > 0) {
        doc.setTextColor(199, 21, 133);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('CULTOS REGULARES (Quarta e Domingo Noite)', 15, currentY);
        currentY += 5;

        const headers = [['Data', 'Culto', 'Auxiliar Principal', 'Auxiliar Lateral']];
        const data = regularServices.map(service => [
            service.date,
            service.type,
            service.auxiliarPrincipal || '-',
            service.auxiliarLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: [199, 21, 133],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center',
                fillColor: [255, 240, 245]
            },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 55 },
                2: { cellWidth: 47 },
                3: { cellWidth: 47 }
            },
            margin: { left: 10, right: 10 }
        });

        currentY = doc.lastAutoTable.finalY + 15;
    }

    // TABELA 2: Domingo Manhã
    if (morningServices.length > 0) {
        doc.setTextColor(199, 21, 133);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DOMINGO MANHA (Jovens/Criancas)', 15, currentY);
        currentY += 5;

        const morningHeaders = [['Data', 'Auxiliar Principal', 'Auxiliar Lateral']];
        const morningData = morningServices.map(service => [
            service.date,
            service.auxiliarPrincipal || '-',
            service.auxiliarLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: morningHeaders,
            body: morningData,
            theme: 'grid',
            headStyles: {
                fillColor: [199, 21, 133],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center',
                fillColor: [255, 240, 245]
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 70 },
                2: { cellWidth: 70 }
            },
            margin: { left: 10, right: 10 }
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        105,
        pageHeight - 10,
        { align: 'center' }
    );

    // Save
    const fileName = `Escala_Auxiliares_${MONTH_NAMES[month]}_${year}.pdf`;

    try {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const newWindow = window.open(pdfUrl, '_blank');

        if (!newWindow) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
    } catch (error) {
        console.error('Erro ao gerar PDF de Auxiliares:', error);
    }
}


// ========================================
// DASHBOARD
// ========================================

function updateDashboard() {
    const members = getMembers();
    const schedules = getSchedules();
    const somSchedules = getSomSchedules();
    const brigadistaSchedules = getBrigadistaSchedules();

    const porteirosEl = document.getElementById('total-porteiros');
    const auxiliaresEl = document.getElementById('total-auxiliares');
    const somEl = document.getElementById('total-som');
    const brigadistaEl = document.getElementById('total-brigadista');
    const escalasEl = document.getElementById('total-escalas');

    if (porteirosEl) porteirosEl.textContent = members.porteiros.length;
    if (auxiliaresEl) auxiliaresEl.textContent = members.auxiliares.length;
    if (somEl) somEl.textContent = (members.som || []).length;
    if (brigadistaEl) brigadistaEl.textContent = (members.brigadista_irmao || []).length + (members.brigadista_irma || []).length;

    // Total de escalas = Porteiros + Som + Brigadista
    const totalEscalas = schedules.length + somSchedules.length + brigadistaSchedules.length;
    if (escalasEl) escalasEl.textContent = totalEscalas;
}

function updateNextServices() {
    const list = document.getElementById('next-services-list');
    if (!list) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextServices = [];

    // Get next 5 services
    for (let i = 0; i < 14 && nextServices.length < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);

        const dayOfWeek = date.getDay();

        if (dayOfWeek === 3) { // Wednesday
            nextServices.push({
                date: date,
                type: 'Quarta - Noite'
            });
        }

        if (dayOfWeek === 0) { // Sunday
            nextServices.push({
                date: date,
                type: 'Domingo - Manhã'
            });
            nextServices.push({
                date: date,
                type: 'Domingo - Noite'
            });
        }
    }

    list.innerHTML = nextServices.slice(0, 5).map(service => `
        <div class="service-item">
            <span class="service-date">${formatDate(service.date)}</span>
            <span class="service-type">${service.type}</span>
        </div>
    `).join('');
}

// ========================================
// SOM SCHEDULE MANAGEMENT
// ========================================

function getSomSchedules() {
    return somSchedulesCache;
}

async function saveSomSchedulesData(schedules) {
    somSchedulesCache = schedules;
    await saveSomSchedulesToDb(schedules);
}

function setupSomYearSelector() {
    const yearSelect = document.getElementById('som-year-select');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 5; year++) {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}

function setSomCurrentMonthYear() {
    const now = new Date();
    const monthSelect = document.getElementById('som-month-select');
    const yearSelect = document.getElementById('som-year-select');

    if (monthSelect) monthSelect.value = now.getMonth();
    if (yearSelect) yearSelect.value = now.getFullYear();
}

function generateSomScheduleForm() {
    const month = parseInt(document.getElementById('som-month-select').value);
    const year = parseInt(document.getElementById('som-year-select').value);

    const members = getMembers();
    const somMembers = members.som || [];

    if (somMembers.length < 1) {
        alert('É necessário ter pelo menos 1 operador de som cadastrado para gerar a escala.');
        return;
    }

    const services = getServiceDays(month, year);

    // Update title
    document.getElementById('som-schedule-title').textContent = `Escala de Som - ${MONTH_NAMES[month]} ${year}`;

    // Generate table rows
    const tbody = document.getElementById('som-schedule-body');
    tbody.innerHTML = '';

    // Check if there's a saved schedule for this month
    const schedules = getSomSchedules();
    const existingSchedule = schedules.find(s => s.month === month && s.year === year);

    services.forEach((service, index) => {
        const dateStr = formatDate(service.date);
        const serviceId = `som-${year}-${month}-${index}`;

        // Get saved values if exist
        let savedData = null;
        if (existingSchedule) {
            savedData = existingSchedule.services.find(s => s.serviceId === serviceId);
        }

        const row = document.createElement('tr');
        row.className = service.cssClass;
        row.innerHTML = `
            <td class="date-cell">${dateStr}</td>
            <td class="culto-cell">${service.type}</td>
            <td>${createMemberSelect('som-operador', serviceId, somMembers, savedData?.operadorSom)}</td>
        `;

        tbody.appendChild(row);
    });

    // Show the form
    document.getElementById('som-schedule-form-container').style.display = 'block';
}

async function saveSomSchedule() {
    const month = parseInt(document.getElementById('som-month-select').value);
    const year = parseInt(document.getElementById('som-year-select').value);

    showLoading('Salvando escala de som...');

    const rows = document.querySelectorAll('#som-schedule-body tr');
    const servicesData = [];

    rows.forEach((row, index) => {
        const serviceId = `som-${year}-${month}-${index}`;
        const dateCell = row.querySelector('.date-cell').textContent;
        const cultoCell = row.querySelector('.culto-cell').textContent;

        servicesData.push({
            serviceId: serviceId,
            date: dateCell,
            type: cultoCell,
            operadorSom: document.getElementById(`som-operador-${serviceId}`)?.value || ''
        });
    });

    const schedules = getSomSchedules();

    // Remove existing schedule for this month if any
    const existingIndex = schedules.findIndex(s => s.month === month && s.year === year);
    if (existingIndex !== -1) {
        schedules.splice(existingIndex, 1);
    }

    // Add new schedule
    schedules.push({
        id: Date.now(),
        month: month,
        year: year,
        monthName: MONTH_NAMES[month],
        services: servicesData,
        createdAt: new Date().toISOString()
    });

    await saveSomSchedulesData(schedules);
    loadSomSchedules();

    hideLoading();
    alert('Escala de som salva com sucesso!');
}

function loadSomSchedules() {
    const schedules = getSomSchedules();
    const list = document.getElementById('saved-som-schedules-list');
    const empty = document.getElementById('som-schedules-empty');

    if (!list) return;

    list.innerHTML = '';

    if (schedules.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';

        // Sort by year and month descending
        schedules.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        schedules.forEach(schedule => {
            list.innerHTML += `
                <div class="schedule-item">
                    <div class="schedule-item-info">
                        <span class="schedule-item-icon">🎤</span>
                        <span class="schedule-item-name">${schedule.monthName} ${schedule.year}</span>
                    </div>
                    <div class="schedule-item-actions">
                        <button class="btn-secondary" onclick="loadSavedSomSchedule(${schedule.month}, ${schedule.year})">
                            📝 Editar
                        </button>
                        <button class="btn-primary" onclick="generateSomPDFForSchedule(${schedule.month}, ${schedule.year})">
                            📄 PDF
                        </button>
                        <button class="btn-danger" onclick="deleteSomSchedule(${schedule.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
    }
}

function loadSavedSomSchedule(month, year) {
    document.getElementById('som-month-select').value = month;
    document.getElementById('som-year-select').value = year;
    generateSomScheduleForm();
}

async function deleteSomSchedule(id) {
    if (!confirm('Tem certeza que deseja excluir esta escala de som?')) {
        return;
    }

    showLoading('Excluindo...');

    let schedules = getSomSchedules();
    schedules = schedules.filter(s => s.id !== id);
    await saveSomSchedulesData(schedules);
    loadSomSchedules();

    hideLoading();
}

function generateSomPDF() {
    const month = parseInt(document.getElementById('som-month-select').value);
    const year = parseInt(document.getElementById('som-year-select').value);
    generateSomPDFForSchedule(month, year);
}

function generateSomPDFForSchedule(month, year) {
    const schedules = getSomSchedules();
    const schedule = schedules.find(s => s.month === month && s.year === year);

    if (!schedule) {
        saveSomSchedule();
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Separar serviços: Domingo Manhã vs outros cultos
    const morningServices = schedule.services.filter(s => s.type.includes('Manhã'));
    const regularServices = schedule.services.filter(s => !s.type.includes('Manhã'));

    // Header
    doc.setFillColor(75, 0, 130); // Roxo
    doc.rect(0, 0, 297, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Congregação Cristã no Brasil', 148.5, 12, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${CHURCH_INFO.city} - ${CHURCH_INFO.neighborhood}`, 148.5, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Escala de Operadores de Som - ${MONTH_NAMES[month]} ${year}`, 148.5, 27, { align: 'center' });

    let currentY = 40;

    // TABELA 1: Cultos Noturnos (Quarta e Domingo Noite)
    if (regularServices.length > 0) {
        doc.setTextColor(75, 0, 130);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('CULTOS NOTURNOS (Quarta e Domingo Noite)', 15, currentY);
        currentY += 5;

        const regularHeaders = [['Data', 'Culto', 'Operador de Som']];
        const regularData = regularServices.map(service => [
            service.date,
            service.type,
            service.operadorSom || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: regularHeaders,
            body: regularData,
            theme: 'grid',
            headStyles: {
                fillColor: [75, 0, 130],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 10,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 80 },
                2: { cellWidth: 100 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 15;
    }

    // TABELA 2: Domingo Manhã
    if (morningServices.length > 0) {
        doc.setTextColor(75, 0, 130);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DOMINGO MANHA (Jovens/Criancas)', 15, currentY);
        currentY += 5;

        const morningHeaders = [['Data', 'Operador de Som']];
        const morningData = morningServices.map(service => [
            service.date,
            service.operadorSom || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: morningHeaders,
            body: morningData,
            theme: 'grid',
            headStyles: {
                fillColor: [75, 0, 130],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 10,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 140 }
            },
            margin: { left: 15, right: 15 }
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        148.5,
        pageHeight - 10,
        { align: 'center' }
    );

    // Save
    const fileName = `Escala_Som_CCB_${MONTH_NAMES[month]}_${year}.pdf`;

    try {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const newWindow = window.open(pdfUrl, '_blank');

        if (!newWindow) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
    }
}

// ========================================
// AI SOM SCHEDULER
// ========================================

function generateAISomSchedule() {
    const month = parseInt(document.getElementById('som-month-select').value);
    const year = parseInt(document.getElementById('som-year-select').value);

    const members = getMembers();
    const somMembers = members.som || [];

    if (somMembers.length < 1) {
        alert('É necessário ter pelo menos 1 operador de som cadastrado para usar a IA.');
        return;
    }

    if (!confirm('A IA vai preencher a escala automaticamente respeitando as disponibilidades. Os dados atuais do formulário serão substituídos. Deseja continuar?')) {
        return;
    }

    showLoading('IA está montando a escala de som...');

    setTimeout(() => {
        try {
            const services = getServiceDays(month, year);

            // Usage counter for load balancing
            const usageCount = {};
            somMembers.forEach(m => { usageCount[m.id] = 0; });

            services.forEach((service, index) => {
                const serviceId = `som-${year}-${month}-${index}`;
                const isWednesday = service.date.getDay() === 3;
                const isSundayMorning = service.date.getDay() === 0 && service.type.includes('Manhã');
                const isSundayNight = service.date.getDay() === 0 && !service.type.includes('Manhã');

                // Filter available operators
                const available = somMembers.filter(m => {
                    if (!m.availability) return true;
                    if (isWednesday && !m.availability.wednesday) return false;
                    if (isSundayMorning && !m.availability.sunday_morning) return false;
                    if (isSundayNight && !m.availability.sunday_night) return false;
                    if (m.oncePerMonth && usageCount[m.id] >= 1) return false;
                    return true;
                });

                if (available.length > 0) {
                    // Shuffle and sort by usage (least used first)
                    available.sort(() => Math.random() - 0.5);
                    available.sort((a, b) => (usageCount[a.id] || 0) - (usageCount[b.id] || 0));

                    const selected = available[0];
                    usageCount[selected.id]++;

                    const selectEl = document.getElementById(`som-operador-${serviceId}`);
                    if (selectEl) {
                        selectEl.value = selected.name;
                    }
                }
            });

            hideLoading();
            alert('Escala de som preenchida com sucesso! Verifique os resultados e salve.');
        } catch (error) {
            console.error(error);
            hideLoading();
            alert('Erro ao gerar escala de som: ' + error.message);
        }
    }, 500);
}

// ========================================
// BRIGADISTA SCHEDULE MANAGEMENT
// ========================================

function getBrigadistaSchedules() {
    return brigadistaSchedulesCache;
}

async function saveBrigadistaSchedulesData(schedules) {
    brigadistaSchedulesCache = schedules;
    await saveBrigadistaSchedulesToDb(schedules);
}

function setupBrigadistaYearSelector() {
    const yearSelect = document.getElementById('brigadista-year-select');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 5; year++) {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}

function setBrigadistaCurrentMonthYear() {
    const now = new Date();
    const monthSelect = document.getElementById('brigadista-month-select');
    const yearSelect = document.getElementById('brigadista-year-select');

    if (monthSelect) monthSelect.value = now.getMonth();
    if (yearSelect) yearSelect.value = now.getFullYear();
}

function generateBrigadistaScheduleForm() {
    const month = parseInt(document.getElementById('brigadista-month-select').value);
    const year = parseInt(document.getElementById('brigadista-year-select').value);

    const members = getMembers();
    const brigadistaIrmaoMembers = members.brigadista_irmao || [];
    const brigadistaIrmaMembers = members.brigadista_irma || [];

    if (brigadistaIrmaoMembers.length < 1 && brigadistaIrmaMembers.length < 1) {
        alert('É necessário ter pelo menos 1 brigadista (irmão ou irmã) cadastrado para gerar a escala.');
        return;
    }

    const services = getServiceDays(month, year);

    document.getElementById('brigadista-schedule-title').textContent = `Escala de Brigadistas - ${MONTH_NAMES[month]} ${year}`;

    const tbody = document.getElementById('brigadista-schedule-body');
    tbody.innerHTML = '';

    const schedules = getBrigadistaSchedules();
    const existingSchedule = schedules.find(s => s.month === month && s.year === year);

    services.forEach((service, index) => {
        const dateStr = formatDate(service.date);
        const serviceId = `${year}-${month}-${index}`;

        let savedData = null;
        if (existingSchedule) {
            savedData = existingSchedule.services.find(s => s.serviceId === serviceId);
        }

        const row = document.createElement('tr');
        row.className = service.cssClass;
        row.innerHTML = `
            <td class="date-cell">${dateStr}</td>
            <td class="culto-cell">${service.type}</td>
            <td>${createMemberSelect('brigadista-irmao', serviceId, brigadistaIrmaoMembers, savedData?.brigadistaIrmao)}</td>
            <td>${createMemberSelect('brigadista-irma', serviceId, brigadistaIrmaMembers, savedData?.brigadistaIrma)}</td>
        `;

        tbody.appendChild(row);
    });

    document.getElementById('brigadista-schedule-form-container').style.display = 'block';
}

async function saveBrigadistaSchedule() {
    const month = parseInt(document.getElementById('brigadista-month-select').value);
    const year = parseInt(document.getElementById('brigadista-year-select').value);

    showLoading('Salvando escala de brigadistas...');

    const rows = document.querySelectorAll('#brigadista-schedule-body tr');
    const servicesData = [];

    rows.forEach((row, index) => {
        const serviceId = `${year}-${month}-${index}`;
        const dateCell = row.querySelector('.date-cell').textContent;
        const cultoCell = row.querySelector('.culto-cell').textContent;

        servicesData.push({
            serviceId: serviceId,
            date: dateCell,
            type: cultoCell,
            brigadistaIrmao: document.getElementById(`brigadista-irmao-${serviceId}`)?.value || '',
            brigadistaIrma: document.getElementById(`brigadista-irma-${serviceId}`)?.value || ''
        });
    });

    const schedules = getBrigadistaSchedules();

    const existingIndex = schedules.findIndex(s => s.month === month && s.year === year);
    if (existingIndex !== -1) {
        schedules.splice(existingIndex, 1);
    }

    schedules.push({
        id: Date.now(),
        month: month,
        year: year,
        monthName: MONTH_NAMES[month],
        services: servicesData,
        createdAt: new Date().toISOString()
    });

    await saveBrigadistaSchedulesData(schedules);
    loadBrigadistaSchedules();

    hideLoading();
    alert('Escala de brigadistas salva com sucesso!');
}

function loadBrigadistaSchedules() {
    const schedules = getBrigadistaSchedules();
    const list = document.getElementById('saved-brigadista-schedules-list');
    const empty = document.getElementById('brigadista-schedules-empty');

    if (!list) return;

    list.innerHTML = '';

    if (schedules.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';

        schedules.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        schedules.forEach(schedule => {
            list.innerHTML += `
                <div class="schedule-item">
                    <div class="schedule-item-info">
                        <span class="schedule-item-icon">🧯</span>
                        <span class="schedule-item-name">${schedule.monthName} ${schedule.year}</span>
                    </div>
                    <div class="schedule-item-actions">
                        <button class="btn-secondary" onclick="loadSavedBrigadistaSchedule(${schedule.month}, ${schedule.year})">
                            📝 Editar
                        </button>
                        <button class="btn-primary" onclick="generateBrigadistaPDFForSchedule(${schedule.month}, ${schedule.year})">
                            📄 PDF
                        </button>
                        <button class="btn-danger" onclick="deleteBrigadistaSchedule(${schedule.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
    }
}

function loadSavedBrigadistaSchedule(month, year) {
    document.getElementById('brigadista-month-select').value = month;
    document.getElementById('brigadista-year-select').value = year;
    generateBrigadistaScheduleForm();
}

async function deleteBrigadistaSchedule(id) {
    if (!confirm('Tem certeza que deseja excluir esta escala de brigadistas?')) {
        return;
    }

    showLoading('Excluindo...');

    let schedules = getBrigadistaSchedules();
    schedules = schedules.filter(s => s.id !== id);
    await saveBrigadistaSchedulesData(schedules);
    loadBrigadistaSchedules();

    hideLoading();
}

function generateBrigadistaPDF() {
    const month = parseInt(document.getElementById('brigadista-month-select').value);
    const year = parseInt(document.getElementById('brigadista-year-select').value);
    generateBrigadistaPDFForSchedule(month, year);
}

function generateBrigadistaPDFForSchedule(month, year) {
    const schedules = getBrigadistaSchedules();
    const schedule = schedules.find(s => s.month === month && s.year === year);

    if (!schedule) {
        saveBrigadistaSchedule();
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    // Header
    doc.setFillColor(220, 53, 69); // Vermelho
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Congregação Cristã no Brasil', 105, 10, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${CHURCH_INFO.city} - ${CHURCH_INFO.neighborhood}`, 105, 17, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Escala de Brigadistas - ${MONTH_NAMES[month]} ${year}`, 105, 24, { align: 'center' });

    let currentY = 40;

    // TABELA 1: Brigadistas (Irmãos)
    const hasIrmaoData = schedule.services.some(s => s.brigadistaIrmao);
    if (hasIrmaoData) {
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ESCALA DOS IRMAOS (Brigadistas)', 15, currentY);
        currentY += 5;

        const irmaoHeaders = [['Data', 'Culto', 'Brigadista (Irmão)']];
        const irmaoData = schedule.services.map(service => [
            service.date,
            service.type,
            service.brigadistaIrmao || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: irmaoHeaders,
            body: irmaoData,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 64, 175],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 70 },
                2: { cellWidth: 60 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // TABELA 2: Brigadistas (Irmãs)
    const hasIrmaData = schedule.services.some(s => s.brigadistaIrma);
    if (hasIrmaData) {
        doc.setTextColor(199, 21, 133);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ESCALA DAS IRMAS (Brigadistas)', 15, currentY);
        currentY += 5;

        const irmaHeaders = [['Data', 'Culto', 'Brigadista (Irmã)']];
        const irmaData = schedule.services.map(service => [
            service.date,
            service.type,
            service.brigadistaIrma || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: irmaHeaders,
            body: irmaData,
            theme: 'grid',
            headStyles: {
                fillColor: [199, 21, 133],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center',
                fillColor: [255, 240, 245]
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 70 },
                2: { cellWidth: 60 }
            },
            margin: { left: 15, right: 15 }
        });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        105,
        pageHeight - 10,
        { align: 'center' }
    );

    // Save
    const fileName = `Escala_Brigadistas_CCB_${MONTH_NAMES[month]}_${year}.pdf`;

    try {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const newWindow = window.open(pdfUrl, '_blank');

        if (!newWindow) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
    }
}

// ========================================
// AI BRIGADISTA SCHEDULER
// ========================================

function generateAIBrigadistaSchedule() {
    const month = parseInt(document.getElementById('brigadista-month-select').value);
    const year = parseInt(document.getElementById('brigadista-year-select').value);

    const members = getMembers();
    const brigadistaIrmaoMembers = members.brigadista_irmao || [];
    const brigadistaIrmaMembers = members.brigadista_irma || [];

    if (brigadistaIrmaoMembers.length < 1 && brigadistaIrmaMembers.length < 1) {
        alert('É necessário ter pelo menos 1 brigadista (irmão ou irmã) cadastrado para usar a IA.');
        return;
    }

    if (!confirm('A IA vai preencher a escala automaticamente respeitando as disponibilidades. Os dados atuais do formulário serão substituídos. Deseja continuar?')) {
        return;
    }

    showLoading('IA está montando a escala de brigadistas...');

    setTimeout(() => {
        try {
            const services = getServiceDays(month, year);

            // Usage counters for load balancing
            const irmaoUsage = {};
            const irmaUsage = {};

            brigadistaIrmaoMembers.forEach(m => { irmaoUsage[m.id] = 0; });
            brigadistaIrmaMembers.forEach(m => { irmaUsage[m.id] = 0; });

            services.forEach((service, index) => {
                const serviceId = `${year}-${month}-${index}`;
                const isWednesday = service.date.getDay() === 3;
                const isSundayMorning = service.date.getDay() === 0 && service.type.includes('Manhã');
                const isSundayNight = service.date.getDay() === 0 && !service.type.includes('Manhã');

                // Select Irmão brigadista
                if (brigadistaIrmaoMembers.length > 0) {
                    const availableIrmaos = brigadistaIrmaoMembers.filter(m => {
                        if (!m.availability) return true;
                        if (isWednesday && !m.availability.wednesday) return false;
                        if (isSundayMorning && !m.availability.sunday_morning) return false;
                        if (isSundayNight && !m.availability.sunday_night) return false;
                        if (m.oncePerMonth && irmaoUsage[m.id] >= 1) return false;
                        return true;
                    });

                    if (availableIrmaos.length > 0) {
                        // Shuffle and sort by usage (least used first)
                        availableIrmaos.sort(() => Math.random() - 0.5);
                        availableIrmaos.sort((a, b) => (irmaoUsage[a.id] || 0) - (irmaoUsage[b.id] || 0));

                        const selected = availableIrmaos[0];
                        irmaoUsage[selected.id]++;

                        const selectEl = document.getElementById(`brigadista-irmao-${serviceId}`);
                        if (selectEl) {
                            selectEl.value = selected.name;
                        }
                    }
                }

                // Select Irmã brigadista
                if (brigadistaIrmaMembers.length > 0) {
                    const availableIrmas = brigadistaIrmaMembers.filter(m => {
                        if (!m.availability) return true;
                        if (isWednesday && !m.availability.wednesday) return false;
                        if (isSundayMorning && !m.availability.sunday_morning) return false;
                        if (isSundayNight && !m.availability.sunday_night) return false;
                        if (m.oncePerMonth && irmaUsage[m.id] >= 1) return false;
                        return true;
                    });

                    if (availableIrmas.length > 0) {
                        // Shuffle and sort by usage (least used first)
                        availableIrmas.sort(() => Math.random() - 0.5);
                        availableIrmas.sort((a, b) => (irmaUsage[a.id] || 0) - (irmaUsage[b.id] || 0));

                        const selected = availableIrmas[0];
                        irmaUsage[selected.id]++;

                        const selectEl = document.getElementById(`brigadista-irma-${serviceId}`);
                        if (selectEl) {
                            selectEl.value = selected.name;
                        }
                    }
                }
            });

            hideLoading();
            alert('Escala de brigadistas preenchida com sucesso! Verifique os resultados e salve.');
        } catch (error) {
            console.error(error);
            hideLoading();
            alert('Erro ao gerar escala de brigadistas: ' + error.message);
        }
    }, 500);
}

// ========================================
// GLOBAL FUNCTIONS (for onclick handlers)
// ========================================

window.switchTab = switchTab;
window.removeMember = removeMember;
window.generateScheduleForm = generateScheduleForm;
window.saveSchedule = saveSchedule;
window.generatePDF = generatePDF;
window.generatePDFForSchedule = generatePDFForSchedule;
window.generatePDFPorteirosBtn = generatePDFPorteirosBtn;
window.generatePDFAuxiliaresBtn = generatePDFAuxiliaresBtn;
window.loadSavedSchedule = loadSavedSchedule;
window.deleteSchedule = deleteSchedule;
window.showLoginForm = showLoginForm;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;

// Som functions
window.generateSomScheduleForm = generateSomScheduleForm;
window.saveSomSchedule = saveSomSchedule;
window.generateSomPDF = generateSomPDF;
window.generateSomPDFForSchedule = generateSomPDFForSchedule;
window.loadSavedSomSchedule = loadSavedSomSchedule;
window.deleteSomSchedule = deleteSomSchedule;
window.generateAISomSchedule = generateAISomSchedule;

// Brigadista functions
window.generateBrigadistaScheduleForm = generateBrigadistaScheduleForm;
window.saveBrigadistaSchedule = saveBrigadistaSchedule;
window.generateBrigadistaPDF = generateBrigadistaPDF;
window.generateBrigadistaPDFForSchedule = generateBrigadistaPDFForSchedule;
window.loadSavedBrigadistaSchedule = loadSavedBrigadistaSchedule;
window.deleteBrigadistaSchedule = deleteBrigadistaSchedule;
window.generateAIBrigadistaSchedule = generateAIBrigadistaSchedule;
