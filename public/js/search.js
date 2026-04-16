/**
 * General View On This - Search Enhancement
 * Live search with auto-submit and category filtering
 */

(function () {
  'use strict';

  var searchForm = document.querySelector('.search-bar form') || document.querySelector('form.search-form');
  if (!searchForm) return;

  var searchInput = searchForm.querySelector('input[type="search"], input[type="text"], input[name="q"]');
  var categorySelect = searchForm.querySelector('select[name="category"]');
  var searchBar = searchForm.closest('.search-bar') || searchForm;

  // ─── Spinner Helpers ─────────────────────────────────────────────────
  function showSpinner() {
    searchBar.classList.add('spinner');
  }

  function hideSpinner() {
    searchBar.classList.remove('spinner');
  }

  // ─── Auto-submit on typing (debounced) ───────────────────────────────
  if (searchInput) {
    var lastValue = searchInput.value;

    var debouncedSubmit = window.debounce
      ? window.debounce(submitSearch, 300)
      : createDebounce(submitSearch, 300);

    searchInput.addEventListener('input', function () {
      var currentValue = searchInput.value.trim();
      // Only submit if the value actually changed
      if (currentValue !== lastValue) {
        lastValue = currentValue;
        debouncedSubmit();
      }
    });

    // Allow immediate search on Enter
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch();
      }
    });
  }

  // ─── Auto-submit on category change ──────────────────────────────────
  if (categorySelect) {
    categorySelect.addEventListener('change', function () {
      submitSearch();
    });
  }

  // ─── Submit Search ───────────────────────────────────────────────────
  function submitSearch() {
    showSpinner();

    // Disable double-submit prevention for search forms
    var submitBtn = searchForm.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      submitBtn.dataset.allowResubmit = 'true';
    }

    // Build the URL with current form data and submit
    var formData = new FormData(searchForm);
    var params = new URLSearchParams();

    for (var pair of formData.entries()) {
      if (pair[1]) {
        params.append(pair[0], pair[1]);
      }
    }

    // Navigate to the search results
    var action = searchForm.getAttribute('action') || window.location.pathname;
    var url = action + '?' + params.toString();

    window.location.href = url;
  }

  // ─── Clear Search Button ─────────────────────────────────────────────
  var clearBtn = searchForm.querySelector('.search-clear');
  if (clearBtn && searchInput) {
    // Show/hide clear button based on input value
    function toggleClearButton() {
      if (searchInput.value.trim()) {
        clearBtn.style.display = 'block';
      } else {
        clearBtn.style.display = 'none';
      }
    }

    toggleClearButton();
    searchInput.addEventListener('input', toggleClearButton);

    clearBtn.addEventListener('click', function (e) {
      e.preventDefault();
      searchInput.value = '';
      toggleClearButton();
      searchInput.focus();
      submitSearch();
    });
  }

  // ─── Hide spinner once page has loaded ───────────────────────────────
  hideSpinner();

  // ─── Fallback debounce if main.js hasn't loaded ─────────────────────
  function createDebounce(fn, delay) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

})();
