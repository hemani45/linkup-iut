// login.js

const auth = firebase.auth();
const db = firebase.firestore();

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    return alert("Veuillez remplir tous les champs.");
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    const docRef = db.collection("etudiants").doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      alert("❌ Profil étudiant introuvable.");
      return;
    }

    alert("✅ Connexion réussie !");
    window.location.href = "dashboard-etudiant.html";
  } catch (error) {
  console.error("Erreur Firebase :", error);
  alert("❌ Erreur : " + error.code + " — " + error.message);
}
});