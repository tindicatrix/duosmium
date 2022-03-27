let doc;
fetch("/results/tournaments.json")
  .then((resp) => resp.json())
  .then((data) => {
    doc = data;
  });

$(document).ready(function () {
  // announcement bar close button
  $(".announcement .close-announcement").on("click", (e) => {
    $(e.target.parentElement).remove();
  });

  // load tournament logos lazily
  // https://developers.google.com/web/fundamentals/performance/lazy-loading-guidance/images-and-video/
  var lazy_images = $("img.lazy");
  let lazyImageObserver;
  if ("IntersectionObserver" in window) {
    lazyImageObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          let lazy_image = entry.target;
          lazy_image.src = lazy_image.dataset.src;
          lazy_image.classList.remove("lazy");
          observer.unobserve(lazy_image);
        }
      });
    });
    lazy_images.each(function () {
      lazyImageObserver.observe(this);
    });
  }

  // helper for generating tournament card
  function appendTournament(t) {
    const clone = document
      .querySelector("#card-template")
      .content.firstElementChild.cloneNode(true);
    const qs = (q) => clone.querySelector(q);
    qs("div.card-header").style.backgroundColor = t.bgColor;
    qs("h2.card-title span[data-slot='content']").innerText =
      t.year + " " + t.title;
    qs("h2.card-title span[data-slot='division']").classList.add(
      "division-" + t.division.toLowerCase()
    );
    qs("h2.card-title small[data-slot='division']").innerText =
      "Division " + t.division;
    if (!t.official) {
      qs("h2.card-title span.official").remove();
    }
    qs("h3.card-subtitle span[data-slot='date']").innerText = t.date;
    qs("h3.card-subtitle span[data-slot='location']").innerText = t.location;
    qs("div.card-body").setAttribute("data-target", "#summary-" + t.filename);
    qs("div.card-body").setAttribute("aria-controls", "summary-" + t.filename);
    qs("div.card-body img").setAttribute("data-src", t.logo);
    if (lazyImageObserver) {
      // add observer
      lazyImageObserver.observe(qs("div.card-body img"));
    }
    qs("div.card-body div.summary").setAttribute("id", "summary-" + t.filename);

    const teamTempate = document.querySelector("#summary-team");
    Object.entries(t.teams).forEach(([title, team]) => {
      const teamEntry = teamTempate.content.cloneNode(true);
      teamEntry.querySelector("dt").innerText = title;
      teamEntry.querySelector("dd span[data-slot='content']").innerText = (
        team.school +
        " " +
        team.suffix
      ).trim();
      teamEntry.querySelector("dd small[data-slot='state']").innerText =
        team.state;
      teamEntry.querySelector("dd span[data-slot='points']").innerText =
        team.points;
      qs("div.card-body div.summary dl").appendChild(teamEntry);
    });

    qs("div.card-footer a").href = "/results/" + t.filename + "/";
    qs("div.card-footer span.teams-count").innerText = t.teamCount + " Teams";

    // register event handlers
    // Blur logo when showing tournament summary
    $(qs("div.card-body div.summary")).on("show.bs.collapse", function () {
      qs("div.card-body img").classList.add("blur");
    });
    $(qs("div.card-body div.summary")).on("hide.bs.collapse", function () {
      qs("div.card-body img").classList.remove("blur");
      // Unfocus tournament summary button when summary is hidden
      qs("div.card-actions button").blur(); // remove focus (not visual blur)
    });

    // Make tournament summary toggle when clicking summary button
    qs("div.card-actions button").addEventListener("click", function () {
      qs("div.card-body").click();
    });

    // Make team badge and card header function as second link to full results
    // (doing this in JS to prevent duplication of link element for accessibility)
    qs("div.card-actions span.teams-count").addEventListener(
      "click",
      function () {
        qs("a.full-results").click();
      }
    );
    qs("div.card-header").addEventListener("click", function () {
      qs("div.card-footer a.full-results").click();
    });

    // append tournament card to page
    $("div.results-index-card-grid").append(clone);
  }
  // helper for clearing search bar
  function clearSearch() {
    $("#searchTournaments").val("");
    localStorage.setItem("searchstring", "");
    $("div.search-wrapper").removeClass("searching");
    $("div.search-wrapper div.floating-label").removeClass("has-value");
    $("div.results-index-card-grid").empty();
    doc.slice(0, 36).map(appendTournament);
  }
  // search tournaments and display results
  function search() {
    let search_text = $("#searchTournaments").val().toLowerCase().trim();
    if (search_text.length === 0) {
      clearSearch();
    } else {
      $("div.search-wrapper").addClass("searching");

      let words = search_text
        .replace(/(div|division) ([abc])/, "$1-$2")
        .split(/[^\w-]+/);
      $("div.results-index-card-grid").empty();
      let empty = true;
      doc.forEach((team) => {
        if (words.every((word) => team.keywords.includes(word))) {
          empty = false;
          appendTournament(team);
        }
      });
      if (empty) {
        $("div.results-index-card-grid").append(
          "<div class='text-center h3 mt-4' style='grid-column: 1/-1;'>No results found!</div>"
        );
      }
    }

    // Save state of search bar between page loads
    localStorage.setItem("searchstring", $("#searchTournaments").val());
    localStorage.setItem("searchDate", Date.now());
  }

  // debounce search input
  let searchTimeout;
  $("div.search-wrapper input").on("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      search();
    }, 25);
  });

  // Clear search bar with x button
  $("#searchTournamentsClear").click(clearSearch);

  // Restore search bar status if exists
  if (
    localStorage.getItem("searchstring") &&
    // Don't restore if it's been more than a day
    Date.now() - parseInt(localStorage.getItem("searchDate")) <
      1000 * 60 * 60 * 24
  ) {
    $("#searchTournaments").val(localStorage.getItem("searchstring"));
    $("div.search-wrapper div.floating-label").addClass("has-value");
    $("div.search-wrapper").addClass("searching");
    search();
  }

  // Cause input box to lose focus after hitting enter (esp. for mobile devices
  // where keyboard takes up a lot of the screen)
  $("#searchTournaments").change(function (e) {
    $("#searchTournaments").blur();
  });

  // Prevent see all from appending anchor tag to URL (makes the back button
  // logic more consistent)
  $("a#see-all").on("click", function (e) {
    e.preventDefault();
    $(document).scrollTop($(this.hash).offset().top);
  });

  // Hide the scroll to top button if already near top or at bottom of page
  var hide_scroll_button = function () {
    if (
      $(this).scrollTop() < $(window).height() ||
      $(this).scrollTop() + $(window).height() > $(document).height() - 10
    ) {
      $("a#scroll-back").fadeOut();
    } else {
      $("a#scroll-back").fadeIn();
    }
  };
  // Prevent scroll to top from appending anchor tag to URL (makes the back
  // button logic more consistent)
  $("a#scroll-back").on("click", function (e) {
    e.preventDefault();
    this.blur(); // remove focus from button
    window.scrollTo(0, 0);
  });

  hide_scroll_button(); // call initially
  $(window).scroll(hide_scroll_button);

  // Blur logo when showing tournament summary (in results index)
  $("div.card-body div.summary").on("show.bs.collapse", function () {
    $(this).parent().children("img").addClass("blur");
  });
  $("div.card-body div.summary").on("hide.bs.collapse", function () {
    $(this).parent().children("img").removeClass("blur");
    // Unfocus tournament summary button when summary is hidden
    let button = $(this).parent().parent().find("div.card-actions button");
    button.blur(); // removes the focus, nothing to do with visual blur
  });

  // Make tournament summary toggle when clicking summary button
  $("div.card-actions button").on("click", function () {
    $(this).parent().parent().children("div.card-body").click();
  });

  // Make team badge and card header function as second link to full results
  // (doing this in JS to prevent duplication of link element for accessibility)
  $("div.card-actions span.teams-count").on("click", function () {
    $(this).parent().children("a.full-results")[0].click();
  });
  $("div.card-header").on("click", function () {
    $(this).parent().find("div.card-footer a.full-results")[0].click();
  });

  // Disabled for now (may try to find a way to enable for PWAs only?) because
  // of issues with back button
  // // Make links to full results instantly trigger a splash screen
  // $("a.full-results").on("click", function() {
  //  $(this).parent().parent().children("div.splash-wrapper").addClass("splash");
  // });
});
