/**
 * General View On This - Survey Flow Management
 * Multi-step survey with validation and progress tracking
 */

(function () {
  'use strict';

  var surveyForm = document.querySelector('.survey-form');
  if (!surveyForm) return;

  var questionCards = surveyForm.querySelectorAll('.question-card');
  if (questionCards.length === 0) return;

  var prevBtn = surveyForm.querySelector('.btn-prev');
  var nextBtn = surveyForm.querySelector('.btn-next');
  var submitBtn = surveyForm.querySelector('.btn-submit-survey');
  var progressBar = surveyForm.querySelector('.progress-bar-fill') || surveyForm.querySelector('.progress-fill');
  var progressText = surveyForm.querySelector('.progress-text');

  var currentIndex = 0;
  var totalQuestions = questionCards.length;

  // ─── Initialize ──────────────────────────────────────────────────────
  init();

  function init() {
    // Hide all question cards except the first
    questionCards.forEach(function (card, i) {
      card.style.display = i === 0 ? 'block' : 'none';
      card.classList.toggle('active', i === 0);
    });

    // Set up initial button states
    updateControls();
    updateProgress();

    // Button event listeners
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goNext();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goPrev();
      });
    }

    // Intercept form submission for confirmation
    if (submitBtn) {
      surveyForm.addEventListener('submit', function (e) {
        if (!confirmSubmit()) {
          e.preventDefault();
        }
      });
    }

    // Allow keyboard navigation
    surveyForm.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (currentIndex < totalQuestions - 1) {
          goNext();
        }
      }
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────
  function goNext() {
    if (!validateCurrentQuestion()) {
      shakeCurrentCard();
      return;
    }

    if (currentIndex < totalQuestions - 1) {
      transitionTo(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      transitionTo(currentIndex - 1);
    }
  }

  function transitionTo(newIndex) {
    var currentCard = questionCards[currentIndex];
    var nextCard = questionCards[newIndex];
    var goingForward = newIndex > currentIndex;

    // Animate out current card
    currentCard.style.opacity = '0';
    currentCard.style.transform = goingForward ? 'translateX(-20px)' : 'translateX(20px)';
    currentCard.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

    setTimeout(function () {
      currentCard.style.display = 'none';
      currentCard.classList.remove('active');
      currentCard.style.transform = '';
      currentCard.style.opacity = '';
      currentCard.style.transition = '';

      // Show and animate in new card
      nextCard.style.opacity = '0';
      nextCard.style.transform = goingForward ? 'translateX(20px)' : 'translateX(-20px)';
      nextCard.style.display = 'block';
      nextCard.classList.add('active');

      // Force reflow
      nextCard.offsetHeight;

      nextCard.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      nextCard.style.opacity = '1';
      nextCard.style.transform = 'translateX(0)';

      currentIndex = newIndex;
      updateControls();
      updateProgress();

      // Clean up transition styles after animation
      setTimeout(function () {
        nextCard.style.transition = '';
        nextCard.style.transform = '';
        nextCard.style.opacity = '';
      }, 260);
    }, 250);
  }

  // ─── Progress ────────────────────────────────────────────────────────
  function updateProgress() {
    var percent = ((currentIndex + 1) / totalQuestions) * 100;

    if (progressBar) {
      progressBar.style.transition = 'width 0.4s ease';
      progressBar.style.width = percent + '%';
    }

    if (progressText) {
      progressText.textContent = 'Question ' + (currentIndex + 1) + ' of ' + totalQuestions;
    }
  }

  // ─── Controls ────────────────────────────────────────────────────────
  function updateControls() {
    var isFirst = currentIndex === 0;
    var isLast = currentIndex === totalQuestions - 1;

    if (prevBtn) {
      prevBtn.style.visibility = isFirst ? 'hidden' : 'visible';
      prevBtn.disabled = isFirst;
    }

    if (nextBtn) {
      nextBtn.style.display = isLast ? 'none' : 'inline-flex';
    }

    if (submitBtn) {
      submitBtn.style.display = isLast ? 'inline-flex' : 'none';
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────
  function validateCurrentQuestion() {
    var card = questionCards[currentIndex];
    var questionType = card.dataset.type || detectQuestionType(card);

    switch (questionType) {
      case 'multiple_choice':
        return validateMultipleChoice(card);
      case 'rating':
        return validateRating(card);
      case 'text':
        return validateText(card);
      default:
        // If type is unknown, check for any input with a value
        return validateAny(card);
    }
  }

  function validateMultipleChoice(card) {
    var checked = card.querySelector('input[type="radio"]:checked');
    if (!checked) {
      showValidationError(card, 'Please select an option to continue.');
      return false;
    }
    clearValidationError(card);
    return true;
  }

  function validateRating(card) {
    var ratingInput = card.querySelector('input[name*="rating"], input.rating-value, .star-rating-interactive input[type="hidden"]');
    if (!ratingInput || !ratingInput.value || ratingInput.value === '0') {
      showValidationError(card, 'Please select a rating to continue.');
      return false;
    }
    clearValidationError(card);
    return true;
  }

  function validateText(card) {
    var textarea = card.querySelector('textarea');
    var textInput = textarea || card.querySelector('input[type="text"]');
    if (!textInput || !textInput.value.trim()) {
      showValidationError(card, 'Please provide an answer to continue.');
      return false;
    }
    clearValidationError(card);
    return true;
  }

  function validateAny(card) {
    // Check radios
    var radios = card.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      return validateMultipleChoice(card);
    }

    // Check rating inputs
    var ratingInput = card.querySelector('.star-rating-interactive input[type="hidden"]');
    if (ratingInput) {
      return validateRating(card);
    }

    // Check text areas
    var textarea = card.querySelector('textarea');
    if (textarea) {
      return validateText(card);
    }

    // If no recognizable input, allow proceeding
    return true;
  }

  function detectQuestionType(card) {
    if (card.querySelector('input[type="radio"]')) return 'multiple_choice';
    if (card.querySelector('.star-rating-interactive')) return 'rating';
    if (card.querySelector('textarea') || card.querySelector('input[type="text"]')) return 'text';
    return 'unknown';
  }

  // ─── Validation Error Display ────────────────────────────────────────
  function showValidationError(card, message) {
    clearValidationError(card);
    var errorEl = document.createElement('div');
    errorEl.className = 'validation-error';
    errorEl.textContent = message;
    errorEl.style.color = 'var(--color-error, #D32F2F)';
    errorEl.style.fontSize = '0.875rem';
    errorEl.style.marginTop = '0.5rem';
    errorEl.style.animation = 'fadeIn 0.2s ease';
    card.appendChild(errorEl);
  }

  function clearValidationError(card) {
    var existing = card.querySelector('.validation-error');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }
  }

  // ─── Shake Animation ────────────────────────────────────────────────
  function shakeCurrentCard() {
    var card = questionCards[currentIndex];
    card.style.animation = 'shake 0.4s ease';
    card.addEventListener('animationend', function handler() {
      card.style.animation = '';
      card.removeEventListener('animationend', handler);
    });
  }

  // ─── Submit Confirmation ─────────────────────────────────────────────
  function confirmSubmit() {
    if (!validateCurrentQuestion()) {
      shakeCurrentCard();
      return false;
    }
    return confirm('You have answered all questions. Submit your survey responses?');
  }

  // ─── Inject Animations ──────────────────────────────────────────────
  var styleSheet = document.createElement('style');
  styleSheet.textContent =
    '@keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }' +
    '@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }';
  document.head.appendChild(styleSheet);

})();
