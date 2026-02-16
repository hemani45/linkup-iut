// dashboard-etudiant.js - VERSION FINALE AVEC EXPIRATION 21 JOURS

// ===== INITIALISATION FIREBASE =====
const auth = firebase.auth();
const db = firebase.firestore();

// ===== VARIABLES GLOBALES =====
let uid = "";
let matricule = "";
let filiere = "";
let niveau = 0;
let nomEtudiant = "";
let clubActifId = null;
let clubActifNom = "";
let unsubscribeMessages = null;
let clubEnGestion = null;

// ===== FONCTIONS UTILITAIRES =====

// 1. Gérer les différents noms de champs dans la base de données
function getField(data, possibleNames) {
    for (const name of possibleNames) {
        if (data[name] !== undefined && data[name] !== null && data[name] !== '') {
            return data[name];
        }
    }
    return null;
}

// 2. Normaliser les chaînes pour comparaison
function normalizeString(str) {
    if (!str && str !== 0) return '';
    return str.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

// 3. Vérifier si un étudiant est concerné par un élément
function estConcerné(element, filiereEtudiant, niveauEtudiant) {
    const filieres = getField(element, [
        'filieres-cibles', 'filieres_cibles', 'filieres_cible', 
        'filieres', 'filiere-cible', 'filiere_cible', 'filiere'
    ]);
    
    const niveaux = getField(element, [
        'niveaux-cibles', 'niveaux_cibles', 'niveaux_cible',
        'niveaux', 'niveau-cible', 'niveau_cible', 'niveau'
    ]);
    
    const filiereNorm = normalizeString(filiereEtudiant);
    const niveauNorm = normalizeString(niveauEtudiant.toString());
    
    if (!filieres) return true;
    if (!niveaux) return true;
    
    const filieresArray = Array.isArray(filieres) ? filieres : [filieres];
    const niveauxArray = Array.isArray(niveaux) ? niveaux : [niveaux];
    
    const filiereMatch = filieresArray.some(f => {
        const fNorm = normalizeString(f);
        return fNorm === filiereNorm || 
               fNorm.includes(filiereNorm) || 
               filiereNorm.includes(fNorm) ||
               fNorm === 'tous' || 
               fNorm === 'all' ||
               fNorm === '';
    });
    
    const niveauMatch = niveauxArray.some(n => {
        const nNorm = normalizeString(n.toString());
        return nNorm === niveauNorm || 
               nNorm.includes(niveauNorm) ||
               niveauNorm.includes(nNorm) ||
               nNorm === 'tous' || 
               nNorm === 'all' ||
               nNorm === '';
    });
    
    return filiereMatch && niveauMatch;
}

// 4. Filtrer les éléments non expirés (NOUVELLE FONCTION)
function filtrerNonExpires(elements, joursExpiration) {
    const maintenant = new Date();
    return elements.filter(element => {
        const datePublication = element.date || element.date_debut || new Date(0);
        
        // Convertir en Date
        const datePub = datePublication.toDate ? datePublication.toDate() : new Date(datePublication);
        
        // Calculer différence en jours
        const differenceJours = (maintenant - datePub) / (1000 * 60 * 60 * 24);
        
        // Retourner true si pas encore expiré
        return differenceJours < joursExpiration;
    });
}

// 5. Formater la date
function formatDate(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 6. Formater date simple
function formatDateSimple(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short'
    });
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

            if (section === 'messagerie') {
                chargerClubsPourMessagerie();
                document.getElementById('selectionClubContainer').style.display = 'block';
                document.getElementById('chatContainer').style.display = 'none';
                clubActifId = null;
                
                if (unsubscribeMessages) {
                    unsubscribeMessages();
                    unsubscribeMessages = null;
                }
            }

            if (section === 'clubs') {
                chargerMesClubs();
                document.getElementById('sectionMesClubs').style.display = 'block';
                document.getElementById('sectionGererClub').style.display = 'none';
            }

            if (section === 'tous-clubs') {
                chargerTousClubs();
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
function initialiserAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        uid = user.uid;

        try {
            const etuDoc = await db.collection("etudiants").doc(uid).get();
            if (!etuDoc.exists) {
                alert("Profil étudiant introuvable");
                await auth.signOut();
                return;
            }

            const data = etuDoc.data();
            filiere = data.filiere || "";
            niveau = data.niveau || 0;
            matricule = data.matricule || "";
            nomEtudiant = (data.prenom || "") + " " + (data.nom || "");

            document.getElementById('userName').textContent = nomEtudiant.trim() || "Étudiant";
            document.getElementById('userDetails').textContent = `${filiere} - Niveau ${niveau}`;

            chargerToutesAnnonces();
            chargerTousEvenements();
            chargerTousDocuments();
            chargerEmploi();
            chargerMesClubs();

        } catch (error) {
            console.error("Erreur:", error);
            alert("Erreur de chargement du profil");
        }
    });
}

