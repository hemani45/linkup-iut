// dashboard-enseignant.js - VERSION FINALE CORRIGÉE

// ===== INITIALISATION FIREBASE =====
const auth = firebase.auth();
const db = firebase.firestore();

// ===== VARIABLES GLOBALES =====
let uid = "";
let enseignantId = ""; // Format: "ens_diallo" ou "ens-diallo"
let nomEnseignant = "";
let prenomEnseignant = "";
let departement = "";
let grade = "";
let matieres = [];

// ===== FONCTIONS UTILITAIRES =====
function getField(data, possibleNames) {
    for (const name of possibleNames) {
        if (data[name] !== undefined && data[name] !== null) {
            return data[name];
        }
    }
    return null;
}

function formatDate(date) {
    if (!date) return "";
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error("Erreur formatage date:", error);
        return "Date invalide";
    }
}

function getCheckedValues(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

// ===== FONCTIONS POUR GÉRER L'EXPIRATION =====

// Filtrer les documents non expirés
function filtrerNonExpires(documents, joursExpiration) {
    const maintenant = new Date();
    return documents.filter(doc => {
        const data = doc.data();
        const datePublication = data.date || data.date_publication || new Date(0);
        
        // Convertir en Date
        const datePub = datePublication.toDate ? datePublication.toDate() : new Date(datePublication);
        
        // Calculer différence en jours
        const differenceJours = (maintenant - datePub) / (1000 * 60 * 60 * 24);
        
        // Retourner true si pas encore expiré
        return differenceJours < joursExpiration;
    });
}

// Afficher le temps restant
function getTempsRestant(datePublication, joursExpiration) {
    const datePub = datePublication.toDate ? datePublication.toDate() : new Date(datePublication);
    const dateExpiration = new Date(datePub);
    dateExpiration.setDate(dateExpiration.getDate() + joursExpiration);
    
    const maintenant = new Date();
    const difference = dateExpiration - maintenant;
    
    if (difference < 0) {
        return "⚠️ Expiré";
    }
    
    const joursRestants = Math.floor(difference / (1000 * 60 * 60 * 24));
    const heuresRestantes = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (joursRestants > 0) {
        return `⏳ ${joursRestants}j ${heuresRestantes}h`;
    } else {
        return `⏳ ${heuresRestantes}h`;
    }
}

// ===== GESTION DU MENU =====
function initialiserNavigation() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;

            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
            document.getElementById(section + 'Section').style.display = 'block';

            if (section === 'dashboard') {
                updateStats();
            }

            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    });

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            e.target !== menuToggle) {
            sidebar.classList.remove('active');
        }
    });
}

// ===== AUTHENTIFICATION ET CHARGEMENT DU PROFIL =====
async function initialiserAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        uid = user.uid;

        try {
            // Vérifier si c'est un enseignant via son email
            const enseignantQuery = await db.collection("enseignants")
                .where("email", "==", user.email)
                .limit(1)
                .get();

            if (enseignantQuery.empty) {
                alert("Accès refusé : Vous n'êtes pas enregistré comme enseignant");
                await auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            const enseignantDoc = enseignantQuery.docs[0];
            const data = enseignantDoc.data();
            
            enseignantId = `ens_${data.nom.toLowerCase()}_${data.prenom.toLowerCase()}`.replace(/\s+/g, '_');
            nomEnseignant = data.nom || "";
            prenomEnseignant = data.prenom || "";
            departement = data.departement || "";
            grade = data.grade || "";
            matieres = data.matiere || [];

            console.log("Enseignant connecté:", enseignantId);

            document.getElementById('userName').textContent = `${prenomEnseignant} ${nomEnseignant}`.trim() || "Enseignant";
            document.getElementById('userRole').textContent = `${grade} - ${departement}`;

            chargerMesAnnonces();
            chargerMesDocuments();
            chargerMesEvenements();
            chargerMesEmplois();
            updateStats();

        } catch (error) {
            console.error("Erreur chargement profil:", error);
            alert("Erreur de chargement du profil enseignant");
        }
    });
}

