document.addEventListener('DOMContentLoaded', function () {
  const starRatingSlider = document.getElementById('starRating');
  const starRatingNumber = document.getElementById('starRatingNumber');
  const reviewNumber = document.getElementById('reviewCountNumber')
  const maxPriceNumber = document.getElementById('maxPriceNumber')
  const freeDeliveryOnlyCheckbox = document.getElementById('freeDeliveryOnly');
  const primeOnlyCheckbox = document.getElementById('primeOnly');
  const applyFilterButton = document.getElementById('applyFilter');

  // Retrieve stored filter values and set them as initial values
  chrome.storage.sync.get(['starRating', 'reviewNumber', 'maxPrice', 'freeDelivery', 'prime'], function (items) {
    starRatingSlider.value = items.starRating || starRatingNumber.value;
    starRatingNumber.value = items.starRating || starRatingNumber.value;
    reviewNumber.value = items.reviewNumber || reviewNumber.value;
    maxPriceNumber.value = items.maxPrice || maxPriceNumber.value;
    freeDeliveryOnlyCheckbox.checked = items.freeDelivery || freeDeliveryOnlyCheckbox.checked;
    primeOnlyCheckbox.checked = items.prime || primeOnlyCheckbox.checked;
  });

  // link inputs and save filter values to storage
  starRatingSlider.addEventListener('input', function () {
    starRatingNumber.value = this.value;
    chrome.storage.sync.set({ 'starRating': this.value });
  });
  starRatingNumber.addEventListener('input', function () {
    starRatingSlider.value = this.value;
    chrome.storage.sync.set({ 'starRating': this.value });
  });
  reviewNumber.addEventListener('input', function () {
    chrome.storage.sync.set({ 'reviewNumber': this.value });
  });
  maxPriceNumber.addEventListener('input', function () {
    chrome.storage.sync.set({ 'maxPrice': this.value });
  });
  freeDeliveryOnlyCheckbox.addEventListener('change', function () {
    chrome.storage.sync.set({ 'freeDelivery': this.checked });
  });
  primeOnlyCheckbox.addEventListener('change', function () {
    chrome.storage.sync.set({ 'prime': this.checked });
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
        args: [ratingThreshold, reviewThreshold, priceThreshold, freeDeliveryOnly, primeOnly]
      });
    });
  });
});


function applyFilter(starRatingThreshold, reviewNumberThreshold, priceThreshold, freeDeliveryOnly, primeOnly) {


  function parseStringAsNumber(text) {
    // get only the first block of numeric, comma and dot characters
    let cleanedString = text.match(/[0-9.,]+/)[0];

    // Determine which character appears last: the dot or the comma
    // Keep only the character that appears last, and only if it has at most 2 characters to the right.
    // If it's comma, replace with dot.
    const lastDotIndex = cleanedString.lastIndexOf('.');
    const lastCommaIndex = cleanedString.lastIndexOf(',');
    if (lastDotIndex > lastCommaIndex) {
      cleanedString = cleanedString.replace(',', '');
      if (cleanedString.length - lastDotIndex > 3) {
        cleanedString = cleanedString.replace('.', '');
      }
    } else if (lastCommaIndex > lastDotIndex) {
      cleanedString = cleanedString.replace('.', '');
      if (cleanedString.length - lastCommaIndex > 3) {
        cleanedString = cleanedString.replace(',', '');
      } else {
        cleanedString = cleanedString.replace(',', '.');
      }
    }

    // Parse as float and return the result
    return parseFloat(cleanedString);
  }

  const divs = document.querySelectorAll('[data-component-type="s-search-result"]');
  for (let div of divs) {

    // define relevant parent divs
    const deliveryDiv = div.querySelector('[data-cy="delivery-recipe"]')
    const priceDiv = div.querySelector('[data-cy="price-recipe"]')
    const starReviewDiv = div.querySelector('.a-section.a-spacing-none.a-spacing-top-micro')


    // set values
    let starRating = 0;
    let reviewNumber = 0;
    let price = 0;
    let prime;
    let freeDelivery;
    if (deliveryDiv) {
      prime = deliveryDiv.querySelector('[aria-label="Amazon Prime"]');
      freeDelivery = deliveryDiv.querySelector('[aria-label^="Entrega GRATIS"]');
    }
    try {
      if (starReviewDiv) {
        starRating = parseStringAsNumber(starReviewDiv.querySelector('[aria-label$="estrellas"]').textContent);
        reviewNumber = parseStringAsNumber(starReviewDiv.querySelector('span.a-size-base.s-underline-text').textContent);
      }
      if (priceDiv) {
        price = parseStringAsNumber(priceDiv.querySelector('.a-price').textContent);
      }
    } catch {
      div.remove();
      continue;
    }

    // filter values
    if (!prime && primeOnly) {
      div.remove();
    }
    else if (!freeDelivery && freeDeliveryOnly) {
      div.remove();
    }
    else if (starRating < starRatingThreshold) {
      div.remove();
    }
    else if (reviewNumber < reviewNumberThreshold) {
      div.remove();
    }
    else if (price > priceThreshold) {
      div.remove();
    }
  };
}