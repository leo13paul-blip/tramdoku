let donneesJeu = null; 
let categoriesChoisies = { lignes: [], colonnes: [] };
let caseActive = null; 
let grilleGagnee = 0; 
let erreurs = 0; 
let stationsUtilisees = []; 
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

    fetch('stations.json')
        .then(response => response.json())
        .then(data => { 
            donneesJeu = data; 
            initialiserNouvellePartie(true); 
        })
        .catch(error => console.error("Erreur JSON :", error));
});

// --- FONCTIONS DE FORMATAGE VISUEL (LIGNES TAG) ---
// Transforme le texte de la catégorie pour inclure le logo de la ligne
function formaterTexteLigne(texte) {
    return texte
        .replace("Ligne A", "Ligne <span class='ligne-badge ligne-A'>A</span>")
        .replace("Ligne B", "Ligne <span class='ligne-badge ligne-B'>B</span>")
        .replace("Ligne C", "Ligne <span class='ligne-badge ligne-C'>C</span>")
        .replace("Ligne D", "Ligne <span class='ligne-badge ligne-D'>D</span>")
        .replace("Ligne E", "Ligne <span class='ligne-badge ligne-E'>E</span>");
}

// Génère le nom de la station avec les petits logos des lignes à côté
function genererHTMLStation(station) {
    let badgesHtml = "";
    const lignesLettres = ['A', 'B', 'C', 'D', 'E'];
    // On vérifie les attributs [0] à [4] (qui correspondent aux 5 lignes)
    for(let i = 0; i < 5; i++) {
        if(station.attributs[i] === 1) {
            badgesHtml += `<span class="ligne-badge ligne-${lignesLettres[i]}">${lignesLettres[i]}</span>`;
        }
    }
    return `<span>${station.nom}</span> <div class="lignes-container">${badgesHtml}</div>`;
}
// ---------------------------------------------------

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
        const indexCategories = Object.keys(donneesJeu._legende_attributs);
        const categoriesTirees = melangerTableau([...indexCategories]).slice(0, 4);
        categoriesChoisies.lignes = categoriesTirees.slice(0, 2);
        categoriesChoisies.colonnes = categoriesTirees.slice(2, 4);
        grilleValide = verifierGrilleFaisable(categoriesChoisies.lignes, categoriesChoisies.colonnes);
    }
    afficherGrille();
}

