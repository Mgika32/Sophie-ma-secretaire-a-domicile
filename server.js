const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Augmenter la limite de taille et bien parser le JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Chemins des fichiers de données ---
const dataDir = path.join(__dirname, 'data');
const csvFilePath = path.join(dataDir, 'rendez-vous.csv'); 
const statsFilePath = path.join(dataDir, 'stats.json'); 

// 1. Création du dossier 'data' s'il n'existe pas
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    console.log("📂 Dossier 'data' créé.");
}

// 2. Création du fichier CSV avec en-têtes s'il n'existe pas
const CSV_HEADERS = 'ID,Date,Nom,Email,Telephone,Sujet,Message,Statut,Priorite,Service,Date_Traitement\n';

if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, CSV_HEADERS, 'utf8');
    console.log("📄 Fichier 'rendez-vous.csv' initialisé avec tous les champs.");
}

// 3. Création du fichier de stats s'il n'existe pas
if (!fs.existsSync(statsFilePath)) {
    const defaultStats = { totalViews: 0, uniqueIps: [] };
    fs.writeFileSync(statsFilePath, JSON.stringify(defaultStats, null, 2), 'utf8');
    console.log("📊 Fichier 'stats.json' initialisé.");
}

// --- Fonction Utilitaires pour le CSV ---

const cleanForCsv = (text) => `"${(text || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
const cleanFromCsv = (txt) => txt ? txt.replace(/^"|"$/g, '').replace(/""/g, '"') : '';

const readAndParseCSV = () => {
    try {
        const data = fs.readFileSync(csvFilePath, 'utf8');
        const lines = data.trim().split('\n');
        const result = [];
        
        if (lines.length <= 1) return [];

        for (let i = 1; i < lines.length; i++) {
            // Regex pour découper correctement les CSV, supporte jusqu'à 11 colonnes.
            const parts = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            
            if (parts && parts.length >= 10) {
                result.push({
                    id: cleanFromCsv(parts[0]),
                    date: cleanFromCsv(parts[1]),
                    nom: cleanFromCsv(parts[2]),
                    email: cleanFromCsv(parts[3]),
                    telephone: cleanFromCsv(parts[4]),
                    sujet: cleanFromCsv(parts[5]),
                    message: cleanFromCsv(parts[6]),
                    statut: cleanFromCsv(parts[7]) || 'Nouveau',
                    priorite: cleanFromCsv(parts[8]) || 'Moyenne',
                    service: cleanFromCsv(parts[9]) || 'Inconnu',
                    date_traitement: cleanFromCsv(parts[10]) || '' 
                });
            }
        }
        return result;
    } catch (e) {
        console.error("❌ Erreur de lecture/parsing CSV:", e.message);
        return [];
    }
};

const rewriteCSV = (rows) => {
    const csvContent = rows.map(row => 
        `${row.id},${cleanForCsv(row.date)},${cleanForCsv(row.nom)},${cleanForCsv(row.email)},${cleanForCsv(row.telephone)},${cleanForCsv(row.sujet)},${cleanForCsv(row.message)},${cleanForCsv(row.statut)},${cleanForCsv(row.priorite)},${cleanForCsv(row.service)},${cleanForCsv(row.date_traitement)}`
    ).join('\n');
    fs.writeFileSync(csvFilePath, CSV_HEADERS + csvContent + '\n', 'utf8');
};

// --- MIDDLEWARE pour les Stats de Trafic ---
app.use((req, res, next) => {
    if (req.path === '/index.html' || req.path === '/') {
        try {
            const stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
            const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.socket.remoteAddress;

            stats.totalViews++;
            if (!stats.uniqueIps.includes(clientIp)) {
                stats.uniqueIps.push(clientIp);
            }
            fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Erreur de mise à jour des stats:', error);
        }
    }
    next();
});

// Le middleware pour les assets statiques
app.use(express.static(path.join(__dirname))); 


// --- ROUTE : Recevoir une demande (FORMULAIRE) ---
app.post('/api/submit', (req, res) => {
    console.log("📥 Requête reçue du site web...");
    
    // Récupération de tous les champs
    const { nom, email, telephone, sujet, service, message } = req.body;

    // Validation minimale pour s'assurer que les champs critiques sont présents
    if (!nom || !email || !service || !sujet || !message) {
        console.log("❌ Erreur : Champs obligatoires manquants");
        return res.status(400).json({ success: false, error: 'Champs obligatoires manquants ou service non sélectionné' });
    }

    const date = new Date().toLocaleString('fr-FR');
    const id = Date.now();
    const statut = 'Nouveau';
    const priorite = 'Moyenne'; 
    const date_traitement = '';

    const csvLine = `${id},${cleanForCsv(date)},${cleanForCsv(nom)},${cleanForCsv(email)},${cleanForCsv(telephone)},${cleanForCsv(sujet)},${cleanForCsv(message)},${cleanForCsv(statut)},${cleanForCsv(priorite)},${cleanForCsv(service)},${cleanForCsv(date_traitement)}\n`;

    fs.appendFile(csvFilePath, csvLine, 'utf8', (err) => {
        if (err) {
            console.error('❌ Erreur écriture disque :', err);
            return res.status(500).json({ success: false, error: 'Erreur disque' });
        }
        console.log(`✅ Succès : RDV enregistré pour ${nom} sur le service ${service}`);
        res.json({ success: true });
    });
});

// --- ROUTE : Lire les données pour le dashboard ---
app.get('/api/data', (req, res) => {
    try {
        const result = readAndParseCSV();
        
        const priorityOrder = { 'Haute': 3, 'Moyenne': 2, 'Basse': 1 };
        
        const sortedResult = result.sort((a, b) => {
            const prioA = priorityOrder[a.priorite] || 0;
            const prioB = priorityOrder[b.priorite] || 0;

            if (prioA !== prioB) {
                return prioB - prioA; 
            }
            return b.id - a.id; 
        });

        res.json(sortedResult);
    } catch (err) {
        console.error("❌ Impossible de lire le fichier CSV:", err);
        return res.status(500).json({ error: 'Erreur lecture' });
    }
});


// --- ROUTE : Mettre à jour le statut d'une demande ---
app.post('/api/update-status', (req, res) => {
    const { id, statut } = req.body;
    console.log(`✏️ Mise à jour du statut ID ${id} à ${statut}`);

    if (!id || !statut) {
        return res.status(400).json({ success: false, error: 'ID ou Statut manquant' });
    }

    try {
        const allRows = readAndParseCSV();
        let found = false;
        const now = new Date().toLocaleDateString('fr-FR');

        const updatedRows = allRows.map(row => {
            if (row.id === id) {
                row.statut = statut;
                found = true;
                if (statut === 'Traitée') {
                    row.date_traitement = now;
                } else if (statut === 'Nouveau') {
                    row.date_traitement = '';
                }
            }
            return row;
        });

        if (found) {
            rewriteCSV(updatedRows);
            console.log(`✅ Statut mis à jour pour la demande ${id}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Demande non trouvée' });
        }

    } catch (err) {
        console.error("❌ Erreur lors de la mise à jour du statut:", err);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
});

