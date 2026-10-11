// Experimental signed-source provenance gate. NOT integrated into userscript.
// Trust anchor is a preconfigured public key supplied by the trusted application,
// never from the assistant report or receipt. No key configured => fail closed.
import {createPublicKey, verify as verifySignature} from 'node:crypto';
const fields=['process_id','chat_id','objective','numerator','denominator','current_pct','receipt_id','timestamp','verified_hitos'];
export function canonicalReceipt(receipt) {
  return JSON.stringify(Object.fromEntries(fields.map(k=>[k,receipt?.[k]])));
}
export function evaluateProgress(report, receipt, prior=null, trustedPublicKeyPem=null) {
  const base={reported_pct:Number.isFinite(report?.current_pct)?report.current_pct:null,verified_pct:null,status:'assistant_report_not_primary_receipt'};
  if (!trustedPublicKeyPem || !receipt || typeof receipt.signature!=='string') return base;
  let signatureValid=false;
  try {
    const key=createPublicKey(trustedPublicKeyPem);
    signatureValid=key.asymmetricKeyType==='ed25519' && verifySignature(null,Buffer.from(canonicalReceipt(receipt)),key,Buffer.from(receipt.signature,'base64'));
  } catch { return base; }
  if (!signatureValid) return {...base,status:'invalid_signature'};
  const same=['process_id','chat_id','objective','numerator','denominator'].every(k=>receipt[k]===report?.[k]);
  const n=report?.numerator,d=report?.denominator,p=report?.current_pct;
  if (!same || !Number.isInteger(n)||!Number.isInteger(d)||d<=0||n<0||n>d||!Number.isFinite(p)||Math.abs(100*n/d-p)>0.35||Math.abs(receipt.current_pct-p)>0.35) return {...base,status:'conflicting_receipt'};
  if (!receipt.receipt_id||!Number.isSafeInteger(receipt.timestamp)||!Array.isArray(receipt.verified_hitos)||receipt.verified_hitos.length<n||new Set(receipt.verified_hitos).size!==receipt.verified_hitos.length) return base;
  if (prior && (receipt.timestamp<=prior.timestamp||receipt.receipt_id===prior.receipt_id)) return {...base,status:'stale_receipt'};
  return {...base,verified_pct:p,status:'signed_receipt_verified',receipt_id:receipt.receipt_id};
}
export function displayProgress(evaluation) {
  return evaluation.verified_pct===null?{verified:'NO VERIFICADO',reported:evaluation.reported_pct,source:evaluation.status}:{verified:evaluation.verified_pct,reported:evaluation.reported_pct,source:evaluation.status};
}
