let donneesJeu = null; 
let toutesLesCategories = []; // Contiendra les attributs classiques + les featurings
let categoriesChoisies = { lignes: [], colonnes: [] };
let caseActive = null; 
let grilleGagnee = 0; 
let erreurs = 0; 
let rappeursUtilises = []; 
let jeuTermine = false; 
const MAX_ERREURS = 3; 

let graineAleatoire = 1; 
function generateurAleatoireLocal() {
    let x = Math.sin(graineAleatoire++) * 10000;
    return x - Math.floor(x);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-modal').addEventListener('click', fermerModale);
    document.getElementById('station-input').addEventListener('input', gererRecherche);
    document.getElementById('btn-close-alert').addEventListener('click', () => document.getElementById('alert-modal').classList.add('hidden'));
    
    document.getElementById('btn-abandon').addEventListener('click', () => declarerFinDePartie(false, "abandon"));
    document.getElementById('btn-rejouer').addEventListener('click', () => initialiserNouvellePartie(false));

    document.getElementById('ecran-caca').addEventListener('click', function() { this.classList.add('hidden'); });
    document.getElementById('ecran-pipi').addEventListener('click', function() { this.classList.add('hidden'); });

    // Chargement du fichier rappeurs.json
    fetch('rappeurs.json')
        .then(response => response.json())
        .then(data => { 
            donneesJeu = data;
            construireListeCategories();
            initialiserNouvellePartie(true); 
        })
        .catch(error => console.error("Erreur JSON :", error));
});

// --- CONSTRUCTION DES CATÉGORIES (CLASSIQUES + FEATURINGS) ---
function construireListeCategories() {
    toutesLesCategories = [];

    // 1. Ajouter les catégories binaires (0/1)
    Object.keys(donneesJeu._legende_attributs).forEach(index => {
        toutesLesCategories.push({
            type: 'attr',
            key: index,
            label: donneesJeu._legende_attributs[index]
        });
    });

    // 2. Ajouter automatiquement les catégories "A fait un feat avec X"
    // Note : passe le "3" à "5" quand tu auras rentré tes 300 rappeurs !
    const MIN_FEATS_REQUIS = 3; 

    donneesJeu.rappeurs.forEach(rappeurCible => {
        const nbFeats = donneesJeu.rappeurs.filter(r => r.feats && r.feats.includes(rappeurCible.id)).length;
        if (nbFeats >= MIN_FEATS_REQUIS) {
            toutesLesCategories.push({
                type: 'feat',
                key: rappeurCible.id,
                label: `A fait un feat avec ${rappeurCible.nom}`
            });
        }
    });
}

// Vérifie si un rappeur valide une catégorie (classique OU featuring)
function rappeurValideCritere(rappeur, categorie) {
    if (categorie.type === 'attr') {
        return rappeur.attributs[categorie.key] === 1;
    } else if (categorie.type === 'feat') {
        return rappeur.feats && rappeur.feats.includes(categorie.key);
    }
    return false;
}

// --- GÉNÉRATION DE LA GRILLE ---
function initialiserNouvellePartie(estGrilleDuJour = false) {
    if (estGrilleDuJour) {
        const dateAujourdhui = new Date();
        graineAleatoire = dateAujourdhui.getFullYear() * 10000 + (dateAujourdhui.getMonth() + 1) * 100 + dateAujourdhui.getDate();
        const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('date-grille').textContent = "Grille du " + dateAujourdhui.toLocaleDateString('fr-FR', optionsDate);
    } else {
        graineAleatoire = Math.random() * 1000000;
        document.getElementById('date-grille').textContent = "Grille d'entraînement";
    }

    let grilleValide = false;
    while (!grilleValide) {
        const categoriesTirees = melangerTableau([...toutesLesCategories]).slice(0, 4);
        categoriesChoisies.lignes = categoriesTirees.slice(0, 2);
        categoriesChoisies.colonnes = categoriesTirees.slice(2, 4);
        grilleValide = verifierGrilleFaisable(categoriesChoisies.lignes, categoriesChoisies.colonnes);
    }
    afficherGrille();
}

function verifierGrilleFaisable(lignes, colonnes) {
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const ok = donneesJeu.rappeurs.find(rappeur => 
                rappeurValideCritere(rappeur, lignes[r]) && rappeurValideCritere(rappeur, colonnes[c])
            );
            if (!ok) return false; 
        }
    }
    return true; 
}

