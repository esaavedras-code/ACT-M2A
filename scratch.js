const url = 'https://dtpfhwxwodzpitzmrbqr.supabase.co/rest/v1/projects?select=id,project_num';
const options = {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODQxOTAsImV4cCI6MjA4NzM2MDE5MH0.G1dmMMov9oeTWTR7Tj6JfkWcR6C1e3pDbCD0F7CaJZE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODQxOTAsImV4cCI6MjA4NzM2MDE5MH0.G1dmMMov9oeTWTR7Tj6JfkWcR6C1e3pDbCD0F7CaJZE'
  }
};
fetch(url, options)
  .then(res => res.json())
  .then(data => {
    const p = data.find(x => x.project_num && x.project_num.toLowerCase().includes('ac-017418'));
    if (p) {
      console.log('Found:', p);
      return fetch('https://dtpfhwxwodzpitzmrbqr.supabase.co/rest/v1/chos?project_id=eq.' + p.id + '&select=*', options);
    } else {
      console.log('Not found among ' + data.length + ' projects');
    }
  })
  .then(res => res ? res.json() : null)
  .then(data => {
    if(data) console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error(err));
