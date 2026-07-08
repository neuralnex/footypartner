(async function(){
  try{
    const epoch = Math.floor(Date.now()/86400000);
    const fixturesRes = await fetch(`http://localhost:3000/api/fixtures?epochDay=${epoch}`);
    const fixtures = await fixturesRes.json();
    const ids = fixtures.slice(0,5).map(f=>f.FixtureId);
    console.log('CHECKING_FIXTURES', ids);
    for(const id of ids){
      try{
        const snapRes = await fetch(`http://localhost:3000/api/fixtures/${id}/snapshot`);
        const snap = await snapRes.json();
        const scoresRes = await fetch(`http://localhost:3000/api/fixtures/${id}/scores`);
        const scores = await scoresRes.json();
        console.log(id, 'snapshot_count', Array.isArray(snap)?snap.length:JSON.stringify(snap).slice(0,200), 'scores_count', Array.isArray(scores)?scores.length:JSON.stringify(scores).slice(0,200));
      }catch(e){
        console.error('ERR for', id, e.message);
      }
    }
  }catch(e){
    console.error('MAIN_ERR', e.message);
    process.exit(2);
  }
})();
