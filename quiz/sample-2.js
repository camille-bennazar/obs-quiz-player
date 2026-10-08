/*
  Sample « YouTubeurs » — versionné pour le rendu après clone.
  Médias : photos/sample-2/ et videos/sample-2/
  Forme : QuizCatalogEntry ({ title, data: QuizItem[] }) — voir quiz/manifest.js.
*/
window.QUIZ_CATALOG = window.QUIZ_CATALOG || {};
window.QUIZ_CATALOG["sample-2"] = {
  title: "Quiz YouTubeurs",
  data: [
    {
      video: "videos/sample-2/1.mp4",
      avatar: "photos/sample-2/1.webp",
      options: ["Exemple Alpha", "Leurres Beta", "Faux Gamma", "Pseudo Delta"],
      correctIndex: 0
    },
    {
      video: "videos/sample-2/2.mp4",
      avatar: "photos/sample-2/2.webp",
      options: ["TechLab", "GeekReview", "MonsieurTech", "PixelReview"],
      correctIndex: 3
    }
  ]
};
