fetch('https://script.google.com/macros/s/AKfycby1XEBoEshSpMdQNGwOCcyZdDgANiUMWuLgJfiNnmdlQOV2BSRxAqOrm0J-7vj6cDCH/exec?q=01797969797')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
