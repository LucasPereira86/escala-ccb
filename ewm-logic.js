
// ========================================
// EWM SEARCH LOGIC
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    setupEWMListeners();
});

function setupEWMListeners() {
    const ewmSearchInput = document.getElementById('ewm-search-input');

    if (ewmSearchInput) {
        ewmSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.trim().toUpperCase();
            searchEWM(term);
        });
    }
}

function searchEWM(term) {
    const ewmResultsBody = document.getElementById('ewm-results-body');
    const ewmResultsCount = document.getElementById('ewm-results-count');

    if (!ewmResultsBody || !ewmResultsCount) return;

    if (typeof EWM_DATA === 'undefined') {
        ewmResultsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red; padding: 20px;">Dados carregando ou indisponíveis...</td></tr>';
        return;
    }

    if (!term || term.length < 2) {
        ewmResultsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Digite pelo menos 2 caracteres para buscar.</td></tr>';
        ewmResultsCount.textContent = 'Aguardando digitação...';
        return;
    }

    const results = EWM_DATA.filter(item => {
        if (!item) return false;
        // Search in material code, text description, or old material number
        return (item.material && item.material.includes(term)) ||
            (item.texto && item.texto.includes(term)) ||
            (item.antigo && item.antigo.includes(term));
    }).slice(0, 50); // Limit results for performance

    if (results.length === 0) {
        ewmResultsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum material encontrado.</td></tr>';
        ewmResultsCount.textContent = 'Nenhum resultado encontrado.';
    } else {
        ewmResultsCount.textContent = `Exibindo ${results.length} resultados encontrados.`;
        ewmResultsBody.innerHTML = results.map(item => `
            <tr>
                <td style="font-weight: bold;">${item.material || ''}</td>
                <td>${item.tipo || ''}</td>
                <td>${item.antigo || ''}</td>
                <td style="text-align: center;">${item.unidade || ''}</td>
                <td>${item.texto || ''}</td>
            </tr>
        `).join('');
    }
}