// ===== METTRE À JOUR LES STATISTIQUES =====
async function updateStats() {
    try {
        // Charger TOUTES les annonces et filtrer côté client
        const annoncesSnap = await db.collection("annonces").get();
        const annoncesCount = annoncesSnap.docs.filter(doc => {
            const data = doc.data();
            const auteur = getField(data, ['auteur-id', 'auteur_id', 'auteur']);
            return auteur === enseignantId;
        }).length;
        document.getElementById('annoncesCount').textContent = annoncesCount;

        // Charger TOUS les documents
        const docsSnap = await db.collection("documents").get();
        const docsCount = docsSnap.docs.filter(doc => {
            const data = doc.data();
            const auteur = getField(data, ['auteur_id', 'auteur-id', 'auteur']);
            return auteur === enseignantId;
        }).length;
        document.getElementById('documentsCount').textContent = docsCount;

        // Charger TOUS les événements
        const eventsSnap = await db.collection("evenements").get();
        const eventsCount = eventsSnap.docs.filter(doc => {
            const data = doc.data();
            const auteur = getField(data, ['auteur_id', 'auteur-id', 'auteur']);
            return auteur === enseignantId;
        }).length;
        document.getElementById('evenementsCount').textContent = eventsCount;

        // Charger TOUS les emplois du temps
        const emploisSnap = await db.collection("emplois_temps").get();
        const emploisCount = emploisSnap.docs.filter(doc => {
            const data = doc.data();
            const auteur = getField(data, ['auteur_id', 'auteur-id', 'auteur']);
            return auteur === enseignantId;
        }).length;
        document.getElementById('emploisCount').textContent = emploisCount;

    } catch (error) {
        console.error("Erreur mise à jour stats:", error);
    }
}

// ===== CHARGER MES ANNONCES (SANS INDEX) =====
async function chargerMesAnnonces() {
    try {
        // Charger TOUTES les annonces
        const snap = await db.collection("annonces").get();

        const div = document.getElementById("mesAnnoncesListe");
        
        if (snap.empty) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i><p>Aucune annonce publiée</p><small>Utilisez le formulaire pour créer votre première annonce</small></div>';
            return;
        }

        // Filtrer côté client
        const annoncesFiltrees = snap.docs
            .filter(doc => {
                const data = doc.data();
                const auteur = getField(data, ['auteur-id', 'auteur_id', 'auteur']);
                return auteur === enseignantId;
            })
            .sort((a, b) => {
                const dateA = getField(a.data(), ['date-publication', 'date_publication', 'date']) || new Date(0);
                const dateB = getField(b.data(), ['date-publication', 'date_publication', 'date']) || new Date(0);
                const timeA = dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
                const timeB = dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
                return timeB - timeA; // Décroissant
            });

        if (annoncesFiltrees.length === 0) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i><p>Aucune annonce publiée</p><small>Utilisez le formulaire pour créer votre première annonce</small></div>';
            return;
        }

        div.innerHTML = "";
        annoncesFiltrees.forEach(doc => {
            const a = doc.data();
            const annonceId = doc.id;
            
            const titre = a.titre || "Annonce sans titre";
            const contenu = a.contenu || "";
            const date = a["date-publication"] || a.date || new Date();
            
            const filieres = getField(a, ['filieres-cibles', 'filieres_cibles', 'filieres']) || [];
            const niveaux = getField(a, ['niveaux-cibles', 'niveaux_cibles', 'niveaux']) || [];

            div.innerHTML += `
                <div class="message small" data-id="${annonceId}" data-type="annonce">
                    <div class="message-sender">
                        <strong>${titre}</strong>
                        <div class="message-actions">
                            <button class="btn-edit" onclick="editerPublication('${annonceId}', 'annonce')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="supprimerPublication('${annonceId}', 'annonce')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="message-content">${contenu}</div>
                    <div class="message-time">
                        ${formatDate(date)}
                        ${filieres.length > 0 ? `<br><small>Filières: ${filieres.join(', ')}</small>` : ''}
                        ${niveaux.length > 0 ? `<br><small>Niveaux: ${niveaux.join(', ')}</small>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement annonces:", error);
        document.getElementById("mesAnnoncesListe").innerHTML = 
            '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement des annonces</p></div>';
    }
}