// --- ROUTE : Mettre à jour la priorité d'une demande ---
app.post('/api/update-priority', (req, res) => {
    const { id, priorite } = req.body;
    console.log(`⭐ Mise à jour de la priorité ID ${id} à ${priorite}`);

    if (!id || !priorite) {
        return res.status(400).json({ success: false, error: 'ID ou Priorité manquant' });
    }

    try {
        const allRows = readAndParseCSV();
        let found = false;

        const updatedRows = allRows.map(row => {
            if (row.id === id) {
                row.priorite = priorite;
                found = true;
            }
            return row;
        });

        if (found) {
            rewriteCSV(updatedRows);
            console.log(`✅ Priorité mise à jour pour la demande ${id}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Demande non trouvée' });
        }

    } catch (err) {
        console.error("❌ Erreur lors de la mise à jour de la priorité:", err);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
});


// --- ROUTE : Supprimer une demande ---
app.post('/api/delete-request', (req, res) => {
    const { id } = req.body;
    console.log(`🗑️ Tentative de suppression de l'ID ${id}`);

    if (!id) {
        return res.status(400).json({ success: false, error: 'ID manquant' });
    }

    try {
        const allRows = readAndParseCSV();
        
        const initialCount = allRows.length;
        const updatedRows = allRows.filter(row => row.id !== id);
        const deletedCount = initialCount - updatedRows.length;

        if (deletedCount > 0) {
            rewriteCSV(updatedRows);
            console.log(`✅ Succès : Demande ${id} supprimée.`);
            res.json({ success: true, message: `Demande ${id} supprimée.` });
        } else {
            res.status(404).json({ success: false, error: 'Demande non trouvée' });
        }

    } catch (err) {
        console.error("❌ Erreur lors de la suppression de la demande:", err);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
});


// --- ROUTE : Exporter le CSV ---
app.get('/api/export-csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="demandes_france_services.csv"');
    
    try {
        const fileContent = fs.readFileSync(csvFilePath, 'utf8');
        res.send(fileContent);
    } catch (error) {
        console.error("❌ Erreur lors de l'export CSV:", error);
        res.status(500).send('Erreur lors de la lecture du fichier de données.');
    }
});

// --- ROUTE : Lire les statistiques de trafic ---
app.get('/api/stats', (req, res) => {
    try {
        const stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
        res.json({
            totalViews: stats.totalViews,
            uniqueIps: stats.uniqueIps.length
        });
    } catch (error) {
        console.error('❌ Erreur de lecture des stats:', error);
        res.status(500).json({ error: 'Erreur lecture' });
    }
});


app.listen(PORT, () => {
    console.log(`\n--------------------------------------------------`);
    console.log(`🚀 SERVEUR PRÊT !`);
    console.log(`🌍 Site visible sur :      http://localhost:${PORT}/index.html`);
    console.log(`📊 Dashboard visible sur : http://localhost:${PORT}/dashboard.html`);
    console.log(`--------------------------------------------------\n`);
});