import axios from 'axios';
const url = 'https://docs.google.com/spreadsheets/d/1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU/export?format=csv&gid=0';
axios.get(url).then(r => console.log(r.data.substring(0, 100))).catch(e => console.log(e.message));