// ===== CHARGER MES DOCUMENTS (avec expiration 21 jours) =====
async function chargerMesDocuments() {
    try {
        const snap = await db.collection("documents").get();

        const div = document.getElementById("mesDocumentsListe");
        
        if (snap.empty) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Aucun document partagé</p><small>Les documents expirent après 21 jours</small></div>';
            return;
        }

        // 1. Filtrer par auteur
        let documentsFiltres = snap.docs.filter(doc => {
            const data = doc.data();
            const auteur = getField(data, ['auteur_id', 'auteur-id', 'auteur']);
            return auteur === enseignantId;
        });

        // 2. Filtrer les non expirés (21 jours)
        documentsFiltres = filtrerNonExpires(documentsFiltres, 21);

        // 3. Trier par date
        documentsFiltres.sort((a, b) => {
            const dateA = a.data().date || new Date(0);
            const dateB = b.data().date || new Date(0);
            const timeA = dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
            const timeB = dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
            return timeB - timeA;
        });

        if (documentsFiltres.length === 0) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Aucun document actif</p><small>Les documents expirent après 21 jours</small></div>';
            return;
        }

        div.innerHTML = "";
        documentsFiltres.forEach(doc => {
            const d = doc.data();
            const docId = doc.id;
            const date = d.date || new Date();
            
            const titre = d.titre || "Document sans titre";
            const description = d.description || "";
            const lien = d.lien || "#";
            
            const filieres = getField(d, ['filieres_cibles', 'filieres-cibles', 'filieres']) || [];
            const niveaux = getField(d, ['niveaux_cibles', 'niveaux-cibles', 'niveaux']) || [];

            div.innerHTML += `
                <div class="message small" data-id="${docId}" data-type="document">
                    <div class="message-sender">
                        <strong>${titre}</strong>
                        <div class="message-actions">
                            <span class="temps-restant" style="color: ${getTempsRestant(date, 21).includes('Expiré') ? 'var(--primary-red)' : 'var(--warning-orange)'}; font-size: 0.8rem; margin-right: 10px;">
                                ${getTempsRestant(date, 21)}
                            </span>
                            <button class="btn-edit" onclick="editerPublication('${docId}', 'document')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="supprimerPublication('${docId}', 'document')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="message-content">
                        ${description}
                        <br>
                        <a href="${lien}" target="_blank" class="btn-download">
                            <i class="fas fa-download"></i> Télécharger
                        </a>
                    </div>
                    <div class="message-time">
                        ${formatDate(date)}
                        ${filieres.length > 0 ? `<br><small>Filières: ${filieres.join(', ')}</small>` : ''}
                        ${niveaux.length > 0 ? `<br><small>Niveaux: ${niveaux.join(', ')}</small>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement documents:", error);
        document.getElementById("mesDocumentsListe").innerHTML = 
            '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement des documents</p></div>';
    }
}

// ===== CHARGER MES ÉVÉNEMENTS (SANS INDEX) =====
async function chargerMesEvenements() {
    try {
        // Charger TOUS les événements
        const snap = await db.collection("evenements").get();

        const div = document.getElementById("mesEvenementsListe");
        
        if (snap.empty) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Aucun événement créé</p><small>Utilisez le formulaire pour créer votre premier événement</small></div>';
            return;
        }

        // Filtrer côté client
        const evenementsFiltres = snap.docs
            .filter(doc => {
                const data = doc.data();
                const auteur = getField(data, ['auteur_id', 'auteur-id', 'auteur']);
                return auteur === enseignantId;
            })
            .sort((a, b) => {
                const dateA = a.data().date_debut || new Date(0);
                const dateB = b.data().date_debut || new Date(0);
                const timeA = dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
                const timeB = dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
                return timeB - timeA; // Décroissant
            });

        if (evenementsFiltres.length === 0) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Aucun événement créé</p><small>Utilisez le formulaire pour créer votre premier événement</small></div>';
            return;
        }

        div.innerHTML = "";
        evenementsFiltres.forEach(doc => {
            const e = doc.data();
            const eventId = doc.id;
            
            const titre = e.titre || e.tritre || "Événement sans titre";
            const description = e.description || "";
            const dateDebut = e.date_debut || new Date();
            const dateFin = e.date_fin || "";
            const lieu = e.lieu || "";
            
            const filieres = getField(e, ['filieres_cibles', 'filieres-cibles', 'filieres']) || [];
            const niveaux = getField(e, ['niveaux_cibles', 'niveaux-cibles', 'niveaux']) || [];

            div.innerHTML += `
                <div class="message small" data-id="${eventId}" data-type="evenement">
                    <div class="message-sender">
                        <strong>${titre}</strong>
                        <div class="message-actions">
                            <button class="btn-edit" onclick="editerPublication('${eventId}', 'evenement')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="supprimerPublication('${eventId}', 'evenement')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="message-content">
                        ${description}
                        ${lieu ? `<br><strong>Lieu:</strong> ${lieu}` : ''}
                        ${dateFin ? `<br><strong>Date fin:</strong> ${formatDate(dateFin)}` : ''}
                    </div>
                    <div class="message-time">
                        📅 <strong>Début:</strong> ${formatDate(dateDebut)}
                        ${filieres.length > 0 ? `<br><small>Filières: ${filieres.join(', ')}</small>` : ''}
                        ${niveaux.length > 0 ? `<br><small>Niveaux: ${niveaux.join(', ')}</small>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement événements:", error);
        document.getElementById("mesEvenementsListe").innerHTML = 
            '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement des événements</p></div>';
    }
}

