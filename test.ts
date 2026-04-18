fetch('http://localhost:3000/api/search?q=2509')
  .then(async r => {
    console.log('Status:', r.status);
    console.log('Headers:', r.headers);
    console.log('Body:', await r.text());
  })
  .catch(console.error);
