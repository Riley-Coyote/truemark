import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getClient } from './client';
import { live } from './runtime';
import '../../brand/gate.css';

export async function verifyEmailLink(client: Pick<ReturnType<typeof getClient>, 'auth'>, token_hash: string | null, type: string | null) {
 if(!token_hash || !['email','signup','recovery'].includes(type??''))throw new Error('Invalid link');
 const {data,error}=await client.auth.verifyOtp({token_hash,type:type as 'email'|'signup'|'recovery'});
 if(error||!data.session)throw new Error('Invalid link');
 return data.session;
}

/** A token hash is verified once, with no browser-local PKCE verifier. */
export default function EmailLink(){
 const location=useLocation();const started=useRef(false);const [state,setState]=useState<'busy'|'confirmed'|'failed'>('busy');
 useEffect(()=>{
  if(started.current)return;started.current=true;
  const params=new URLSearchParams(location.search),token_hash=params.get('token_hash'),type=params.get('type');
  void (async()=>{
   try{
    const session = await verifyEmailLink(getClient(),token_hash,type);
    const url=new URL(window.location.href);const route=new URLSearchParams(location.search);route.delete('token_hash');route.delete('type');
    url.hash=location.pathname+(route.size?'?'+route.toString():'');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    if(type==='recovery')await live().auth.recoverVerifiedSession(session);
    else {await live().auth.signOut();setState('confirmed');}
   }catch{
    const url=new URL(window.location.href);url.hash=location.pathname;history.replaceState(history.state,'',url.pathname+url.search+url.hash);setState('failed');
   }
  })();
 },[location.pathname,location.search]);
 return <div className="tm tm-gate"><main className="tm-gate-panel"><div className="tm-gate-form">
  <h1 className="tm-gate-heading">{state==='confirmed'?'Email confirmed.':state==='failed'?'This link has expired or was already used.':'One moment…'}</h1>
  {state!=='busy'&&<><p className="tm-gate-sub">{state==='confirmed'?"We review every account and write to you once it's approved.":'Request a new link from the sign-in page.'}</p><Link className="tm-gate-link" to="/access">Back to sign in</Link></>}
 </div></main></div>;
}