// ===== CHARGER MES EMPLOIS DU TEMPS (avec expiration 21 jours) =====
async function chargerMesEmplois() {
    try {
        const snap = await db.collection("emplois_temps").get();

        const div = document.getElementById("mesEmploisListe");
        
        if (snap.empty) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>Aucun emploi du temps publié</p><small>Les emplois du temps expirent après 21 jours</small></div>';
            return;
        }

        // 1. Filtrer par auteur
        let emploisFiltres = snap.docs.filter(doc => {
            const data = doc.data();
            const auteur = getField(data, ['auteur_id', 'auteur-id', 'auteur']);
            return auteur === enseignantId;
        });

        // 2. Filtrer les non expirés (21 jours)
        emploisFiltres = filtrerNonExpires(emploisFiltres, 21);

        // 3. Trier par date
        emploisFiltres.sort((a, b) => {
            const dateA = a.data().date || new Date(0);
            const dateB = b.data().date || new Date(0);
            const timeA = dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
            const timeB = dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
            return timeB - timeA;
        });

        if (emploisFiltres.length === 0) {
            div.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>Aucun emploi du temps actif</p><small>Les emplois du temps expirent après 21 jours</small></div>';
            return;
        }

        div.innerHTML = "";
        emploisFiltres.forEach(doc => {
            const e = doc.data();
            const emploiId = doc.id;
            const date = e.date || new Date();
            
            const titre = e.titre || "Emploi du temps";
            const lien = e.lien || "#";
            
            const filieres = getField(e, ['filieres_cibles', 'filieres-cibles', 'filieres']) || [];
            const niveaux = getField(e, ['niveaux_cibles', 'niveaux-cibles', 'niveaux']) || [];

            div.innerHTML += `
                <div class="message small" data-id="${emploiId}" data-type="emploi">
                    <div class="message-sender">
                        <strong>${titre}</strong>
                        <div class="message-actions">
                            <span class="temps-restant" style="color: ${getTempsRestant(date, 21).includes('Expiré') ? 'var(--primary-red)' : 'var(--warning-orange)'}; font-size: 0.8rem; margin-right: 10px;">
                                ${getTempsRestant(date, 21)}
                            </span>
                            <button class="btn-edit" onclick="editerPublication('${emploiId}', 'emploi')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="supprimerPublication('${emploiId}', 'emploi')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="message-content">
                        <a href="${lien}" target="_blank" class="btn-download">
                            <i class="fas fa-download"></i> Télécharger l'emploi du temps
                        </a>
                    </div>
                    <div class="message-time">
                        ${formatDate(date)}
                        ${filieres.length > 0 ? `<br><small>Filières: ${filieres.join(', ')}</small>` : ''}
                        ${niveaux.length > 0 ? `<br><small>Niveaux: ${niveaux.join(', ')}</small>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement emplois:", error);
        document.getElementById("mesEmploisListe").innerHTML = 
            '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur de chargement des emplois du temps</p></div>';
    }
}

// ===== FORMULAIRES DE CRÉATION AVEC STORAGE =====
function initialiserFormulaires() {
    // Formulaire annonce (inchangé)
    document.getElementById("formAnnonce").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const contenu = document.getElementById("contenuAnnonce").value.trim();
        if (!contenu) {
            alert("Veuillez écrire le contenu de l'annonce");
            return;
        }
        
        const filieres = getCheckedValues("filiere");
        const niveaux = getCheckedValues("niveau");
        
        try {
            await db.collection("annonces").add({
                "auteur-id": enseignantId,
                contenu: contenu,
                "date-publication": new Date(),
                "filieres-cibles": filieres,
                "niveaux-cibles": niveaux,
                titre: `Annonce de ${prenomEnseignant} ${nomEnseignant}`
            });
            
            alert("✅ Annonce publiée avec succès !");
            e.target.reset();
            chargerMesAnnonces();
            updateStats();
            
        } catch (error) {
            console.error("Erreur publication annonce:", error);
            alert("Erreur lors de la publication : " + error.message);
        }
    });

    // Formulaire document avec Firebase Storage (CORRIGÉ)
    document.getElementById("formDocument").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const titre = document.getElementById("titreDocument").value.trim();
        const description = document.getElementById("descriptionDocument").value.trim();
        const fichierInput = document.getElementById("fichierDocument");
        const fichier = fichierInput.files[0];
        
        if (!titre || !fichier) {
            alert("Veuillez remplir le titre et sélectionner un fichier");
            return;
        }
        
        // Validation du fichier
        if (fichier.size > 10 * 1024 * 1024) { // 10MB max
            alert("Le fichier est trop volumineux (max 10MB)");
            return;
        }
        
        const filieres = getCheckedValues("filiere-doc");
        const niveaux = getCheckedValues("niveau-doc");
        
        try {
            // 1. Connexion directe à Google Cloud Storage
            const storage = firebase.app().storage('gs://linkup-iut.appspot.com');
            const storageRef = storage.ref();
            const fileRef = storageRef.child(`documents/${Date.now()}_${fichier.name}`);
            
            // 2. Upload le fichier
            const uploadTask = await fileRef.put(fichier);
            
            // 3. Récupérer l'URL de téléchargement
            const downloadURL = await uploadTask.ref.getDownloadURL();
            
            // 4. Enregistrer dans Firestore avec la VRAIE URL
            await db.collection("documents").add({
                titre: titre,
                description: description,
                lien: downloadURL,
                nom_fichier: fichier.name,
                taille_fichier: fichier.size,
                type_fichier: fichier.type,
                auteur_id: enseignantId,
                date: new Date(),
                filieres_cibles: filieres,
                niveaux_cibles: niveaux
            });
            
            alert("✅ Document partagé avec succès !");
            e.target.reset();
            chargerMesDocuments();
            updateStats();
            
        } catch (error) {
            console.error("Erreur upload document:", error);
            alert("Erreur lors du partage : " + error.message);
        }
    });

    // Formulaire événement (inchangé)
    document.getElementById("formEvenement").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const titre = document.getElementById("titreEvenement").value.trim();
        const description = document.getElementById("descriptionEvenement").value.trim();
        const dateDebut = document.getElementById("dateDebutEvenement").value;
        const dateFin = document.getElementById("dateFinEvenement").value;
        const lieu = document.getElementById("lieuEvenement").value.trim();
        
        if (!titre || !description || !dateDebut) {
            alert("Veuillez remplir les champs obligatoires (titre, description, date de début)");
            return;
        }
        
        if (dateFin && new Date(dateFin) < new Date(dateDebut)) {
            alert("La date de fin doit être après la date de début");
            return;
        }
        
        const filieres = getCheckedValues("filiere-event");
        const niveaux = getCheckedValues("niveau-event");
        
        try {
            await db.collection("evenements").add({
                titre: titre,
                description: description,
                date_debut: new Date(dateDebut),
                date_fin: dateFin ? new Date(dateFin) : null,
                lieu: lieu,
                auteur_id: enseignantId,
                filieres_cibles: filieres,
                niveaux_cibles: niveaux
            });
            
            alert("✅ Événement créé avec succès !");
            e.target.reset();
            chargerMesEvenements();
            updateStats();
            
        } catch (error) {
            console.error("Erreur création événement:", error);
            alert("Erreur lors de la création de l'événement : " + error.message);
        }
    });

    // Formulaire emploi du temps avec Firebase Storage (CORRIGÉ)
    document.getElementById("formEmploi").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const titre = document.getElementById("titreEmploi").value.trim();
        const fichierInput = document.getElementById("fichierEmploi");
        const fichier = fichierInput.files[0];
        
        if (!titre || !fichier) {
            alert("Veuillez remplir le titre et sélectionner un fichier");
            return;
        }
        
        // Validation du fichier - Formats étendus
        const extensionsValides = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
        const extension = fichier.name.toLowerCase().substring(fichier.name.lastIndexOf('.'));
        
        if (!extensionsValides.includes(extension)) {
            alert("Format de fichier non supporté. Utilisez PDF, JPG, PNG, Word, Excel, PowerPoint ou TXT.");
            return;
        }
        
        if (fichier.size > 10 * 1024 * 1024) { // 10MB max
            alert("Le fichier est trop volumineux (max 10MB)");
            return;
        }
        
        const filieres = getCheckedValues("filiere-emploi");
        const niveaux = getCheckedValues("niveau-emploi");
        
        try {
            // 1. Connexion directe à Google Cloud Storage
            const storage = firebase.app().storage('gs://linkup-iut.appspot.com');
            const storageRef = storage.ref();
            const fileRef = storageRef.child(`emplois/${Date.now()}_${fichier.name}`);
            
            // 2. Upload le fichier
            const uploadTask = await fileRef.put(fichier);
            
            // 3. Récupérer l'URL de téléchargement
            const downloadURL = await uploadTask.ref.getDownloadURL();
            
            // 4. Enregistrer dans Firestore avec la VRAIE URL
            await db.collection("emplois_temps").add({
                titre: titre,
                lien: downloadURL,
                nom_fichier: fichier.name,
                taille_fichier: fichier.size,
                type_fichier: fichier.type,
                auteur_id: enseignantId,
                date: new Date(),
                filieres_cibles: filieres,
                niveaux_cibles: niveaux
            });
            
            alert("✅ Emploi du temps publié avec succès !");
            e.target.reset();
            chargerMesEmplois();
            updateStats();
            
        } catch (error) {
            console.error("Erreur upload emploi:", error);
            alert("Erreur lors de la publication : " + error.message);
        }
    });

    // Modal d'édition (inchangé)
    document.getElementById("formEdit").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("editId").value;
        const type = document.getElementById("editType").value;
        const nouveauContenu = document.getElementById("editContenu").value.trim();
        
        if (!nouveauContenu) {
            alert("Le contenu ne peut pas être vide");
            return;
        }
        
        try {
            let updateData = {};
            let collectionName = "";
            
            switch(type) {
                case 'annonce': 
                    collectionName = "annonces";
                    updateData = { contenu: nouveauContenu };
                    break;
                case 'document': 
                    collectionName = "documents";
                    updateData = { description: nouveauContenu };
                    break;
                case 'evenement': 
                    collectionName = "evenements";
                    updateData = { description: nouveauContenu };
                    break;
                case 'emploi': 
                    collectionName = "emplois_temps";
                    updateData = { titre: nouveauContenu };
                    break;
            }
            
            await db.collection(collectionName).doc(id).update(updateData);
            
            alert("✅ Modification enregistrée !");
            fermerModal();
            
            // Recharger
            switch(type) {
                case 'annonce': chargerMesAnnonces(); break;
                case 'document': chargerMesDocuments(); break;
                case 'evenement': chargerMesEvenements(); break;
                case 'emploi': chargerMesEmplois(); break;
            }
            updateStats();
            
        } catch (error) {
            console.error("Erreur modification:", error);
            alert("Erreur lors de la modification : " + error.message);
        }
    });

    document.getElementById("btnDelete").addEventListener("click", async () => {
        const id = document.getElementById("editId").value;
        const type = document.getElementById("editType").value;
        
        if (!confirm("Voulez-vous vraiment supprimer cette publication ? Cette action est irréversible.")) {
            return;
        }
        
        try {
            let collectionName = "";
            switch(type) {
                case 'annonce': collectionName = "annonces"; break;
                case 'document': collectionName = "documents"; break;
                case 'evenement': collectionName = "evenements"; break;
                case 'emploi': collectionName = "emplois_temps"; break;
            }
            
            await db.collection(collectionName).doc(id).delete();
            
            alert("✅ Publication supprimée !");
            fermerModal();
            
            switch(type) {
                case 'annonce': chargerMesAnnonces(); break;
                case 'document': chargerMesDocuments(); break;
                case 'evenement': chargerMesEvenements(); break;
                case 'emploi': chargerMesEmplois(); break;
            }
            updateStats();
            
        } catch (error) {
            console.error("Erreur suppression:", error);
            alert("Erreur lors de la suppression : " + error.message);
        }
    });

    document.getElementById("btnCancelEdit").addEventListener("click", fermerModal);
    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
            auth.signOut().then(() => {
                window.location.href = "login.html";
            });
        }
    });
}