function melangerTableau(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(generateurAleatoireLocal() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- AFFICHAGE & INTERACTIONS ---
function afficherGrille() {
    for (let i = 0; i < 2; i++) {
        document.getElementById(`cat-row-${i}`).textContent = categoriesChoisies.lignes[i].label;
        document.getElementById(`cat-col-${i}`).textContent = categoriesChoisies.colonnes[i].label;
    }

    document.querySelectorAll('.game-cell').forEach(cellule => {
        cellule.textContent = "";
        cellule.className = "game-cell"; 
        const nouvelleCellule = cellule.cloneNode(true);
        cellule.parentNode.replaceChild(nouvelleCellule, cellule);
        nouvelleCellule.addEventListener('click', () => ouvrirModale(nouvelleCellule));
    });

    grilleGagnee = 0;
    erreurs = 0;
    rappeursUtilises = [];
    jeuTermine = false;
    document.getElementById('compteur-erreurs').textContent = `Erreurs : 0 / 3`;
    document.getElementById('btn-abandon').classList.remove('hidden');
    document.getElementById('btn-rejouer').classList.add('hidden');
}

function ouvrirModale(celluleHtml) {
    if (!jeuTermine && celluleHtml.classList.contains('correct')) return; 

    const row = parseInt(celluleHtml.getAttribute('data-row'));
    const col = parseInt(celluleHtml.getAttribute('data-col'));
    caseActive = { row, col, element: celluleHtml };

    const catLigne = categoriesChoisies.lignes[row];
    const catCol = categoriesChoisies.colonnes[col];
    
    document.getElementById('current-intersection').textContent = `${catLigne.label} + ${catCol.label}`;
    
    const toutesLesSolutions = donneesJeu.rappeurs.filter(r => 
        rappeurValideCritere(r, catLigne) && rappeurValideCritere(r, catCol)
    );

    const liste = document.getElementById('suggestions-list');
    liste.innerHTML = "";
    document.getElementById('search-modal').classList.remove('hidden');

    if (jeuTermine) {
        document.getElementById('modal-title').textContent = "Solutions possibles";
        document.getElementById('hint-possibilites').textContent = `Il y avait ${toutesLesSolutions.length} réponse(s) valable(s) :`;
        document.getElementById('station-input').classList.add('hidden'); 
        
        toutesLesSolutions.forEach(r => {
            const li = document.createElement('li');
            li.textContent = r.nom;
            li.classList.add('solution-item');
            if (rappeursUtilises.includes(r.id)) { li.style.color = '#27ae60'; li.style.fontWeight = 'bold'; }
            liste.appendChild(li);
        });
    } else {
        const nbRestantes = toutesLesSolutions.filter(r => !rappeursUtilises.includes(r.id)).length;
        document.getElementById('modal-title').textContent = "Trouver un rappeur";
        document.getElementById('hint-possibilites').textContent = `Indice : Il reste ${nbRestantes} solution(s) pour cette case.`;
        const input = document.getElementById('station-input');
        input.classList.remove('hidden');
        input.value = "";
        setTimeout(() => input.focus(), 50);
    }
}

function fermerModale() {
    document.getElementById('search-modal').classList.add('hidden');
    caseActive = null;
}

function gererRecherche(event) {
    const texteSaisi = event.target.value.toLowerCase();
    const liste = document.getElementById('suggestions-list');
    liste.innerHTML = ""; 
    if (texteSaisi.length < 2) return; 

    const resultats = donneesJeu.rappeurs.filter(r => 
        r.nom.toLowerCase().includes(texteSaisi) && !rappeursUtilises.includes(r.id)
    );
    resultats.slice(0, 5).forEach(rappeur => {
        const li = document.createElement('li');
        li.textContent = rappeur.nom;
        li.addEventListener('click', () => verifierReponse(rappeur));
        liste.appendChild(li);
    });
}

function afficherAlerte(titre, message) {
    document.getElementById('alert-title').textContent = titre;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').classList.remove('hidden');
}

function verifierReponse(rappeurChoisi) {
    const catLigne = categoriesChoisies.lignes[caseActive.row];
    const catCol = categoriesChoisies.colonnes[caseActive.col];

    if (rappeurValideCritere(rappeurChoisi, catLigne) && rappeurValideCritere(rappeurChoisi, catCol)) {
        caseActive.element.textContent = rappeurChoisi.nom;
        caseActive.element.classList.add('correct');
        rappeursUtilises.push(rappeurChoisi.id); 
        grilleGagnee++;
        if (grilleGagnee === 4) declarerFinDePartie(true);
    } else {
        erreurs++;
        document.getElementById('compteur-erreurs').textContent = `Erreurs : ${erreurs} / 3`;
        
        if (erreurs >= MAX_ERREURS) {
            declarerFinDePartie(false, "defaite");
        } else {
            afficherAlerte("Mauvaise réponse", `Faux ! ${rappeurChoisi.nom} ne valide pas cette case.\nPlus que ${MAX_ERREURS - erreurs} essai(s).`);
        }
    }
    fermerModale();
}

function declarerFinDePartie(victoire, raison = "") {
    jeuTermine = true;
    document.getElementById('btn-abandon').classList.add('hidden');
    document.getElementById('btn-rejouer').classList.remove('hidden');

    if (victoire) {
        setTimeout(() => document.getElementById('ecran-caca').classList.remove('hidden'), 300);
    } else {
        document.querySelectorAll('.game-cell:not(.correct)').forEach(c => {
            c.textContent = "?";
            c.classList.add('missed');
        });
        
        if (raison === "abandon") {
            afficherAlerte("Abandon", "Vous avez abandonné !\n\nCliquez sur les cases rouges pour voir les solutions.");
        } else {
            setTimeout(() => document.getElementById('ecran-pipi').classList.remove('hidden'), 300);
        }
    }
}
