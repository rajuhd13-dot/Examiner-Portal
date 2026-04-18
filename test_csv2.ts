import Papa from "papaparse";
import axios from "axios";

const url = 'https://docs.google.com/spreadsheets/d/1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU/export?format=csv&gid=0';

axios.get(url).then(r => {
  const results = Papa.parse(r.data, { header: false, skipEmptyLines: true });
  const rows = results.data;
  const target = rows.find(row => row[9] === '01797969797' || row[9] === '8801797969797' || row[3] === '24153');
  console.log("Found row:", target);
}).catch(e => console.log(e.message));
