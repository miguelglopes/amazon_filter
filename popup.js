// This variable will hold the original, complete list of product divs.
let originalProductDivs = null;

// Run as soon as DOM loads
document.addEventListener('DOMContentLoaded', function () {
  const starRatingSlider = document.getElementById('starRating');
  const starRatingNumber = document.getElementById('starRatingNumber');
  const reviewNumber = document.getElementById('reviewCountNumber');
  const maxPriceNumber = document.getElementById('maxPriceNumber');
  const freeDeliveryOnlyCheckbox = document.getElementById('freeDeliveryOnly');
  const primeOnlyCheckbox = document.getElementById('primeOnly');
  const applyFilterButton = document.getElementById('applyFilter');

  // Retrieve stored filter values and set them as initial values
  chrome.storage.sync.get(
    ['starRating', 'reviewNumber', 'maxPrice', 'freeDelivery', 'prime'],
    function (items) {
      starRatingSlider.value = items.starRating ?? starRatingNumber.value;
      starRatingNumber.value = items.starRating ?? starRatingNumber.value;
      reviewNumber.value = items.reviewNumber ?? reviewNumber.value;
      maxPriceNumber.value = items.maxPrice ?? maxPriceNumber.value;
      freeDeliveryOnlyCheckbox.checked = 
        items.freeDelivery ?? freeDeliveryOnlyCheckbox.checked;
      primeOnlyCheckbox.checked = 
        items.prime ?? primeOnlyCheckbox.checked;
    }
  );

  // Link inputs and save filter values to storage
  starRatingSlider.addEventListener('input', function () {
    starRatingNumber.value = this.value;
    chrome.storage.sync.set({ starRating: this.value });
  });

  starRatingNumber.addEventListener('input', function () {
    starRatingSlider.value = this.value;
    chrome.storage.sync.set({ starRating: this.value });
  });

  reviewNumber.addEventListener('input', function () {
    chrome.storage.sync.set({ reviewNumber: this.value });
  });

  maxPriceNumber.addEventListener('input', function () {
    chrome.storage.sync.set({ maxPrice: this.value });
  });

  freeDeliveryOnlyCheckbox.addEventListener('change', function () {
    chrome.storage.sync.set({ freeDelivery: this.checked });
  });

  primeOnlyCheckbox.addEventListener('change', function () {
    chrome.storage.sync.set({ prime: this.checked });
  });

  // Apply filter when button is clicked
  applyFilterButton.addEventListener('click', function () {
    const ratingThreshold = parseFloat(starRatingSlider.value);
    const reviewThreshold = parseInt(reviewNumber.value);
    const priceThreshold = parseInt(maxPriceNumber.value);
    const freeDeliveryOnly = freeDeliveryOnlyCheckbox.checked;
    const primeOnly = primeOnlyCheckbox.checked;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: applyFilter,
        args: [
          ratingThreshold,
          reviewThreshold,
          priceThreshold,
          freeDeliveryOnly,
          primeOnly,
        ],
      });
    });
  });
});

// Updated applyFilter function
function applyFilter(
  starRatingThreshold,
  reviewNumberThreshold,
  priceThreshold,
  freeDeliveryOnly,
  primeOnly
) {
  // Helper to parse text like "4,6 de 5 estrellas" / "(3.002)"
  function parseStringAsNumber(text) {
    if (!text) return 0;
    // Get only the first block of numeric, comma, and dot characters
    const match = text.match(/[0-9.,]+/);
    if (!match) return 0;

    let cleanedString = match[0];

    // Determine which character appears last: the dot or the comma
    const lastDotIndex = cleanedString.lastIndexOf('.');
    const lastCommaIndex = cleanedString.lastIndexOf(',');

    if (lastDotIndex > lastCommaIndex) {
      // Remove commas
      cleanedString = cleanedString.replace(',', '');
      // If the dot is used as thousands separator
      if (cleanedString.length - lastDotIndex > 3) {
        cleanedString = cleanedString.replace('.', '');
      }
    } else if (lastCommaIndex > lastDotIndex) {
      // Remove dots
      cleanedString = cleanedString.replace('.', '');
      // If the comma is used as thousands separator
      if (cleanedString.length - lastCommaIndex > 3) {
        cleanedString = cleanedString.replace(',', '');
      } else {
        // Use comma as decimal
        cleanedString = cleanedString.replace(',', '.');
      }
    }

    return parseFloat(cleanedString);
  }

  // If we haven't already stored the original product list, do so now:
  if (!window.originalProductDivs) {
    window.originalProductDivs = Array.from(
      document.querySelectorAll('[data-component-type="s-search-result"]')
    );
  }

  // Show them all (reset to visible) before applying filter
  for (const div of window.originalProductDivs) {
    div.style.display = '';
  }

  // Now apply filter logic
  for (let div of window.originalProductDivs) {
    // Identify relevant sub-blocks
    const deliveryDiv = div.querySelector('[data-cy="delivery-recipe"]');
    const priceDiv = div.querySelector('[data-cy="price-recipe"]');
    const starReviewDiv = div.querySelector(
      '.a-section.a-spacing-none.a-spacing-top-micro'
    );

    // Initialize default values
    let starRating = 0;
    let reviewCount = 0;
    let price = 0;
    let prime = false;
    let freeDelivery = false;

    // Extract prime + free delivery info
    if (deliveryDiv) {
      const primeEl = deliveryDiv.querySelector('[aria-label="Amazon Prime"]');
      prime = !!primeEl;

      // In Spanish, the attribute might read "Entrega GRATIS el ... para clientes de Prime"
      const freeDeliveryEl = deliveryDiv.querySelector(
        '[aria-label*="Entrega GRATIS"]'
      );
      freeDelivery = !!freeDeliveryEl;
    }

    // Extract rating & review count
    if (starReviewDiv) {
      // Typically: <i class="a-icon a-icon-star-mini"><span class="a-icon-alt">4,6 de 5 estrellas</span></i>
      const starEl = starReviewDiv.querySelector(
        'i.a-icon-star-mini span.a-icon-alt'
      );
      if (starEl) {
        starRating = parseStringAsNumber(starEl.textContent);
      }

      // Typically: <span class="a-size-small puis-normal-weight-text s-underline-text">(3.002)</span>
      const reviewEl = starReviewDiv.querySelector('span.s-underline-text');
      if (reviewEl) {
        reviewCount = parseStringAsNumber(reviewEl.textContent);
      }
    }

    // Extract price
    if (priceDiv) {
      const priceEl = priceDiv.querySelector('.a-price');
      if (priceEl) {
        price = parseStringAsNumber(priceEl.textContent);
      }
    }

    // Now apply filtering step by step:
    // If any condition fails, hide it (instead of removing).
    if (primeOnly && !prime) {
      div.style.display = 'none';
      continue;
    }
    if (freeDeliveryOnly && !freeDelivery) {
      div.style.display = 'none';
      continue;
    }
    if (starRating < starRatingThreshold) {
      div.style.display = 'none';
      continue;
    }
    if (reviewCount < reviewNumberThreshold) {
      div.style.display = 'none';
      continue;
    }
    if (price > priceThreshold) {
      div.style.display = 'none';
      continue;
    }
  }
}
