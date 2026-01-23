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
let membersCache = { porteiros: [], auxiliares: [], som: [] };
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

    // Setup Som tab
    setupSomYearSelector();
    setSomCurrentMonthYear();

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
        loadMembers();
        loadSchedules();
        loadSomSchedules();
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
        }
    };

    if (type === 'porteiro') {
        members.porteiros.push(newMember);
    } else if (type === 'auxiliar') {
        members.auxiliares.push(newMember);
    } else if (type === 'som') {
        if (!members.som) members.som = [];
        members.som.push(newMember);
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
    } else if (type === 'auxiliar') {
        members.auxiliares = members.auxiliares.filter(m => m.id !== id);
    } else if (type === 'som') {
        if (members.som) {
            members.som = members.som.filter(m => m.id !== id);
        }
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

    // Separar serviços: Domingo Manhã vs outros cultos
    const morningServices = schedule.services.filter(s => s.type.includes('Manhã'));
    const regularServices = schedule.services.filter(s => !s.type.includes('Manhã'));

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

    let currentY = 35;

    // =====================================================
    // TABELA 1: IRMÃOS (Porteiros) - Cultos Regulares
    // =====================================================
    if (regularServices.length > 0) {
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ESCALA DOS IRMAOS (Porteiros)', 15, currentY);
        currentY += 5;

        const irmãosHeaders = [['Data', 'Culto', 'Porteiro Principal', 'Porteiro Lateral']];
        const irmãosData = regularServices.map(service => [
            service.date,
            service.type,
            service.porteiroPrincipal || '-',
            service.porteiroLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: irmãosHeaders,
            body: irmãosData,
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
                0: { cellWidth: 45 },
                1: { cellWidth: 55 },
                2: { cellWidth: 60 },
                3: { cellWidth: 60 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // =====================================================
    // TABELA 2: IRMÃS (Auxiliares da Porta) - Cultos Regulares
    // =====================================================
    if (regularServices.length > 0) {
        doc.setTextColor(199, 21, 133); // Rosa escuro
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ESCALA DAS IRMAS (Auxiliares da Porta)', 15, currentY);
        currentY += 5;

        const irmãsHeaders = [['Data', 'Culto', 'Auxiliar Principal', 'Auxiliar Lateral']];
        const irmãsData = regularServices.map(service => [
            service.date,
            service.type,
            service.auxiliarPrincipal || '-',
            service.auxiliarLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: irmãsHeaders,
            body: irmãsData,
            theme: 'grid',
            headStyles: {
                fillColor: [199, 21, 133], // Rosa escuro
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center',
                fillColor: [255, 240, 245] // Rosa bem claro
            },
            columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 55 },
                2: { cellWidth: 60 },
                3: { cellWidth: 60 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // =====================================================
    // TABELA 3: DOMINGO MANHÃ - IRMÃOS (Porteiros)
    // =====================================================
    if (morningServices.length > 0) {
        // Verificar se precisa de nova página
        if (currentY > 160) {
            doc.addPage();
            currentY = 20;
        }

        doc.setTextColor(30, 64, 175); // Azul
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DOMINGO MANHA - IRMAOS (Porteiros)', 15, currentY);
        currentY += 5;

        const morningIrmaosHeaders = [['Data', 'Porteiro Principal', 'Porteiro Lateral']];
        const morningIrmaosData = morningServices.map(service => [
            service.date,
            service.porteiroPrincipal || '-',
            service.porteiroLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: morningIrmaosHeaders,
            body: morningIrmaosData,
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
                0: { cellWidth: 55 },
                1: { cellWidth: 70 },
                2: { cellWidth: 70 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // =====================================================
    // TABELA 4: DOMINGO MANHÃ - IRMÃS (Auxiliares)
    // =====================================================
    if (morningServices.length > 0) {
        // Verificar se precisa de nova página
        if (currentY > 160) {
            doc.addPage();
            currentY = 20;
        }

        doc.setTextColor(199, 21, 133); // Rosa escuro
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DOMINGO MANHA - IRMAS (Auxiliares da Porta)', 15, currentY);
        currentY += 5;

        const morningIrmasHeaders = [['Data', 'Auxiliar Principal', 'Auxiliar Lateral']];
        const morningIrmasData = morningServices.map(service => [
            service.date,
            service.auxiliarPrincipal || '-',
            service.auxiliarLateral || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: morningIrmasHeaders,
            body: morningIrmasData,
            theme: 'grid',
            headStyles: {
                fillColor: [199, 21, 133], // Rosa escuro
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center',
                fillColor: [255, 240, 245] // Rosa bem claro
            },
            columnStyles: {
                0: { cellWidth: 55 },
                1: { cellWidth: 70 },
                2: { cellWidth: 70 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // =====================================================
    // TABELA 5: SOM - CULTOS NOTURNOS (Quarta e Domingo Noite)
    // =====================================================
    if (regularServices.length > 0) {
        // Verificar se precisa de nova página
        if (currentY > 160) {
            doc.addPage();
            currentY = 20;
        }

        doc.setTextColor(75, 0, 130); // Roxo
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OPERADORES DE SOM - CULTOS NOTURNOS', 15, currentY);
        currentY += 5;

        const somNoturnoHeaders = [['Data', 'Culto', 'Operador de Som']];
        const somNoturnoData = regularServices.map(service => [
            service.date,
            service.type,
            service.operadorSom || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: somNoturnoHeaders,
            body: somNoturnoData,
            theme: 'grid',
            headStyles: {
                fillColor: [75, 0, 130], // Roxo
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
                0: { cellWidth: 55 },
                1: { cellWidth: 70 },
                2: { cellWidth: 80 }
            },
            margin: { left: 15, right: 15 }
        });

        currentY = doc.lastAutoTable.finalY + 12;
    }

    // =====================================================
    // TABELA 6: SOM - DOMINGO MANHÃ
    // =====================================================
    if (morningServices.length > 0) {
        // Verificar se precisa de nova página
        if (currentY > 160) {
            doc.addPage();
            currentY = 20;
        }

        doc.setTextColor(75, 0, 130); // Roxo
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OPERADORES DE SOM - DOMINGO MANHA', 15, currentY);
        currentY += 5;

        const somManhaHeaders = [['Data', 'Operador de Som']];
        const somManhaData = morningServices.map(service => [
            service.date,
            service.operadorSom || '-'
        ]);

        doc.autoTable({
            startY: currentY,
            head: somManhaHeaders,
            body: somManhaData,
            theme: 'grid',
            headStyles: {
                fillColor: [75, 0, 130], // Roxo
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
                0: { cellWidth: 80 },
                1: { cellWidth: 100 }
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

    // Save with proper blob download to ensure .pdf extension
    const fileName = `Escala_CCB_${MONTH_NAMES[month]}_${year}.pdf`;

    // Try multiple methods for download
    try {
        // Method 1: For file:// protocol, open in new window with save dialog
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Create a new window with the PDF
        const newWindow = window.open(pdfUrl, '_blank');

        if (!newWindow) {
            // Popup blocked, try alternative download
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Cleanup URL after delay
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
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
    const somEl = document.getElementById('total-som');
    const escalasEl = document.getElementById('total-escalas');

    if (porteirosEl) porteirosEl.textContent = members.porteiros.length;
    if (auxiliaresEl) auxiliaresEl.textContent = members.auxiliares.length;
    if (somEl) somEl.textContent = (members.som || []).length;
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
// SOM SCHEDULE MANAGEMENT
// ========================================

let somSchedulesCache = [];

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

// Som functions
window.generateSomScheduleForm = generateSomScheduleForm;
window.saveSomSchedule = saveSomSchedule;
window.generateSomPDF = generateSomPDF;
window.generateSomPDFForSchedule = generateSomPDFForSchedule;
window.loadSavedSomSchedule = loadSavedSomSchedule;
window.deleteSomSchedule = deleteSomSchedule;
