/*
  Sample « Gaming » — premier quiz pour démontrer le sélecteur.
  Médias : photos/sample-1/ et videos/sample-1/
  Forme : QuizCatalogEntry ({ title, data: QuizItem[] }) — voir quiz/manifest.js.
*/
window.QUIZ_CATALOG = window.QUIZ_CATALOG || {};
window.QUIZ_CATALOG["sample-1"] = {
  title: "Quiz Gaming",
  data: [
    {
      video: "videos/sample-1/1.mp4",
      avatar: "photos/sample-1/1.webp",
      options: ["Pixel Hero", "Boss Final", "Speedrun Kid", "Lag Monster"],
      correctIndex: 1
    },
    {
      video: "videos/sample-1/2.mp4",
      avatar: "photos/sample-1/2.webp",
      options: ["CyberRacer 2099", "NeonDrift", "FutureSpeed", "QuantumShift"],
      correctIndex: 1
    }
  ]
};
