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
let membersCache = { porteiros: [], auxiliares: [] };
let schedulesCache = [];

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
        loadMembers();
        loadSchedules();
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
        name: name
    };

    if (type === 'porteiro') {
        members.porteiros.push(newMember);
    } else {
        members.auxiliares.push(newMember);
    }

    await saveMembers(members);
    loadMembers();
    updateDashboard();

    hideLoading();

    // Reset form
    nameInput.value = '';
    typeSelect.value = '';
    nameInput.focus();
}

async function removeMember(type, id) {
    if (!confirm('Tem certeza que deseja remover este membro?')) {
        return;
    }

    showLoading('Removendo...');

    const members = getMembers();

    if (type === 'porteiro') {
        members.porteiros = members.porteiros.filter(m => m.id !== id);
    } else {
        members.auxiliares = members.auxiliares.filter(m => m.id !== id);
    }

    await saveMembers(members);
    loadMembers();
    updateDashboard();

    hideLoading();
}

function loadMembers() {
    const members = getMembers();

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

    for (let year = currentYear; year <= currentYear + 2; year++) {
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
// PDF GENERATION
// ========================================

function generatePDF() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);

    generatePDFForSchedule(month, year);
}

function generatePDFForSchedule(month, year) {
    const schedules = getSchedules();
    const schedule = schedules.find(s => s.month === month && s.year === year);

    if (!schedule) {
        // Try to get current form data
        saveSchedule();
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 297, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Congregação Cristã no Brasil', 148.5, 12, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${CHURCH_INFO.city} - ${CHURCH_INFO.neighborhood}`, 148.5, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Escala de Porteiros e Auxiliares da Porta - ${MONTH_NAMES[month]} ${year}`, 148.5, 27, { align: 'center' });

    // Table
    const tableData = schedule.services.map(service => [
        service.date,
        service.type,
        service.porteiroPrincipal || '-',
        service.porteiroLateral || '-',
        service.auxiliarPrincipal || '-',
        service.auxiliarLateral || '-'
    ]);

    doc.autoTable({
        startY: 35,
        head: [[
            'Data',
            'Culto',
            'Porteiro Principal',
            'Porteiro Lateral',
            'Auxiliar Principal',
            'Auxiliar Lateral'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 64, 175],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8,
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 50 },
            2: { cellWidth: 45 },
            3: { cellWidth: 45 },
            4: { cellWidth: 45 },
            5: { cellWidth: 45 }
        },
        margin: { left: 15, right: 15 }
    });

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

    // Save with proper blob download to ensure .pdf extension
    const fileName = `Escala_CCB_${MONTH_NAMES[month]}_${year}.pdf`;

    // Try multiple methods for download
    try {
        // Method 1: For file:// protocol, open in new window with save dialog
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Create a new window with the PDF
        const newWindow = window.open(pdfUrl, '_blank');

        if (newWindow) {
            // Show alert with save instructions
            alert(`📄 O PDF foi aberto em uma nova aba!\n\nPara salvar:\n1. Clique com botão direito → "Salvar como"\n2. Ou use Ctrl+S\n\n💡 Salve como: ${fileName}`);
        } else {
            // Popup blocked, try alternative
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert(`📄 PDF gerado!\n\nSe o arquivo foi baixado sem nome:\n1. Vá na pasta Downloads\n2. Renomeie o arquivo para:\n${fileName}`);
        }

        // Cleanup URL after delay
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
}

// ========================================
// DASHBOARD
// ========================================

function updateDashboard() {
    const members = getMembers();
    const schedules = getSchedules();

    const porteirosEl = document.getElementById('total-porteiros');
    const auxiliaresEl = document.getElementById('total-auxiliares');
    const escalasEl = document.getElementById('total-escalas');

    if (porteirosEl) porteirosEl.textContent = members.porteiros.length;
    if (auxiliaresEl) auxiliaresEl.textContent = members.auxiliares.length;
    if (escalasEl) escalasEl.textContent = schedules.length;
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
// GLOBAL FUNCTIONS (for onclick handlers)
// ========================================

window.switchTab = switchTab;
window.removeMember = removeMember;
window.generateScheduleForm = generateScheduleForm;
window.saveSchedule = saveSchedule;
window.generatePDF = generatePDF;
window.generatePDFForSchedule = generatePDFForSchedule;
window.loadSavedSchedule = loadSavedSchedule;
window.deleteSchedule = deleteSchedule;
window.showLoginForm = showLoginForm;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
