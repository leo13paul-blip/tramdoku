let donneesJeu = null; 
let toutesLesCategories = []; // Attributs JSON + Orthographe auto + Featurings
let categoriesChoisies = { lignes: [], colonnes: [] };
let caseActive = null; 
let grilleGagnee = 0; 
let erreurs = 0; 
let rappeursUtilises = []; 
let jeuTermine = false; 
const MAX_ERREURS = 3; 

// Passe cette valeur à 5 quand tu auras rentré tes 300 rappeurs !
const MIN_REPONSES_CATEGORIE = 5; 

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

    fetch('rappeurs.json')
        .then(response => response.json())
        .then(data => { 
            donneesJeu = data;
            construireListeCategories();
            initialiserNouvellePartie(true); 
        })
        .catch(error => console.error("Erreur JSON :", error));
});

// --- UTILITAIRE : ENLEVER LES ACCENTS ---
function nettoyerTexte(texte) {
    return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- CONSTRUCTION DES CATÉGORIES ---
function construireListeCategories() {
    toutesLesCategories = [];

    // 1. Catégories binaires (0/1) issues du fichier JSON
    Object.keys(donneesJeu._legende_attributs).forEach(index => {
        const nbValides = donneesJeu.rappeurs.filter(r => r.attributs[index] === 1).length;
        if (nbValides >= MIN_REPONSES_CATEGORIE) {
            toutesLesCategories.push({
                type: 'attr',
                key: index,
                label: donneesJeu._legende_attributs[index]
            });
        }
    });

    // 2. Catégories d'orthographe calculées automatiquement
    const reglesOrtho = [
        { key: '3_lettres', label: 'Exactement 3 lettres', test: nom => nom.replace(/\s+/g, '').length === 3 },
        { key: '4_lettres_max', label: '4 lettres ou moins', test: nom => nom.replace(/\s+/g, '').length <= 4 },
        { key: '10_lettres_min', label: '10 lettres ou plus', test: nom => nom.replace(/\s+/g, '').length >= 10 },
        { key: 'chiffre', label: 'Comporte au moins un chiffre', test: nom => /\d/.test(nom) },
        { key: 'article', label: 'Comporte un article (Le, La, L\', Du...)', test: nom => /\b(le|la|les|du|de)\b|\b[ld]'/i.test(nom) },
        { key: 'lettre_doublee', label: 'Comporte une lettre doublée', test: nom => /([a-z])\1/i.test(nettoyerTexte(nom)) },
        { key: 'ponctuation', label: 'Comporte un tiret (-) ou une apostrophe (\')', test: nom => /[-']/.test(nom) },
        { key: '3_mots', label: 'Comporte 3 mots ou plus', test: nom => nom.trim().split(/\s+/).length >= 3 },
        { key: 'majuscules', label: 'Nom tout en MAJUSCULES', test: nom => nom === nom.toUpperCase() && /[A-Z]/.test(nom) },
        { key: 'finit_a_o', label: 'Se termine par "A" ou "O"', test: nom => /[ao]$/i.test(nettoyerTexte(nom.trim())) }
    ];

    // Ajouter les lettres de début (A, B, C...)
    const lettres = ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T'];
    lettres.forEach(lettre => {
        reglesOrtho.push({
            key: `commence_${lettre}`,
            label: `Commence par la lettre ${lettre}`,
            test: nom => nettoyerTexte(nom.trim()).toUpperCase().startsWith(lettre)
        });
    });

    reglesOrtho.forEach(regle => {
        const nbValides = donneesJeu.rappeurs.filter(r => regle.test(r.nom)).length;
        if (nbValides >= MIN_REPONSES_CATEGORIE) {
            toutesLesCategories.push({
                type: 'ortho',
                key: regle.key,
                label: regle.label,
                test: regle.test
            });
        }
    });

    // 3. Catégories "A fait un feat avec X"
    donneesJeu.rappeurs.forEach(rappeurCible => {
        const nbFeats = donneesJeu.rappeurs.filter(r => r.feats && r.feats.includes(rappeurCible.id)).length;
        if (nbFeats >= MIN_REPONSES_CATEGORIE) {
            toutesLesCategories.push({
                type: 'feat',
                key: rappeurCible.id,
                label: `A fait un feat avec ${rappeurCible.nom}`
            });
        }
    });
}

// Vérifie si un rappeur valide une catégorie (JSON, Orthographe ou Featuring)
function rappeurValideCritere(rappeur, categorie) {
    if (categorie.type === 'attr') {
        return rappeur.attributs[categorie.key] === 1;
    } else if (categorie.type === 'ortho') {
        return categorie.test(rappeur.nom);
    } else if (categorie.type === 'feat') {
        return rappeur.feats && rappeur.feats.includes(categorie.key);
    }
    return false;
}

// --- GÉNÉRATION DE LA GRILLE 3x3 ---
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
    let tentatives = 0;

    while (!grilleValide && tentatives < 5000) {
        tentatives++;
        const categoriesTirees = melangerTableau([...toutesLesCategories]).slice(0, 6);
        categoriesChoisies.lignes = categoriesTirees.slice(0, 3);
        categoriesChoisies.colonnes = categoriesTirees.slice(3, 6);
        grilleValide = verifierGrilleFaisable(categoriesChoisies.lignes, categoriesChoisies.colonnes);
    }

    if (!grilleValide) {
        afficherAlerte("Erreur", "Impossible de générer une grille 3x3 avec si peu de rappeurs. Ajoute plus de rappeurs dans rappeurs.json !");
        return;
    }

    afficherGrille();
}

function verifierGrilleFaisable(lignes, colonnes) {
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
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
    for (let i = 0; i < 3; i++) {
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
    document.getElementById('compteur-erreurs').textContent = `Erreurs : 0 / ${MAX_ERREURS}`;
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
    const texteSaisi = nettoyerTexte(event.target.value.toLowerCase());
    const liste = document.getElementById('suggestions-list');
    liste.innerHTML = ""; 
    if (texteSaisi.length < 2) return; 

    const resultats = donneesJeu.rappeurs.filter(r => 
        nettoyerTexte(r.nom.toLowerCase()).includes(texteSaisi) && !rappeursUtilises.includes(r.id)
    );
    resultats.slice(0, 6).forEach(rappeur => {
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
        if (grilleGagnee === 9) declarerFinDePartie(true);
    } else {
        erreurs++;
        document.getElementById('compteur-erreurs').textContent = `Erreurs : ${erreurs} / ${MAX_ERREURS}`;
        
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
// ==========================================
// --- SYSTÈME COLLABORATIF (FORMSPREE) ---
// ==========================================
const FORMSPREE_URL = "https://formspree.io/f/xeagzzbp"; // ex: https://formspree.io/f/abcd1234

document.addEventListener('DOMContentLoaded', () => {
    // Ouverture / Fermeture des modales
    document.getElementById('btn-open-ajout').addEventListener('click', () => {
        remplirFormulaireAjout();
        document.getElementById('modal-ajout').classList.remove('hidden');
    });
    document.getElementById('close-ajout').addEventListener('click', () => {
        document.getElementById('modal-ajout').classList.add('hidden');
    });

    document.getElementById('btn-open-erreur').addEventListener('click', () => {
        remplirFormulaireErreur();
        document.getElementById('modal-erreur').classList.remove('hidden');
    });
    document.getElementById('close-erreur').addEventListener('click', () => {
        document.getElementById('modal-erreur').classList.add('hidden');
    });

    // Soumission : Ajout de rappeur
    document.getElementById('form-ajout').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('ajout-nom').value.trim();
        const feats = document.getElementById('ajout-feats').value.trim();
        const checkboxes = document.querySelectorAll('#ajout-categories-list input[type="checkbox"]');
        
        let attributs = [];
        let nbCoches = 0;
        let categoriesTexte = [];

        checkboxes.forEach(cb => {
            if (cb.checked) {
                attributs.push(1);
                nbCoches++;
                categoriesTexte.push(cb.getAttribute('data-label'));
            } else {
                attributs.push(0);
            }
        });

        // Vérification de la règle des 3 catégories minimum
        const msgErreur = document.getElementById('ajout-erreur-msg');
        if (nbCoches < 3) {
            msgErreur.classList.remove('hidden');
            return;
        }
        msgErreur.classList.add('hidden');

        // Génère la ligne JSON prête à copier-coller !
        const idGenere = nettoyerTexte(nom.toLowerCase()).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const featsArray = feats ? feats.split(',').map(f => nettoyerTexte(f.trim().toLowerCase()).replace(/[^a-z0-9]+/g, '_')) : [];
        const ligneJSON = JSON.stringify({ id: idGenere, nom: nom, attributs: attributs, feats: featsArray });

        await envoyerVersFormspree({
            type_demande: "AJOUT RAPPEUR",
            rappeur: nom,
            categories_cochees: categoriesTexte.join(", "),
            ligne_json_prete: ligneJSON
        }, 'modal-ajout', 'form-ajout');
    });

    // Soumission : Signalement d'erreur
    document.getElementById('form-erreur').addEventListener('submit', async (e) => {
        e.preventDefault();
        await envoyerVersFormspree({
            type_demande: "SIGNALEMENT ERREUR",
            rappeur: document.getElementById('erreur-rappeur').value,
            categorie: document.getElementById('erreur-categorie').value,
            probleme: document.getElementById('erreur-type').value,
            explication: document.getElementById('erreur-details').value.trim() || "Aucune précision"
        }, 'modal-erreur', 'form-erreur');
    });
});

function remplirFormulaireAjout() {
    const container = document.getElementById('ajout-categories-list');
    if (container.children.length > 0 || !donneesJeu) return;

    Object.keys(donneesJeu._legende_attributs).forEach(index => {
        const labelText = donneesJeu._legende_attributs[index];
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `<input type="checkbox" value="${index}" data-label="${labelText}"> ${labelText}`;
        container.appendChild(label);
    });
}

function remplirFormulaireErreur() {
    const selectRappeur = document.getElementById('erreur-rappeur');
    const selectCat = document.getElementById('erreur-categorie');
    if (selectRappeur.children.length > 0 || !donneesJeu) return;

    // Liste des rappeurs triée par ordre alphabétique
    const rappeursTries = [...donneesJeu.rappeurs].sort((a, b) => a.nom.localeCompare(b.nom));
    rappeursTries.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nom;
        opt.textContent = r.nom;
        selectRappeur.appendChild(opt);
    });

    // Liste des catégories (JSON + Feats)
    Object.values(donneesJeu._legende_attributs).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        selectCat.appendChild(opt);
    });
    const optFeat = document.createElement('option');
    optFeat.value = "Featuring manquant / erroné";
    optFeat.textContent = "Featuring manquant / erroné (préciser en bas)";
    selectCat.appendChild(optFeat);
}

async function envoyerVersFormspree(payload, modalId, formId) {
    try {
        const response = await fetch(FORMSPREE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            document.getElementById(modalId).classList.add('hidden');
            document.getElementById(formId).reset();
            afficherAlerte("Merci !", "Ta suggestion a bien été envoyée pour vérification.");
        } else {
            afficherAlerte("Erreur", "Impossible d'envoyer le formulaire. Réessaie plus tard.");
        }
    } catch (err) {
        afficherAlerte("Erreur", "Problème de connexion.");
    }
}
