// signup.js - Version corrigée pour Firebase compat v9

// Initialisation (doit correspondre à firebase-config.js)
const auth = firebase.auth();
const db = firebase.firestore();

document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Récupération des valeurs
  const nom = document.getElementById("nom").value.trim();
  const prenom = document.getElementById("prenom").value.trim();
  const matricule = document.getElementById("matricule").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const filiere = document.getElementById("filiere").value; // .value pas .trim() pour select
  const niveau = document.getElementById("niveau").value; // .value pour select

  // Message d'erreur
  const messageDiv = document.getElementById("message");
  
  // Validation des mots de passe
  if (password !== confirmPassword) {
    messageDiv.textContent = "❌ Les mots de passe ne correspondent pas.";
    messageDiv.className = "message error";
    messageDiv.style.display = "block";
    return;
  }

  // Validation des champs
  if (!nom || !prenom || !matricule || !email || !password || !filiere || !niveau) {
    messageDiv.textContent = "❌ Veuillez remplir tous les champs.";
    messageDiv.className = "message error";
    messageDiv.style.display = "block";
    return;
  }

 // Validation format matricule
const matriculeRegex = /^[0-9]{2,3}[A-Za-z]{2,4}[0-9]{2,3}[A-Za-z]{1,4}$/;
if (!matriculeRegex.test(matricule)) {
    messageDiv.textContent = "❌ Format matricule invalide. Exemple : 22GL001FS";
    messageDiv.className = "message error";
    messageDiv.style.display = "block";
    return;
}

  try {
    // Désactiver le bouton
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création en cours...';

    // 1. Création du compte authentication (méthode correcte pour compat v9)
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const uid = user.uid;

    // 2. Création du document étudiant dans Firestore
    await db.collection("etudiants").doc(uid).set({
      uid: uid,
      nom: nom,
      prenom: prenom,
      matricule: matricule,
      email: email,
      filiere: filiere,
      niveau: parseInt(niveau), // Conversion en nombre
      dateInscription: firebase.firestore.FieldValue.serverTimestamp(), // Meilleure que new Date()
      clubs: [] // Initialisation tableau clubs
    });

    // Message de succès
    messageDiv.textContent = "✅ Compte créé avec succès ! Redirection...";
    messageDiv.className = "message success";
    messageDiv.style.display = "block";

    // Redirection automatique vers le dashboard après 2 secondes
    setTimeout(() => {
      window.location.href = "dashboard-etudiant.html";
    }, 2000);

  } catch (error) {
    console.error("Erreur Firebase :", error);
    
    // Réactiver le bouton
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
    
    // Messages d'erreur spécifiques
    let errorMessage = "❌ Erreur lors de l'inscription.";
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = "❌ Cet email est déjà utilisé.";
    } else if (error.code === 'auth/weak-password') {
      errorMessage = "❌ Mot de passe trop faible (min. 6 caractères).";
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = "❌ Format d'email invalide.";
    } else {
      errorMessage = "❌ Erreur : " + error.message;
    }
    
    messageDiv.textContent = errorMessage;
    messageDiv.className = "message error";
    messageDiv.style.display = "block";
  }
});

// Réinitialiser le message quand l'utilisateur modifie un champ
const inputs = document.querySelectorAll('#signup-form input, #signup-form select');
inputs.forEach(input => {
  input.addEventListener('input', () => {
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'none';
  });
});