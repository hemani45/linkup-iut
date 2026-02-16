// inscription-enseignant.js - VERSION AVEC CHAMP "code"

// Initialisation Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Collection pour les codes secrets
const CODES_SECRETS = "codes_secrets_enseignants";

// Afficher un message
function showAlert(message, type = "danger") {
    const alertDiv = document.getElementById("alertMessage");
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.display = "block";
    
    // Masquer après 5 secondes pour les succès
    if (type === "success") {
        setTimeout(() => {
            alertDiv.style.display = "none";
        }, 5000);
    }
}

// Masquer un message
function hideAlert() {
    document.getElementById("alertMessage").style.display = "none";
}

// Valider le formulaire
function validateForm() {
    const codeSecret = document.getElementById("codeSecret").value.trim();
    const nom = document.getElementById("nom").value.trim();
    const prenom = document.getElementById("prenom").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const departement = document.getElementById("departement").value;
    const grade = document.getElementById("grade").value;
    const matieres = document.getElementById("matieres").value.trim();
    
    // Validation basique
    if (!codeSecret) {
        showAlert("Le code secret est obligatoire");
        return false;
    }
    
    if (!nom || !prenom) {
        showAlert("Le nom et le prénom sont obligatoires");
        return false;
    }
    
    if (!email || !email.includes("@") || !email.includes(".")) {
        showAlert("Veuillez entrer un email valide");
        return false;
    }
    
    if (password.length < 6) {
        showAlert("Le mot de passe doit contenir au moins 6 caractères");
        return false;
    }
    
    if (password !== confirmPassword) {
        showAlert("Les mots de passe ne correspondent pas");
        return false;
    }
    
    if (!departement) {
        showAlert("Veuillez sélectionner un département");
        return false;
    }
    
    if (!grade) {
        showAlert("Veuillez sélectionner un grade");
        return false;
    }
    
    if (!matieres) {
        showAlert("Veuillez indiquer au moins une matière enseignée");
        return false;
    }
    
    return true;
}

// Vérifier le code secret - VERSION AVEC CHAMP "code"
async function verifierCodeSecret(code) {
    try {
        console.log("🔍 Vérification du code:", code);
        
        // Chercher par CHAMP "code" (pas par ID)
        const querySnapshot = await db.collection(CODES_SECRETS)
            .where("code", "==", code)
            .limit(1)
            .get();
        
        console.log("🔍 Résultats trouvés:", querySnapshot.size);
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            console.log("🔍 Document trouvé:", data);
            return { valide: true, data: data };
        } else {
            console.log("🔍 Aucun document trouvé");
            return { valide: false, message: "Code secret invalide" };
        }
        
    } catch (error) {
        console.error("❌ Erreur vérification code:", error);
        return { valide: false, message: "Erreur de vérification du code" };
    }
}

// Traiter l'inscription
document.getElementById("inscriptionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    
    // Désactiver le bouton pendant le traitement
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
    
    // Valider le formulaire
    if (!validateForm()) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> S\'inscrire comme enseignant';
        return;
    }
    
    // Récupérer les données
    const codeSecret = document.getElementById("codeSecret").value.trim();
    const nom = document.getElementById("nom").value.trim();
    const prenom = document.getElementById("prenom").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const departement = document.getElementById("departement").value;
    const grade = document.getElementById("grade").value;
    const matieresInput = document.getElementById("matieres").value.trim();
    
    // Convertir les matières en tableau
    const matieres = matieresInput.split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);
    
    try {
        console.log("📝 Début de l'inscription pour:", email);
        
        // Étape 1: Vérifier le code secret
        const verification = await verifierCodeSecret(codeSecret);
        if (!verification.valide) {
            showAlert(verification.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> S\'inscrire comme enseignant';
            return;
        }
        
        console.log("✅ Code secret valide");
        
        // Étape 2: Créer l'utilisateur dans Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        console.log("✅ Compte Auth créé, UID:", uid);
        
        // Étape 3: Créer le profil dans Firestore
        await db.collection("enseignants").doc(uid).set({
            uid: uid,
            email: email,
            nom: nom,
            prenom: prenom,
            departement: departement,
            grade: grade,
            matiere: matieres,
            date_inscription: new Date(),
            statut: "actif"
        });
        
        console.log("✅ Profil Firestore créé");
        
        // Succès !
        showAlert(
            `🎉 Inscription réussie ! Bienvenue ${prenom} ${nom}. Vous allez être redirigé vers votre tableau de bord.`, 
            "success"
        );
        
        // Redirection après 3 secondes
        setTimeout(() => {
            window.location.href = "dashboard-enseignant.html";
        }, 3000);
        
    } catch (error) {
        console.error("❌ Erreur inscription:", error);
        console.error("❌ Code erreur:", error.code);
        console.error("❌ Message:", error.message);
        
        // Messages d'erreur spécifiques
        let errorMessage = "Une erreur est survenue lors de l'inscription";
        
        if (error.code === "auth/email-already-in-use") {
            errorMessage = "Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email.";
        } else if (error.code === "auth/weak-password") {
            errorMessage = "Le mot de passe est trop faible. Utilisez au moins 6 caractères.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "L'adresse email n'est pas valide.";
        } else if (error.code === "auth/operation-not-allowed") {
            errorMessage = "L'inscription par email/mot de passe n'est pas activée.";
        } else if (error.code === "auth/network-request-failed") {
            errorMessage = "Problème de connexion réseau. Vérifiez votre internet.";
        }
        
        showAlert(errorMessage);
        
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> S\'inscrire comme enseignant';
    }
});

// Vérification en temps réel des mots de passe
document.getElementById("confirmPassword").addEventListener("input", function() {
    const password = document.getElementById("password").value;
    const confirm = this.value;
    
    if (confirm && password !== confirm) {
        this.style.borderColor = "var(--primary-red)";
    } else if (confirm) {
        this.style.borderColor = "#06d6a0";
    } else {
        this.style.borderColor = "rgba(255, 255, 255, 0.2)";
    }
});

// Initialisation
console.log("✅ Page d'inscription enseignant chargée");
console.log("ℹ️ Collection codes:", CODES_SECRETS);