// Teach Nav — Shared navigation for teaching workspace
// Update MANIFEST when adding or removing pages.

const TEACH_NAV_MANIFEST = {
  topic: "",
  lessons: [
    // { id: "0001", title: "Lesson Title", file: "0001-dash-case-name.html" },
  ],
  reference: [
    // { title: "Glossary", file: "glossary.html" },
  ],
};

// ── Renderer (do not edit below) ──────────────────────────

(function () {
  "use strict";

  var path = window.location.pathname;
  var inLessons = path.includes("/lessons/");
  var inReference = path.includes("/reference/");
  var prefix = inLessons || inReference ? "../" : "./";
  var currentFile = path.split("/").pop();
  var currentDir = inLessons ? "lessons" : inReference ? "reference" : "";

  function buildNav() {
    // Toggle button
    var toggle = document.createElement("button");
    toggle.className = "teach-nav-toggle";
    toggle.setAttribute("aria-label", "Toggle navigation");
    toggle.textContent = "\u2630"; // ☰
    document.body.appendChild(toggle);

    // Sidebar
    var nav = document.createElement("nav");
    nav.className = "teach-nav";
    var html = "";

    if (TEACH_NAV_MANIFEST.topic) {
      html +=
        '<div class="teach-nav-header">' +
        TEACH_NAV_MANIFEST.topic +
        "</div>";
    }

    // Lessons
    html += '<div class="teach-nav-section">';
    html += '<div class="teach-nav-section-title">Lessons</div>';
    if (TEACH_NAV_MANIFEST.lessons.length === 0) {
      html += '<div class="teach-nav-empty">No lessons yet</div>';
    } else {
      TEACH_NAV_MANIFEST.lessons.forEach(function (l) {
        var href = prefix + "lessons/" + l.file;
        var cls = currentDir === "lessons" && currentFile === l.file;
        html +=
          '<a href="' +
          href +
          '"' +
          (cls ? ' class="current"' : "") +
          ">" +
          l.id +
          ". " +
          l.title +
          "</a>";
      });
    }
    html += "</div>";

    // Reference
    html += '<div class="teach-nav-section">';
    html += '<div class="teach-nav-section-title">Reference</div>';
    if (TEACH_NAV_MANIFEST.reference.length === 0) {
      html += '<div class="teach-nav-empty">No reference docs yet</div>';
    } else {
      TEACH_NAV_MANIFEST.reference.forEach(function (r) {
        var href = prefix + "reference/" + r.file;
        var cls = currentDir === "reference" && currentFile === r.file;
        html +=
          '<a href="' +
          href +
          '"' +
          (cls ? ' class="current"' : "") +
          ">" +
          r.title +
          "</a>";
      });
    }
    html += "</div>";

    nav.innerHTML = html;
    document.body.appendChild(nav);

    // Toggle behavior
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.textContent = open ? "\u2715" : "\u2630"; // ✕ or ☰
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildNav);
  } else {
    buildNav();
  }
})();
