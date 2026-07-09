const fs = require('fs');

if (!process.env.SOLANA_MASTER_PRIVATE_KEY) {
  const envPath = process.cwd() + '/.env';
  if (fs.existsSync(envPath)) {
    const txt = fs.readFileSync(envPath,'utf8');
    for (const line of txt.split(/\r?\n/)){
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if(m){ const k=m[1]; let v=m[2]; v=v.replace(/^"|"$/g,''); process.env[k]=v; }
    }
  }
}
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const axios = require('axios');

(async ()=>{
  try{
    const cachePath = process.cwd() + '/.txline-cache.json';
    if(!fs.existsSync(cachePath)){ console.error('No cache file'); process.exit(2); }
    const cache = JSON.parse(fs.readFileSync(cachePath,'utf8'));
    const { cachedJwt, subscribeTxSig } = cache;
    if(!cachedJwt || !subscribeTxSig){ console.error('cache missing jwt or txSig'); process.exit(2); }

    const priv = process.env.SOLANA_MASTER_PRIVATE_KEY;
    if(!priv){ console.error('SOLANA_MASTER_PRIVATE_KEY not set in env'); process.exit(2); }
    let secret;
    if (typeof bs58 === 'function') secret = bs58(priv);
    else if (bs58.decode) secret = bs58.decode(priv);
    else if (bs58.default && bs58.default.decode) secret = bs58.default.decode(priv);
    else throw new Error('bs58 decode not available');
    const messageString = `${subscribeTxSig}::${cachedJwt}`;
    const message = new TextEncoder().encode(messageString);
    const signature = nacl.sign.detached(message, secret);
    const walletSignature = Buffer.from(signature).toString('base64');

    const apiOrigin = process.env.TXLINE_API_ORIGIN || 'https://txline-dev.txodds.com';
    const url = `${apiOrigin}/api/token/activate`;
    console.log('POST', url);
    try{
      const resp = await axios.post(url, { txSig: subscribeTxSig, walletSignature, leagues: [] }, { headers: { Authorization: `Bearer ${cachedJwt}` }, timeout: 15000 });
      console.log('OK', resp.status, resp.data);
    }catch(err){
      if(err.response){
        console.error('ERR_STATUS', err.response.status, 'DATA:', err.response.data);
      }else{
        console.error('ERR', err.message);
      }
    }
  }catch(e){ console.error('MAIN_ERR', e); process.exit(2); }
})();