// ===== FONCTIONS POUR LE MODAL D'ÉDITION =====
async function editerPublication(id, type) {
    try {
        let collectionName = "";
        switch(type) {
            case 'annonce': collectionName = "annonces"; break;
            case 'document': collectionName = "documents"; break;
            case 'evenement': collectionName = "evenements"; break;
            case 'emploi': collectionName = "emplois_temps"; break;
        }
        
        const doc = await db.collection(collectionName).doc(id).get();
        
        if (!doc.exists) {
            alert("Publication introuvable");
            return;
        }
        
        const data = doc.data();
        let contenu = "";
        let titreModal = "";
        
        switch(type) {
            case 'annonce':
                contenu = data.contenu || "";
                titreModal = "Modifier l'annonce";
                break;
            case 'document':
                contenu = data.description || "";
                titreModal = "Modifier la description";
                break;
            case 'evenement':
                contenu = data.description || "";
                titreModal = "Modifier la description";
                break;
            case 'emploi':
                contenu = data.titre || "";
                titreModal = "Modifier le titre";
                break;
        }
        
        document.getElementById("editId").value = id;
        document.getElementById("editType").value = type;
        document.getElementById("editContenu").value = contenu;
        document.querySelector("#editModal h3").innerHTML = `<i class="fas fa-edit"></i> ${titreModal}`;
        
        document.getElementById("editModal").style.display = "flex";
        
    } catch (error) {
        console.error("Erreur chargement édition:", error);
        alert("Erreur lors du chargement de la publication : " + error.message);
    }
}

