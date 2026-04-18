fetch('https://script.google.com/macros/s/AKfycbyMd5CujaXSOigr5ayX0z99XLif5-_hvF3TQmWU-IsnVSq4UNaTNwbuSSmPWSgSgLDZpg/exec?q=01797969797')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
