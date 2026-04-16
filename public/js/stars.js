/**
 * General View On This - Star Rating Components
 * Interactive and static star rating displays
 */

(function () {
  'use strict';

  var STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
  var FILLED_COLOR = 'var(--color-yellow, #F4A940)';
  var EMPTY_COLOR = 'var(--color-border, #D9D3CB)';

  // ─── Inject Star Animation Styles ────────────────────────────────────
  var styleSheet = document.createElement('style');
  styleSheet.textContent =
    '@keyframes starBounce { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }' +
    '.star-rating-interactive .star { cursor: pointer; transition: transform 0.15s ease; }' +
    '.star-rating-interactive .star.hovered path { fill: ' + FILLED_COLOR + '; opacity: 0.75; }' +
    '.star-rating-interactive .star.selected path { fill: ' + FILLED_COLOR + '; }' +
    '.star-rating-interactive .star.bounce { animation: starBounce 0.3s ease; }' +
    '.star-rating-interactive .star path { fill: ' + EMPTY_COLOR + '; transition: fill 0.15s ease; }';
  document.head.appendChild(styleSheet);

  // ─── Initialize Interactive Star Ratings ─────────────────────────────
  document.querySelectorAll('.star-rating-interactive').forEach(initInteractive);

  // ─── Initialize Static Star Displays ─────────────────────────────────
  document.querySelectorAll('.star-rating-static').forEach(initStatic);

  // ─── Interactive Rating ──────────────────────────────────────────────
  function initInteractive(container) {
    var hiddenInput = container.querySelector('input[type="hidden"]');
    if (!hiddenInput) {
      hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = container.dataset.name || 'rating';
      hiddenInput.value = '0';
      container.appendChild(hiddenInput);
    }

    var currentRating = parseInt(hiddenInput.value, 10) || 0;

    // Clear existing stars and build fresh
    var existingStars = container.querySelectorAll('.star');
    if (existingStars.length === 0) {
      for (var i = 1; i <= 5; i++) {
        var star = createStarSVG(i);
        container.insertBefore(star, hiddenInput);
      }
    }

    var stars = container.querySelectorAll('.star');

    // Set initial state if a value already exists
    if (currentRating > 0) {
      updateSelectedStars(stars, currentRating);
    }

    // Hover events
    stars.forEach(function (star) {
      star.addEventListener('mouseenter', function () {
        var value = parseInt(star.dataset.value, 10);
        updateHoveredStars(stars, value);
      });

      star.addEventListener('mouseleave', function () {
        clearHoveredStars(stars);
        updateSelectedStars(stars, currentRating);
      });

      // Click to select
      star.addEventListener('click', function () {
        var value = parseInt(star.dataset.value, 10);
        currentRating = value;
        hiddenInput.value = value;
        updateSelectedStars(stars, currentRating);

        // Bounce animation on clicked star
        star.classList.remove('bounce');
        // Force reflow
        star.offsetHeight;
        star.classList.add('bounce');
        star.addEventListener('animationend', function handler() {
          star.classList.remove('bounce');
          star.removeEventListener('animationend', handler);
        });

        // Dispatch change event so forms/validation can detect the update
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function updateHoveredStars(stars, upToValue) {
    stars.forEach(function (star) {
      var val = parseInt(star.dataset.value, 10);
      if (val <= upToValue) {
        star.classList.add('hovered');
      } else {
        star.classList.remove('hovered');
      }
    });
  }

  function clearHoveredStars(stars) {
    stars.forEach(function (star) {
      star.classList.remove('hovered');
    });
  }

  function updateSelectedStars(stars, rating) {
    stars.forEach(function (star) {
      var val = parseInt(star.dataset.value, 10);
      if (val <= rating) {
        star.classList.add('selected');
      } else {
        star.classList.remove('selected');
      }
    });
  }

  // ─── Static Star Display ─────────────────────────────────────────────
  function initStatic(container) {
    var rating = parseFloat(container.dataset.rating) || 0;
    var maxStars = parseInt(container.dataset.max, 10) || 5;

    // Clear any existing content
    container.innerHTML = '';

    for (var i = 1; i <= maxStars; i++) {
      var star = createStarSVG(i);
      star.style.cursor = 'default';

      if (i <= Math.floor(rating)) {
        // Full star
        star.querySelector('path').style.fill = FILLED_COLOR;
      } else if (i === Math.ceil(rating) && rating % 1 !== 0) {
        // Half star - use a clip approach
        star.querySelector('path').style.fill = EMPTY_COLOR;
        addHalfFill(star, rating % 1);
      } else {
        // Empty star
        star.querySelector('path').style.fill = EMPTY_COLOR;
      }

      container.appendChild(star);
    }

    // Append text showing the numeric value
    var ratingText = document.createElement('span');
    ratingText.className = 'star-rating-value';
    ratingText.textContent = rating.toFixed(1);
    ratingText.style.marginLeft = '0.35rem';
    ratingText.style.fontSize = '0.875rem';
    ratingText.style.color = 'var(--color-text-secondary, #6B6560)';
    container.appendChild(ratingText);
  }

  function addHalfFill(starSvg, fraction) {
    var clipId = 'star-clip-' + Math.random().toString(36).substr(2, 6);

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    var clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);

    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', Math.round(fraction * 24));
    rect.setAttribute('height', '24');

    clipPath.appendChild(rect);
    defs.appendChild(clipPath);
    starSvg.insertBefore(defs, starSvg.firstChild);

    // Add a filled overlay clipped to the fraction
    var filledPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    filledPath.setAttribute('d', STAR_PATH);
    filledPath.style.fill = FILLED_COLOR;
    filledPath.setAttribute('clip-path', 'url(#' + clipId + ')');
    starSvg.appendChild(filledPath);
  }

  // ─── SVG Factory ─────────────────────────────────────────────────────
  function createStarSVG(value) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('class', 'star');
    svg.setAttribute('data-value', value);
    svg.setAttribute('role', 'button');
    svg.setAttribute('aria-label', value + ' star' + (value !== 1 ? 's' : ''));

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', STAR_PATH);

    svg.appendChild(path);
    return svg;
  }

})();