async function supprimerPublication(id, type) {
    if (!confirm("Voulez-vous vraiment supprimer cette publication ? Cette action est irréversible.")) {
        return;
    }
    
    try {
        let collectionName = "";
        switch(type) {
            case 'annonce': collectionName = "annonces"; break;
            case 'document': collectionName = "documents"; break;
            case 'evenement': collectionName = "evenements"; break;
            case 'emploi': collectionName = "emplois_temps"; break;
        }
        
        await db.collection(collectionName).doc(id).delete();
        
        alert("✅ Publication supprimée !");
        
        switch(type) {
            case 'annonce': chargerMesAnnonces(); break;
            case 'document': chargerMesDocuments(); break;
            case 'evenement': chargerMesEvenements(); break;
            case 'emploi': chargerMesEmplois(); break;
        }
        updateStats();
        
    } catch (error) {
        console.error("Erreur suppression:", error);
        alert("Erreur lors de la suppression : " + error.message);
    }
}

function fermerModal() {
    document.getElementById("editModal").style.display = "none";
    document.getElementById("formEdit").reset();
}

// ===== INITIALISATION GÉNÉRALE =====
function initialiserDashboard() {
    initialiserNavigation();
    initialiserAuth();
    initialiserFormulaires();

    window.addEventListener('resize', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
        }
    });
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', initialiserDashboard);

// ===== EXPORT DES FONCTIONS POUR HTML =====
window.editerPublication = editerPublication;
window.supprimerPublication = supprimerPublication;