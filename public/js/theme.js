(function () {
  try {
    var theme = localStorage.getItem("capes.theme");
    if (theme === "light") document.documentElement.classList.add("theme-light");
  } catch (e) {}
})();