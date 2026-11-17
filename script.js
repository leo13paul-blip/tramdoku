let donneesJeu = null; 
let categoriesChoisies = { lignes: [], colonnes: [] };
let caseActive = null; 
let grilleGagnee = 0; 
let erreurs = 0; 
let stationsUtilisees = []; 
let jeuTermine = false; 
const MAX_ERREURS = 3; 

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-modal').addEventListener('click', fermerModale);
    document.getElementById('station-input').addEventListener('input', gererRecherche);
    
    document.getElementById('btn-abandon').addEventListener('click', () => declarerFinDePartie(false, "abandon"));
    document.getElementById('btn-rejouer').addEventListener('click', initialiserNouvellePartie);

    fetch('stations.json')
        .then(response => response.json())
        .then(data => { donneesJeu = data; initialiserNouvellePartie(); })
        .catch(error => console.error("Erreur JSON :", error));
});

function initialiserNouvellePartie() {
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
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function afficherGrille() {
    for (let i = 0; i < 2; i++) {
        document.getElementById(`cat-row-${i}`).textContent = donneesJeu._legende_attributs[categoriesChoisies.lignes[i]];
        document.getElementById(`cat-col-${i}`).textContent = donneesJeu._legende_attributs[categoriesChoisies.colonnes[i]];
    }

    document.querySelectorAll('.game-cell').forEach(cellule => {
        cellule.textContent = "";
        cellule.className = "game-cell"; // Reset les classes
        const nouvelleCellule = cellule.cloneNode(true);
        cellule.parentNode.replaceChild(nouvelleCellule, cellule);
        nouvelleCellule.addEventListener('click', () => ouvrirModale(nouvelleCellule));
    });

    // Reset des variables d'état
    grilleGagnee = 0;
    erreurs = 0;
    stationsUtilisees = [];
    jeuTermine = false;
    document.getElementById('compteur-erreurs').textContent = `Erreurs : 0 / 3`;
    document.getElementById('btn-abandon').classList.remove('hidden');
    document.getElementById('btn-rejouer').classList.add('hidden');
}

function ouvrirModale(celluleHtml) {
    // Si le jeu n'est pas terminé, on empêche de rouvrir une case validée
    if (!jeuTermine && celluleHtml.classList.contains('correct')) return; 

    const row = celluleHtml.getAttribute('data-row');
    const col = celluleHtml.getAttribute('data-col');
    caseActive = { row: parseInt(row), col: parseInt(col), element: celluleHtml };

    const indexL = categoriesChoisies.lignes[row];
    const indexC = categoriesChoisies.colonnes[col];
    
    document.getElementById('current-intersection').textContent = 
        `${donneesJeu._legende_attributs[indexL]} + ${donneesJeu._legende_attributs[indexC]}`;

    // Récupérer TOUTES les stations valides pour cette intersection
    const toutesLesSolutions = donneesJeu.stations.filter(s => s.attributs[indexL] === 1 && s.attributs[indexC] === 1);
    
    const liste = document.getElementById('suggestions-list');
    liste.innerHTML = "";
    document.getElementById('search-modal').classList.remove('hidden');

    if (jeuTermine) {
        // --- MODE LECTURE (JEU TERMINÉ) ---
        document.getElementById('modal-title').textContent = "Solutions possibles";
        document.getElementById('hint-possibilites').textContent = `Il y avait ${toutesLesSolutions.length} réponse(s) valable(s) :`;
        document.getElementById('station-input').classList.add('hidden'); // On cache la barre de recherche
        
        toutesLesSolutions.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s.nom;
            li.classList.add('solution-item');
            if (stationsUtilisees.includes(s.id)) {
                li.style.color = '#27ae60'; // Met en vert la station qui a été jouée
                li.style.fontWeight = 'bold';
            }
            liste.appendChild(li);
        });
    } else {
        // --- MODE JEU ---
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
        li.textContent = station.nom;
        li.addEventListener('click', () => verifierReponse(station));
        liste.appendChild(li);
    });
}

function verifierReponse(stationChoisie) {
    const indexL = categoriesChoisies.lignes[caseActive.row];
    const indexC = categoriesChoisies.colonnes[caseActive.col];

    if (stationChoisie.attributs[indexL] === 1 && stationChoisie.attributs[indexC] === 1) {
        caseActive.element.textContent = stationChoisie.nom;
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
            alert(`Faux ! ${stationChoisie.nom} n'est pas bon. Plus que ${MAX_ERREURS - erreurs} essai(s).`);
        }
    }
    fermerModale();
}

function declarerFinDePartie(victoire, raison = "") {
    jeuTermine = true;
    document.getElementById('btn-abandon').classList.add('hidden');
    document.getElementById('btn-rejouer').classList.remove('hidden');

    if (victoire) {
        setTimeout(() => alert("tu as gagné, CACA\n(Cliquez sur les cases pour voir les autres solutions)"), 300);
    } else {
        document.querySelectorAll('.game-cell:not(.correct)').forEach(c => {
            c.textContent = "?";
            c.classList.add('missed'); // Affiche les cases ratées en rouge
        });
        
        if (raison === "abandon") {
            alert("Vous avez abandonné ! Cliquez sur les cases pour voir les solutions.");
        } else {
            setTimeout(() => alert("tu as perdu, PIPI !\nCliquez sur les cases pour voir les solutions."), 300);
        }
    }
}