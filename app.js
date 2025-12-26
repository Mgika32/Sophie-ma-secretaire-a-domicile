// =================================================================
// LOGIQUE DU DASHBOARD (dashboard.html)
// =================================================================

// Fonction pour récupérer les statistiques de trafic
async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        document.getElementById('stat-views').innerText = stats.totalViews;
        document.getElementById('stat-ips').innerText = stats.uniqueIps;

    } catch (error) {
        console.error("Erreur de stats de trafic:", error);
    }
}

// Fonction principale pour récupérer et afficher les données du tableau
async function fetchData() {
    const table = document.getElementById('dataTable');
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');

    fetchStats(); 

    loading.innerText = "Chargement des données...";
    loading.style.display = 'block';
    table.style.display = 'none';
    
    // Récupérer les valeurs de filtre/recherche
    const searchValue = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;

    try {
        const response = await fetch('/api/data');
        let data = await response.json();

        // --- Application des Filtres et Recherche ---
        data = data.filter(row => {
            // Filtre par Statut
            if (statusValue !== 'all' && row.statut !== statusValue) {
                return false;
            }
            // Filtre par Priorité
            if (priorityValue !== 'all' && row.priorite !== priorityValue) {
                return false;
            }
            // Recherche par texte
            if (searchValue && 
                !row.nom.toLowerCase().includes(searchValue) &&
                !row.email.toLowerCase().includes(searchValue) &&
                !row.sujet.toLowerCase().includes(searchValue) &&
                !row.service.toLowerCase().includes(searchValue) &&
                !row.message.toLowerCase().includes(searchValue)
            ) {
                return false;
            }
            return true;
        });

        // Calcul et mise à jour des stats de demandes
        const countNew = data.filter(row => row.statut === 'Nouveau').length;
        const countDone = data.filter(row => row.statut === 'Traitée').length;

        document.getElementById('count-total').innerText = data.length;
        document.getElementById('count-new').innerText = countNew;
        document.getElementById('count-done').innerText = countDone;

        tbody.innerHTML = '';

        if (data.length === 0) {
            loading.innerText = "Aucune demande trouvée avec ces filtres.";
            return;
        }

        // Remplir le tableau
        data.forEach(row => {
            const tr = document.createElement('tr');
            
            const badgeClass = `badge-${row.statut.replace(/[^a-zA-Z]/g, '')}`;
            const prioClass = `prio-${row.priorite.replace(/[^a-zA-Z]/g, '')}`;

            let actionsHtml = '';
            
            // Boutons d'action statut
            if (row.statut === 'Nouveau') {
                actionsHtml += `<button class="action-button" onclick="updateStatus('${row.id}', 'Traitée')">Marquer Traitée</button>`;
            } else if (row.statut === 'Traitée') {
                actionsHtml += `<button class="action-button" onclick="updateStatus('${row.id}', 'Archivée')">Archiver</button>`;
            } else if (row.statut === 'Archivée') {
                actionsHtml += `<button class="action-button" onclick="updateStatus('${row.id}', 'Nouveau')">Ré-ouvrir</button>`;
            }
            
            // Bouton de suppression
            actionsHtml += `<button class="action-button delete-button" onclick="deleteRequest('${row.id}')" style="background: var(--danger); margin-top: 10px;">Supprimer</button>`;
            
            // Sélecteur de Priorité
            const prioritySelectHtml = `
                <select class="priority-select ${prioClass}" onchange="updatePriority('${row.id}', this.value)">
                    <option value="Haute" ${row.priorite === 'Haute' ? 'selected' : ''} class="prio-Haute">Haute</option>
                    <option value="Moyenne" ${row.priorite === 'Moyenne' ? 'selected' : ''} class="prio-Moyenne">Moyenne</option>
                    <option value="Basse" ${row.priorite === 'Basse' ? 'selected' : ''} class="prio-Basse">Basse</option>
                </select>
            `;
            
            // Affichage de la date de traitement si elle existe
            const statutCell = row.statut === 'Traitée' && row.date_traitement 
                ? `<span class="badge ${badgeClass}">${row.statut}</span><div style="font-size:0.75rem; color:var(--text-light); margin-top:5px;">(Traité le ${row.date_traitement})</div>`
                : `<span class="badge ${badgeClass}">${row.statut}</span>`;


            tr.innerHTML = `
                <td style="color: #64748b; font-size: 0.9rem;">${row.date}</td>
                <td style="font-weight: 600;">${row.nom}</td>
                <td style="font-size: 0.9rem;">
                    <div style="margin-bottom:2px;">📧 <a href="mailto:${row.email}">${row.email}</a></div>
                    <div>📱 ${row.telephone}</div>
                </td>
                <td>
                    <div style="font-weight:600; color:var(--primary); margin-bottom:5px;">${row.service} - ${row.sujet}</div>
                    <div style="color: #475569; font-size: 0.9rem; line-height: 1.5;">${row.message}</div>
                </td>
                <td>${prioritySelectHtml}</td>
                <td>${statutCell}</td>
                <td>${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });

        loading.style.display = 'none';
        table.style.display = 'table';

    } catch (error) {
        console.error("Erreur de chargement des données:", error);
        loading.innerText = "Erreur de chargement. Vérifiez le serveur et le format des données.";
        loading.style.color = "red";
    }
}

// Fonction pour mettre à jour le statut
async function updateStatus(id, newStatus) {
    if (!confirm(`Confirmez-vous le changement de statut de la demande ${id} à "${newStatus}" ?`)) {
        return;
    }

    try {
        const response = await fetch('/api/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, statut: newStatus })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log(`Statut mis à jour pour ${id}`);
            // Recharger les données pour mettre à jour le tableau et appliquer les filtres immédiatement
            fetchData(); 
        } else {
            alert("❌ Échec de la mise à jour du statut : " + (result.error || "Erreur inconnue."));
        }

    } catch (error) {
        console.error("Erreur réseau lors de la mise à jour du statut:", error);
        alert("❌ Impossible de contacter le serveur pour la mise à jour du statut.");
    }
}

// Fonction pour mettre à jour la priorité
async function updatePriority(id, newPriority) {
    try {
        const response = await fetch('/api/update-priority', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, priorite: newPriority })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log(`Priorité mise à jour pour ${id} à ${newPriority}`);
            // Recharger les données pour mettre à jour l'ordre et l'affichage
            fetchData(); 
        } else {
            alert("❌ Échec de la mise à jour de la priorité : " + (result.error || "Erreur inconnue."));
        }
    } catch (error) {
        console.error("Erreur réseau lors de la mise à jour de la priorité:", error);
        alert("❌ Impossible de contacter le serveur pour la mise à jour de la priorité.");
    }
}

// Fonction pour supprimer une demande (NOUVEAU)
async function deleteRequest(id) {
    if (!confirm(`⚠️ ATTENTION : Confirmez-vous la suppression DÉFINITIVE de la demande ${id} ? Cette action est irréversible.`)) {
        return;
    }

    try {
        const response = await fetch('/api/delete-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log(`Demande ${id} supprimée.`);
            alert("🗑️ Suppression réussie !");
            // Recharger les données pour mettre à jour le tableau
            fetchData(); 
        } else {
            alert("❌ Échec de la suppression : " + (result.error || "Erreur inconnue."));
        }
    } catch (error) {
        console.error("Erreur réseau lors de la suppression:", error);
        alert("❌ Impossible de contacter le serveur pour la suppression.");
    }
}


// Fonction pour l'export CSV
function exportCSV() {
    window.location.href = '/api/export-csv';
}


// =================================================================
// LOGIQUE DU FORMULAIRE (index.html)
// =================================================================

function validateForm() {
    const form = document.getElementById('contactForm');
    let isValid = true;
    
    // CORRECTION : Utilisation de la syntaxe littérale de Regex (sans new RegExp)
    // pour éviter l'erreur "nothing to repeat".
    const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

    // Champs requis
    const requiredFields = ['nom', 'email', 'sujet', 'service', 'message'];

    requiredFields.forEach(id => {

        const input = document.getElementById(id);
        const group = input.closest('.form-group');
        const errorMessage = group.querySelector('.error-message');

        if (!input.value.trim() || (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value))) {
            group.classList.add('error');
            errorMessage.innerText = input.id === 'email' && input.value.trim() 
                ? "Format Email invalide." 
                : "Ce champ est obligatoire.";
            isValid = false;
        } else {
            group.classList.remove('error');
        }
    });

    // NOUVELLE VALIDATION POUR LE TÉLÉPHONE (non obligatoire, mais valide si rempli)
    const phoneInput = document.getElementById('telephone');
    const phoneGroup = phoneInput.closest('.form-group');
    const phoneError = phoneGroup.querySelector('.error-message');

    if (phoneInput.value.trim() !== '' && !phoneRegex.test(phoneInput.value.trim())) {
        phoneGroup.classList.add('error');
        phoneError.innerText = "Numéro de téléphone invalide (format attendu : 0X XX XX XX XX).";
        isValid = false;
    } else {
        // Enlève l'erreur si le champ est vide OU s'il est valide
        phoneGroup.classList.remove('error');
    }

    return isValid;
}

document.addEventListener('DOMContentLoaded', () => {
    // Si c'est la page dashboard, on lance fetchData au chargement
    if (document.URL.includes('dashboard.html')) {
        fetchData();
        // Attacher les écouteurs d'événements pour le filtrage
        document.getElementById('searchInput').addEventListener('input', fetchData);
        document.getElementById('statusFilter').addEventListener('change', fetchData);
        document.getElementById('priorityFilter').addEventListener('change', fetchData);
    }
    
    // Si c'est le formulaire, on attache l'événement submit
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            if (!validateForm()) {
                alert("Veuillez corriger les erreurs dans le formulaire.");
                return;
            }

            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Envoi en cours...";
            btn.disabled = true;

            const formData = {
                nom: document.getElementById('nom').value,
                email: document.getElementById('email').value,
                telephone: document.getElementById('telephone').value,
                sujet: document.getElementById('sujet').value,
                service: document.getElementById('service').value, // NOUVEAU CHAMP
                message: document.getElementById('message').value
            };

            try {
                const response = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    alert("✅ Votre demande a bien été enregistrée !");
                    this.reset(); 
                } else {
                    alert("❌ Erreur serveur : " + (result.error || "Inconnue"));
                }

            } catch (error) {
                console.error("Erreur Fetch :", error);
                alert("❌ Impossible de contacter le serveur. Vérifiez qu'il est bien lancé.");
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});