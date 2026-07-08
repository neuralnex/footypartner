const id = process.argv[2];
if(!id){ console.error('Usage: node scripts/pull_fixture.js <fixtureId>'); process.exit(2); }
(async()=>{
  try{
    const endpoints = ['snapshot','scores','historical'];
    console.log('FIXTURE', id);
    for(const ep of endpoints){
      try{
        const res = await fetch(`http://localhost:3000/api/fixtures/${id}/${ep}`);
        let text = await res.text();
        // Unwrap JSON-quoted string responses that contain SSE payloads
        const ttrim = text.trim();
        if (ttrim.startsWith('"') || ttrim.startsWith("'")) {
          try {
            const inner = JSON.parse(text);
            if (typeof inner === 'string') text = inner;
          } catch (e) { /* keep original */ }
        }

        // Detect SSE-style responses that include lines like "data: {...}\n"
        if (/^data:\s*\{/m.test(text) || /^event:/m.test(text)) {
          const matches = Array.from(text.matchAll(/^data:\s*(\{[\s\S]*?\})(?:\r?\n|$)/gm)).map(m=>m[1]);
          const parsed = matches.map((t)=>{
            try{ return JSON.parse(t); }catch(e){ return { _raw: t.slice(0,200) }; }
          });
          console.log(ep.toUpperCase(), 'sse_events=', parsed.length, 'latest=', parsed[parsed.length-1] ? JSON.stringify(parsed[parsed.length-1]).slice(0,400) : null);
        } else {
          try{
            const j = JSON.parse(text);
            if(Array.isArray(j)){
              console.log(ep.toUpperCase(), 'count=', j.length);
            } else {
              console.log(ep.toUpperCase(), 'res=', JSON.stringify(j).slice(0,1000));
            }
          }catch(e){
            console.log(ep.toUpperCase(),'raw=', text.slice(0,1000));
          }
        }
      }catch(e){
        console.error('ERR', ep, e.message);
      }
    }
  }catch(e){
    console.error('MAIN_ERR', e.message);
    process.exit(2);
  }
})();
