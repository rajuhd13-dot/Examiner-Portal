import axios from "axios";

const url = 'https://docs.google.com/spreadsheets/d/1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU/pub?output=csv&sheet=Examiner%20Information';

axios.get(url).then(r => {
  console.log("Success! Length:", r.data.length);
  console.log(r.data.substring(0, 200));
}).catch(e => console.log("Error:", e.message));
