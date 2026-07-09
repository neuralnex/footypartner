const id = process.argv[2];
if(!id){ console.error('Usage: node scripts/pull_scores_central.js <fixtureId>'); process.exit(2); }
(async()=>{
  try{
    const sres = await fetch(`http://localhost:3000/api/scores/snapshot?fixtureId=${id}`);
    const snap = await sres.json();
    console.log('/api/scores/snapshot/', Array.isArray(snap)?snap.length:JSON.stringify(snap).slice(0,400));
  }catch(e){ console.error('SNAP_ERR', e.message); }
  try{
    const ures = await fetch(`http://localhost:3000/api/scores/updates?fixtureId=${id}`);
    const utext = await ures.text();

    if (utext.trim().startsWith('data:')) {
      const blocks = utext.split('\n\n').map(b=>b.trim()).filter(Boolean);
      const parsed = [];
      for(const b of blocks){
        const dataLines = b.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.replace(/^data:\s*/,'')).join('\n');
        try{ parsed.push(JSON.parse(dataLines)); }catch(e){  }
      }
      console.log('/api/scores/updates/ parsed_events=', parsed.length);
      if(parsed.length>0) console.log('LATEST_PARSED', JSON.stringify(parsed[parsed.length-1]).slice(0,400));
    } else {
      try{
        const ups = JSON.parse(utext);
        console.log('/api/scores/updates/', Array.isArray(ups)?ups.length:JSON.stringify(ups).slice(0,400));
      }catch(e){ console.log('/api/scores/updates text len=', utext.length); }
    }
  }catch(e){ console.error('UPD_ERR', e.message); }
})();
