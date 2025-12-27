/* ========================================
   FIREBASE CONFIGURATION
   Escala CCB - Congregação Cristã no Brasil
   ======================================== */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAthMf4xEznaz7TRo-U36Je7UsNxOHe_q8",
    authDomain: "escala-ccb.firebaseapp.com",
    databaseURL: "https://escala-ccb-default-rtdb.firebaseio.com",
    projectId: "escala-ccb",
    storageBucket: "escala-ccb.firebasestorage.app",
    messagingSenderId: "446919518418",
    appId: "1:446919518418:web:35ed5dc07a153b9f2c250b",
    measurementId: "G-1NGBPJHNGQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references
const auth = firebase.auth();
const database = firebase.database();

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

// Current user
let currentUser = null;

// Check auth state on load
auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        console.log('Usuário logado:', user.email);
        hideLoginScreen();
        initApp();
    } else {
        console.log('Usuário não logado');
        showLoginScreen();
    }
});

// Show login screen
function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

// Hide login screen
function hideLoginScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

// Register new user
async function registerUser(email, password) {
    try {
        showLoading('Criando conta...');
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        hideLoading();
        return { success: true, user: userCredential.user };
    } catch (error) {
        hideLoading();
        console.error('Erro ao registrar:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

// Login user
async function loginUser(email, password) {
    try {
        showLoading('Entrando...');
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        hideLoading();
        return { success: true, user: userCredential.user };
    } catch (error) {
        hideLoading();
        console.error('Erro ao logar:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

// Logout user
async function logoutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Erro ao sair:', error);
        return { success: false, error: error.message };
    }
}

// Get friendly error messages
function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Este email já está cadastrado.',
        'auth/invalid-email': 'Email inválido.',
        'auth/operation-not-allowed': 'Operação não permitida.',
        'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
        'auth/user-disabled': 'Esta conta foi desativada.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'Email ou senha incorretos.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento.'
    };
    return messages[code] || 'Erro desconhecido. Tente novamente.';
}

// ========================================
// DATABASE FUNCTIONS
// ========================================

// Get shared data path (all users see same data)
function getDataPath() {
    // All users share the same church data
    // Only logged in users can access
    if (!currentUser) return null;
    return 'church_data';
}

// Save members to database
async function saveMembersToDb(members) {
    const path = getDataPath();
    if (!path) return false;

    try {
        await database.ref(`${path}/members`).set(members);
        return true;
    } catch (error) {
        console.error('Erro ao salvar membros:', error);
        return false;
    }
}

// Load members from database
async function loadMembersFromDb() {
    const path = getDataPath();
    if (!path) return { porteiros: [], auxiliares: [], som: [] };

    try {
        const snapshot = await database.ref(`${path}/members`).once('value');
        const data = snapshot.val();
        return data || { porteiros: [], auxiliares: [], som: [] };
    } catch (error) {
        console.error('Erro ao carregar membros:', error);
        return { porteiros: [], auxiliares: [] };
    }
}

// Save schedules to database
async function saveSchedulesToDb(schedules) {
    const path = getDataPath();
    if (!path) return false;

    try {
        await database.ref(`${path}/schedules`).set(schedules);
        return true;
    } catch (error) {
        console.error('Erro ao salvar escalas:', error);
        return false;
    }
}

// Load schedules from database
async function loadSchedulesFromDb() {
    const path = getDataPath();
    if (!path) return [];

    try {
        const snapshot = await database.ref(`${path}/schedules`).once('value');
        const data = snapshot.val();
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar escalas:', error);
        return [];
    }
}

// Save SOM schedules to database
async function saveSomSchedulesToDb(schedules) {
    const path = getDataPath();
    if (!path) return false;

    try {
        await database.ref(`${path}/som_schedules`).set(schedules);
        return true;
    } catch (error) {
        console.error('Erro ao salvar escalas de som:', error);
        return false;
    }
}

// Load SOM schedules from database
async function loadSomSchedulesFromDb() {
    const path = getDataPath();
    if (!path) return [];

    try {
        const snapshot = await database.ref(`${path}/som_schedules`).once('value');
        const data = snapshot.val();
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar escalas de som:', error);
        return [];
    }
}

// ========================================
// UI HELPERS
// ========================================

function showLoading(message = 'Carregando...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
        text.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showError(message) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

function hideError() {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

// ========================================
// EXPOSE FUNCTIONS GLOBALLY
// ========================================

window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.saveMembersToDb = saveMembersToDb;
window.loadMembersFromDb = loadMembersFromDb;
window.saveSchedulesToDb = saveSchedulesToDb;
window.loadSchedulesFromDb = loadSchedulesFromDb;
window.saveSomSchedulesToDb = saveSomSchedulesToDb;
window.loadSomSchedulesFromDb = loadSomSchedulesFromDb;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showError = showError;
window.hideError = hideError;