// ===== CHARGEMENT DES ANNONCES (ENSEIGNANTS + CLUBS) =====
async function chargerToutesAnnonces() {
    try {
        const div = document.getElementById("annoncesListe");
        div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Chargement des annonces...</p>';
        
        let toutesAnnonces = [];
        
        // 1. Annonces des enseignants
        try {
            const snapEnseignants = await db.collection("annonces")
                .orderBy("date-publication", "desc")
                .limit(20)
                .get();
            
            snapEnseignants.forEach(doc => {
                const data = doc.data();
                if (estConcerné(data, filiere, niveau)) {
                    toutesAnnonces.push({
                        titre: data.titre || "Annonce",
                        contenu: data.contenu || "",
                        date: data["date-publication"] || new Date(),
                        type: 'enseignant',
                        source: data["auteur-id"] || 'Enseignant',
                        badge: 'enseignant'
                    });
                }
            });
        } catch (error) {
            console.log("Erreur chargement annonces enseignants:", error);
        }
        
        // 2. Annonces des clubs
        try {
            const clubsSnap = await db.collection("clubs")
                .where("membre", "array-contains", matricule)
                .get();
            
            if (!clubsSnap.empty) {
                const clubIds = clubsSnap.docs.map(doc => doc.id);
                
                if (clubIds.length > 0) {
                    const snapClubs = await db.collection("annonces_clubs")
                        .where("clubId", "in", clubIds.slice(0, 10))
                        .orderBy("date", "desc")
                        .limit(15)
                        .get();
                    
                    for (const doc of snapClubs.docs) {
                        const annonce = doc.data();
                        try {
                            const clubDoc = await db.collection("clubs").doc(annonce.clubId).get();
                            if (clubDoc.exists) {
                                const clubData = clubDoc.data();
                                toutesAnnonces.push({
                                    titre: `[CLUB] ${clubData.nom || 'Club'}`,
                                    contenu: annonce.contenu || "",
                                    date: annonce.date || new Date(),
                                    type: 'club',
                                    source: clubData.nom || 'Club',
                                    badge: 'club',
                                    clubId: annonce.clubId
                                });
                            }
                        } catch (e) {
                            console.log("Club introuvable pour annonce:", annonce.clubId);
                        }
                    }
                }
            }
        } catch (error) {
            console.log("Erreur chargement annonces clubs:", error);
        }
        
        toutesAnnonces.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return dateB - dateA;
        });
        
        toutesAnnonces = toutesAnnonces.slice(0, 20);
        
        if (toutesAnnonces.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucune annonce pour le moment</p>';
            return;
        }
        
        div.innerHTML = '';
        toutesAnnonces.forEach(annonce => {
            const badgeHTML = annonce.badge === 'club' ? 
                '<span class="badge badge-club" style="margin-left: 10px;"><i class="fas fa-users"></i> Club</span>' : 
                '<span class="badge" style="margin-left: 10px; background: rgba(58, 134, 255, 0.2); color: var(--info-blue); border: 1px solid var(--info-blue);"><i class="fas fa-chalkboard-teacher"></i> Enseignant</span>';
            
            div.innerHTML += `
                <div class="message">
                    <div class="message-sender">
                        ${annonce.titre} ${badgeHTML}
                    </div>
                    <div class="message-content">${annonce.contenu}</div>
                    <div class="message-time">
                        <i class="far fa-clock"></i> ${formatDate(annonce.date)}
                        ${annonce.source ? `<span style="margin-left: 10px; color: var(--text-muted);"><i class="fas fa-user"></i> ${annonce.source}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error("Erreur chargement annonces:", error);
        document.getElementById("annoncesListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des annonces</p>';
    }
}

// ===== CHARGEMENT DES ÉVÉNEMENTS (ENSEIGNANTS + CLUBS) =====
async function chargerTousEvenements() {
    try {
        const div = document.getElementById("evenementsListe");
        div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Chargement des événements...</p>';
        
        let tousEvenements = [];
        
        // 1. Événements des enseignants
        try {
            const snapEnseignants = await db.collection("evenements")
                .orderBy("date_debut", "asc")
                .limit(20)
                .get();
            
            snapEnseignants.forEach(doc => {
                const data = doc.data();
                if (estConcerné(data, filiere, niveau)) {
                    const titre = data.titre || data.tritre || "Événement";
                    tousEvenements.push({
                        titre: titre,
                        description: data.description || "",
                        date_debut: data.date_debut || new Date(),
                        type: 'enseignant',
                        source: data.auteur_id || 'Enseignant',
                        badge: 'enseignant'
                    });
                }
            });
        } catch (error) {
            console.log("Erreur chargement événements enseignants:", error);
        }
        
        // 2. Événements des clubs
        try {
            const clubsSnap = await db.collection("clubs")
                .where("membre", "array-contains", matricule)
                .get();
            
            if (!clubsSnap.empty) {
                const clubIds = clubsSnap.docs.map(doc => doc.id);
                
                if (clubIds.length > 0) {
                    const snapClubs = await db.collection("evenements_clubs")
                        .where("clubId", "in", clubIds.slice(0, 10))
                        .orderBy("date", "asc")
                        .limit(15)
                        .get();
                    
                    for (const doc of snapClubs.docs) {
                        const evenement = doc.data();
                        try {
                            const clubDoc = await db.collection("clubs").doc(evenement.clubId).get();
                            if (clubDoc.exists) {
                                const clubData = clubDoc.data();
                                tousEvenements.push({
                                    titre: `[CLUB] ${evenement.titre || 'Événement'}`,
                                    description: evenement.description || "",
                                    date_debut: evenement.date || new Date(),
                                    type: 'club',
                                    source: clubData.nom || 'Club',
                                    badge: 'club',
                                    clubId: evenement.clubId
                                });
                            }
                        } catch (e) {
                            console.log("Club introuvable pour événement:", evenement.clubId);
                        }
                    }
                }
            }
        } catch (error) {
            console.log("Erreur chargement événements clubs:", error);
        }
        
        tousEvenements.sort((a, b) => {
            const dateA = a.date_debut?.toDate ? a.date_debut.toDate().getTime() : new Date(a.date_debut).getTime();
            const dateB = b.date_debut?.toDate ? b.date_debut.toDate().getTime() : new Date(b.date_debut).getTime();
            return dateA - dateB;
        });
        
        const maintenant = new Date();
        tousEvenements = tousEvenements.filter(e => {
            const dateEvent = e.date_debut?.toDate ? e.date_debut.toDate() : new Date(e.date_debut);
            return dateEvent >= maintenant;
        });
        
        tousEvenements = tousEvenements.slice(0, 15);
        
        if (tousEvenements.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun événement à venir</p>';
            return;
        }
        
        div.innerHTML = '';
        tousEvenements.forEach(evenement => {
            const badgeHTML = evenement.badge === 'club' ? 
                '<span class="badge badge-club" style="margin-left: 10px;"><i class="fas fa-users"></i> Club</span>' : 
                '<span class="badge" style="margin-left: 10px; background: rgba(58, 134, 255, 0.2); color: var(--info-blue); border: 1px solid var(--info-blue);"><i class="fas fa-chalkboard-teacher"></i> Enseignant</span>';
            
            div.innerHTML += `
                <div class="message">
                    <div class="message-sender">
                        ${evenement.titre} ${badgeHTML}
                    </div>
                    <div class="message-content">${evenement.description}</div>
                    <div class="message-time">
                        <i class="fas fa-calendar-alt"></i> ${formatDate(evenement.date_debut)}
                        ${evenement.source ? `<span style="margin-left: 10px; color: var(--text-muted);"><i class="fas fa-user"></i> ${evenement.source}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error("Erreur chargement événements:", error);
        document.getElementById("evenementsListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des événements</p>';
    }
}

// ===== CHARGEMENT DES DOCUMENTS (ENSEIGNANTS) =====
async function chargerTousDocuments() {
    try {
        const div = document.getElementById("documentsListe");
        div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Chargement des documents...</p>';
        
        let tousDocuments = [];
        
        try {
            const snap = await db.collection("documents")
                .orderBy("date", "desc")
                .limit(20)
                .get();
            
            snap.forEach(doc => {
                const data = doc.data();
                if (estConcerné(data, filiere, niveau)) {
                    tousDocuments.push({
                        titre: data.titre || "Document",
                        description: data.description || "",
                        date: data.date || new Date(),
                        lien: data.lien || data.url || data.fileUrl || "",
                        type: 'document',
                        source: data.auteur || data["auteur-id"] || 'Enseignant'
                    });
                }
            });
        } catch (error) {
            console.log("Erreur chargement documents:", error);
        }
        
        tousDocuments.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return dateB - dateA;
        });
        
        // AJOUT : Filtrer les documents expirés (21 jours)
        tousDocuments = filtrerNonExpires(tousDocuments, 21);
        
        if (tousDocuments.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun document disponible</p>';
            return;
        }
        
        div.innerHTML = '';
        tousDocuments.forEach(doc => {
            const getBoutonDocument = (lien, titre) => {
                if (!lien) return '';
                
                const nomFichier = titre.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
                const estLienExterne = lien.includes('http') || 
                                       lien.includes('drive.google.com') ||
                                       lien.includes('firebasestorage.googleapis.com');
                
                if (estLienExterne) {
                    return `<a href="${lien}" target="_blank" class="btn-download" title="Ouvrir dans un nouvel onglet">
                               <i class="fas fa-external-link-alt"></i> Ouvrir
                            </a>`;
                } else {
                    return `<a href="${lien}" class="btn-download" download="${nomFichier}" title="Télécharger le fichier">
                               <i class="fas fa-download"></i> Télécharger
                            </a>`;
                }
            };
            
            const boutonHTML = getBoutonDocument(doc.lien, doc.titre);
            
            div.innerHTML += `
                <div class="message">
                    <div class="message-sender">
                        ${doc.titre}
                        ${boutonHTML}
                    </div>
                    <div class="message-content">${doc.description}</div>
                    <div class="message-time">
                        <i class="fas fa-file-alt"></i> ${formatDate(doc.date)}
                        <span style="margin-left: 10px; color: var(--text-muted);">
                            <i class="fas fa-user"></i> ${doc.source}
                        </span>
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error("Erreur chargement documents:", error);
        document.getElementById("documentsListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des documents</p>';
    }
}

// ===== CHARGEMENT DE L'EMPLOI DU TEMPS (ENSEIGNANTS) =====
async function chargerEmploi() {
    try {
        const snap = await db.collection("emplois_temps")
            .orderBy("date", "desc")
            .limit(5)
            .get();

        const div = document.getElementById("emploiListe");
        div.innerHTML = "";

        const emploisFiltrés = snap.docs.filter(doc => {
            const e = doc.data();
            return estConcerné(e, filiere, niveau);
        });

        if (emploisFiltrés.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun emploi du temps disponible</p>';
            return;
        }

        // AJOUT : Convertir en objets et filtrer les expirés
        const emploisData = emploisFiltrés.map(doc => doc.data());
        const emploisNonExpires = filtrerNonExpires(emploisData, 21);

        if (emploisNonExpires.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun emploi du temps disponible</p>';
            return;
        }

        const e = emploisNonExpires[0]; // Prendre le plus récent non expiré
        const lien = e.lien || e.url || e.fileUrl || "";
        const titre = e.titre || "Emploi du temps";
        const date = e.date ? formatDate(e.date) : "";
        
        if (lien) {
            const getBoutonEmploi = (lien, titre) => {
                const nomFichier = (titre || 'emploi_du_temps').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
                const estLienExterne = lien.includes('http') || 
                                       lien.includes('drive.google.com') ||
                                       lien.includes('firebasestorage.googleapis.com');
                
                if (estLienExterne) {
                    return `<a href="${lien}" target="_blank" class="btn" style="font-size: 1.1rem;" title="Ouvrir dans un nouvel onglet">
                               <i class="fas fa-external-link-alt"></i> Voir l'emploi du temps
                            </a>`;
                } else {
                    return `<a href="${lien}" class="btn" style="font-size: 1.1rem;" download="${nomFichier}" title="Télécharger le fichier">
                               <i class="fas fa-download"></i> Télécharger l'emploi du temps
                            </a>`;
                }
            };
            
            const boutonHTML = getBoutonEmploi(lien, titre);
            
            div.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <h4 style="margin-bottom: 15px; color: var(--primary-yellow);">
                        <i class="fas fa-calendar-alt"></i> ${titre}
                    </h4>
                    ${date ? `<p style="color: var(--text-muted); margin-bottom: 20px;">Mis à jour le ${date}</p>` : ''}
                    ${boutonHTML}
                    <p style="margin-top: 15px; color: var(--text-muted); font-size: 0.9rem;">
                        <i class="fas fa-info-circle"></i> Pour ${e.filiere || 'votre filière'} - Niveau ${e.niveau || 'votre niveau'}
                    </p>
                </div>
            `;
        } else {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Lien de téléchargement indisponible</p>';
        }
    } catch (error) {
        console.error("Erreur chargement emploi:", error);
        document.getElementById("emploiListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement de l\'emploi du temps</p>';
    }
}

// ===== MES CLUBS (PRÉSIDENT) =====
async function chargerMesClubs() {
    try {
        const snap = await db.collection("clubs")
            .where("createur_id", "==", matricule)
            .get();

        const div = document.getElementById("mesClubsListe");
        
        if (snap.empty) {
            div.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-users" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 15px;"></i>
                    <p style="color: var(--text-muted);">Vous n'avez créé aucun club</p>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">Utilisez le formulaire ci-dessous pour créer votre premier club</p>
                </div>
            `;
            return;
        }

        div.innerHTML = "";
        snap.forEach(doc => {
            const c = doc.data();
            const clubId = doc.id;
            const membresCount = Array.isArray(c.membre) ? c.membre.length : 0;
            
            div.innerHTML += `
                <div class="club-card" style="cursor: pointer;" onclick="gererClub('${clubId}', '${c.nom.replace(/'/g, "\\'")}')">
                    <div class="president-badge">
                        <i class="fas fa-crown"></i> Président
                    </div>
                    <h4>${c.nom}</h4>
                    <p style="color: var(--text-muted); margin-bottom: 10px;">${c.description || 'Aucune description'}</p>
                    <p><strong>Membres :</strong> ${membresCount}</p>
                    <p><strong>Créé le :</strong> ${c.date_creation ? formatDateSimple(c.date_creation) : 'Date inconnue'}</p>
                    <button class="btn btn-small" style="margin-top: 10px;">
                        <i class="fas fa-cog"></i> Gérer ce club
                    </button>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement mes clubs:", error);
        document.getElementById("mesClubsListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des clubs</p>';
    }
}

// ===== TOUS LES CLUBS DE L'IUT =====
async function chargerTousClubs() {
    try {
        const snap = await db.collection("clubs").get();
        const div = document.getElementById("tousClubsListe");
        
        if (snap.empty) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun club dans l\'IUT</p>';
            return;
        }

        div.innerHTML = "";
        
        const etudiantsSnap = await db.collection("etudiants").get();
        const etudiantsMap = new Map();
        etudiantsSnap.forEach(doc => {
            const e = doc.data();
            if (e.matricule) {
                etudiantsMap.set(e.matricule, `${e.prenom || ''} ${e.nom || ''}`.trim() || e.matricule);
            }
        });

        snap.forEach(doc => {
            const c = doc.data();
            const clubId = doc.id;
            
            const estPresident = c.createur_id === matricule;
            const estMembre = Array.isArray(c.membre) && c.membre.includes(matricule);
            
            const nomPresident = etudiantsMap.get(c.createur_id) || c.createur_id || "Inconnu";
            
            let statusText = "🔒 Non membre";
            let statusClass = "status-unavailable";
            let boutonHTML = "";
            
            if (estPresident) {
                statusText = "👑 Président";
                statusClass = "president-badge";
                boutonHTML = `<button class="btn btn-small" disabled><i class="fas fa-crown"></i> Vous êtes président</button>`;
            } else if (estMembre) {
                statusText = "✅ Membre";
                statusClass = "status-member";
                boutonHTML = `<button class="btn btn-small" disabled><i class="fas fa-check"></i> Déjà membre</button>`;
            } else {
                statusText = "🟢 Peut rejoindre";
                statusClass = "status-available";
                boutonHTML = `<button class="btn btn-small btn-success" onclick="rejoindreClub('${clubId}')">
                    <i class="fas fa-sign-in-alt"></i> Rejoindre
                </button>`;
            }
            
            const membresCount = Array.isArray(c.membre) ? c.membre.length : 0;
            const dateCreation = c.date_creation ? formatDateSimple(c.date_creation) : "Date inconnue";
            
            div.innerHTML += `
                <div class="club-card">
                    <div class="${statusClass}">${statusText}</div>
                    <h4>${c.nom}</h4>
                    <p style="color: var(--text-muted); margin-bottom: 10px;">${c.description || 'Aucune description'}</p>
                    <p><strong>Président :</strong> ${nomPresident}</p>
                    <p><strong>Membres :</strong> ${membresCount}</p>
                    <p><strong>Créé le :</strong> ${dateCreation}</p>
                    ${boutonHTML}
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement tous clubs:", error);
        document.getElementById("tousClubsListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des clubs</p>';
    }
}

// ===== GÉRER UN CLUB (PRÉSIDENT) =====
function gererClub(clubId, clubNom) {
    clubEnGestion = clubId;
    
    document.getElementById('sectionMesClubs').style.display = 'none';
    document.getElementById('sectionGererClub').style.display = 'block';
    
    document.getElementById('nomClubAGerer').textContent = clubNom;
    
    chargerAnnoncesClub();
    chargerEvenementsClub();
    
    document.getElementById('sectionGererClub').scrollIntoView({ behavior: 'smooth' });
}

function retourMesClubs() {
    document.getElementById('sectionMesClubs').style.display = 'block';
    document.getElementById('sectionGererClub').style.display = 'none';
    clubEnGestion = null;
}

async function chargerAnnoncesClub() {
    if (!clubEnGestion) return;
    
    try {
        const div = document.getElementById("annoncesClubListe");
        div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Chargement des annonces...</p>';

        let annonces = [];
        try {
            const snap = await db.collection("annonces_clubs")
                .where("clubId", "==", clubEnGestion)
                .orderBy("date", "desc")
                .limit(10)
                .get();
            
            annonces = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.log("Aucune annonce pour ce club");
        }

        if (annonces.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucune annonce pour ce club</p>';
            return;
        }

        div.innerHTML = "";
        annonces.forEach(annonce => {
            div.innerHTML += `
                <div class="message">
                    <div class="message-content">${annonce.contenu}</div>
                    <div class="message-time">${formatDate(annonce.date)}</div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement annonces club:", error);
        document.getElementById("annoncesClubListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des annonces</p>';
    }
}

async function chargerEvenementsClub() {
    if (!clubEnGestion) return;
    
    try {
        const div = document.getElementById("evenementsClubListe");
        div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Chargement des événements...</p>';

        let evenements = [];
        try {
            const snap = await db.collection("evenements_clubs")
                .where("clubId", "==", clubEnGestion)
                .orderBy("date", "asc")
                .limit(10)
                .get();
            
            evenements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.log("Aucun événement pour ce club");
        }

        if (evenements.length === 0) {
            div.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun événement pour ce club</p>';
            return;
        }

        div.innerHTML = "";
        evenements.forEach(evenement => {
            div.innerHTML += `
                <div class="message">
                    <div class="message-sender">${evenement.titre || 'Événement'}</div>
                    <div class="message-content">${evenement.description || ''}</div>
                    <div class="message-time">📅 ${formatDate(evenement.date)}</div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erreur chargement événements club:", error);
        document.getElementById("evenementsClubListe").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des événements</p>';
    }
}

// ===== REJOINDRE UN CLUB =====
async function rejoindreClub(clubId) {
    if (!confirm("Voulez-vous rejoindre ce club ?")) return;

    try {
        const ref = db.collection("clubs").doc(clubId);
        const doc = await ref.get();

        if (!doc.exists) {
            alert("Club introuvable");
            return;
        }

        const c = doc.data();
        
        if (Array.isArray(c.membre) && c.membre.includes(matricule)) {
            alert("Vous êtes déjà membre de ce club !");
            return;
        }
        
        await ref.update({
            membre: firebase.firestore.FieldValue.arrayUnion(matricule)
        });

        alert("✅ Vous avez rejoint le club !");
        
        if (document.getElementById('tous-clubsSection').style.display === 'block') {
            chargerTousClubs();
        }
        
        chargerMesClubs();

    } catch (error) {
        console.error("Erreur:", error);
        alert("Erreur lors de la tentative de rejoindre le club");
    }
}

// ===== MESSAGERIE AMÉLIORÉE =====

// 1. Charger la liste des clubs pour la messagerie
async function chargerClubsPourMessagerie() {
    try {
        const clubsSnap = await db.collection("clubs")
            .where("membre", "array-contains", matricule)
            .get();
        
        const div = document.getElementById("listeClubsMessagerie");
        const aucunClubDiv = document.getElementById("aucunClubMessage");
        
        if (clubsSnap.empty) {
            div.innerHTML = '';
            aucunClubDiv.style.display = 'block';
            return;
        }
        
        div.innerHTML = "";
        aucunClubDiv.style.display = 'none';
        
        clubsSnap.forEach(doc => {
            const club = doc.data();
            const clubId = doc.id;
            const membresCount = Array.isArray(club.membre) ? club.membre.length : 0;
            
            div.innerHTML += `
                <div class="club-card" onclick="ouvrirMessagerieClub('${clubId}', '${club.nom.replace(/'/g, "\\'")}')">
                    <div class="badge badge-club">
                        <i class="fas fa-comments"></i> Messagerie
                    </div>
                    <h4>${club.nom}</h4>
                    <p style="color: var(--text-muted); margin-bottom: 10px;">${club.description || 'Aucune description'}</p>
                    <p><strong>Membres :</strong> ${membresCount}</p>
                    <div style="margin-top: 15px;">
                        <span class="btn btn-small">
                            <i class="fas fa-comment"></i> Ouvrir le chat
                        </span>
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error("Erreur chargement clubs messagerie:", error);
        document.getElementById("listeClubsMessagerie").innerHTML = 
            '<p style="color: var(--text-muted); text-align: center;">Erreur de chargement des clubs</p>';
    }
}

// 2. Ouvrir la messagerie d'un club spécifique
function ouvrirMessagerieClub(clubId, clubNom) {
    clubActifId = clubId;
    clubActifNom = clubNom;
    
    document.getElementById('selectionClubContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    
    document.getElementById('clubChatName').textContent = clubNom;
    
    chargerMessagesClub();
}

// 3. Retour à la sélection des clubs
function retourSelectionClubs() {
    document.getElementById('selectionClubContainer').style.display = 'block';
    document.getElementById('chatContainer').style.display = 'none';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    chargerClubsPourMessagerie();
}

// ===== MESSAGERIE ÉPHÉMÈRE =====
async function chargerMessagesClub() {
    if (!clubActifId) return;

    try {
        const messagesRef = db.collection("clubs").doc(clubActifId)
            .collection("messages")
            .orderBy("timestamp", "desc")
            .limit(200);

        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        unsubscribeMessages = messagesRef.onSnapshot(async (snapshot) => {
            const div = document.getElementById("chatMessages");
            div.innerHTML = "";

            const maintenant = Date.now();
            const limiteTemps = maintenant - (48 * 60 * 60 * 1000);

            let messagesValides = [];

            snapshot.forEach(doc => {
                const m = doc.data();
                const messageTime = m.timestamp?.toDate ? m.timestamp.toDate().getTime() : m.timestamp;

                if (messageTime > limiteTemps) {
                    messagesValides.push({ id: doc.id, ...m });
                }
            });

            messagesValides = messagesValides.slice(0, 200);

            messagesValides.sort((a, b) => {
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : a.timestamp;
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : b.timestamp;
                return timeA - timeB;
            });

            if (messagesValides.length === 0) {
                div.innerHTML = `
                    <div class="message-info">
                        <i class="fas fa-comment"></i>
                        <p>Soyez le premier à envoyer un message !</p>
                        <small>Les messages disparaissent après 48h (max 200 messages)</small>
                    </div>
                `;
            } else {
                messagesValides.forEach(m => {
                    const date = m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
                    const dateStr = date.toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short'
                    });

                    const estMoi = m.auteurId === uid || m.auteurId === matricule;

                    div.innerHTML += `
                        <div class="message" style="border-left-color: ${estMoi ? 'var(--info-blue)' : 'var(--primary-yellow)'};">
                            <div class="message-sender">
                                ${estMoi ? '<i class="fas fa-user"></i> Vous' : `<i class="fas fa-user-friends"></i> ${m.nomAuteur || 'Membre'}`}
                            </div>
                            <div class="message-content">${m.contenu}</div>
                            <div class="message-time">${dateStr}</div>
                        </div>
                    `;
                });
            }

            const compteur = messagesValides.length;
            document.getElementById("messageCount").textContent = `${compteur}/200 messages`;
            document.getElementById("chatInfo").textContent = `Messages des dernières 48h (${compteur}/200)`;

            div.scrollTop = div.scrollHeight;

            if (compteur > 200) {
                await nettoyerMessagesSupplémentaires();
            }
        });
    } catch (error) {
        console.error("Erreur chargement messages:", error);
    }
}

async function nettoyerMessagesSupplémentaires() {
    if (!clubActifId) return;
    
    try {
        const messagesRef = db.collection("clubs").doc(clubActifId)
            .collection("messages")
            .orderBy("timestamp", "asc");

        const snapshot = await messagesRef.get();
        const maintenant = Date.now();
        const limiteTemps = maintenant - (48 * 60 * 60 * 1000);

        const batch = db.batch();
        let compteurSupprime = 0;

        snapshot.forEach(doc => {
            const m = doc.data();
            const messageTime = m.timestamp?.toDate ? m.timestamp.toDate().getTime() : m.timestamp;

            if (messageTime < limiteTemps) {
                batch.delete(doc.ref);
                compteurSupprime++;
            }
        });

        if (snapshot.size - compteurSupprime > 200) {
            const messagesRestants = snapshot.size - compteurSupprime;
            const aSupprimer = messagesRestants - 200;

            let supprimes = 0;
            snapshot.forEach(doc => {
                if (supprimes < aSupprimer) {
                    batch.delete(doc.ref);
                    supprimes++;
                }
            });
        }

        if (compteurSupprime > 0) {
            await batch.commit();
            console.log(`${compteurSupprime} messages nettoyés`);
        }

    } catch (error) {
        console.error("Erreur nettoyage messages:", error);
    }
}

// ===== FORMULAIRES =====
function initialiserFormulaires() {
    document.getElementById("formMessage").addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!clubActifId) {
            alert("Veuillez rejoindre un club d'abord");
            return;
        }

        const contenu = document.getElementById("contenuMessage").value.trim();
        if (!contenu) return;

        try {
            const messagesRef = db.collection("clubs").doc(clubActifId)
                .collection("messages");

            const countSnapshot = await messagesRef.orderBy("timestamp", "desc").limit(201).get();

            if (countSnapshot.size >= 200) {
                const oldestQuery = await messagesRef.orderBy("timestamp", "asc").limit(1).get();
                if (!oldestQuery.empty) {
                    await oldestQuery.docs[0].ref.delete();
                }
            }

            await messagesRef.add({
                contenu,
                auteurId: matricule,
                nomAuteur: nomEtudiant,
                timestamp: new Date()
            });

            document.getElementById("formMessage").reset();

        } catch (error) {
            console.error("Erreur envoi message:", error);
            alert("Erreur lors de l'envoi du message");
        }
    });

    document.getElementById("formCreerClub").addEventListener("submit", async (e) => {
        e.preventDefault();

        const nom = document.getElementById("nomClub").value.trim();
        const desc = document.getElementById("descClub").value.trim();
        const cle = document.getElementById("cleClub").value.trim();

        if (!nom || !desc || !cle) {
            alert("Veuillez remplir tous les champs");
            return;
        }

        try {
            const cleSnap = await db.collection("cles_clubs").doc(cle).get();
            if (!cleSnap.exists) {
                alert("Clé invalide ou expirée");
                return;
            }

            await db.collection("clubs").add({
                nom: nom,
                description: desc,
                createur_id: matricule,
                membre: [matricule],
                autorisation_code: cle,
                date_creation: new Date()
            });

            await db.collection("cles_clubs").doc(cle).delete();

            alert("✅ Club créé avec succès !");

            chargerMesClubs();
            e.target.reset();

        } catch (error) {
            console.error("Erreur création club:", error);
            alert("Erreur lors de la création du club : " + error.message);
        }
    });

    document.getElementById("formAnnonceClub").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!clubEnGestion) {
            alert("Aucun club sélectionné");
            return;
        }
        
        const contenu = document.getElementById("annonceClubContenu").value.trim();
        if (!contenu) {
            alert("Veuillez écrire une annonce");
            return;
        }
        
        try {
            const clubDoc = await db.collection("clubs").doc(clubEnGestion).get();
            const clubData = clubDoc.data();
            
            if (!clubData || clubData.createur_id !== matricule) {
                alert("Vous n'êtes pas autorisé à publier des annonces pour ce club");
                return;
            }
            
            await db.collection("annonces_clubs").add({
                clubId: clubEnGestion,
                contenu: contenu,
                auteurId: matricule,
                date: new Date()
            });
            
            alert("✅ Annonce publiée avec succès !");
            document.getElementById("annonceClubContenu").value = "";
            
            chargerAnnoncesClub();
            
        } catch (error) {
            console.error("Erreur publication annonce:", error);
            alert("Erreur lors de la publication de l'annonce");
        }
    });

    document.getElementById("formEvenementClub").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!clubEnGestion) {
            alert("Aucun club sélectionné");
            return;
        }
        
        const titre = document.getElementById("evenementClubTitre").value.trim();
        const description = document.getElementById("evenementClubDescription").value.trim();
        const dateInput = document.getElementById("evenementClubDate").value;
        
        if (!titre || !description || !dateInput) {
            alert("Veuillez remplir tous les champs");
            return;
        }
        
        try {
            const clubDoc = await db.collection("clubs").doc(clubEnGestion).get();
            const clubData = clubDoc.data();
            
            if (!clubData || clubData.createur_id !== matricule) {
                alert("Vous n'êtes pas autorisé à publier des événements pour ce club");
                return;
            }
            
            const dateEvent = new Date(dateInput);
            
            await db.collection("evenements_clubs").add({
                clubId: clubEnGestion,
                titre: titre,
                description: description,
                date: dateEvent,
                auteurId: matricule
            });
            
            alert("✅ Événement créé avec succès !");
            document.getElementById("formEvenementClub").reset();
            
            chargerEvenementsClub();
            
        } catch (error) {
            console.error("Erreur création événement:", error);
            alert("Erreur lors de la création de l'événement");
        }
    });

    document.getElementById("retourMesClubsBtn").addEventListener("click", (e) => {
        e.preventDefault();
        retourMesClubs();
    });

    document.getElementById("btnVoirClubs").addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.section === 'tous-clubs') {
                item.click();
            }
        });
    });

    document.getElementById("retourSelectionBtn").addEventListener("click", (e) => {
        e.preventDefault();
        retourSelectionClubs();
    });

    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
            auth.signOut().then(() => {
                window.location.href = "login.html";
            });
        }
    });
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

    window.addEventListener('beforeunload', () => {
        if (unsubscribeMessages) {
            unsubscribeMessages();
        }
    });
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', initialiserDashboard);

// ===== EXPORT DES FONCTIONS POUR HTML =====
window.rejoindreClub = rejoindreClub;
window.ouvrirMessagerie = ouvrirMessagerieClub;
window.gererClub = gererClub;
window.retourMesClubs = retourMesClubs;
window.retourSelectionClubs = retourSelectionClubs;