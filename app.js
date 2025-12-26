// =================================================================
// CONFIGURATION : REMPLACEZ PAR VOTRE URL GOOGLE APPS SCRIPT
// =================================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwP1CWXgGqlX-lmZGU5Px0rJ-aKxhmflW4V9oFMsC_b6cTzDtqzAxv4UMW5PWk6b0HJcw/exec"; 

// =================================================================
// LOGIQUE DU DASHBOARD (dashboard.html)
// =================================================================

async function fetchStats() {
    try {
        // On demande les stats au script Google
        const response = await fetch(`${SCRIPT_URL}?action=stats`);
        const stats = await response.json();
        
        document.getElementById('stat-views').innerText = stats.totalViews;
        document.getElementById('stat-ips').innerText = stats.uniqueIps;
    } catch (error) {
        console.error("Erreur de stats:", error);
    }
}

async function fetchData() {
    const table = document.getElementById('dataTable');
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');

    fetchStats(); 

    loading.innerText = "Chargement des données depuis Google Sheets...";
    loading.style.display = 'block';
    table.style.display = 'none';
    
    const searchValue = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;

    try {
        // Récupération des données via GET sur Google Script
        const response = await fetch(SCRIPT_URL);
        let data = await response.json();

        // Filtrage identique à la version précédente
        data = data.filter(row => {
            if (statusValue !== 'all' && row.statut !== statusValue) return false;
            if (priorityValue !== 'all' && row.priorite !== priorityValue) return false;
            if (searchValue && 
                !row.nom.toLowerCase().includes(searchValue) &&
                !row.email.toLowerCase().includes(searchValue) &&
                !row.sujet.toLowerCase().includes(searchValue) &&
                !row.service.toLowerCase().includes(searchValue) &&
                !row.message.toLowerCase().includes(searchValue)
            ) return false;
            return true;
        });

        document.getElementById('count-total').innerText = data.length;
        document.getElementById('count-new').innerText = data.filter(r => r.statut === 'Nouveau').length;
        document.getElementById('count-done').innerText = data.filter(r => r.statut === 'Traitée').length;

        tbody.innerHTML = '';
        if (data.length === 0) {
            loading.innerText = "Aucune demande trouvée.";
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            const badgeClass = `badge-${row.statut.replace(/[^a-zA-Z]/g, '')}`;
            const prioClass = `prio-${row.priorite.replace(/[^a-zA-Z]/g, '')}`;

            let actionsHtml = '';
            if (row.statut === 'Nouveau') {
                actionsHtml += `<button class="action-button" onclick="updateStatus('${row.id}', 'Traitée')">Marquer Traitée</button>`;
            } else if (row.statut === 'Traitée') {
                actionsHtml += `<button class="action-button" onclick="updateStatus('${row.id}', 'Archivée')">Archiver</button>`;
            } else if (row.statut === 'Archivée') {
                actionsHtml += `<button class="action-button" onclick="updateStatus('${row.id}', 'Nouveau')">Ré-ouvrir</button>`;
            }
            actionsHtml += `<button class="action-button delete-button" onclick="deleteRequest('${row.id}')" style="background: var(--danger); margin-top: 10px;">Supprimer</button>`;
            
            const prioritySelectHtml = `
                <select class="priority-select ${prioClass}" onchange="updatePriority('${row.id}', this.value)">
                    <option value="Haute" ${row.priorite === 'Haute' ? 'selected' : ''}>Haute</option>
                    <option value="Moyenne" ${row.priorite === 'Moyenne' ? 'selected' : ''}>Moyenne</option>
                    <option value="Basse" ${row.priorite === 'Basse' ? 'selected' : ''}>Basse</option>
                </select>`;

            const statutCell = row.statut === 'Traitée' && row.date_traitement 
                ? `<span class="badge ${badgeClass}">${row.statut}</span><div style="font-size:0.75rem; color:var(--text-light); margin-top:5px;">(le ${row.date_traitement})</div>`
                : `<span class="badge ${badgeClass}">${row.statut}</span>`;

            tr.innerHTML = `
                <td style="color: #64748b; font-size: 0.9rem;">${row.date}</td>
                <td style="font-weight: 600;">${row.nom}</td>
                <td style="font-size: 0.9rem;">
                    <div>📧 <a href="mailto:${row.email}">${row.email}</a></div>
                    <div>📱 ${row.telephone}</div>
                </td>
                <td>
                    <div style="font-weight:600; color:var(--primary); margin-bottom:5px;">${row.service} - ${row.sujet}</div>
                    <div style="color: #475569; font-size: 0.9rem;">${row.message}</div>
                </td>
                <td>${prioritySelectHtml}</td>
                <td>${statutCell}</td>
                <td>${actionsHtml}</td>`;
            tbody.appendChild(tr);
        });

        loading.style.display = 'none';
        table.style.display = 'table';
    } catch (error) {
        console.error("Erreur:", error);
        loading.innerText = "Erreur de connexion à Google Sheets.";
    }
}

async function updateStatus(id, newStatus) {
    if (!confirm(`Changer le statut à "${newStatus}" ?`)) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'update', id: id, statut: newStatus })
        });
        fetchData(); 
    } catch (error) { alert("Erreur de mise à jour"); }
}

async function updatePriority(id, newPriority) {
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'update', id: id, priorite: newPriority })
        });
        fetchData(); 
    } catch (error) { alert("Erreur de priorité"); }
}

async function deleteRequest(id) {
    if (!confirm(`Supprimer définitivement la demande ?`)) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: id })
        });
        fetchData(); 
    } catch (error) { alert("Erreur de suppression"); }
}

function exportCSV() {
    // Pour Google Sheets, on redirige vers l'export CSV natif de Google ou l'URL du script
    window.open(SCRIPT_URL + "?action=export");
}

// =================================================================
// LOGIQUE DU FORMULAIRE (index.html)
// =================================================================

function validateForm() {
    const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
    let isValid = true;
    ['nom', 'email', 'sujet', 'service', 'message'].forEach(id => {
        const input = document.getElementById(id);
        const group = input.closest('.form-group');
        if (!input.value.trim() || (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value))) {
            group.classList.add('error');
            isValid = false;
        } else { group.classList.remove('error'); }
    });
    return isValid;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.URL.includes('dashboard.html')) {
        fetchData();
        document.getElementById('searchInput').addEventListener('input', fetchData);
        document.getElementById('statusFilter').addEventListener('change', fetchData);
        document.getElementById('priorityFilter').addEventListener('change', fetchData);
    }
    
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            if (!validateForm()) return;

            const btn = this.querySelector('button');
            btn.innerText = "Envoi...";
            btn.disabled = true;

            const formData = {
                action: 'submit',
                nom: document.getElementById('nom').value,
                email: document.getElementById('email').value,
                telephone: document.getElementById('telephone').value,
                sujet: document.getElementById('sujet').value,
                service: document.getElementById('service').value,
                message: document.getElementById('message').value
            };

            try {
                // Envoi vers Google Script (POST)
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Important pour éviter les erreurs CORS avec Google Apps Script
                    body: JSON.stringify(formData)
                });
                alert("✅ Demande envoyée !");
                this.reset();
            } catch (error) {
                alert("Erreur lors de l'envoi.");
            } finally {
                btn.innerText = "Envoyer la demande";
                btn.disabled = false;
            }
        });
    }
});


