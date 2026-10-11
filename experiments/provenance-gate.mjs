// Isolated provenance experiment; NOT integrated into userscript.
// SECURITY LIMIT: authenticated is caller supplied. Never use this flag for real verified claims.
export function evaluateProgress(report, receipt, prior = null) {
  const base = {reported_pct: Number.isFinite(report?.current_pct) ? report.current_pct : null, verified_pct:null, status:'assistant_report_not_primary_receipt'};
  if (!receipt?.authenticated || receipt?.source_type !== 'primary') return base;
  const same = ['process_id','chat_id','objective','denominator','numerator'].every(k => receipt[k] === report?.[k]);
  const n=report?.numerator, d=report?.denominator, p=report?.current_pct;
  if (!same || !Number.isInteger(n) || !Number.isInteger(d) || d<=0 || n<0 || n>d || !Number.isFinite(p) || Math.abs(100*n/d-p)>0.35 || Math.abs(receipt.current_pct-p)>0.35) return {...base,status:'conflicting_receipt'};
  if (!receipt.receipt_id || !Number.isFinite(receipt.timestamp) || !Array.isArray(receipt.verified_hitos) || receipt.verified_hitos.length<n || new Set(receipt.verified_hitos).size<n) return base;
  if (prior && (receipt.timestamp<=prior.timestamp || receipt.receipt_id===prior.receipt_id)) return {...base,status:'stale_receipt'};
  return {...base,verified_pct:p,status:'primary_receipt_verified',receipt_id:receipt.receipt_id};
}
export function displayProgress(evaluation) {
  return evaluation.verified_pct === null ? {verified:'NO VERIFICADO',reported:evaluation.reported_pct,source:evaluation.status} : {verified:evaluation.verified_pct,reported:evaluation.reported_pct,source:evaluation.status};
}
