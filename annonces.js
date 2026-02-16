// annonces.js

const db = firebase.firestore();
const annoncesListe = document.getElementById("annoncesListe");

async function chargerAnnonces() {
  try {
    const snapshot = await db.collection("annonces").orderBy("date_publication", "desc").get();

    if (snapshot.empty) {
      annoncesListe.innerHTML = "<p>Aucune annonce disponible pour le moment.</p>";
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Formatage de la date
      const date = data.date_publication?.toDate?.().toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const bloc = document.createElement("div");
      bloc.className = "annonce";
      bloc.style.border = "1px solid #ccc";
      bloc.style.padding = "15px";
      bloc.style.marginBottom = "20px";
      bloc.style.borderRadius = "8px";
      bloc.style.backgroundColor = "#f9f9f9";

      bloc.innerHTML = `
        <h4>${data.titre}</h4>
        <p>${data.contenu}</p>
        <p><strong>Publié le :</strong> ${date || "Date inconnue"}</p>
        <p><strong>Filières :</strong> ${data.filieres_cibles?.join(", ") || "Non spécifié"}</p>
        <p><strong>Niveaux :</strong> ${data.niveaux_cibles?.join(", ") || "Non spécifié"}</p>
        <div class="actions" style="margin-top:10px;">
          <button onclick="capturerAnnonce(this)" class="btn">
            <i class="fas fa-camera"></i> Capturer
          </button>
        </div>
      `;

      annoncesListe.appendChild(bloc);
    });
  } catch (error) {
    console.error("Erreur lors du chargement des annonces :", error);
    annoncesListe.innerHTML = "<p>Erreur lors du chargement des annonces.</p>";
  }
}

function capturerAnnonce(button) {
  const bloc = button.closest(".annonce");
  html2canvas(bloc).then((canvas) => {
    const link = document.createElement("a");
    link.download = "annonce.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

window.addEventListener("DOMContentLoaded", chargerAnnonces);