function verifierGrilleFaisable(lignes, colonnes) {
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const indexL = lignes[r]; const indexC = colonnes[c];
            const ok = donneesJeu.stations.find(s => s.attributs[indexL] === 1 && s.attributs[indexC] === 1);
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

function afficherGrille() {
    for (let i = 0; i < 2; i++) {
        // Utilisation de formaterTexteLigne pour afficher les logos dans les en-têtes
        document.getElementById(`cat-row-${i}`).innerHTML = formaterTexteLigne(donneesJeu._legende_attributs[categoriesChoisies.lignes[i]]);
        document.getElementById(`cat-col-${i}`).innerHTML = formaterTexteLigne(donneesJeu._legende_attributs[categoriesChoisies.colonnes[i]]);
    }

    document.querySelectorAll('.game-cell').forEach(cellule => {
        cellule.innerHTML = "";
        cellule.className = "game-cell"; 
        const nouvelleCellule = cellule.cloneNode(true);
        cellule.parentNode.replaceChild(nouvelleCellule, cellule);
        nouvelleCellule.addEventListener('click', () => ouvrirModale(nouvelleCellule));
    });

    grilleGagnee = 0;
    erreurs = 0;
    stationsUtilisees = [];
    jeuTermine = false;
    document.getElementById('compteur-erreurs').textContent = `Erreurs : 0 / 3`;
    document.getElementById('btn-abandon').classList.remove('hidden');
    document.getElementById('btn-rejouer').classList.add('hidden');
}

function ouvrirModale(celluleHtml) {
    if (!jeuTermine && celluleHtml.classList.contains('correct')) return; 

    const row = celluleHtml.getAttribute('data-row');
    const col = celluleHtml.getAttribute('data-col');
    caseActive = { row: parseInt(row), col: parseInt(col), element: celluleHtml };
    const indexL = categoriesChoisies.lignes[row];
    const indexC = categoriesChoisies.colonnes[col];
    
    // Affichage des logos dans l'intersection de la modale
    const texteIntersection = `${donneesJeu._legende_attributs[indexL]} + ${donneesJeu._legende_attributs[indexC]}`;
    document.getElementById('current-intersection').innerHTML = formaterTexteLigne(texteIntersection);
    
    const toutesLesSolutions = donneesJeu.stations.filter(s => s.attributs[indexL] === 1 && s.attributs[indexC] === 1);
    const liste = document.getElementById('suggestions-list');
    liste.innerHTML = "";
    document.getElementById('search-modal').classList.remove('hidden');

    if (jeuTermine) {
        document.getElementById('modal-title').textContent = "Solutions possibles";
        document.getElementById('hint-possibilites').textContent = `Il y avait ${toutesLesSolutions.length} réponse(s) valable(s) :`;
        document.getElementById('station-input').classList.add('hidden'); 
        
        toutesLesSolutions.forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = genererHTMLStation(s); // Affiche le nom ET les logos
            li.classList.add('solution-item');
            if (stationsUtilisees.includes(s.id)) { li.style.color = '#27ae60'; li.style.fontWeight = 'bold'; }
            liste.appendChild(li);
        });
    } else {
        const nbPossibilitesRestantes = toutesLesSolutions.filter(s => !stationsUtilisees.includes(s.id)).length;
        document.getElementById('modal-title').textContent = "Trouver une station";
        document.getElementById('hint-possibilites').textContent = `Indice : Il reste ${nbPossibilitesRestantes} solution(s) pour cette case.`;
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

    const resultats = donneesJeu.stations.filter(s => s.nom.toLowerCase().includes(texteSaisi) && !stationsUtilisees.includes(s.id));
    resultats.slice(0, 5).forEach(station => {
        const li = document.createElement('li');
        li.innerHTML = genererHTMLStation(station); // Affiche le nom ET les logos dans la recherche
        li.addEventListener('click', () => verifierReponse(station));
        liste.appendChild(li);
    });
}

function afficherAlerte(titre, message) {
    document.getElementById('alert-title').textContent = titre;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').classList.remove('hidden');
}

function verifierReponse(stationChoisie) {
    const indexL = categoriesChoisies.lignes[caseActive.row];
    const indexC = categoriesChoisies.colonnes[caseActive.col];

    if (stationChoisie.attributs[indexL] === 1 && stationChoisie.attributs[indexC] === 1) {
        // Enregistre la bonne réponse dans la case AVEC les logos
        caseActive.element.innerHTML = genererHTMLStation(stationChoisie);
        caseActive.element.classList.add('correct');
        stationsUtilisees.push(stationChoisie.id); 
        grilleGagnee++;
        if (grilleGagnee === 4) declarerFinDePartie(true);
    } else {
        erreurs++;
        document.getElementById('compteur-erreurs').textContent = `Erreurs : ${erreurs} / 3`;
        
        if (erreurs >= MAX_ERREURS) {
            declarerFinDePartie(false, "defaite");
        } else {
            afficherAlerte("Mauvaise réponse", `Faux ! L'arrêt ${stationChoisie.nom} ne valide pas cette case.\nPlus que ${MAX_ERREURS - erreurs} essai(s).`);
        }
    }
    fermerModale();
}

function declarerFinDePartie(victoire, raison = "") {
    jeuTermine = true;
    document.getElementById('btn-abandon').classList.add('hidden');
    document.getElementById('btn-rejouer').classList.remove('hidden');

    if (victoire) {
        setTimeout(() => afficherAlerte("Victoire !", "Tu as gagné, CACA !\n\nCliquez sur les cases pour voir les autres solutions."), 300);
    } else {
        document.querySelectorAll('.game-cell:not(.correct)').forEach(c => {
            c.innerHTML = "?";
            c.classList.add('missed');
        });
        
        if (raison === "abandon") {
            afficherAlerte("Abandon", "Vous avez abandonné !\n\nCliquez sur les cases rouges pour voir les solutions.");
        } else {
            setTimeout(() => afficherAlerte("Défaite", "Tu as perdu, PIPI !\n\nCliquez sur les cases rouges pour voir les solutions."), 300);
        }
    }
}
