/**
 * General View On This - Main JavaScript
 * Global functionality for the entire application
 */

(function () {
  'use strict';

  // ─── Mobile Nav Toggle ───────────────────────────────────────────────
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      navLinks.classList.toggle('open');
      navToggle.classList.toggle('active');
    });

    // Close nav when clicking a link inside it
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
      });
    });

    // Close nav when clicking outside
    document.addEventListener('click', function (e) {
      if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
      }
    });
  }

  // ─── Toast System ────────────────────────────────────────────────────
  window.showToast = function (message, type, duration) {
    type = type || 'success';
    duration = duration || 4000;

    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    var iconMap = {
      success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };

    toast.innerHTML =
      '<span class="toast-icon">' + (iconMap[type] || iconMap.info) + '</span>' +
      '<span class="toast-message">' + message + '</span>' +
      '<button class="toast-close" aria-label="Close">&times;</button>';

    container.appendChild(toast);

    // Trigger slide-in transition
    setTimeout(function () {
      toast.classList.add('show');
    }, 10);

    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', function () {
      dismissToast(toast);
    });

    // Auto-dismiss
    setTimeout(function () {
      dismissToast(toast);
    }, duration);
  };

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('show');
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // ─── Flash Message Auto-dismiss ──────────────────────────────────────
  var alerts = document.querySelectorAll('.alert');
  if (alerts.length > 0) {
    alerts.forEach(function (alert) {
      setTimeout(function () {
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-10px)';
        alert.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        setTimeout(function () {
          if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
          }
        }, 400);
      }, 5000);
    });
  }

  // ─── Smooth Scroll for Anchor Links ──────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ─── Form Double-Submit Prevention ───────────────────────────────────
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function () {
      var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && !submitBtn.dataset.allowResubmit) {
        var originalText = submitBtn.textContent || submitBtn.value;
        submitBtn.disabled = true;

        if (submitBtn.tagName === 'INPUT') {
          submitBtn.value = 'Processing...';
        } else {
          submitBtn.textContent = 'Processing...';
        }

        // Re-enable after 3 seconds as a safety fallback
        setTimeout(function () {
          submitBtn.disabled = false;
          if (submitBtn.tagName === 'INPUT') {
            submitBtn.value = originalText;
          } else {
            submitBtn.textContent = originalText;
          }
        }, 3000);
      }
    });
  });

  // ─── Credit Chip Count-up Animation ──────────────────────────────────
  document.querySelectorAll('.credit-count').forEach(function (chip) {
    var target = parseInt(chip.textContent, 10);
    if (isNaN(target) || target <= 0) return;

    var current = 0;
    var step = Math.max(1, Math.floor(target / 30));
    var interval = Math.max(20, Math.floor(800 / (target / step)));

    chip.textContent = '0';

    var timer = setInterval(function () {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      chip.textContent = current;
    }, interval);
  });

  // ─── Utility: formatDate ─────────────────────────────────────────────
  window.formatDate = function (dateString) {
    var date = new Date(dateString);
    var now = new Date();
    var diffMs = now - date;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHr = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return diffMin + (diffMin === 1 ? ' minute ago' : ' minutes ago');
    if (diffHr < 24) return diffHr + (diffHr === 1 ? ' hour ago' : ' hours ago');
    if (diffDay < 7) return diffDay + (diffDay === 1 ? ' day ago' : ' days ago');
    if (diffDay < 30) {
      var weeks = Math.floor(diffDay / 7);
      return weeks + (weeks === 1 ? ' week ago' : ' weeks ago');
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // ─── Utility: debounce ───────────────────────────────────────────────
  window.debounce = function (fn, delay) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  };

})();
